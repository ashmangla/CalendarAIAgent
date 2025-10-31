const VoiceAdapter = require('./VoiceAdapter');
const { OpenAI } = require('openai');

class OpenAIVoiceAdapter extends VoiceAdapter {
  constructor() {
    super();
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for OpenAI adapter');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async parseIntent(transcript, context = {}) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a calendar assistant that understands voice commands. Extract the user's intent and event details from their speech.

Return a JSON object with this exact structure:
{
  "intent": "add_event|query_calendar|cancel_event",
  "eventDetails": {
    "title": "Event title",
    "date": "YYYY-MM-DD or relative date like 'tomorrow', 'next Tuesday'",
    "time": "HH:MM in 24-hour format or natural time like '2pm', '10:30am'",
    "duration": "duration in minutes (default: 60)",
    "location": "location if mentioned"
  },
  "confidence": 0.0-1.0
}

Current date: ${context.currentDate || new Date().toISOString().split('T')[0]}

Important:
- Convert relative dates (tomorrow, next week, etc.) to specific dates
- Convert natural time (2pm, 10:30am) to 24-hour format
- If date/time is ambiguous, use reasonable defaults
- Extract event type from title if clear`
          },
          {
            role: "user",
            content: transcript
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const responseContent = completion.choices[0].message.content;
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Invalid JSON response from OpenAI');
    } catch (error) {
      console.error('OpenAI parseIntent error:', error);
      throw new Error(`Failed to parse intent: ${error.message}`);
    }
  }

  async extractEventDetails(transcript) {
    const intent = await this.parseIntent(transcript);
    return intent.eventDetails;
  }

  async generateResponse(responseData) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a friendly calendar assistant. Generate natural, conversational responses. Keep responses concise (1-2 sentences max) and friendly.`
          },
          {
            role: "user",
            content: `Generate a voice response for: ${JSON.stringify(responseData)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI generateResponse error:', error);
      // Fallback response
      return this._generateFallbackResponse(responseData);
    }
  }

  async suggestAlternateTimes(conflictData, calendarAvailability) {
    try {
      const conflictInfo = `
Conflicting event: ${conflictData.conflictingEvent?.title || 'Unknown'}
Conflict time: ${conflictData.requestedTime}
Event duration: ${conflictData.duration || 60} minutes
`;

      const availableSlots = calendarAvailability
        .map(slot => `${slot.time} (${slot.date})`)
        .join(', ');

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a calendar assistant. Given conflict information and available time slots, suggest the best 3 alternative times.

Return a JSON array of objects:
[
  {
    "time": "HH:MM",
    "date": "YYYY-MM-DD",
    "reason": "brief reason why this is a good alternative"
  }
]

Prioritize:
1. Times closest to requested time
2. Same day if possible
3. Morning slots if requested time was morning
4. Afternoon slots if requested time was afternoon`
          },
          {
            role: "user",
            content: `${conflictInfo}\n\nAvailable slots: ${availableSlots}`
          }
        ],
        temperature: 0.5,
        max_tokens: 300
      });

      const responseContent = completion.choices[0].message.content;
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to first 3 available slots
      return calendarAvailability.slice(0, 3).map(slot => ({
        time: slot.time,
        date: slot.date,
        reason: 'Available time slot'
      }));
    } catch (error) {
      console.error('OpenAI suggestAlternateTimes error:', error);
      // Fallback to available slots
      return calendarAvailability.slice(0, 3).map(slot => ({
        time: slot.time,
        date: slot.date,
        reason: 'Available time slot'
      }));
    }
  }

  async generateConflictResponse(conflictInfo, alternatives) {
    try {
      const alternativesText = alternatives
        .map((alt, idx) => `${idx + 1}. ${alt.time} on ${new Date(alt.date).toLocaleDateString()}`)
        .join(', ');

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a friendly calendar assistant. Generate a natural voice response for a scheduling conflict.

Include:
1. Mention the conflict briefly
2. List the alternative times
3. Always mention the option to double book if they prefer
4. Keep it conversational and friendly
5. Maximum 2 sentences`
          },
          {
            role: "user",
            content: `Generate a conflict response. Conflict: ${conflictInfo.conflictingEvent?.title || 'Another event'} at ${conflictInfo.requestedTime}. Alternatives: ${alternativesText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI generateConflictResponse error:', error);
      return this._generateFallbackConflictResponse(conflictInfo, alternatives);
    }
  }

  _generateFallbackResponse(responseData) {
    if (responseData.type === 'success') {
      return `Perfect! I've scheduled ${responseData.eventTitle} for ${responseData.date} at ${responseData.time}.`;
    } else if (responseData.type === 'error') {
      return `I'm sorry, I couldn't schedule that. ${responseData.message || 'Please try again.'}`;
    }
    return 'Got it!';
  }

  _generateFallbackConflictResponse(conflictInfo, alternatives) {
    const altText = alternatives
      .slice(0, 3)
      .map(alt => `${alt.time}`)
      .join(', ');

    return `I found a conflict with ${conflictInfo.conflictingEvent?.title || 'another event'} at ${conflictInfo.requestedTime}. I can schedule it at ${altText}, or you can choose to double book if you prefer. What would you like?`;
  }
}

module.exports = OpenAIVoiceAdapter;


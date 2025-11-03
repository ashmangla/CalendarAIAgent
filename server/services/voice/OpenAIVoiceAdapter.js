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
      const conversationHistory = context.conversationHistory || [];
      const currentDate = context.currentDate || new Date().toISOString().split('T')[0];
      const followUpCount = context.followUpCount || 0;
      const maxFollowUps = 5;

      // Build conversation messages
      const messages = [
        {
          role: "system",
          content: `You are a calendar assistant that understands voice commands. Your job is to determine if the user wants to ADD or DELETE a calendar event, ADD TO WISHLIST (things they want to do someday), and extract all necessary details.

IMPORTANT RULES:
1. Determine intent: "add_event", "delete_event", "add_to_wishlist", or "needs_clarification"
2. Use "add_to_wishlist" when user says things like:
   - "I want to...", "I'd like to...", "Someday I want to...", "I wish I could...", "I'm interested in..."
   - "I want to visit the museum someday"
   - "I'd like to try that new restaurant"
   - Items without specific date/time (unless they explicitly want it scheduled now)
2. If intent is "needs_clarification", you MUST ask ONE specific follow-up question to get missing information
3. Only ask about ONE missing piece of information at a time (prioritize: date, then time, then title/event identification)
4. Be concise and friendly in follow-up questions (max 1 sentence)
5. Return JSON in the exact structure shown below

Return a JSON object with this exact structure:
{
  "intent": "add_event|delete_event|add_to_wishlist|needs_clarification",
  "eventDetails": {
    "title": "Event title (or null if unknown)",
    "date": "YYYY-MM-DD format (or null if unknown)",
    "time": "HH:MM in 24-hour format (or null if unknown)",
    "duration": "duration in minutes (default: 60)",
    "location": "location if mentioned (or null)"
  },
  "followUpQuestion": "Specific question to ask user if needs_clarification (null otherwise)",
  "missingInfo": ["date", "time", "title"],
  "confidence": 0.0-1.0,
  "readyToProcess": true
}

Current date: ${currentDate}
Follow-up question count: ${followUpCount}/${maxFollowUps}

Guidelines:
- Convert relative dates (tomorrow, next week, etc.) to specific dates in YYYY-MM-DD format
- Convert natural time (2pm, 10:30am) to 24-hour format (HH:MM)
- For DELETE intent: must identify which event (by title, date, time, or combination)
- If user says something unclear, set intent to "needs_clarification" and ask ONE specific question
- Be confident in your parsing - only use "needs_clarification" if truly unclear`
        }
      ];

      // Add conversation history
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // Add current transcript
      messages.push({
        role: "user",
        content: transcript
      });

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: 0.3,
        max_tokens: 500
      });

      const responseContent = completion.choices[0].message.content;
      
      try {
        // Try to parse JSON (might be wrapped in markdown or have extra text)
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseContent);

        // Validate response structure
        if (!parsed.intent) {
          throw new Error('Missing intent in response');
        }

        // If needs clarification and we haven't exceeded max follow-ups
        if (parsed.intent === 'needs_clarification' && followUpCount < maxFollowUps) {
          return {
            intent: 'needs_clarification',
            eventDetails: parsed.eventDetails || {},
            followUpQuestion: parsed.followUpQuestion || 'Could you provide more details?',
            missingInfo: parsed.missingInfo || [],
            confidence: parsed.confidence || 0.5,
            readyToProcess: false,
            conversationHistory: [
              ...conversationHistory,
              { role: 'user', content: transcript },
              { role: 'assistant', content: parsed.followUpQuestion || '' }
            ]
          };
        }

        // If still unclear after max follow-ups
        if (parsed.intent === 'needs_clarification' && followUpCount >= maxFollowUps) {
          return {
            intent: 'needs_clarification',
            eventDetails: parsed.eventDetails || {},
            followUpQuestion: null,
            missingInfo: parsed.missingInfo || [],
            confidence: 0,
            readyToProcess: false,
            abort: true,
            abortMessage: "I'm having trouble understanding. Please add or delete events manually."
          };
        }

        // Valid intent (add_event or delete_event)
        return {
          intent: parsed.intent,
          eventDetails: parsed.eventDetails || {},
          followUpQuestion: null,
          missingInfo: [],
          confidence: parsed.confidence || 0.8,
          readyToProcess: true
        };
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Invalid JSON response from OpenAI');
      }
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
    } else if (responseData.type === 'wishlist_added') {
      if (responseData.hasDateTime) {
        return `Added "${responseData.itemTitle}" to your wishlist. It's scheduled for the time you specified, and I'll suggest it if that time frees up!`;
      }
      return `Added "${responseData.itemTitle}" to your wishlist! I'll suggest it when you have free time.`;
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

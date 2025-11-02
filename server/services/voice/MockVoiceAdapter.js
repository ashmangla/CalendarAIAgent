const VoiceAdapter = require('./VoiceAdapter');

/**
 * Mock Voice Adapter - Simple fallback when OpenAI is not available
 * This is a minimal implementation since LLM handles all parsing when available
 */
class MockVoiceAdapter extends VoiceAdapter {
  constructor() {
    super();
  }

  async parseIntent(transcript, context = {}) {
    // Minimal mock parsing - just return a basic response
    // In production, OpenAI adapter should be used for proper parsing
    const lowerTranscript = transcript.toLowerCase();
    
    // Very basic intent detection
    let intent = 'needs_clarification';
    if (lowerTranscript.includes('delete') || lowerTranscript.includes('remove') || lowerTranscript.includes('cancel')) {
      intent = 'delete_event';
    } else if (lowerTranscript.includes('add') || lowerTranscript.includes('schedule') || lowerTranscript.includes('create')) {
      intent = 'add_event';
    }

    // Basic event details (most will be null - LLM should handle parsing)
    const eventDetails = {
      title: null,
      date: null,
      time: null,
      duration: 60,
      location: null
    };

    // Return needs_clarification to prompt user to use OpenAI adapter
    return {
      intent: 'needs_clarification',
      eventDetails: eventDetails,
      followUpQuestion: 'I need more information. Could you provide the event title, date, and time?',
      missingInfo: ['title', 'date', 'time'],
      confidence: 0.3,
      readyToProcess: false,
      conversationHistory: context.conversationHistory || []
    };
  }

  async extractEventDetails(transcript) {
    // Minimal implementation - LLM handles parsing when available
    return {
      title: null,
      date: null,
      time: null,
      duration: 60,
      location: null
    };
  }

  async generateResponse(responseData) {
    if (responseData.type === 'success') {
      return `Perfect! I've scheduled ${responseData.eventTitle} for ${responseData.date} at ${responseData.time}.`;
    } else if (responseData.type === 'error') {
      return `I'm sorry, I couldn't schedule that. ${responseData.message || 'Please try again.'}`;
    } else if (responseData.type === 'conflict') {
      return this.generateConflictResponse(responseData.conflictInfo, responseData.alternatives);
    }
    return 'Got it!';
  }

  async suggestAlternateTimes(conflictData, calendarAvailability) {
    // Simple logic: return first 3 available slots
    return calendarAvailability.slice(0, 3).map(slot => ({
      time: slot.time,
      date: slot.date,
      reason: 'Available time slot'
    }));
  }

  async generateConflictResponse(conflictInfo, alternatives) {
    const conflictTitle = conflictInfo.conflictingEvent?.title || 'another event';
    const requestedTime = conflictInfo.requestedTime || 'that time';
    
    const altTimes = alternatives.slice(0, 3).map(alt => {
      const date = new Date(alt.date);
      const timeStr = alt.time;
      return `${timeStr} on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }).join(', ');

    return `I found a conflict with ${conflictTitle} at ${requestedTime}. I can schedule it at ${altTimes}, or you can choose to double book if you prefer. What would you like?`;
  }

  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  _getNextDayOfWeek(dayIndex, fromDate) {
    const date = new Date(fromDate);
    const currentDay = date.getDay();
    const daysUntil = (dayIndex - currentDay + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntil);
    return date;
  }
}

module.exports = MockVoiceAdapter;


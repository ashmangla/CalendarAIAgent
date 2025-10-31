const VoiceAdapter = require('./VoiceAdapter');

class MockVoiceAdapter extends VoiceAdapter {
  constructor() {
    super();
    // Simple patterns for testing
    this.intentPatterns = {
      add: /(?:add|schedule|create|book|set up).*?(?:appointment|meeting|event)/i,
      query: /(?:what|when|show|list|get).*(?:appointment|meeting|event|calendar)/i,
      cancel: /(?:cancel|remove|delete).*(?:appointment|meeting|event)/i
    };

    this.datePatterns = {
      today: /today/i,
      tomorrow: /tomorrow/i,
      monday: /monday|mon\b/i,
      tuesday: /tuesday|tues\b/i,
      wednesday: /wednesday|wed\b/i,
      thursday: /thursday|thurs\b/i,
      friday: /friday|fri\b/i,
      saturday: /saturday|sat\b/i,
      sunday: /sunday|sun\b/i
    };

    this.timePatterns = {
      hour: /(\d{1,2})\s*(?:am|pm|:|o'clock)/i,
      hourMinute: /(\d{1,2}):(\d{2})\s*(am|pm)?/i
    };
  }

  async parseIntent(transcript, context = {}) {
    // Simple rule-based parsing
    const lowerTranscript = transcript.toLowerCase();

    let intent = 'add_event';
    for (const [intentName, pattern] of Object.entries(this.intentPatterns)) {
      if (pattern.test(lowerTranscript)) {
        intent = intentName === 'add' ? 'add_event' : 
                 intentName === 'query' ? 'query_calendar' : 'cancel_event';
        break;
      }
    }

    // Extract event details
    const eventDetails = await this.extractEventDetails(transcript);

    return {
      intent,
      eventDetails,
      confidence: 0.7 // Mock confidence
    };
  }

  async extractEventDetails(transcript) {
    const details = {
      title: '',
      date: null,
      time: null,
      duration: 60, // default 1 hour
      location: null
    };

    // Extract title (between "add" and date/time keywords)
    // Simple pattern: match everything after "add [a/an/the]" until we hit date/time keywords
    const titlePattern = /add\s+(?:a|an|the)?\s*(.+?)(?:\s+(?:for|on|at|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\s+\d)/i;
    const titleMatch = transcript.match(titlePattern);
    if (titleMatch) {
      details.title = titleMatch[1].trim();
    }

    // Extract date
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (this.datePatterns.today.test(transcript)) {
      details.date = this._formatDate(currentDate);
    } else if (this.datePatterns.tomorrow.test(transcript)) {
      const tomorrow = new Date(currentDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      details.date = this._formatDate(tomorrow);
    } else {
      // Try to find day of week
      for (const [day, pattern] of Object.entries(this.datePatterns)) {
        if (day !== 'today' && day !== 'tomorrow' && pattern.test(transcript)) {
          const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day);
          const nextDay = this._getNextDayOfWeek(dayIndex, currentDate);
          details.date = this._formatDate(nextDay);
          break;
        }
      }
    }

    // Default to today if no date found
    if (!details.date) {
      details.date = this._formatDate(currentDate);
    }

    // Extract time
    const timeMatch24 = transcript.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    const timeMatch12 = transcript.match(/(\d{1,2})\s*(am|pm)/i);

    if (timeMatch24) {
      let hours = parseInt(timeMatch24[1]);
      const minutes = parseInt(timeMatch24[2]);
      const period = timeMatch24[3]?.toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      details.time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else if (timeMatch12) {
      let hours = parseInt(timeMatch12[1]);
      const period = timeMatch12[2]?.toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      details.time = `${hours.toString().padStart(2, '0')}:00`;
    } else {
      // Default to current time + 1 hour
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      details.time = `${defaultTime.getHours().toString().padStart(2, '0')}:${defaultTime.getMinutes().toString().padStart(2, '0')}`;
    }

    // Extract duration (basic)
    const durationMatch = transcript.match(/(\d+)\s*(?:minute|min|hour|hr)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      if (durationMatch[0].includes('hour') || durationMatch[0].includes('hr')) {
        details.duration = value * 60;
      } else {
        details.duration = value;
      }
    }

    return details;
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


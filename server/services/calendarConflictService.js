/**
 * Service for detecting calendar conflicts and finding available time slots
 */
class CalendarConflictService {
  /**
   * Check if a new event conflicts with existing events
   * @param {Object} newEvent - Event to check { date, time, duration }
   * @param {Array} existingEvents - Array of existing calendar events
   * @returns {Object} Conflict detection result
   */
  checkConflict(newEvent, existingEvents) {
    const newEventStart = this._parseDateTime(newEvent.date, newEvent.time);
    const newEventEnd = new Date(newEventStart.getTime() + (newEvent.duration || 60) * 60000);

    const conflicts = [];

    for (const existingEvent of existingEvents) {
      const existingStart = this._parseDateTime(existingEvent.date, existingEvent.time);
      const existingEnd = existingStart.getTime() + (existingEvent.duration || 60) * 60000;

      // Check if events overlap
      if (newEventStart < existingEnd && newEventEnd > existingStart) {
        conflicts.push({
          event: existingEvent,
          conflictType: this._getConflictType(newEventStart, newEventEnd, existingStart, existingEnd)
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts,
      conflictingEvent: conflicts.length > 0 ? conflicts[0].event : null
    };
  }

  /**
   * Find available time slots in a calendar
   * @param {Date} targetDate - Date to find slots for
   * @param {number} duration - Duration in minutes
   * @param {Array} existingEvents - Existing events for that day
   * @param {Object} options - Options { startHour, endHour, buffer }
   * @returns {Array} Array of available time slots
   */
  findAvailableSlots(targetDate, duration, existingEvents, options = {}) {
    const {
      startHour = 9,
      endHour = 17,
      buffer = 15 // buffer between events in minutes
    } = options;

    const slots = [];
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Get existing events for this day
    const dayEvents = existingEvents.filter(e => 
      e.date === dateStr || 
      new Date(e.date).toDateString() === targetDate.toDateString()
    ).sort((a, b) => {
      const timeA = this._parseTime(a.time);
      const timeB = this._parseTime(b.time);
      return timeA - timeB;
    });

    // Generate potential slots
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotStart = this._parseDateTime(dateStr, slotTime);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        // Check if slot conflicts with existing events
        const hasConflict = dayEvents.some(event => {
          const eventStart = this._parseDateTime(event.date || dateStr, event.time);
          const eventEnd = new Date(eventStart.getTime() + (event.duration || 60) * 60000);
          
          return slotStart < eventEnd && slotEnd > eventStart;
        });

        if (!hasConflict && slotEnd.getHours() <= endHour) {
          slots.push({
            time: slotTime,
            date: dateStr,
            available: true
          });
        }
      }
    }

    // Filter slots that are in the past or too close together
    const now = new Date();
    return slots.filter(slot => {
      const slotDateTime = this._parseDateTime(slot.date, slot.time);
      return slotDateTime > now && 
             slotDateTime.getTime() > (now.getTime() + buffer * 60000);
    }).slice(0, 10); // Return top 10 available slots
  }

  /**
   * Get alternative time suggestions
   * @param {Object} requestedEvent - The requested event
   * @param {Array} existingEvents - Existing calendar events
   * @param {number} numSuggestions - Number of suggestions to generate (default: 3)
   * @returns {Array} Array of alternative time suggestions
   */
  getAlternativeSuggestions(requestedEvent, existingEvents, numSuggestions = 3) {
    const requestedDate = this._parseDate(requestedEvent.date);
    const duration = requestedEvent.duration || 60;
    
    // Try same day first
    let slots = this.findAvailableSlots(requestedDate, duration, existingEvents);
    
    // If not enough slots, try next day
    if (slots.length < numSuggestions) {
      const nextDay = new Date(requestedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDaySlots = this.findAvailableSlots(nextDay, duration, existingEvents);
      slots = [...slots, ...nextDaySlots];
    }

    // If still not enough, try day after
    if (slots.length < numSuggestions) {
      const dayAfter = new Date(requestedDate);
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterSlots = this.findAvailableSlots(dayAfter, duration, existingEvents);
      slots = [...slots, ...dayAfterSlots];
    }

    return slots.slice(0, numSuggestions).map(slot => ({
      time: slot.time,
      date: slot.date,
      formattedTime: this._formatTimeForDisplay(slot.time),
      formattedDate: this._formatDateForDisplay(slot.date)
    }));
  }

  _parseDateTime(dateStr, timeStr) {
    const date = this._parseDate(dateStr);
    const time = this._parseTime(timeStr);
    
    const dateTime = new Date(date);
    dateTime.setHours(Math.floor(time / 60));
    dateTime.setMinutes(time % 60);
    dateTime.setSeconds(0);
    dateTime.setMilliseconds(0);
    
    return dateTime;
  }

  _parseDate(dateStr) {
    return new Date(dateStr + 'T00:00:00');
  }

  _parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  _getConflictType(newStart, newEnd, existingStart, existingEnd) {
    if (newStart >= existingStart && newEnd <= existingEnd) {
      return 'contained'; // New event completely within existing
    } else if (existingStart >= newStart && existingEnd <= newEnd) {
      return 'contains'; // New event completely contains existing
    } else {
      return 'overlaps'; // Partial overlap
    }
  }

  _formatTimeForDisplay(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  _formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

module.exports = new CalendarConflictService();


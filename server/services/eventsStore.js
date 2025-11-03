/**
 * Shared events store for managing calendar events
 * This allows routes to add events that will be available to the calendar
 */
class EventsStore {
  constructor() {
    this.events = [];
  }

  /**
   * Initialize with existing events array (by reference)
   * @param {Array} eventsArray - Reference to the events array
   */
  initialize(eventsArray) {
    this.events = eventsArray;
  }

  /**
   * Add a new event to the store
   * @param {Object} event - Event object to add
   */
  addEvent(event) {
    // Ensure event has required fields
    if (!event.id) {
      // Generate ID if not provided
      const maxId = this.events.length > 0 
        ? Math.max(...this.events.map(e => {
            const numId = parseInt(e.id);
            return isNaN(numId) ? 0 : numId;
          }))
        : 0;
      event.id = (maxId + 1).toString();
    }
    
    this.events.push(event);
    console.log(`✅ Added event to calendar: ${event.title} (ID: ${event.id})`);
    return event;
  }

  /**
   * Get all events
   */
  getEvents() {
    return this.events;
  }

  /**
   * Find event by ID
   */
  findEventById(id) {
    return this.events.find(e => e.id === id || e.eventId === id);
  }

  /**
   * Update an existing event
   * @param {string} eventId - Event ID to update
   * @param {Object} updates - Properties to update
   */
  updateEvent(eventId, updates) {
    const index = this.events.findIndex(e => e.id === eventId || e.eventId === eventId);
    if (index !== -1) {
      this.events[index] = { ...this.events[index], ...updates };
      return this.events[index];
    }
    return null;
  }

  /**
   * Delete an event from the store
   * @param {string} eventId - Event ID to delete
   */
  deleteEvent(eventId) {
    const index = this.events.findIndex(e => e.id === eventId || e.eventId === eventId);
    if (index !== -1) {
      const deleted = this.events.splice(index, 1)[0];
      console.log(`🗑️ Deleted event from store: ${deleted.title} (ID: ${eventId})`);
      return deleted;
    }
    return null;
  }
}

module.exports = new EventsStore();


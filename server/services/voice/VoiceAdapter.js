/**
 * Abstract Voice Adapter Interface
 * All voice adapters must implement these methods
 */
class VoiceAdapter {
  /**
   * Parse user voice input to extract intent and event details
   * @param {string} transcript - The transcribed user speech
   * @param {Object} context - Additional context (current date, user preferences, etc.)
   * @returns {Promise<Object>} Parsed intent with event details
   */
  async parseIntent(transcript, context = {}) {
    throw new Error('parseIntent() must be implemented by subclass');
  }

  /**
   * Extract event details from natural language
   * @param {string} transcript - The transcribed user speech
   * @returns {Promise<Object>} Extracted event details
   */
  async extractEventDetails(transcript) {
    throw new Error('extractEventDetails() must be implemented by subclass');
  }

  /**
   * Generate a natural language response
   * @param {Object} responseData - Data to include in response
   * @returns {Promise<string>} Natural language response text
   */
  async generateResponse(responseData) {
    throw new Error('generateResponse() must be implemented by subclass');
  }

  /**
   * Suggest alternate times when a conflict is detected
   * @param {Object} conflictData - Conflict information
   * @param {Array} calendarAvailability - Available time slots
   * @returns {Promise<Array>} Array of suggested alternative times
   */
  async suggestAlternateTimes(conflictData, calendarAvailability) {
    throw new Error('suggestAlternateTimes() must be implemented by subclass');
  }

  /**
   * Generate conflict response message with alternatives and override option
   * @param {Object} conflictInfo - Information about the conflict
   * @param {Array} alternatives - Array of alternative time suggestions
   * @returns {Promise<string>} Natural language conflict response
   */
  async generateConflictResponse(conflictInfo, alternatives) {
    throw new Error('generateConflictResponse() must be implemented by subclass');
  }

  /**
   * Validate extracted event details
   * @param {Object} eventDetails - Extracted event details
   * @returns {Object} Validation result with isValid flag and errors
   */
  validateEventDetails(eventDetails) {
    const errors = [];
    
    if (!eventDetails.title) {
      errors.push('Event title is required');
    }
    
    if (!eventDetails.date) {
      errors.push('Event date is required');
    }
    
    if (!eventDetails.time) {
      errors.push('Event time is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = VoiceAdapter;


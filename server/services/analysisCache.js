/**
 * Service for caching event analyses until the event date passes
 */
class AnalysisCache {
  constructor() {
    // In-memory cache: { eventId: { analysis, eventDate, createdAt } }
    this.cache = new Map();
    
    // Metadata store: { eventId: { isAnalyzed: true, analyzedAt: Date, eventId: string } }
    this.metadata = new Map();
    
    // Clean up expired entries every hour
    setInterval(() => {
      this.cleanExpired();
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Store analysis for an event
   * @param {string} eventId - Event identifier
   * @param {Object} analysis - Analysis data
   * @param {string|Date} eventDate - Event date
   */
  set(eventId, analysis, eventDate) {
    const expirationDate = this.getExpirationDate(eventDate);
    
    this.cache.set(eventId, {
      analysis,
      eventDate: new Date(eventDate),
      expirationDate,
      createdAt: new Date()
    });
    
    // Mark event as analyzed in metadata
    this.metadata.set(eventId, {
      isAnalyzed: true,
      analyzedAt: new Date(),
      eventId: eventId,
      expirationDate: expirationDate
    });
  }

  /**
   * Get cached analysis if available and not expired
   * @param {string} eventId - Event identifier
   * @returns {Object|null} Cached analysis or null
   */
  get(eventId) {
    const cached = this.cache.get(eventId);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (new Date() > cached.expirationDate) {
      this.cache.delete(eventId);
      return null;
    }

    return cached.analysis;
  }

  /**
   * Check if event has cached analysis
   * @param {string} eventId - Event identifier
   * @returns {boolean}
   */
  has(eventId) {
    const cached = this.cache.get(eventId);
    
    if (!cached) {
      return false;
    }

    // Check if expired
    if (new Date() > cached.expirationDate) {
      this.cache.delete(eventId);
      this.metadata.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * Check if event has been analyzed (checks metadata)
   * @param {string} eventId - Event identifier
   * @returns {boolean}
   */
  isAnalyzed(eventId) {
    const meta = this.metadata.get(eventId);
    
    if (!meta) {
      return false;
    }

    // Check if expired
    if (meta.expirationDate && new Date() > meta.expirationDate) {
      this.metadata.delete(eventId);
      return false;
    }

    return meta.isAnalyzed === true;
  }

  /**
   * Get metadata for an event
   * @param {string} eventId - Event identifier
   * @returns {Object|null} Metadata or null
   */
  getMetadata(eventId) {
    const meta = this.metadata.get(eventId);
    
    if (!meta) {
      return null;
    }

    // Check if expired
    if (meta.expirationDate && new Date() > meta.expirationDate) {
      this.metadata.delete(eventId);
      return null;
    }

    return { ...meta };
  }

  /**
   * Remove analysis from cache
   * @param {string} eventId - Event identifier
   */
  delete(eventId) {
    this.cache.delete(eventId);
    this.metadata.delete(eventId);
  }

  /**
   * Get expiration date (end of event day)
   * @param {string|Date} eventDate - Event date
   * @returns {Date} Expiration date (end of event day)
   */
  getExpirationDate(eventDate) {
    const date = new Date(eventDate);
    // Set to end of day
    date.setHours(23, 59, 59, 999);
    return date;
  }

  /**
   * Clean up expired entries
   */
  cleanExpired() {
    const now = new Date();
    const toDelete = [];

    for (const [eventId, cached] of this.cache.entries()) {
      if (now > cached.expirationDate) {
        toDelete.push(eventId);
      }
    }

    toDelete.forEach(eventId => {
      this.cache.delete(eventId);
      this.metadata.delete(eventId);
    });
    
    if (toDelete.length > 0) {
      console.log(`🧹 Cleaned up ${toDelete.length} expired analysis cache entries`);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.metadata.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      metadataSize: this.metadata.size,
      cacheEntries: Array.from(this.cache.keys()),
      analyzedEvents: Array.from(this.metadata.keys())
    };
  }
}

module.exports = new AnalysisCache();


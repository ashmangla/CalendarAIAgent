/**
 * Wishlist Store - Manages wishlist items (events user wants to do)
 */
class WishlistStore {
  constructor() {
    this.items = [];
  }

  /**
   * Add a wishlist item
   * @param {Object} item - Wishlist item with title, optional date/time, priority, etc.
   */
  addItem(item) {
    const wishlistItem = {
      id: item.id || `wishlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: item.title,
      description: item.description || null,
      date: item.date || null, // If specified, show as grayed out on calendar
      time: item.time || null,
      duration: item.duration || null, // Estimated duration in minutes
      priority: item.priority || 'medium', // low, medium, high
      location: item.location || null,
      category: item.category || 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: item.source || 'voice', // voice, manual
      metadata: item.metadata || {}
    };

    this.items.push(wishlistItem);
    console.log(`✅ Added wishlist item: ${wishlistItem.title} (ID: ${wishlistItem.id})`);
    return wishlistItem;
  }

  /**
   * Get all wishlist items
   */
  getItems() {
    return this.items;
  }

  /**
   * Get wishlist item by ID
   */
  getItemById(id) {
    return this.items.find(item => item.id === id);
  }

  /**
   * Update a wishlist item
   */
  updateItem(id, updates) {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.items[index] = {
        ...this.items[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return this.items[index];
    }
    return null;
  }

  /**
   * Delete a wishlist item
   */
  deleteItem(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      const deleted = this.items.splice(index, 1)[0];
      console.log(`🗑️ Deleted wishlist item: ${deleted.title} (ID: ${id})`);
      return deleted;
    }
    return null;
  }

  /**
   * Get items without specific date/time (for suggestions)
   */
  getUnscheduledItems() {
    return this.getActiveItems().filter(item => !item.date || !item.time);
  }

  /**
   * Get items with specific date/time (for calendar display)
   */
  getScheduledItems() {
    return this.getActiveItems().filter(item => item.date && item.time);
  }

  /**
   * Get active items (not past date and not scheduled in calendar)
   */
  getActiveItems() {
    const now = new Date();
    return this.items.filter(item => {
      // Remove items with past dates
      if (item.date && item.time) {
        const itemDateTime = new Date(`${item.date}T${item.time}`);
        if (itemDateTime < now) {
          return false; // Past date, remove it
        }
      }
      // Keep all active items (server will check if they're in calendar separately)
      return true;
    });
  }

  /**
   * Remove items that are past their date
   */
  cleanup() {
    const now = new Date();
    const initialCount = this.items.length;
    
    this.items = this.items.filter(item => {
      if (item.date && item.time) {
        const itemDateTime = new Date(`${item.date}T${item.time}`);
        if (itemDateTime < now) {
          return false; // Past date, remove
        }
      }
      return true;
    });

    const removedCount = initialCount - this.items.length;
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} past-dated wishlist item(s)`);
    }
  }
}

module.exports = new WishlistStore();


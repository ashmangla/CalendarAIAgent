const express = require('express');
const router = express.Router();
const wishlistStore = require('../services/wishlistStore');
const WishlistAnalyzer = require('../services/wishlistAnalyzer');
const calendarConflictService = require('../services/calendarConflictService');

let wishlistAnalyzer;
try {
  wishlistAnalyzer = new WishlistAnalyzer();
  console.log('✅ Wishlist Analyzer initialized successfully');
} catch (error) {
  console.warn('⚠️ Wishlist Analyzer initialization failed:', error.message);
}

/**
 * Get all active wishlist items (auto-cleanup past items)
 */
router.get('/items', async (req, res) => {
  try {
    // Cleanup past-dated items
    wishlistStore.cleanup();
    
    // Get active items only
    const items = wishlistStore.getActiveItems();
    
    // Also check if any scheduled items are already in calendar and remove them
    // This is a simple check - in production you might want to cross-reference with actual calendar
    const activeItems = items;
    
    res.json({
      success: true,
      items: activeItems
    });
  } catch (error) {
    console.error('Error fetching wishlist items:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch wishlist items'
    });
  }
});

/**
 * Add wishlist item
 */
router.post('/items', async (req, res) => {
  try {
    const { title, description, date, time, priority, location, category } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    const item = wishlistStore.addItem({
      title,
      description,
      date,
      time,
      priority: priority || 'medium',
      location,
      category,
      source: 'manual'
    });

    res.json({
      success: true,
      item: item
    });
  } catch (error) {
    console.error('Error adding wishlist item:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add wishlist item'
    });
  }
});

/**
 * Update wishlist item
 */
router.put('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, date, time, priority } = req.body;

    const updated = wishlistStore.updateItem(id, {
      title,
      description,
      location,
      date,
      time,
      priority
    });

    if (updated) {
      res.json({
        success: true,
        item: updated,
        message: 'Wishlist item updated'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Wishlist item not found'
      });
    }
  } catch (error) {
    console.error('Error updating wishlist item:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update wishlist item'
    });
  }
});

/**
 * Delete wishlist item
 */
router.delete('/items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = wishlistStore.deleteItem(id);

    if (deleted) {
      res.json({
        success: true,
        message: 'Wishlist item deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Wishlist item not found'
      });
    }
  } catch (error) {
    console.error('Error deleting wishlist item:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete wishlist item'
    });
  }
});

/**
 * Find free slots and match wishlist items
 */
router.post('/find-time', async (req, res) => {
  try {
    const { events, daysToCheck = 14 } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Events array is required'
      });
    }

    if (!wishlistAnalyzer) {
      return res.status(503).json({
        success: false,
        error: 'Wishlist analyzer not available'
      });
    }

    // Get unscheduled wishlist items
    const wishlistItems = wishlistStore.getUnscheduledItems();
    
    if (wishlistItems.length === 0) {
      return res.json({
        success: true,
        matches: [],
        message: 'No unscheduled wishlist items to match'
      });
    }

    // Find free slots (2+ hours) in the next N days
    const freeSlots = findFreeSlots(events, daysToCheck);
    
    if (freeSlots.length === 0) {
      return res.json({
        success: true,
        matches: [],
        message: 'No free slots found (2+ hours required)'
      });
    }

    // Match wishlist items to free slots using LLM
    const matches = await wishlistAnalyzer.matchItemsToSlots(wishlistItems, freeSlots);

    // Generate suggestion messages for each match
    const matchesWithMessages = await Promise.all(
      matches.map(async (match) => {
        const message = await wishlistAnalyzer.generateSuggestionMessage(match);
        return {
          ...match,
          suggestionMessage: message
        };
      })
    );

    res.json({
      success: true,
      matches: matchesWithMessages,
      freeSlotsCount: freeSlots.length,
      wishlistItemsCount: wishlistItems.length
    });

  } catch (error) {
    console.error('Error finding time for wishlist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to find time for wishlist items'
    });
  }
});

/**
 * Analyze a single wishlist item for duration estimation
 */
router.post('/analyze-item', async (req, res) => {
  try {
    const { item } = req.body;

    if (!item || !item.title) {
      return res.status(400).json({
        success: false,
        error: 'Item with title is required'
      });
    }

    if (!wishlistAnalyzer) {
      return res.status(503).json({
        success: false,
        error: 'Wishlist analyzer not available'
      });
    }

    const analysis = await wishlistAnalyzer.analyzeItem(item);

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error analyzing wishlist item:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze wishlist item'
    });
  }
});

/**
 * Helper function to find free slots in calendar
 */
function findFreeSlots(events, daysToCheck = 14) {
  const freeSlots = [];
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + daysToCheck);

  // Normalize events to have consistent date/time format
  const normalizedEvents = events.map(event => {
    const date = new Date(event.date);
    const endDate = event.endDate ? new Date(event.endDate) : new Date(date.getTime() + 60 * 60 * 1000); // Default 1 hour
    return {
      start: date,
      end: endDate,
      title: event.title
    };
  }).filter(e => e.start && !isNaN(e.start.getTime()) && e.start >= now);

  // Sort events by start time
  normalizedEvents.sort((a, b) => a.start - b.start);

  // Start from now, find gaps between events
  let currentTime = new Date(now);
  currentTime.setMinutes(0, 0, 0); // Round to hour

  normalizedEvents.forEach(event => {
    // If there's a gap before this event
    if (currentTime < event.start) {
      const gapDuration = (event.start - currentTime) / (1000 * 60); // minutes
      
      // Only consider gaps of 2+ hours
      if (gapDuration >= 120) {
        freeSlots.push({
          startTime: currentTime.toISOString(),
          endTime: event.start.toISOString(),
          duration: gapDuration,
          date: currentTime.toISOString().split('T')[0]
        });
      }
    }
    
    // Move current time to end of this event
    currentTime = new Date(event.end);
    // Round up to next hour for cleaner slots
    currentTime.setMinutes(0, 0, 0);
    currentTime.setHours(currentTime.getHours() + 1);
  });

  // Check for free slot at end of period
  if (currentTime < endDate) {
    const gapDuration = (endDate - currentTime) / (1000 * 60);
    if (gapDuration >= 120) {
      freeSlots.push({
        startTime: currentTime.toISOString(),
        endTime: endDate.toISOString(),
        duration: gapDuration,
        date: currentTime.toISOString().split('T')[0]
      });
    }
  }

  return freeSlots;
}

module.exports = router;


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Wishlist.css';

const Wishlist = () => {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [findingTime, setFindingTime] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  useEffect(() => {
    fetchWishlistItems();
    // Auto-refresh every 30 seconds to remove past/scheduled items
    const interval = setInterval(fetchWishlistItems, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWishlistItems = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/wishlist/items');
      if (response.data.success) {
        // Server automatically filters out past/scheduled items
        setWishlistItems(response.data.items || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await axios.delete(`/api/wishlist/items/${itemId}`);
      await fetchWishlistItems();
    } catch (error) {
      console.error('Error deleting wishlist item:', error);
      alert('Failed to delete wishlist item');
    }
  };

  const handleFindTime = async () => {
    setFindingTime(true);
    setShowMatches(false);
    
    try {
      // Get current events
      const eventsResponse = await axios.get('/api/calendar/events');
      const events = eventsResponse.data.success ? eventsResponse.data.events : [];

      // Find time for wishlist items
      const response = await axios.post('/api/wishlist/find-time', {
        events: events,
        daysToCheck: 14
      });

      if (response.data.success && response.data.matches && response.data.matches.length > 0) {
        // Show top 3 matches
        setMatches(response.data.matches.slice(0, 3));
        setShowMatches(true);
      } else {
        alert('No free time slots found for wishlist items right now.');
      }
    } catch (error) {
      console.error('Error finding time:', error);
      alert('Failed to find time. Please try again.');
    } finally {
      setFindingTime(false);
    }
  };

  const handleScheduleMatch = async (match) => {
    try {
      const item = match.item;
      const startTime = new Date(match.suggestedStartTime || match.slot.startTime);
      
      const eventDetails = {
        title: item.title,
        date: startTime.toISOString().split('T')[0],
        time: startTime.toTimeString().slice(0, 5),
        duration: match.analysis?.estimatedDuration || 120,
        location: item.location || null,
        description: `Scheduled from wishlist: ${item.title}`
      };

      // Create event
      const createResponse = await axios.post('/api/voice/create-event', {
        eventDetails,
        tokens: null,
        override: false
      });

      if (createResponse.data.success) {
        // Delete from wishlist
        await axios.delete(`/api/wishlist/items/${item.id}`);
        await fetchWishlistItems();
        
        // Hide matches and refresh
        setShowMatches(false);
        setMatches([]);
        alert(`Scheduled "${item.title}"! It will be removed from wishlist automatically.`);
      } else {
        throw new Error(createResponse.data.error || 'Failed to schedule');
      }
    } catch (error) {
      console.error('Error scheduling match:', error);
      alert('Failed to schedule item. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="wishlist-container">
        <div className="loading">Loading wishlist...</div>
      </div>
    );
  }

  return (
    <div className="wishlist-container">
      <div className="wishlist-header">
        <h2>🌟 My Wishlist</h2>
        <button
          className="find-time-btn-primary"
          onClick={handleFindTime}
          disabled={wishlistItems.length === 0 || findingTime}
        >
          {findingTime ? '🔍 Finding...' : '🔍 Find Time'}
        </button>
      </div>

      {showMatches && matches.length > 0 && (
        <div className="matches-section">
          <h3>✨ Suggested Times</h3>
          <div className="matches-list">
            {matches.map((match, index) => {
              const item = match.item;
              const startTime = new Date(match.suggestedStartTime || match.slot.startTime);
              const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
              const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              const duration = match.analysis?.estimatedDuration || 120;
              
              return (
                <div key={index} className="match-card">
                  <div className="match-info">
                    <h4>{item.title}</h4>
                    {match.suggestionMessage ? (
                      <p className="suggestion-message">{match.suggestionMessage}</p>
                    ) : (
                      <p className="match-time">{dateStr} at {timeStr}</p>
                    )}
                    {match.analysis?.reasoning && (
                      <p className="match-reasoning">{match.analysis.reasoning}</p>
                    )}
                    <div className="match-details">
                      <span className="duration-badge">⏱️ ~{duration} min</span>
                      {item.location && <span className="location-badge">📍 {item.location}</span>}
                    </div>
                  </div>
                  <button
                    className="schedule-match-btn"
                    onClick={() => handleScheduleMatch(match)}
                  >
                    ✅ Schedule
                  </button>
                </div>
              );
            })}
          </div>
          <button className="dismiss-matches-btn" onClick={() => { setShowMatches(false); setMatches([]); }}>
            Dismiss
          </button>
        </div>
      )}

      {wishlistItems.length === 0 ? (
        <div className="empty-wishlist">
          <p>Your wishlist is empty!</p>
          <p className="hint">💡 Use voice commands like "I want to visit the art museum someday" to add items</p>
        </div>
      ) : (
        <div className="wishlist-list">
          {wishlistItems.map(item => (
            <div key={item.id} className="wishlist-item">
              <div className="item-content">
                <h4>{item.title}</h4>
                {item.location && <p className="item-location">📍 {item.location}</p>}
                {item.description && <p className="item-description">{item.description}</p>}
              </div>
              <button
                className="delete-item-btn"
                onClick={() => handleDeleteItem(item.id)}
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="wishlist-info">
        <p>💡 Items are automatically removed when scheduled or past their date</p>
        <p className="item-count">{wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''} in wishlist</p>
      </div>
    </div>
  );
};

export default Wishlist;

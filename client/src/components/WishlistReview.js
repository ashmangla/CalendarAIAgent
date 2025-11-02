import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WishlistReview.css';

const WishlistReview = ({ events, onClose, onScheduleItem }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);

  useEffect(() => {
    fetchWishlistItems();
    findTimeForWishlist();
  }, [events]);

  const fetchWishlistItems = async () => {
    try {
      const response = await axios.get('/api/wishlist/items');
      if (response.data.success) {
        setWishlistItems(response.data.items || []);
      }
    } catch (error) {
      console.error('Error fetching wishlist items:', error);
    }
  };

  const findTimeForWishlist = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/wishlist/find-time', {
        events: events || [],
        daysToCheck: 14
      });

      if (response.data.success) {
        setMatches(response.data.matches || []);
      } else {
        setError(response.data.error || 'Failed to find time for wishlist items');
      }
    } catch (error) {
      console.error('Error finding time for wishlist:', error);
      setError(error.response?.data?.error || 'Failed to find time for wishlist items');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (match) => {
    try {
      // Create event from wishlist item
      const item = match.item;
      const slot = match.slot;
      const startTime = new Date(match.suggestedStartTime || slot.startTime);
      
      const eventDetails = {
        title: item.title,
        date: startTime.toISOString().split('T')[0],
        time: startTime.toTimeString().slice(0, 5),
        duration: match.analysis?.estimatedDuration || 120,
        location: item.location || null,
        description: item.description || `Scheduled from wishlist: ${item.title}`
      };

      // Call parent callback to schedule
      if (onScheduleItem) {
        await onScheduleItem(eventDetails, item.id);
      }

      // Remove from wishlist if successfully scheduled
      try {
        await axios.delete(`/api/wishlist/items/${item.id}`);
        await fetchWishlistItems();
        await findTimeForWishlist();
      } catch (deleteError) {
        console.error('Error removing from wishlist:', deleteError);
      }
    } catch (error) {
      console.error('Error scheduling wishlist item:', error);
      alert('Failed to schedule item. Please try again.');
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  if (loading) {
    return (
      <div className="wishlist-review-container">
        <div className="wishlist-review-header">
          <h3>🌟 Wishlist Review</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Finding time for your wishlist items...</p>
        </div>
      </div>
    );
  }

  const unscheduledCount = wishlistItems.filter(item => !item.date || !item.time).length;

  return (
    <div className="wishlist-review-container">
      <div className="wishlist-review-header">
        <h3>🌟 Wishlist Review</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="wishlist-review-content">
        {error ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={findTimeForWishlist} className="retry-btn">Retry</button>
          </div>
        ) : matches.length === 0 ? (
          <div className="no-matches">
            <p>📭 No wishlist items match your available free time right now.</p>
            {unscheduledCount > 0 && (
              <p className="wishlist-count">You have {unscheduledCount} item{unscheduledCount !== 1 ? 's' : ''} in your wishlist.</p>
            )}
          </div>
        ) : (
          <>
            <div className="matches-intro">
              <p>I found time for {matches.length} wishlist item{matches.length !== 1 ? 's' : ''} in the next 2 weeks:</p>
            </div>

            <div className="matches-list">
              {matches.map((match, index) => {
                const item = match.item;
                const slot = match.slot;
                const dateTime = formatDateTime(match.suggestedStartTime || slot.startTime);
                const duration = match.analysis?.estimatedDuration || 120;

                return (
                  <div key={index} className="match-card">
                    <div className="match-item-info">
                      <h4>{item.title}</h4>
                      {item.location && (
                        <p className="match-location">📍 {item.location}</p>
                      )}
                      {match.analysis?.reasoning && (
                        <p className="match-reasoning">{match.analysis.reasoning}</p>
                      )}
                    </div>

                    <div className="match-suggestion">
                      <p className="suggestion-message">{match.suggestionMessage || `Want to schedule this for ${dateTime.date} at ${dateTime.time}?`}</p>
                      <div className="match-details">
                        <span className="duration-badge">⏱️ ~{duration} min</span>
                        {match.confidence && (
                          <span className="confidence-badge">
                            {match.confidence >= 0.8 ? '✨ Great match' : '👍 Good match'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="match-actions">
                      <button
                        className="schedule-btn"
                        onClick={() => handleSchedule(match)}
                      >
                        ✅ Schedule This
                      </button>
                      <button
                        className="skip-btn"
                        onClick={findTimeForWishlist}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="wishlist-stats">
          <p className="wishlist-total">
            Total wishlist items: {wishlistItems.length} 
            {unscheduledCount > 0 && ` (${unscheduledCount} unscheduled)`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WishlistReview;


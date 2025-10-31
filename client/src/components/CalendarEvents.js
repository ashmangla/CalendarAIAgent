import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EventAnalysis from './EventAnalysis';
import GoogleAuth from './GoogleAuth';
import VoiceAssistant from './VoiceAssistant';

const CalendarEvents = ({ onUserInfoChange, onDisconnectRequest }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Notify parent component of user info changes
  useEffect(() => {
    if (onUserInfoChange) {
      onUserInfoChange(userInfo, isGoogleConnected);
    }
  }, [userInfo, isGoogleConnected, onUserInfoChange]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (isGoogleConnected && userInfo && userInfo.tokens) {
        // Fetch from Google Calendar via server
        const response = await axios.post('/api/google-calendar/events', {
          tokens: userInfo.tokens
        });
        if (response.data.success) {
          setEvents(response.data.events);
        } else {
          setError('Failed to fetch Google Calendar events');
        }
      } else {
        // Fetch from mock API
        const response = await axios.get('/api/calendar/events');
        if (response.data.success) {
          setEvents(response.data.events);
        } else {
          setError('Failed to fetch calendar events');
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      
      // Check if it's a scope/permission error
      if (err.response?.data?.error?.includes('insufficient authentication scopes') || 
          err.response?.data?.error?.includes('PERMISSION_DENIED')) {
        setError('Authentication scopes have changed. Please sign out and sign in again.');
        // Auto-disconnect to force re-authentication
        setIsGoogleConnected(false);
        setUserInfo(null);
        setShowAuthModal(true);
      } else {
        setError('Error fetching calendar events. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [isGoogleConnected, userInfo]);

  // Handle Google authentication success
  const handleGoogleAuthSuccess = (user) => {
    setUserInfo(user);
    setIsGoogleConnected(true);
    setShowAuthModal(false);
    fetchEvents(); // Fetch events after successful auth
  };

  // Handle skip authentication (use mock data)
  const handleSkipAuth = () => {
    setIsGoogleConnected(false);
    setShowAuthModal(false);
    fetchEvents(); // Fetch mock events
  };

  // Handle disconnect from Google
  const handleDisconnectGoogle = useCallback(async () => {
    try {
      // Revoke Google tokens if available
      if (userInfo && userInfo.tokens) {
        try {
          await axios.post('/api/google-calendar/revoke', {
            tokens: userInfo.tokens
          });
        } catch (error) {
          console.warn('Failed to revoke tokens:', error);
          // Continue with disconnect even if revocation fails
        }
      }
      
      // Clear local state
      setIsGoogleConnected(false);
      setUserInfo(null);
      setShowAuthModal(true); // Show auth modal again
      
      // Clean URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      console.log('Disconnected from Google Calendar');
    } catch (error) {
      console.error('Error disconnecting from Google:', error);
      // Still clear local state even if there's an error
      setIsGoogleConnected(false);
      setUserInfo(null);
      setShowAuthModal(true);
    }
  }, [userInfo]);

  // Expose disconnect handler to parent
  useEffect(() => {
    if (onDisconnectRequest) {
      onDisconnectRequest(handleDisconnectGoogle);
    }
  }, [onDisconnectRequest, handleDisconnectGoogle]);

  // Handle OAuth callback with tokens in URL
  useEffect(() => {
    console.log('Checking for OAuth callback in URL:', window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    const tokensParam = urlParams.get('tokens');
    const errorParam = urlParams.get('error');
    
    console.log('URL params - tokens:', tokensParam ? 'present' : 'missing', 'error:', errorParam);
    
    if (errorParam) {
      console.error('OAuth error:', errorParam);
      setError('Authentication failed. Please try again or use sample data.');
      setShowAuthModal(false);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (tokensParam) {
      try {
        console.log('Parsing tokens...');
        const tokens = JSON.parse(decodeURIComponent(tokensParam));
        console.log('OAuth tokens received:', tokens);
        
        // Set user info with tokens (we'll fetch real user info after)
        setUserInfo({
          email: 'Loading...',
          name: 'Loading...',
          imageUrl: 'https://lh3.googleusercontent.com/a/default-user-icon',
          tokens: tokens
        });
        setIsGoogleConnected(true);
        setShowAuthModal(false);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('OAuth setup complete, fetching user info...');
        
        // Fetch real user information
        fetchUserInfo(tokens);
      } catch (error) {
        console.error('Error parsing OAuth tokens:', error);
        setError('Failed to authenticate with Google');
      }
    } else {
      console.log('No tokens or error in URL, showing auth modal');
    }
  }, []);

  // Fetch user information from Google
  const fetchUserInfo = async (tokens) => {
    try {
      const response = await axios.post('/api/google-calendar/user-info', {
        tokens: tokens
      });
      
      if (response.data.success) {
        const user = response.data.user;
        setUserInfo({
          email: user.email,
          name: user.name,
          imageUrl: user.picture,
          tokens: tokens
        });
        console.log('User info fetched:', user);
      } else {
        console.error('Failed to fetch user info:', response.data.error);
        // Use fallback user info
        setUserInfo({
          email: 'user@google.com',
          name: 'Google User',
          imageUrl: 'https://lh3.googleusercontent.com/a/default-user-icon',
          tokens: tokens
        });
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      // Use fallback user info if API call fails
      setUserInfo({
        email: 'user@google.com',
        name: 'Google User',
        imageUrl: 'https://lh3.googleusercontent.com/a/default-user-icon',
        tokens: tokens
      });
    }
  };

  useEffect(() => {
    // Only fetch events if user has made a choice (not showing auth modal)
    if (!showAuthModal) {
      fetchEvents();
    }
  }, [showAuthModal, isGoogleConnected, fetchEvents]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getEventTypeClass = (type) => {
    return type.replace(/\s+/g, '-').toLowerCase();
  };

  // Group events by date for calendar grid
  const groupEventsByDate = () => {
    const grouped = {};
    events.forEach(event => {
      const eventDate = new Date(event.date);
      const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });
    return grouped;
  };

  // Generate calendar grid for current month
  const generateCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Last day of month
    
    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const startDay = firstDay.getDay();
    
    // Create array of all days in month
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Navigate to previous month
  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Navigate to next month
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Get month/year label
  const getMonthYearLabel = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getEventsForDate = (date) => {
    if (!date) return [];
    const dateKey = date.toISOString().split('T')[0];
    const groupedEvents = groupEventsByDate();
    return groupedEvents[dateKey] || [];
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === today.getTime();
  };

  const isPastEvent = (event) => {
    if (!event || !event.date) return true;
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  const isPastDate = (date) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const handleAnalyzeEvent = (event) => {
    // Only allow analyzing future or today's events
    if (!isPastEvent(event)) {
      setSelectedEvent(event);
      setShowAnalysis(true);
    }
  };

  const closeAnalysis = () => {
    setShowAnalysis(false);
    setSelectedEvent(null);
  };

  const handleEventAnalyzed = useCallback((eventId) => {
    // Mark the event as analyzed in the events list
    setEvents(prevEvents => 
      prevEvents.map(event => {
        if ((event.id || event.eventId) === eventId) {
          return { ...event, isAnalyzed: true };
        }
        return event;
      })
    );
    
    // Also update selectedEvent if it's the one that was analyzed
    if (selectedEvent && (selectedEvent.id || selectedEvent.eventId) === eventId) {
      setSelectedEvent(prev => prev ? { ...prev, isAnalyzed: true } : null);
    }
  }, [selectedEvent]);

  const handleVoiceEventAdded = useCallback((newEvent) => {
    // Add the new event to the events list
    setEvents(prevEvents => [...prevEvents, newEvent]);
    // Refresh events to get updated list
    fetchEvents();
  }, [fetchEvents]);

  const handleTasksAdded = (addedEvents) => {
    // Refresh the events list to show the new AI-generated tasks
    fetchEvents();
  };

  // Show authentication modal if user hasn't made a choice yet
  if (showAuthModal) {
    return <GoogleAuth onAuthSuccess={handleGoogleAuthSuccess} onSkip={handleSkipAuth} />;
  }

  if (loading) {
    return (
      <div className="calendar-container">
        <div className="loading">Loading calendar events...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-container">
        <div className="error">
          {error}
          <br />
          {error.includes('Authentication scopes have changed') ? (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                This happens when we update the app's permissions. Please:
              </p>
              <ol style={{ fontSize: '0.875rem', marginLeft: '1.5rem', marginBottom: '1rem' }}>
                <li>Click "Sign in with Google" below</li>
                <li>Grant the new permissions</li>
                <li>Your calendar will load with your real data</li>
              </ol>
            </div>
          ) : (
            <button className="refresh-btn" onClick={fetchEvents}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h2>Your Calendar Events</h2>
        </div>
        <div className="events-count">
          Found {events.length} upcoming events
          {isGoogleConnected ? ' from Google Calendar' : ' (sample data)'}
        </div>
        <button className="refresh-btn" onClick={fetchEvents}>
          Refresh Events
        </button>
      </div>

      {!showAuthModal && (
        <VoiceAssistant
          onEventAdded={handleVoiceEventAdded}
          userInfo={userInfo}
          existingEvents={events}
        />
      )}
      
      <div className="calendar-content">
        <div className="calendar-with-details">
          <div className="calendar-grid-container">
            <div className="calendar-grid-header">
            <button 
              className="month-nav-btn" 
              onClick={handlePreviousMonth}
              aria-label="Previous month"
            >
              ‹
            </button>
            <h3>{getMonthYearLabel()}</h3>
            <button 
              className="month-nav-btn" 
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="calendar-grid">
            <div className="calendar-weekdays">
              <div className="calendar-weekday">Sun</div>
              <div className="calendar-weekday">Mon</div>
              <div className="calendar-weekday">Tue</div>
              <div className="calendar-weekday">Wed</div>
              <div className="calendar-weekday">Thu</div>
              <div className="calendar-weekday">Fri</div>
              <div className="calendar-weekday">Sat</div>
            </div>
            <div className="calendar-days">
              {generateCalendarGrid().map((date, index) => (
                <div 
                  key={index} 
                  className={`calendar-day ${!date ? 'calendar-day-empty' : ''} ${isToday(date) ? 'calendar-day-today' : ''}`}
                >
                  {date && (
                    <>
                      <div className="calendar-day-number">{date.getDate()}</div>
                      <div className="calendar-day-events">
                        {getEventsForDate(date).map((event) => (
                          <div
                            key={event.id}
                            className={`calendar-event-item ${getEventTypeClass(event.type)} ${event.isRecurring ? 'recurring' : ''} ${isPastEvent(event) ? 'past-event' : ''} ${selectedEvent?.id === event.id ? 'selected' : ''} ${event.isAnalyzed ? 'analyzed' : ''} ${event.isChecklistEvent || event.isGeneratedEvent ? 'checklist-event' : ''}`}
                            onClick={() => handleAnalyzeEvent(event)}
                            title={isPastEvent(event) ? `${event.title} (Cannot analyze past events)` : event.title}
                          >
                            <span className="event-dot"></span>
                            <span className="event-title-short">{event.title}</span>
                            {event.isAnalyzed && !event.isChecklistEvent && !event.isGeneratedEvent && (
                              <span className="analyzed-badge-small" title="Event has been analyzed">✓</span>
                            )}
                            {(event.isChecklistEvent || event.isGeneratedEvent) && (
                              <span className="checklist-badge-small" title="Generated event from checklist (cannot be analyzed)">📋</span>
                            )}
                            {event.isRecurring && <span className="recurring-icon">🔄</span>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {showAnalysis && selectedEvent && (
          <div className="event-details-panel">
            <EventAnalysis 
              event={selectedEvent} 
              onClose={closeAnalysis}
              onTasksAdded={handleTasksAdded}
              onEventAnalyzed={handleEventAnalyzed}
            />
          </div>
        )}
        {!showAnalysis && (
          <div className="event-details-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">📅</div>
              <h3>Click an event to view details</h3>
              <p>Select any event from the calendar to see full details and analysis options</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default CalendarEvents;
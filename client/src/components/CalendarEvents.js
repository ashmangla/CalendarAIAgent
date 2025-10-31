import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EventAnalysis from './EventAnalysis';
import GoogleAuth from './GoogleAuth';

const CalendarEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(true);

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
      setError('Error fetching calendar events. Please try again.');
      console.error('Error fetching events:', err);
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
  const handleDisconnectGoogle = async () => {
    try {
      setIsGoogleConnected(false);
      setUserInfo(null);
      fetchEvents(); // Switch back to mock data
    } catch (error) {
      console.error('Error disconnecting from Google:', error);
    }
  };

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
        
        // Set user info with tokens
        setUserInfo({
          email: 'user@example.com',
          name: 'Google User',
          tokens: tokens
        });
        setIsGoogleConnected(true);
        setShowAuthModal(false);
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('OAuth setup complete, fetching events...');
      } catch (error) {
        console.error('Error parsing OAuth tokens:', error);
        setError('Failed to authenticate with Google');
      }
    } else {
      console.log('No tokens or error in URL, showing auth modal');
    }
  }, []);

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

  const getEventTypeClass = (type) => {
    return type.replace(/\s+/g, '-').toLowerCase();
  };

  const handleAnalyzeEvent = (event) => {
    setSelectedEvent(event);
    setShowAnalysis(true);
  };

  const closeAnalysis = () => {
    setShowAnalysis(false);
    setSelectedEvent(null);
  };

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
          <button className="refresh-btn" onClick={fetchEvents}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h2>Your Calendar Events</h2>
          {isGoogleConnected && userInfo && (
            <div className="google-user-info">
              <img 
                src={userInfo.imageUrl} 
                alt={userInfo.name} 
                className="user-avatar"
              />
              <div className="user-details">
                <span className="user-name">{userInfo.name}</span>
                <span className="user-email">{userInfo.email}</span>
              </div>
              <button 
                className="disconnect-btn"
                onClick={handleDisconnectGoogle}
                title="Disconnect from Google Calendar"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
        <div className="events-count">
          Found {events.length} upcoming events
          {isGoogleConnected ? ' from Google Calendar' : ' (sample data)'}
        </div>
        <button className="refresh-btn" onClick={fetchEvents}>
          Refresh Events
        </button>
      </div>
      
      <div className="calendar-content">
        <div className="events-grid">
          {events.map((event) => (
            <div 
              key={event.id} 
              className={`event-card ${getEventTypeClass(event.type)} ${event.aiGenerated ? 'ai-generated' : ''} ${showAnalysis && selectedEvent?.id === event.id ? 'analyzing' : ''}`}
            >
            <div className="event-badges">
              <div className="event-type">{event.type}</div>
              {event.aiGenerated && <div className="ai-badge">🤖 AI Generated</div>}
              {event.isAnalyzed && !event.aiGenerated && <div className="analyzed-badge">✅ Analyzed</div>}
            </div>
            <div className="event-title">{event.title}</div>
            <div className="event-date">
              <strong>Start:</strong> {formatDate(event.date)}
            </div>
            {event.endDate && (
              <div className="event-date">
                <strong>End:</strong> {formatDate(event.endDate)}
              </div>
            )}
            {event.location && (
              <div className="event-location">
                📍 {event.location}
              </div>
            )}
            {event.description && (
              <div className="event-description">
                {event.description}
              </div>
            )}
            {!event.aiGenerated && (
              <button 
                className="analyze-event-btn"
                onClick={() => handleAnalyzeEvent(event)}
                disabled={event.isAnalyzed}
              >
                {event.isAnalyzed ? '✅ Already Analyzed' : '🤖 Analyze Event'}
              </button>
            )}
          </div>
          ))}
        </div>
        
        {showAnalysis && selectedEvent && (
          <div className="analysis-panel">
            <EventAnalysis 
              event={selectedEvent} 
              onClose={closeAnalysis}
              onTasksAdded={handleTasksAdded}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEvents;
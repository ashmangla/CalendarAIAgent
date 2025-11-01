import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import EventAnalysis from './EventAnalysis';
import EventDetails from './EventDetails';
import GoogleAuth from './GoogleAuth';
import VoiceAssistant from './VoiceAssistant';

const CalendarEvents = ({ onUserInfoChange, onDisconnectRequest, onRefreshEventsRequest, onVoiceAssistantRequest, showTodayOnly = false }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [weatherData, setWeatherData] = useState({});

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

  // Fetch weather for today's events with locations
  const fetchWeatherForTodayEvents = useCallback(async (todayEvents) => {
    console.log('🌤️ fetchWeatherForTodayEvents called', { todayEvents, showTodayOnly });

    if (!todayEvents || todayEvents.length === 0 || !showTodayOnly) {
      console.log('🌤️ Skipping weather fetch - no events or not showing today');
      return;
    }

    const eventsWithLocation = todayEvents.filter(event => event.location);
    console.log('🌤️ Events with locations:', eventsWithLocation.map(e => ({ id: e.id, title: e.title, location: e.location })));

    const weatherResults = {};

    // Fetch weather for ALL events with locations (including analyzed and AI-generated)
    const weatherPromises = eventsWithLocation
      .map(async (event) => {
        try {
          console.log(`🌤️ Fetching weather for event: ${event.title} at ${event.location}`);
          const response = await axios.post('/api/get-weather', {
            location: event.location,
            eventDate: event.date,
            eventType: event.type,
            eventTitle: event.title
          });

          console.log(`🌤️ Weather response for ${event.title}:`, response.data);

          if (response.data.success && response.data.weather) {
            weatherResults[event.id] = response.data.weather;
            console.log(`🌤️ Added weather for ${event.title}:`, weatherResults[event.id]);
          }
        } catch (error) {
          console.error(`❌ Error fetching weather for event ${event.id}:`, error);
        }
      });

    await Promise.all(weatherPromises);
    console.log('🌤️ Final weather results:', weatherResults);
    setWeatherData(weatherResults);
  }, [showTodayOnly]);

  // Fetch weather when events change and we're in "Today" view
  useEffect(() => {
    console.log('🌤️ Weather useEffect triggered', {
      showTodayOnly,
      eventsCount: events.length,
      weatherDataKeys: Object.keys(weatherData)
    });

    if (showTodayOnly && events.length > 0) {
      const todayEvents = events.filter(event => isToday(new Date(event.date)));
      console.log('🌤️ Found today events:', todayEvents.length, todayEvents.map(e => ({ title: e.title, location: e.location, date: e.date })));
      fetchWeatherForTodayEvents(todayEvents);
    } else {
      console.log('🌤️ Skipping - showTodayOnly:', showTodayOnly, 'events.length:', events.length);
    }
  }, [events, showTodayOnly, fetchWeatherForTodayEvents]);

  // Handle Google authentication success
  const handleGoogleAuthSuccess = (user) => {
    setUserInfo(user);
    setIsGoogleConnected(true);
    setShowAuthModal(false);
    // Notify parent component
    if (onUserInfoChange) {
      onUserInfoChange(user, true);
    }
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
      // Call logout endpoint to destroy session and revoke tokens
      await axios.post('/api/google-calendar/logout', {}, {
        withCredentials: true
      });

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
  }, []);

  // Expose disconnect handler to parent
  useEffect(() => {
    if (onDisconnectRequest) {
      onDisconnectRequest(handleDisconnectGoogle);
    }
  }, [onDisconnectRequest, handleDisconnectGoogle]);

  // Expose refresh events handler to parent
  useEffect(() => {
    if (onRefreshEventsRequest) {
      onRefreshEventsRequest(fetchEvents);
    }
  }, [onRefreshEventsRequest, fetchEvents]);

  // Expose voice assistant toggle handler to parent
  useEffect(() => {
    if (onVoiceAssistantRequest) {
      onVoiceAssistantRequest(() => setShowVoiceAssistant(prev => !prev));
    }
  }, [onVoiceAssistantRequest]);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('Checking for existing session...');
      try {
        const response = await axios.get('/api/google-calendar/session', {
          withCredentials: true
        });

        if (response.data.success && response.data.isAuthenticated) {
          console.log('Found existing session:', response.data.userInfo);
          const user = {
            email: response.data.userInfo.email,
            name: response.data.userInfo.name,
            imageUrl: response.data.userInfo.picture,
            tokens: response.data.tokens
          };
          setUserInfo(user);
          setIsGoogleConnected(true);
          setShowAuthModal(false);
          // Notify parent component
          if (onUserInfoChange) {
            onUserInfoChange(user, true);
          }
        } else {
          console.log('No existing session found');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };

    checkSession();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    console.log('Checking for OAuth callback in URL:', window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    const authParam = urlParams.get('auth');
    const errorParam = urlParams.get('error');

    console.log('URL params - auth:', authParam, 'error:', errorParam);

    if (errorParam) {
      console.error('OAuth error:', errorParam);
      setError('Authentication failed. Please try again or use sample data.');
      setShowAuthModal(false);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authParam === 'success') {
      console.log('Auth success, fetching session...');

      // Fetch session data from server
      axios.get('/api/google-calendar/session', {
        withCredentials: true
      })
      .then(response => {
        if (response.data.success && response.data.isAuthenticated) {
          console.log('Session data received:', response.data.userInfo);
          setUserInfo({
            email: response.data.userInfo.email,
            name: response.data.userInfo.name,
            imageUrl: response.data.userInfo.picture,
            tokens: response.data.tokens
          });
          setIsGoogleConnected(true);
          setShowAuthModal(false);

          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      })
      .catch(error => {
        console.error('Error fetching session after auth:', error);
        setError('Failed to complete authentication');
      });
    } else {
      console.log('No auth callback in URL');
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
    // For AI-generated or already analyzed events, show event details instead
    if (event.isAIGenerated || event.isAnalyzed) {
      setSelectedEvent(event);
      setShowAnalysis(true);
      return;
    }

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
    // Add the new event to the events list immediately for instant feedback
    setEvents(prevEvents => [...prevEvents, newEvent]);
    // Refresh events after a short delay to get updated list from Google Calendar
    setTimeout(() => {
      fetchEvents();
    }, 1000);
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

  // Filter events for today if showTodayOnly is true
  const displayEvents = showTodayOnly ? events.filter(event => isToday(new Date(event.date))) : events;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-title-section">
          <h2>{showTodayOnly ? "Today's Events" : "Your Calendar Events"}</h2>
        </div>
        <div className="events-count">
          Found {displayEvents.length} {showTodayOnly ? "event(s) today" : "upcoming events"}
          {isGoogleConnected ? ' from Google Calendar' : ' (sample data)'}
        </div>
      </div>

      {!showAuthModal && showVoiceAssistant && (
        <VoiceAssistant
          onEventAdded={handleVoiceEventAdded}
          userInfo={userInfo}
          existingEvents={events}
        />
      )}
      
      <div className="calendar-content">
        {showTodayOnly ? (
          // Today's Events List View
          <div className="today-events-list">
            {displayEvents.length === 0 ? (
              <div className="no-events-message">
                <div className="no-events-icon">📅</div>
                <h3>No events scheduled for today</h3>
                <p>Enjoy your free day or add new events to your calendar!</p>
              </div>
            ) : (
              <div className="events-grid">
                {displayEvents.map((event) => {
                  const canAnalyze = !event.isAIGenerated && !event.isAnalyzed && !isPastEvent(event);
                  const canClick = canAnalyze || event.isAIGenerated || event.isAnalyzed;
                  const getTitle = () => {
                    if (event.isAIGenerated) return `${event.title} (Click to view details)`;
                    if (event.isAnalyzed) return `${event.title} (Click to view details)`;
                    if (isPastEvent(event)) return `${event.title} (Cannot analyze past events)`;
                    return event.title;
                  };

                  return (
                  <div
                    key={event.id}
                    className={`event-card ${getEventTypeClass(event.type)} ${event.isAnalyzed ? 'analyzed' : ''} ${event.isAIGenerated ? 'ai-generated' : ''} ${!canClick ? 'non-clickable' : ''}`}
                    onClick={() => canClick && handleAnalyzeEvent(event)}
                    title={getTitle()}
                    style={{ cursor: canClick ? 'pointer' : 'default' }}
                  >
                    <div className="event-badges">
                      {event.isAIGenerated && (
                        <span className="ai-badge" title="AI-generated event">🤖 AI</span>
                      )}
                      {event.isAnalyzed && (
                        <span className="analyzed-badge" title="Event has been analyzed">✓ Analyzed</span>
                      )}
                      <span className={`event-type ${getEventTypeClass(event.type)}`}>
                        {event.type}
                      </span>
                    </div>
                    <h3 className="event-title">{event.title}</h3>
                    <div className="event-card-body">
                      <p className="event-time">
                        {new Date(event.date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {event.location && (
                        <p className="event-location">📍 {event.location}</p>
                      )}
                      {event.description && (
                        <p className="event-description">
                          {(() => {
                            // Check if this is an AI-generated task with an original event reference
                            if (event.isAIGenerated || event.isChecklistEvent) {
                              // Parse description to remove the first line about the original event
                              const matchQuoted = event.description.match(/AI-generated preparation task for "(.+?)"\.\n\n/);
                              const matchEventId = event.description.match(/AI-generated preparation task for event ID .+?\.\n\n/);

                              if (matchQuoted || matchEventId) {
                                let restOfDescription = event.description;
                                let originalTitle;

                                if (matchQuoted) {
                                  // Use stored originalEventTitle, otherwise extract from description
                                  originalTitle = event.originalEventTitle || matchQuoted[1];
                                  restOfDescription = event.description.replace(/AI-generated preparation task for "(.+?)"\.\n\n/, '');
                                } else if (matchEventId) {
                                  // Use stored originalEventTitle, otherwise use fallback
                                  originalTitle = event.originalEventTitle || 'the event';
                                  restOfDescription = event.description.replace(/AI-generated preparation task for event ID .+?\.\n\n/, '');
                                }

                                return (
                                  <>
                                    <strong style={{ color: '#8b5cf6', fontSize: '0.75rem', display: 'block', marginBottom: '0.5rem' }}>
                                      Prep for: {originalTitle}
                                    </strong>
                                    {restOfDescription}
                                  </>
                                );
                              }
                            }
                            return event.description;
                          })()}
                        </p>
                      )}

                      {/* Display weather for events with location */}
                      {weatherData[event.id] && (
                        <div className="event-weather-card">
                          <div className="weather-header">
                            <span className="weather-icon">🌤️</span>
                            <span className="weather-temp">{weatherData[event.id].temperature}°C</span>
                            <span className="weather-desc">{weatherData[event.id].description}</span>
                          </div>
                          {weatherData[event.id].suggestions && weatherData[event.id].suggestions.length > 0 && (
                            <div className="weather-suggestion">
                              {weatherData[event.id].suggestions[0]}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Regular Calendar Grid View
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
                        {getEventsForDate(date).map((event) => {
                          const canAnalyze = !event.isAIGenerated && !event.isAnalyzed && !isPastEvent(event);
                          const canClick = canAnalyze || event.isAIGenerated || event.isAnalyzed;
                          const getTitle = () => {
                            if (event.isAIGenerated) return `${event.title} (Click to view details)`;
                            if (event.isAnalyzed) return `${event.title} (Click to view details)`;
                            if (isPastEvent(event)) return `${event.title} (Cannot analyze past events)`;
                            return event.title;
                          };

                          return (
                          <div
                            key={event.id}
                            className={`calendar-event-item ${getEventTypeClass(event.type)} ${event.isRecurring ? 'recurring' : ''} ${isPastEvent(event) ? 'past-event' : ''} ${selectedEvent?.id === event.id ? 'selected' : ''} ${event.isAnalyzed ? 'analyzed' : ''} ${event.isAIGenerated ? 'ai-generated-item' : ''} ${event.isChecklistEvent || event.isGeneratedEvent ? 'checklist-event' : ''}`}
                            onClick={() => canClick && handleAnalyzeEvent(event)}
                            title={getTitle()}
                            style={{ cursor: canClick ? 'pointer' : 'default' }}
                          >
                            <span className="event-dot"></span>
                            <span className="event-title-short">{event.title}</span>
                            {event.isAIGenerated && (
                              <span className="ai-badge-small" title="AI-generated event">🤖</span>
                            )}
                            {event.isAnalyzed && !event.isChecklistEvent && !event.isGeneratedEvent && (
                              <span className="analyzed-badge-small" title="Event has been analyzed">✓</span>
                            )}
                            {(event.isChecklistEvent || event.isGeneratedEvent) && (
                              <span className="checklist-badge-small" title="Generated event from checklist (cannot be analyzed)">📋</span>
                            )}
                            {event.isRecurring && <span className="recurring-icon">🔄</span>}
                          </div>
                          );
                        })}
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
                {selectedEvent.isAIGenerated || selectedEvent.isAnalyzed ? (
                  <EventDetails
                    event={selectedEvent}
                    onClose={closeAnalysis}
                  />
                ) : (
                  <EventAnalysis
                    event={selectedEvent}
                    onClose={closeAnalysis}
                    onTasksAdded={handleTasksAdded}
                    onEventAnalyzed={handleEventAnalyzed}
                  />
                )}
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
        )}
      </div>
    </div>
  );
};

export default CalendarEvents;
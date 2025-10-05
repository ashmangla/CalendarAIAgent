import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EventAnalysis from './EventAnalysis';

const CalendarEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('/api/calendar/events');
      if (response.data.success) {
        setEvents(response.data.events);
      } else {
        setError('Failed to fetch calendar events');
      }
    } catch (err) {
      setError('Error connecting to server. Please make sure the server is running.');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

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
        <h2>Your Calendar Events</h2>
        <div className="events-count">
          Found {events.length} upcoming events
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
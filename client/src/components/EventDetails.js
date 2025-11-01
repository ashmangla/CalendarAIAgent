import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './EventDetails.css';

const EventDetails = ({ event, onClose }) => {
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Fetch linked tasks if this is an analyzed event
  useEffect(() => {
    const fetchLinkedTasks = async () => {
      if (event.isAnalyzed && event.id) {
        setLoadingTasks(true);
        try {
          const response = await axios.post('/api/get-linked-tasks', {
            eventId: event.id
          });

          if (response.data.success) {
            setLinkedTasks(response.data.linkedTasks || []);
          }
        } catch (error) {
          console.error('Error fetching linked tasks:', error);
        } finally {
          setLoadingTasks(false);
        }
      }
    };

    fetchLinkedTasks();
  }, [event.id, event.isAnalyzed]);

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeClass = (type) => {
    return type?.replace(/\s+/g, '-').toLowerCase() || 'general';
  };

  return (
    <div className="event-details-container">
      <div className="event-details-header">
        <h3>📅 Event Details</h3>
        <button
          className="close-details-btn"
          onClick={onClose}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="event-details-content">
        <div className="event-info-section">
          <div className="event-badges">
            {event.isAIGenerated && (
              <span className="ai-badge" title="AI-generated event">🤖 AI Generated</span>
            )}
            {event.isAnalyzed && (
              <span className="analyzed-badge" title="Event has been analyzed">✓ Analyzed</span>
            )}
            {(event.isChecklistEvent || event.isGeneratedEvent) && (
              <span className="checklist-badge" title="Generated from checklist">📋 Checklist</span>
            )}
            <span className={`event-type-badge ${getEventTypeClass(event.type)}`}>
              {event.type || 'General'}
            </span>
          </div>

          <h2 className="event-title">{event.title}</h2>

          <div className="event-meta-info">
            <div className="meta-item">
              <span className="meta-icon">📅</span>
              <span className="meta-label">Date & Time:</span>
              <span className="meta-value">{formatDate(event.date)}</span>
            </div>

            {event.location && (
              <div className="meta-item">
                <span className="meta-icon">📍</span>
                <span className="meta-label">Location:</span>
                <span className="meta-value">{event.location}</span>
              </div>
            )}

            {event.description && (
              <div className="meta-item">
                <span className="meta-icon">📝</span>
                <span className="meta-label">Description:</span>
                <span className="meta-value description-text">{event.description}</span>
              </div>
            )}

            {event.attendees !== undefined && event.attendees > 0 && (
              <div className="meta-item">
                <span className="meta-icon">👥</span>
                <span className="meta-label">Attendees:</span>
                <span className="meta-value">{event.attendees} {event.attendees === 1 ? 'person' : 'people'}</span>
              </div>
            )}

            {event.source && (
              <div className="meta-item">
                <span className="meta-icon">🔗</span>
                <span className="meta-label">Source:</span>
                <span className="meta-value">{event.source === 'google' ? 'Google Calendar' : event.source}</span>
              </div>
            )}

            {event.isRecurring && (
              <div className="meta-item">
                <span className="meta-icon">🔄</span>
                <span className="meta-label">Recurring Event:</span>
                <span className="meta-value">Yes</span>
              </div>
            )}

            {event.priority && (
              <div className="meta-item">
                <span className="meta-icon">⚡</span>
                <span className="meta-label">Priority:</span>
                <span className="meta-value priority-value">{event.priority}</span>
              </div>
            )}

            {event.category && (
              <div className="meta-item">
                <span className="meta-icon">🏷️</span>
                <span className="meta-label">Category:</span>
                <span className="meta-value">{event.category}</span>
              </div>
            )}
          </div>
        </div>

        {event.isAIGenerated && (
          <div className="event-notice ai-notice">
            <span className="notice-icon">🤖</span>
            <div className="notice-content">
              <strong>AI-Generated Event</strong>
              <p>This event was created by the voice assistant or AI system and cannot be analyzed further.</p>
            </div>
          </div>
        )}

        {event.isAnalyzed && !event.isAIGenerated && (
          <div className="event-notice analyzed-notice">
            <span className="notice-icon">✓</span>
            <div className="notice-content">
              <strong>Already Analyzed</strong>
              <p>This event has been analyzed previously. The analysis results are saved.</p>
            </div>
          </div>
        )}

        {(event.isChecklistEvent || event.isGeneratedEvent) && (
          <div className="event-notice checklist-notice">
            <span className="notice-icon">📋</span>
            <div className="notice-content">
              <strong>Generated from Checklist</strong>
              <p>This event was automatically generated from an event analysis checklist.</p>
            </div>
          </div>
        )}

        {event.isAnalyzed && !event.isAIGenerated && (
          <div className="linked-tasks-section">
            <h3 className="linked-tasks-title">📋 Linked Preparation Tasks</h3>

            {loadingTasks ? (
              <div className="loading-tasks">
                <div className="loading-spinner"></div>
                <p>Loading linked tasks...</p>
              </div>
            ) : linkedTasks.length > 0 ? (
              <>
                <p className="linked-tasks-count">
                  {linkedTasks.length} {linkedTasks.length === 1 ? 'task' : 'tasks'} generated from this event
                </p>
                <div className="linked-tasks-list">
                  {linkedTasks.map((task) => (
                    <div key={task.id} className="linked-task-card">
                      <div className="linked-task-header">
                        <h4 className="linked-task-title">{task.title}</h4>
                        {task.priority && (
                          <span className={`task-priority-badge priority-${task.priority.toLowerCase()}`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      <div className="linked-task-meta">
                        <span className="task-date">
                          <span className="task-icon">📅</span>
                          {formatShortDate(task.date)}
                        </span>
                        {task.category && (
                          <span className="task-category">
                            <span className="task-icon">🏷️</span>
                            {task.category}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="linked-task-description">{task.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="no-linked-tasks">No preparation tasks have been added yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetails;

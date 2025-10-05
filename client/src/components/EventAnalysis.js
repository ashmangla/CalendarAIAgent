import React, { useState } from 'react';
import axios from 'axios';
import './EventAnalysis.css';

const EventAnalysis = ({ event, onClose, onTasksAdded }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [addingTasks, setAddingTasks] = useState(false);

  const analyzeEvent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/analyze-event', {
        eventId: event.id
      });
      
      if (response.data.success) {
        setAnalysis(response.data.analysis);
      } else {
        setError('Failed to analyze event');
      }
    } catch (err) {
      setError('Error analyzing event. Please try again.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#ff4757';
      case 'medium': return '#ffa502';
      case 'low': return '#2ed573';
      default: return '#747d8c';
    }
  };

  const formatTimelineDay = (day) => {
    return day.replace(/(\d+)\s+(day|week|hour)/, '$1 $2');
  };

  const handleTaskSelection = (task, isSelected) => {
    if (isSelected) {
      setSelectedTasks(prev => [...prev, task]);
    } else {
      setSelectedTasks(prev => prev.filter(t => t.id !== task.id));
    }
  };

  const addSelectedTasksToCalendar = async () => {
    if (selectedTasks.length === 0) {
      alert('Please select at least one task to add to your calendar.');
      return;
    }

    setAddingTasks(true);
    try {
      const response = await axios.post('/api/add-ai-tasks', {
        selectedTasks: selectedTasks,
        originalEventId: event.id
      });

      if (response.data.success) {
        alert(`Successfully added ${selectedTasks.length} preparation tasks to your calendar!`);
        onTasksAdded && onTasksAdded(response.data.addedEvents);
        onClose();
      } else {
        setError('Failed to add tasks to calendar');
      }
    } catch (err) {
      setError('Error adding tasks to calendar. Please try again.');
      console.error('Error:', err);
    } finally {
      setAddingTasks(false);
    }
  };

  return (
    <div className="analysis-container">
      <div className="analysis-header">
        <h3>🤖 AI Event Analysis</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="analysis-content">
          <div className="event-info">
            <h4>{event.title}</h4>
            <p className="event-meta">
              <span className="event-type-badge">{event.type}</span>
              <span className="event-date">
                {new Date(event.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </p>
            {event.location && <p className="event-location">📍 {event.location}</p>}
          </div>

          {!analysis && !loading && (
            <div className="analyze-prompt">
              <p>Get AI-powered suggestions for preparing for this event!</p>
              <button className="analyze-btn" onClick={analyzeEvent}>
                🧠 Analyze Event
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-analysis">
              <div className="spinner"></div>
              <p>AI is analyzing your event...</p>
            </div>
          )}

          {error && (
            <div className="error-analysis">
              <p>{error}</p>
              <button className="retry-btn" onClick={analyzeEvent}>Try Again</button>
            </div>
          )}

          {analysis && (
            <div className="analysis-results">
              <div className="analysis-summary">
                <h5>📋 Event Summary</h5>
                <p>{analysis.eventSummary}</p>
                <div className="prep-time">
                  <strong>Estimated Prep Time:</strong> {analysis.estimatedPrepTime}
                </div>
              </div>

              <div className="preparation-tasks">
                <h5>✅ Preparation Tasks</h5>
                <p className="task-selection-info">Select tasks to add to your calendar:</p>
                <div className="tasks-grid">
                  {analysis.preparationTasks.map((task, index) => (
                    <div key={task.id || index} className="task-card">
                      <div className="task-selection">
                        <input
                          type="checkbox"
                          id={`task-${task.id || index}`}
                          onChange={(e) => handleTaskSelection(task, e.target.checked)}
                          className="task-checkbox"
                        />
                        <label htmlFor={`task-${task.id || index}`} className="task-select-label">
                          Add to Calendar
                        </label>
                      </div>
                      <div className="task-header">
                        <span 
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(task.priority) }}
                        >
                          {task.priority}
                        </span>
                        <span className="task-time">{task.estimatedTime}</span>
                      </div>
                      <h6>{task.task}</h6>
                      <p className="task-category">{task.category}</p>
                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}
                      {task.suggestedDate && (
                        <p className="task-suggested-date">
                          <strong>Suggested date:</strong> {new Date(task.suggestedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="timeline-section">
                <h5>⏰ Preparation Timeline</h5>
                <div className="timeline">
                  {Object.entries(analysis.timeline).map(([timeframe, tasks]) => (
                    <div key={timeframe} className="timeline-item">
                      <div className="timeline-marker"></div>
                      <div className="timeline-content">
                        <h6>{formatTimelineDay(timeframe)}</h6>
                        <ul>
                          {tasks.map((task, index) => (
                            <li key={index}>{task}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="tips-section">
                <h5>💡 Pro Tips</h5>
                <ul className="tips-list">
                  {analysis.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>

              <div className="analysis-actions">
                <div className="selected-tasks-info">
                  {selectedTasks.length > 0 && (
                    <p>{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>
                <div className="action-buttons">
                  <button 
                    className="add-tasks-btn" 
                    onClick={addSelectedTasksToCalendar}
                    disabled={selectedTasks.length === 0 || addingTasks}
                  >
                    {addingTasks ? '⏳ Adding...' : '📅 Add Selected to Calendar'}
                  </button>
                  <button className="reanalyze-btn" onClick={analyzeEvent}>
                    🔄 Analyze Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default EventAnalysis;
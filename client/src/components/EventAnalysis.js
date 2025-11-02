import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './EventAnalysis.css';
import UberBookingModal from './UberBookingModal';

const EventAnalysis = ({ event, onClose, onTasksAdded, onEventAnalyzed }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [addingTasks, setAddingTasks] = useState(false);
  const [showUberModal, setShowUberModal] = useState(false);
  const [editedTasks, setEditedTasks] = useState({}); // Store edited versions of tasks
  const [editingTaskId, setEditingTaskId] = useState(null); // Track which task is being edited
  const [isAlreadyAnalyzed, setIsAlreadyAnalyzed] = useState(false);
  const [isChecklistEvent, setIsChecklistEvent] = useState(false);
  const [isGeneratedEvent, setIsGeneratedEvent] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [metadata, setMetadata] = useState(null);
  
  // Check if event type suggests transportation might be needed
  const needsTransportation = () => {
    if (!event) return false;
    const eventType = (event.type || '').toLowerCase();
    const eventTitle = (event.title || '').toLowerCase();
    const eventLocation = (event.location || '').toLowerCase();
    
    // Events that typically need transportation
    const transportationNeededTypes = ['travel', 'meeting', 'pickup', 'celebration', 'concert'];
    const transportationKeywords = ['trip', 'meetup', 'appointment', 'visit'];
    
    return (
      transportationNeededTypes.includes(eventType) ||
      transportationKeywords.some(keyword => eventTitle.includes(keyword)) ||
      (eventLocation && eventLocation.length > 0) // If there's a location, might need transportation
    );
  };

  const analyzeEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/analyze-event', {
        event: event // Pass the full event object
      });
      
      if (response.data.success) {
        setAnalysis(response.data.analysis);
        // Don't mark as analyzed yet - only after tasks are added
        // setIsAlreadyAnalyzed(true); // REMOVED - now set only when tasks are added
        const wasFromCache = response.data.fromCache || false;
        setFromCache(wasFromCache);

        // Store metadata
        if (response.data.metadata) {
          setMetadata(response.data.metadata);
        }

        // Don't notify parent that event was analyzed yet
        // Only notify after tasks are actually added to the calendar
      } else {
        setError(response.data.message || 'Failed to analyze event');
      }
    } catch (err) {
      // Handle specific error cases
      if (err.response?.data?.message) {
        const errorMsg = err.response.data.message;
        setError(errorMsg);
        
        if (errorMsg.includes('already been analyzed')) {
          setIsAlreadyAnalyzed(true);
        } else if (errorMsg.includes('Checklist events cannot') || errorMsg.includes('Generated events')) {
          setIsChecklistEvent(true);
          setIsGeneratedEvent(true);
        }
      } else {
        setError('Error analyzing event. Please try again.');
      }
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [event]);

  // Check event status on mount
  useEffect(() => {
    if (event) {
      setIsAlreadyAnalyzed(event.isAnalyzed || false);
      setIsChecklistEvent(event.isChecklistEvent || false);
      setIsGeneratedEvent(event.isGeneratedEvent || false);
      
      // If already analyzed, try to load cached analysis
      if (event.isAnalyzed && !event.isChecklistEvent && !event.isGeneratedEvent) {
        analyzeEvent(); // This will get from cache
      }
    }
  }, [event, analyzeEvent]);

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
    // Get the edited version if it exists, otherwise use original
    const taskToAdd = editedTasks[task.id || task.task] || task;
    
    if (isSelected) {
      setSelectedTasks(prev => [...prev, taskToAdd]);
    } else {
      setSelectedTasks(prev => prev.filter(t => (t.id || t.task) !== (task.id || task.task)));
    }
  };

  const updateChecklistItem = (taskId, itemIndex, newValue) => {
    const taskKey = taskId || 'default';
    const currentTask = editedTasks[taskKey] || analysis.preparationTasks.find(t => (t.id || t.task) === taskId);
    
    if (!currentTask) return;
    
    // Get checklist items
    const checklistItems = currentTask.description ? currentTask.description.split(',').map(i => i.trim()) : [];
    
    // Update the specific item
    const updatedItems = [...checklistItems];
    updatedItems[itemIndex] = newValue;
    
    // Update edited task
    setEditedTasks(prev => ({
      ...prev,
      [taskKey]: {
        ...currentTask,
        description: updatedItems.join(', ')
      }
    }));
  };

  const addChecklistItem = (taskId, newItem = 'New item') => {
    const taskKey = taskId || 'default';
    const currentTask = editedTasks[taskKey] || analysis.preparationTasks.find(t => (t.id || t.task) === taskId);
    
    if (!currentTask) return;
    
    // Get checklist items
    const checklistItems = currentTask.description ? currentTask.description.split(',').map(i => i.trim()) : [];
    
    // Add new item
    const updatedItems = [...checklistItems, newItem];
    
    // Update edited task
    setEditedTasks(prev => ({
      ...prev,
      [taskKey]: {
        ...currentTask,
        description: updatedItems.join(', ')
      }
    }));
  };
  
  const addTransportationToChecklist = (taskId) => {
    const taskKey = taskId || 'default';
    const currentTask = editedTasks[taskKey] || analysis.preparationTasks.find(t => (t.id || t.task) === taskId);
    
    if (!currentTask) return;
    
    // Get checklist items
    const checklistItems = currentTask.description ? currentTask.description.split(',').map(i => i.trim()) : [];
    
    // Check if transportation item already exists
    const hasTransportation = checklistItems.some(item => 
      item.toLowerCase().includes('uber') || 
      item.toLowerCase().includes('ride') || 
      item.toLowerCase().includes('transportation')
    );
    
    if (!hasTransportation) {
      // Add transportation item
      const updatedItems = [...checklistItems, 'Book Uber ride to event'];
      
      // Update edited task and mark as transportation task
      setEditedTasks(prev => ({
        ...prev,
        [taskKey]: {
          ...currentTask,
          description: updatedItems.join(', '),
          category: 'Transportation'
        }
      }));
    }
  };

  const removeChecklistItem = (taskId, itemIndex) => {
    const taskKey = taskId || 'default';
    const currentTask = editedTasks[taskKey] || analysis.preparationTasks.find(t => (t.id || t.task) === taskId);
    
    if (!currentTask) return;
    
    // Get checklist items
    const checklistItems = currentTask.description ? currentTask.description.split(',').map(i => i.trim()) : [];
    
    // Remove the item
    const updatedItems = checklistItems.filter((_, idx) => idx !== itemIndex);
    
    // Update edited task
    setEditedTasks(prev => ({
      ...prev,
      [taskKey]: {
        ...currentTask,
        description: updatedItems.join(', ')
      }
    }));
  };

  const updateTaskDateTime = (taskId, newDate, newTime) => {
    const taskKey = taskId || 'default';
    const currentTask = editedTasks[taskKey] || analysis.preparationTasks.find(t => (t.id || t.task) === taskId);
    
    if (!currentTask) return;
    
    // If newDate provided, create a datetime with the time
    let updatedDate = currentTask.suggestedDate;
    if (newDate) {
      const dateObj = new Date(newDate);
      if (newTime) {
        const [hours, minutes] = newTime.split(':');
        dateObj.setHours(parseInt(hours), parseInt(minutes));
      }
      updatedDate = dateObj.toISOString();
    } else if (newTime && currentTask.suggestedDate) {
      // Update time on existing date
      const dateObj = new Date(currentTask.suggestedDate);
      const [hours, minutes] = newTime.split(':');
      dateObj.setHours(parseInt(hours), parseInt(minutes));
      updatedDate = dateObj.toISOString();
    }
    
    // Validate that the date/time is in the future
    const now = new Date();
    const suggestedDateTime = new Date(updatedDate);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour buffer
    
    // If the suggested date/time is in the past, adjust it to 1 hour from now
    if (suggestedDateTime <= oneHourFromNow) {
      const adjustedDate = new Date(oneHourFromNow);
      // Preserve the time portion if it was valid, otherwise use 1 hour from now
      if (newTime && suggestedDateTime > now) {
        // If only the time was adjusted and it's still in the past, use the adjusted time
        adjustedDate.setHours(suggestedDateTime.getHours(), suggestedDateTime.getMinutes());
        if (adjustedDate <= now) {
          // Still in past, use 1 hour from now
          updatedDate = oneHourFromNow.toISOString();
        } else {
          updatedDate = adjustedDate.toISOString();
        }
      } else {
        updatedDate = oneHourFromNow.toISOString();
      }
    }
    
    // Update edited task with new date/time
    setEditedTasks(prev => ({
      ...prev,
      [taskKey]: {
        ...currentTask,
        suggestedDate: updatedDate,
        suggestedTime: newTime || currentTask.suggestedTime || newTime
      }
    }));
  };

  const getTaskToDisplay = (task) => {
    const taskKey = task.id || task.task;
    return editedTasks[taskKey] || task;
  };

  const isTransportationTask = (task) => {
    if (!task) return false;
    const taskLower = (task.task || '').toLowerCase();
    const categoryLower = (task.category || '').toLowerCase();
    const descriptionLower = (task.description || '').toLowerCase();
    
    return (
      categoryLower.includes('transportation') ||
      taskLower.includes('uber') ||
      taskLower.includes('transportation') ||
      taskLower.includes('ride') ||
      taskLower.includes('travel') ||
      descriptionLower.includes('uber') ||
      (descriptionLower.includes('book') && descriptionLower.includes('ride'))
    );
  };

  const handleUberBooking = (bookingData) => {
    // Handle successful Uber booking
    console.log('Uber booking completed:', bookingData);
    // You could add the booking to calendar events here if needed
  };

  const handleTaskClick = (task, e) => {
    // Prevent checkbox from triggering this
    if (e.target.type === 'checkbox' || e.target.tagName === 'LABEL' || e.target.closest('.task-selection')) {
      return;
    }
    
    if (isTransportationTask(task)) {
      setShowUberModal(true);
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
        // Now mark the event as analyzed since tasks have been added
        setIsAlreadyAnalyzed(true);
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
                {new Date(event.date).toLocaleString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </p>
            {event.location && <p className="event-location">📍 {event.location}</p>}
          </div>

          {!analysis && !loading && !error && (
            <div className="analyze-prompt">
              {isGeneratedEvent || isChecklistEvent ? (
                <>
                  <p className="info-message">ℹ️ This is a generated event created from an analyzed event's checklist. Generated events cannot be analyzed.</p>
                </>
              ) : isAlreadyAnalyzed ? (
                <>
                  <p className="info-message">✅ This event has already been analyzed. Loading cached analysis...</p>
                </>
              ) : (
                <>
                  <p>Get AI-powered suggestions for preparing for this event!</p>
                  <button className="analyze-btn" onClick={analyzeEvent}>
                    🧠 Analyze Event
                  </button>
                </>
              )}
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
              {!isChecklistEvent && !isGeneratedEvent && !isAlreadyAnalyzed && (
                <button className="retry-btn" onClick={analyzeEvent}>Try Again</button>
              )}
            </div>
          )}

          {analysis && (
            <div className="analysis-results">
              <div className="analysis-summary">
                <div className="summary-header">
                  <h5>📋 Event Summary</h5>
                  {fromCache && (
                    <span className="cache-badge" title="This analysis was loaded from cache">
                      📦 Cached
                    </span>
                  )}
                  {isAlreadyAnalyzed && !fromCache && (
                    <span className="analyzed-badge" title="This event has been analyzed">
                      ✅ Analyzed
                    </span>
                  )}
                </div>
                <p>{analysis.eventSummary}</p>
                <div className="prep-time">
                  <strong>Estimated Prep Time:</strong> {analysis.estimatedPrepTime}
                </div>
              </div>

              {analysis.weather && (
                <div className="weather-info">
                  <h5>🌤️ Weather Forecast</h5>
                  <div className="weather-details">
                    <div className="weather-main">
                      <div className="weather-temp">
                        <span className="temp-value">{analysis.weather.temperature}°C</span>
                        <span className="temp-feels">Feels like {analysis.weather.feelsLike}°C</span>
                      </div>
                      <div className="weather-condition">
                        <span className="condition-text">{analysis.weather.description}</span>
                        <span className="condition-location">📍 {analysis.weather.location}</span>
                      </div>
                    </div>
                    <div className="weather-stats">
                      <div className="weather-stat">
                        <span className="stat-icon">💧</span>
                        <span className="stat-value">{analysis.weather.precipitation}%</span>
                        <span className="stat-label">Rain</span>
                      </div>
                      <div className="weather-stat">
                        <span className="stat-icon">💨</span>
                        <span className="stat-value">{analysis.weather.windSpeed}</span>
                        <span className="stat-label">km/h</span>
                      </div>
                      <div className="weather-stat">
                        <span className="stat-icon">💦</span>
                        <span className="stat-value">{analysis.weather.humidity}%</span>
                        <span className="stat-label">Humidity</span>
                      </div>
                    </div>
                    {analysis.weather.suggestions && analysis.weather.suggestions.length > 0 && (
                      <div className="weather-suggestions">
                        <strong>Weather-based suggestions:</strong>
                        <ul>
                          {analysis.weather.suggestions.map((suggestion, idx) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="preparation-tasks">
                <h5>✅ Preparation Tasks</h5>
                <p className="task-selection-info">Select tasks to add to your calendar:</p>
                <div className="tasks-grid">
                  {analysis.preparationTasks.map((task, index) => {
                    const displayTask = getTaskToDisplay(task);
                    const taskKey = task.id || task.task || index;
                    const isEditing = editingTaskId === taskKey;
                    const checklistItems = displayTask.description ? displayTask.description.split(',').map(i => i.trim()) : [];
                    const suggestedDate = displayTask.suggestedDate ? new Date(displayTask.suggestedDate) : null;
                    // Extract time from suggestedDate if it's a datetime, otherwise use suggestedTime
                    const taskTime = displayTask.suggestedTime || 
                                    (suggestedDate && suggestedDate.toTimeString().slice(0, 5)) || 
                                    '09:00';
                    
                    return (
                      <div 
                        key={task.id || index} 
                        className={`task-card ${isTransportationTask(task) ? 'transportation-task' : ''} ${isEditing ? 'editing' : ''}`}
                        onClick={(e) => handleTaskClick(task, e)}
                        style={isTransportationTask(task) ? { cursor: 'pointer' } : {}}
                      >
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
                          <button
                            className="edit-task-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTaskId(isEditing ? null : taskKey);
                            }}
                            title={isEditing ? "Done Editing" : "Edit Task"}
                          >
                            {isEditing ? '✓' : '✏️'}
                          </button>
                        </div>
                        <div className="task-header">
                          <span 
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(displayTask.priority) }}
                          >
                            {displayTask.priority}
                          </span>
                          <span className="task-time">{displayTask.estimatedTime}</span>
                        </div>
                        <h6>{displayTask.task}</h6>
                        <p className="task-category">{displayTask.category}</p>
                        
                        {(displayTask.description || isEditing) && (
                          <div className="task-checklist">
                            <div className="checklist-header">
                              <strong>Checklist:</strong>
                              {isEditing && (
                                <div className="checklist-actions">
                                  <button
                                    className="add-ride-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addTransportationToChecklist(taskKey);
                                    }}
                                    title="Add transportation/ride option"
                                  >
                                    🚕 Add Ride
                                  </button>
                                  <button
                                    className="add-item-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addChecklistItem(taskKey);
                                    }}
                                    title="Add item"
                                  >
                                    + Add Item
                                  </button>
                                </div>
                              )}
                            </div>
                            {checklistItems.length > 0 ? (
                              <ul className="checklist-items">
                                {checklistItems.map((item, idx) => (
                                  <li key={idx}>
                                    {isEditing ? (
                                      <div className="checklist-item-editable">
                                        <input
                                          type="text"
                                          value={item}
                                          onChange={(e) => updateChecklistItem(taskKey, idx, e.target.value)}
                                          className="checklist-item-input"
                                          onClick={(e) => e.stopPropagation()}
                                          placeholder="Enter checklist item"
                                        />
                                        <button
                                          className="remove-item-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeChecklistItem(taskKey, idx);
                                          }}
                                          title="Remove item"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ) : (
                                      item
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              isEditing && (
                                <p className="no-checklist-items">No items yet. Click "+ Add Item" to add one.</p>
                              )
                            )}
                          </div>
                        )}
                        
                        <div className="task-suggested-date">
                          {isEditing ? (
                            <div className="datetime-edit" onClick={(e) => e.stopPropagation()}>
                              <label>
                                <strong>Date:</strong>
                                <input
                                  type="date"
                                  min={new Date().toISOString().split('T')[0]}
                                  value={suggestedDate ? suggestedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                  onChange={(e) => updateTaskDateTime(taskKey, e.target.value, null)}
                                  className="date-input"
                                />
                              </label>
                              <label>
                                <strong>Time:</strong>
                                <input
                                  type="time"
                                  min={(() => {
                                    // If date is today, set min time to 1 hour from now
                                    const now = new Date();
                                    const taskDate = suggestedDate ? new Date(suggestedDate) : null;
                                    if (taskDate && taskDate.toDateString() === now.toDateString()) {
                                      // Same day, set min to 1 hour from now
                                      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
                                      return `${oneHourFromNow.getHours().toString().padStart(2, '0')}:${oneHourFromNow.getMinutes().toString().padStart(2, '0')}`;
                                    }
                                    return '00:00';
                                  })()}
                                  value={taskTime}
                                  onChange={(e) => updateTaskDateTime(taskKey, null, e.target.value)}
                                  className="time-input"
                                />
                              </label>
                            </div>
                          ) : (
                            suggestedDate ? (
                              <p>
                                <strong>Suggested date:</strong> {suggestedDate.toLocaleDateString()}
                                {taskTime && ` at ${taskTime}`}
                              </p>
                            ) : (
                              <p className="no-date-notice">No date set - click ✏️ to edit</p>
                            )
                          )}
                        </div>
                        
                        {isTransportationTask(task) && (
                          <button 
                            className="uber-booking-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowUberModal(true);
                            }}
                          >
                            🚕 Book Uber Ride
                          </button>
                        )}
                      </div>
                    );
                  })}
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
                  {/* Show Uber booking button for events that need transportation */}
                  {needsTransportation() && (
                    <button 
                      className="uber-booking-btn" 
                      onClick={() => setShowUberModal(true)}
                      title="Book an Uber ride for this event"
                    >
                      🚕 Book Uber Ride
                    </button>
                  )}
                  <button 
                    className="add-tasks-btn" 
                    onClick={addSelectedTasksToCalendar}
                    disabled={selectedTasks.length === 0 || addingTasks}
                  >
                    {addingTasks ? '⏳ Adding...' : '📅 Add Selected to Calendar'}
                  </button>
                  {!isChecklistEvent && !isGeneratedEvent && (
                    <button 
                      className="reanalyze-btn" 
                      onClick={analyzeEvent}
                      disabled={isAlreadyAnalyzed}
                      title={isAlreadyAnalyzed ? "This event has already been analyzed" : "Re-analyze this event"}
                    >
                      🔄 Analyze Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {showUberModal && (
          <UberBookingModal
            event={event}
            onClose={() => setShowUberModal(false)}
            onBook={handleUberBooking}
          />
        )}
    </div>
  );
};

export default EventAnalysis;
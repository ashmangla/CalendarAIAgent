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
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [detectedDocUrls, setDetectedDocUrls] = useState([]);
  const [showMealPlanModal, setShowMealPlanModal] = useState(false);
  const [mealPlanPreferences, setMealPlanPreferences] = useState({
    days: 7,
    familySize: '',
    targetCalories: 2000,
    diet: '',
    exclude: ''
  });
  const [generatingMealPlan, setGeneratingMealPlan] = useState(false);

  useEffect(() => {
    setSelectedTasks([]);
  }, [analysis]);

  const preparationTasks = Array.isArray(analysis?.preparationTasks)
    ? analysis.preparationTasks
    : [];
  const hasPreparationTasks = preparationTasks.length > 0;
  const linkedTasks = Array.isArray(analysis?.linkedTasks)
    ? analysis.linkedTasks
    : [];
  const hasLinkedTasks = linkedTasks.length > 0;
  const formatLinkedTaskDate = (dateStr) => {
    if (!dateStr) {
      return 'Date TBD';
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

      const addedEvents = response.data.addedEvents || [];
      if (response.data.success) {
        setIsAlreadyAnalyzed(true);
        onTasksAdded && onTasksAdded(addedEvents);

        setAnalysis(prev => {
          if (!prev) return prev;

          const selectedIds = new Set(selectedTasks.map(task => task.id || task.task));
          const remainingTasks = (prev.preparationTasks || []).filter(task => {
            const identifier = task.id || task.task;
            return !selectedIds.has(identifier);
          });

          const updatedLinked = [...(prev.linkedTasks || []), ...addedEvents];

          return {
            ...prev,
            preparationTasks: remainingTasks,
            linkedTasks: updatedLinked,
            remainingTaskCount: remainingTasks.length,
            totalLinkedTasks: updatedLinked.length
          };
        });

        setSelectedTasks([]);
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
  
  const analyzeEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use edited description if available, otherwise use original
      const eventToAnalyze = {
        ...event,
        description: editedDescription || event.description || ''
      };
      
      const response = await axios.post('/api/analyze-event', {
        event: eventToAnalyze // Pass the event with potentially updated description
      });
      
      if (response.data.success) {
        setAnalysis(response.data.analysis);

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
  }, [event, editedDescription]);

  // Generate meal plan with user preferences
  const handleGenerateMealPlan = async () => {
    setGeneratingMealPlan(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/generate-meal-plan', {
        event: event,
        preferences: mealPlanPreferences,
        analysis: analysis // Pass current analysis to update it
      });

      if (response.data.success) {
        // Update analysis with meal plan
        setAnalysis(response.data.analysis);
        setShowMealPlanModal(false);
        // Show success message
      } else {
        setError(response.data.message || 'Failed to generate meal plan');
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Error generating meal plan. Please try again.');
      }
      console.error('Error:', err);
    } finally {
      setGeneratingMealPlan(false);
    }
  };

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

  // Check if meal plan preferences are needed after analysis
  useEffect(() => {
    if (analysis && analysis.requiresMealPlanPreferences) {
      setShowMealPlanModal(true);
    }
  }, [analysis]);

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return '#ff4757';
      case 'medium': return '#ffa502';
      case 'low': return '#2ed573';
      default: return '#747d8c';
    }
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
    const currentTask = editedTasks[taskKey] || preparationTasks.find(t => (t.id || t.task) === taskId);
    
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
    const currentTask = editedTasks[taskKey] || preparationTasks.find(t => (t.id || t.task) === taskId);
    
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
    const currentTask = editedTasks[taskKey] || preparationTasks.find(t => (t.id || t.task) === taskId);
    
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
    const currentTask = editedTasks[taskKey] || preparationTasks.find(t => (t.id || t.task) === taskId);
    
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
    const currentTask = editedTasks[taskKey] || preparationTasks.find(t => (t.id || t.task) === taskId);
    
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
            
            {/* Description Section with Google Docs URL Detection */}
            <div className="event-description-section">
              <div className="description-header">
                <strong>Description:</strong>
                {!isChecklistEvent && !isGeneratedEvent && (
                  <button
                    className="edit-description-btn"
                    onClick={() => setShowDescriptionEditor(!showDescriptionEditor)}
                    title="Edit description"
                  >
                    {showDescriptionEditor ? '✗ Cancel' : '✏️ Edit'}
                  </button>
                )}
              </div>
              {showDescriptionEditor ? (
                <div className="description-editor">
                  <textarea
                    className="description-textarea"
                    value={editedDescription}
                    onChange={(e) => {
                      setEditedDescription(e.target.value);
                      // Auto-detect URLs in real-time
                      const urlPattern = /https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/g;
                      const urls = [];
                      let match;
                      while ((match = urlPattern.exec(e.target.value)) !== null) {
                        urls.push({
                          fullUrl: match[0],
                          docId: match[1]
                        });
                      }
                      setDetectedDocUrls(urls);
                    }}
                    placeholder="Enter event description. Paste Google Docs/Sheets URLs here for AI-powered meeting preparation."
                    rows="4"
                  />
                  <div className="description-hints">
                    <p>💡 <strong>Tip:</strong> Paste Google Docs URLs (e.g., https://docs.google.com/document/d/...) in the description for enhanced meeting preparation</p>
                  </div>
                  {detectedDocUrls.length > 0 && (
                    <div className="detected-docs">
                      <strong>📄 Detected Google Docs ({detectedDocUrls.length}):</strong>
                      {detectedDocUrls.map((url, idx) => (
                        <a key={idx} href={url.fullUrl} target="_blank" rel="noopener noreferrer" className="doc-url-link">
                          📄 Document {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  <button
                    className="save-description-btn"
                    onClick={async () => {
                      // Detect URLs in the edited description
                      const urlPattern = /https?:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/g;
                      const urls = [];
                      let match;
                      while ((match = urlPattern.exec(editedDescription)) !== null) {
                        urls.push({
                          fullUrl: match[0],
                          docId: match[1]
                        });
                      }
                      setDetectedDocUrls(urls);
                      
                      // Close editor - description will be used when analyzing
                      setShowDescriptionEditor(false);
                      
                      // Note: For Google Calendar events, description updates would require API call
                      // For now, the edited description will be used in analysis
                    }}
                  >
                    💾 Save Description
                  </button>
                </div>
              ) : (
                <div className="event-description-display">
                  {event.description ? (
                    <>
                      <p className="description-text">{event.description}</p>
                      {detectedDocUrls.length > 0 && (
                        <div className="detected-docs-inline">
                          <strong>📄 Google Docs detected:</strong>
                          {detectedDocUrls.map((url, idx) => (
                            <a key={idx} href={url.fullUrl} target="_blank" rel="noopener noreferrer" className="doc-url-link">
                              Document {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="no-description">No description yet. Click "Edit" to add one.</p>
                  )}
                </div>
              )}
            </div>
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
                  <button
                    className="analyze-btn"
                    onClick={analyzeEvent}
                    disabled={loading}
                  >
                    {loading ? 'Analyzing...' : '🧠 Generate Checklist'}
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
                  {isAlreadyAnalyzed && (
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

              {analysis.mealPlan && (
                <div className="meal-plan-info" style={{ marginBottom: '20px', padding: '15px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                  <h5>🍽️ Meal Plan Generated</h5>
                  <p style={{ margin: '10px 0' }}>{analysis.mealPlan.message}</p>
                  <a 
                    href={analysis.mealPlan.document.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      display: 'inline-block',
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: '#10b981',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      fontWeight: '500'
                    }}
                  >
                    📄 Open Meal Plan: {analysis.mealPlan.document.title}
                  </a>
                </div>
              )}

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
                <p className="task-selection-info">
                  {analysis?.remainingTasksOnly
                    ? 'These are the remaining checklist tasks that have not been scheduled yet.'
                    : 'Select tasks to add to your calendar:'}
                </p>
                {hasPreparationTasks ? (
                  <div className="tasks-grid">
                    {preparationTasks.map((task, index) => {
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
                ) : (
                  <div className="no-remaining-tasks">
                    <p>
                      {hasLinkedTasks
                        ? 'All checklist items from this checklist are on your calendar.'
                        : 'All checklist items have already been added to your calendar. 🎉'}
                    </p>
                    <p className="no-remaining-subtext">
                      If plans change, click "Re-generate checklist" to get a fresh set of tasks.
                    </p>
                  </div>
                )}
              </div>

              {hasLinkedTasks && (
                <div className="linked-tasks-section">
                  <h5>📅 Checklist Tasks on Your Calendar</h5>
                  <p className="linked-tasks-subtext">
                    These tasks were added from this checklist and already live on your calendar.
                  </p>
                  <div className="linked-tasks-list">
                    {linkedTasks.map((task) => (
                      <div key={task.id} className="linked-task-card">
                        <div className="linked-task-header">
                          <span className="linked-task-title">{task.title}</span>
                          {task.priority && (
                            <span className="linked-task-priority">{task.priority}</span>
                          )}
                        </div>
                        <div className="linked-task-meta">
                          <span>{formatLinkedTaskDate(task.date)}</span>
                          {task.category && <span>• {task.category}</span>}
                          {task.estimatedTime && <span>• {task.estimatedTime}</span>}
                        </div>
                        {task.description && (
                          <p className="linked-task-description">{task.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Action buttons - outside scrollable area */}
        {analysis && (
          <div className="analysis-actions">
            <div className="action-buttons">
              <button
                className="add-tasks-btn"
                onClick={addSelectedTasksToCalendar}
                disabled={selectedTasks.length === 0 || addingTasks}
                title="Add selected tasks to your calendar"
              >
                {addingTasks ? '⏳ Adding...' : '📅 Add to Calendar'}
              </button>
              {!isChecklistEvent && !isGeneratedEvent && !isAlreadyAnalyzed && (
                <button
                  className="reanalyze-btn"
                  onClick={analyzeEvent}
                  disabled={isAlreadyAnalyzed}
                  title="Re-generate the checklist"
                >
                  🔄 Re-generate checklist
                </button>
              )}
            </div>
          </div>
        )}

        {showUberModal && (
          <UberBookingModal
            event={event}
            onClose={() => setShowUberModal(false)}
            onBook={handleUberBooking}
          />
        )}

        {/* Meal Plan Preferences Modal */}
        {showMealPlanModal && (
          <div className="meal-plan-modal-overlay" onClick={() => setShowMealPlanModal(false)}>
            <div className="meal-plan-modal" onClick={(e) => e.stopPropagation()}>
              <div className="meal-plan-modal-header">
                <h3>🍽️ Meal Planning Preferences</h3>
                <button className="close-btn" onClick={() => setShowMealPlanModal(false)}>×</button>
              </div>
              <div className="meal-plan-modal-content">
                <p>To generate your personalized meal plan, please provide the following information:</p>
                
                <div className="meal-plan-form">
                  <label>
                    <strong>Number of Days:</strong>
                    <input
                      type="number"
                      min="1"
                      max="7"
                      value={mealPlanPreferences.days}
                      onChange={(e) => setMealPlanPreferences({
                        ...mealPlanPreferences,
                        days: parseInt(e.target.value) || 7
                      })}
                    />
                  </label>

                  <label>
                    <strong>Number of People:</strong>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g., 4"
                      value={mealPlanPreferences.familySize}
                      onChange={(e) => setMealPlanPreferences({
                        ...mealPlanPreferences,
                        familySize: e.target.value
                      })}
                    />
                  </label>

                  <label>
                    <strong>Daily Calorie Target:</strong>
                    <input
                      type="number"
                      min="1000"
                      max="5000"
                      step="100"
                      value={mealPlanPreferences.targetCalories}
                      onChange={(e) => setMealPlanPreferences({
                        ...mealPlanPreferences,
                        targetCalories: parseInt(e.target.value) || 2000
                      })}
                    />
                  </label>

                  <label>
                    <strong>Dietary Preference (optional):</strong>
                    <select
                      value={mealPlanPreferences.diet}
                      onChange={(e) => setMealPlanPreferences({
                        ...mealPlanPreferences,
                        diet: e.target.value
                      })}
                    >
                      <option value="">None</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="paleo">Paleo</option>
                      <option value="primal">Primal</option>
                      <option value="ketogenic">Ketogenic</option>
                      <option value="pescetarian">Pescetarian</option>
                    </select>
                  </label>

                  <label>
                    <strong>Exclude Ingredients (comma-separated, optional):</strong>
                    <input
                      type="text"
                      placeholder="e.g., shellfish, nuts, dairy"
                      value={mealPlanPreferences.exclude}
                      onChange={(e) => setMealPlanPreferences({
                        ...mealPlanPreferences,
                        exclude: e.target.value
                      })}
                    />
                  </label>
                </div>

                {error && (
                  <div className="error-message" style={{ color: '#ff4757', marginTop: '10px' }}>
                    {error}
                  </div>
                )}

                <div className="meal-plan-modal-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => setShowMealPlanModal(false)}
                    disabled={generatingMealPlan}
                  >
                    Skip
                  </button>
                  <button
                    className="generate-btn"
                    onClick={handleGenerateMealPlan}
                    disabled={generatingMealPlan}
                  >
                    {generatingMealPlan ? '⏳ Generating...' : '🍽️ Generate Meal Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default EventAnalysis;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const CalendarEventAnalyzer = require('./eventAnalyzer');
const analysisCache = require('./services/analysisCache');
const eventsStore = require('./services/eventsStore');
const weatherService = require('./services/weatherService');
const uberRoutes = require('./routes/uber');
const googleCalendarRoutes = require('./routes/googleCalendar');
const voiceRoutes = require('./routes/voice');
const wishlistRoutes = require('./routes/wishlist');
const colorClassificationService = require('./services/colorClassificationService');

const app = express();

// Initialize the event analyzer
let eventAnalyzer;
try {
  eventAnalyzer = new CalendarEventAnalyzer();
  console.log('✅ OpenAI Event Analyzer initialized successfully');
} catch (error) {
  console.log('⚠️  OpenAI Event Analyzer initialization failed:', error.message);
  console.log('💡 Set OPENAI_API_KEY environment variable to enable AI analysis');
}
const PORT = process.env.PORT || 5001;

/**
 * Ensure the analysis payload includes up-to-date weather information.
 * Refreshes cached analyses when the event is within the 7-day forecast window.
 */
async function refreshWeatherDataForAnalysis(analysis, event) {
  try {
    if (!analysis || !event) {
      return false;
    }

    const location = (event.location || '').trim();
    if (!location || !event.date) {
      return false;
    }

    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) {
      return false;
    }

    const now = new Date();
    if (eventDate <= now) {
      return false;
    }

    const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);
    if (hoursUntilEvent > 168) {
      return false;
    }

    const existingWeather = analysis.weather || null;
    const existingTimestamp = existingWeather?.fetchedAt ? new Date(existingWeather.fetchedAt) : null;
    const existingLocation = existingWeather?.queryLocation ? existingWeather.queryLocation.toLowerCase() : '';
    const normalizedLocation = location.toLowerCase();

    const needsRefresh =
      !existingWeather ||
      !existingTimestamp ||
      (now - existingTimestamp) > 3 * 60 * 60 * 1000 ||
      existingLocation !== normalizedLocation;

    if (!needsRefresh) {
      return false;
    }

    const weatherData = await weatherService.getWeatherForEvent(location, event.date);
    if (!weatherData) {
      return false;
    }

    const weatherSuggestions = weatherService.generateWeatherSuggestions(
      weatherData,
      event.type,
      event.title
    );

    analysis.weather = {
      temperature: weatherData.temperature,
      feelsLike: weatherData.feelsLike,
      description: weatherData.description,
      main: weatherData.main,
      precipitation: Math.round(weatherData.precipitation),
      windSpeed: weatherData.windSpeed,
      humidity: weatherData.humidity,
      location: weatherData.location,
      suggestions: weatherSuggestions,
      fetchedAt: now.toISOString(),
      queryLocation: location
    };

    return true;
  } catch (error) {
    console.warn('Weather refresh failed:', error.message);
    return false;
  }
}

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'motherboard-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// Mock calendar events data (with analysis tracking)
let mockCalendarEvents = [
  {
    id: '1',
    title: 'Business Trip to New York',
    type: 'travel',
    date: '2025-10-05T09:00:00Z',
    endDate: '2025-10-08T18:00:00Z',
    description: 'Client meetings and conference attendance',
    location: 'New York, NY',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '2',
    title: 'Rock Concert - The Electric Blues',
    type: 'concert',
    date: '2025-10-12T20:00:00Z',
    endDate: '2025-10-12T23:00:00Z',
    description: 'Live performance at Madison Square Garden',
    location: 'Madison Square Garden, NY',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '3',
    title: 'Band Practice Session',
    type: 'band practice',
    date: '2025-10-03T19:00:00Z',
    endDate: '2025-10-03T22:00:00Z',
    description: 'Weekly practice for upcoming gig',
    location: 'Music Studio B, Downtown',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '4',
    title: 'Airport Pickup - Sarah',
    type: 'pickup',
    date: '2025-10-07T14:30:00Z',
    endDate: '2025-10-07T16:00:00Z',
    description: 'Pick up Sarah from JFK Airport',
    location: 'JFK Airport Terminal 4',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '5',
    title: 'Weekend Trip to Mountains',
    type: 'travel',
    date: '2025-10-14T08:00:00Z',
    endDate: '2025-10-16T20:00:00Z',
    description: 'Hiking and camping adventure',
    location: 'Rocky Mountain National Park',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '6',
    title: 'Jazz Concert - Blue Note Quartet',
    type: 'concert',
    date: '2025-10-20T19:30:00Z',
    endDate: '2025-10-20T22:30:00Z',
    description: 'Intimate jazz performance',
    location: 'Blue Note Jazz Club',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '7',
    title: 'Band Practice - New Songs',
    type: 'band practice',
    date: '2025-10-10T18:00:00Z',
    endDate: '2025-10-10T21:00:00Z',
    description: 'Learning new repertoire for winter performances',
    location: 'Community Center Room 3',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '8',
    title: 'Family Pickup - Kids from School',
    type: 'pickup',
    date: '2025-10-04T15:15:00Z',
    endDate: '2025-10-04T16:00:00Z',
    description: 'Weekly pickup duty for soccer practice',
    location: 'Riverside Elementary School',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '9',
    title: 'European Vacation',
    type: 'travel',
    date: '2025-11-01T06:00:00Z',
    endDate: '2025-11-15T22:00:00Z',
    description: 'Two-week tour of Italy and France',
    location: 'Europe',
    isAnalyzed: false,
    aiGenerated: false
  },
  {
    id: '10',
    title: 'Classical Concert - Symphony Orchestra',
    type: 'concert',
    date: '2025-10-25T20:00:00Z',
    endDate: '2025-10-25T22:30:00Z',
    description: 'Beethoven\'s 9th Symphony performance',
    location: 'Lincoln Center',
    isAnalyzed: false,
    aiGenerated: false
  }
];

// Routes
// Color classification endpoint (for LLM fallback if needed)
app.post('/api/calendar/color-classify', async (req, res) => {
  try {
    const { event } = req.body;
    
    if (!event || !event.title) {
      return res.status(400).json({
        success: false,
        error: 'Event with title is required'
      });
    }

    const colorClass = await colorClassificationService.getColorClass(event);
    
    res.json({
      success: true,
      colorClass: colorClass,
      cacheSize: colorClassificationService.getCacheSize()
    });
  } catch (error) {
    console.error('Error classifying event color:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to classify event color'
    });
  }
});

app.get('/api/calendar/events', (req, res) => {
  try {
    // Simulate API delay
    setTimeout(() => {
      res.json({
        success: true,
        events: mockCalendarEvents,
        message: 'Calendar events retrieved successfully'
      });
    }, 500);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve calendar events',
      error: error.message
    });
  }
});

// Event analysis endpoint
app.post('/api/analyze-event', async (req, res) => {
  try {
    const { eventId, event } = req.body;
    
    if (!eventId && !event) {
      return res.status(400).json({
        success: false,
        message: 'Event ID or event data is required'
      });
    }

    let eventToAnalyze;
    
    // If event data is provided directly (from Google Calendar), use it
    if (event) {
      eventToAnalyze = event;
    } else {
      // Otherwise, find the event by ID in mock events
      eventToAnalyze = mockCalendarEvents.find(e => e.id === eventId);
      
      if (!eventToAnalyze) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
    }

    // Check if event is a checklist/generated event (these should never be analyzed)
    if (eventToAnalyze.isChecklistEvent || eventToAnalyze.isGeneratedEvent) {
      return res.status(400).json({
        success: false,
        message: 'Generated events (from checklist items) cannot be analyzed'
      });
    }

    // Generate a unique cache key from event
    // Include id, title, date, and time to ensure uniqueness
    const eventIdentifier = eventToAnalyze.id || eventToAnalyze.eventId;
    const eventTime = eventToAnalyze.time || (eventToAnalyze.date && eventToAnalyze.date.includes('T') ? new Date(eventToAnalyze.date).toTimeString().slice(0, 8) : '');
    const eventDate = eventToAnalyze.date ? (typeof eventToAnalyze.date === 'string' && eventToAnalyze.date.includes('T') 
      ? new Date(eventToAnalyze.date).toISOString().split('T')[0] 
      : eventToAnalyze.date) : 'no-date';
    
    // Create a more unique cache key
    const cacheKey = eventIdentifier || `${eventToAnalyze.title}_${eventDate}_${eventTime}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check metadata to see if event has been analyzed
    const isAnalyzedInCache = analysisCache.isAnalyzed(cacheKey);
    
    // Attempt to load cached analysis
    let analysis = analysisCache.get(cacheKey);
    let fromCache = false;
    
    if (analysis) {
      fromCache = true;
      if (isAnalyzedInCache) {
        console.log(`Cached analysis found for event: ${cacheKey}`);
      } else {
        console.log(`Cached analysis exists without metadata for event: ${cacheKey}`);
      }
    } else if (isAnalyzedInCache) {
      console.log(`Cached metadata found but analysis expired, re-analyzing event: ${cacheKey}`);
    }

    if (!analysis) {
      // Check if event analyzer is available
      if (!eventAnalyzer) {
        return res.status(503).json({
          success: false,
          message: 'AI Event Analysis is not available. Please set OPENAI_API_KEY environment variable.'
        });
      }

      // Get Google OAuth tokens for document processing (if available)
      const tokens = req.session?.tokens || null;
      
      // Analyze the event using our AI agent (pass tokens for Google Docs processing)
      analysis = await eventAnalyzer.analyzeEvent(eventToAnalyze, tokens);
      fromCache = false;
    }

    // Refresh weather data when needed (handles cached analyses as well)
    const weatherUpdated = await refreshWeatherDataForAnalysis(analysis, eventToAnalyze);
    if (fromCache && weatherUpdated) {
      console.log(`Weather data refreshed for cached analysis: ${cacheKey}`);
    }

    // Store or refresh cache when analysis is new or weather info changed
    const shouldRefreshCache = !fromCache || weatherUpdated || !isAnalyzedInCache;
    if (shouldRefreshCache && eventToAnalyze.date) {
      analysisCache.set(cacheKey, analysis, eventToAnalyze.date);
    }
    
    // Don't mark the event as analyzed yet - wait until tasks are added
    // If this event is in Google Calendar, remove the isAnalyzed flag
    const tokens = req.session?.tokens;
    if (tokens && tokens.access_token && eventIdentifier && eventToAnalyze.source === 'google') {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        await calendar.events.patch({
          calendarId: 'primary',
          eventId: eventIdentifier,
          resource: {
            extendedProperties: {
              private: {
                isAnalyzed: 'false'
              }
            }
          }
        });
        console.log(`🔄 Removed analyzed flag from Google Calendar event: ${eventIdentifier}`);
      } catch (patchError) {
        console.error('⚠️ Failed to remove analyzed flag from Google Calendar:', patchError.message);
      }
    }

    // Get metadata for the event
    const metadata = analysisCache.getMetadata(cacheKey);

    res.json({
      success: true,
      event: { ...eventToAnalyze, isAnalyzed: false }, // Return as not analyzed until tasks are added
      analysis: analysis,
      fromCache: fromCache,
      metadata: metadata || { isAnalyzed: false, analyzedAt: new Date() },
      message: fromCache ? 'Analysis retrieved from cache' : 'Event analyzed successfully'
    });
  } catch (error) {
    console.error('Error analyzing event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze event',
      error: error.message
    });
  }
});

// Delete event endpoint
app.delete('/api/calendar/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const tokens = req.session?.tokens;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    let deletedFromGoogle = false;

    // If Google Calendar tokens provided, delete from Google Calendar
    if (tokens && tokens.access_token) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Check if event exists in Google Calendar
        try {
          await calendar.events.get({
            calendarId: 'primary',
            eventId: eventId
          });

          // Event exists, delete it
          await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId
          });

          deletedFromGoogle = true;
          console.log(`✅ Deleted event from Google Calendar: ${eventId}`);
        } catch (getError) {
          // Event not found in Google Calendar, continue to check mock events
          console.log(`ℹ️ Event not found in Google Calendar, checking mock events: ${eventId}`);
        }
      } catch (googleError) {
        console.error('❌ Error deleting from Google Calendar:', googleError.message);
        // Continue to try deleting from mock events
      }
    }

    // Delete from mock events (either as fallback or primary)
    const deletedEvent = eventsStore.deleteEvent(eventId);
    
    // Also check and remove from mockCalendarEvents array
    const mockIndex = mockCalendarEvents.findIndex(e => e.id === eventId || e.eventId === eventId);
    if (mockIndex !== -1) {
      mockCalendarEvents.splice(mockIndex, 1);
      console.log(`🗑️ Deleted event from mock calendar: ${eventId}`);
    }

    if (deletedFromGoogle || deletedEvent || mockIndex !== -1) {
      res.json({
        success: true,
        message: 'Event deleted successfully',
        deletedFromGoogle: deletedFromGoogle
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error.message
    });
  }
});

// Check event analysis status
app.get('/api/event-status/:eventId', (req, res) => {
  try {
    const { eventId } = req.params;
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    const metadata = analysisCache.getMetadata(eventId);
    const hasAnalysis = analysisCache.has(eventId);
    
    res.json({
      success: true,
      eventId: eventId,
      isAnalyzed: !!metadata,
      hasCachedAnalysis: hasAnalysis,
      metadata: metadata
    });
  } catch (error) {
    console.error('Error checking event status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check event status',
      error: error.message
    });
  }
});

// Add selected AI tasks as calendar events
app.post('/api/add-ai-tasks', async (req, res) => {
  try {
    const { selectedTasks, originalEventId } = req.body;

    if (!selectedTasks || !Array.isArray(selectedTasks) || selectedTasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected tasks array is required'
      });
    }

    if (!originalEventId) {
      return res.status(400).json({
        success: false,
        message: 'Original event ID is required'
      });
    }

    const addedEvents = [];
    const tokens = req.session?.tokens;
    let createdInGoogle = false;

    // If user has Google Calendar tokens, create events in Google Calendar
    if (tokens && tokens.access_token) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';

        // Fetch original event details to get the title
        let originalEventTitle = 'the event';
        try {
          const originalEvent = await calendar.events.get({
            calendarId: 'primary',
            eventId: originalEventId
          });
          originalEventTitle = originalEvent.data.summary || 'the event';
        } catch (err) {
          console.error('Could not fetch original event title:', err.message);
        }

        for (const task of selectedTasks) {
          const startDate = new Date(task.suggestedDate);
          const duration = 60; // Default 1 hour
          const endDate = new Date(startDate.getTime() + duration * 60000);

          const formatDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
          };

          // Ensure we have a valid task title
          const taskTitle = task.task || task.description?.split('.')[0] || task.description?.split(',')[0] || 'Preparation Task';
          
          const googleEvent = {
            summary: `📋 ${taskTitle}`,
            description: `AI-generated preparation task for "${originalEventTitle}".\n\n${task.description || ''}\n\nEstimated time: ${task.estimatedTime}\nPriority: ${task.priority}\nCategory: ${task.category}`,
            start: {
              dateTime: formatDateTime(startDate),
              timeZone: timeZone
            },
            end: {
              dateTime: formatDateTime(endDate),
              timeZone: timeZone
            },
            extendedProperties: {
              private: {
                isChecklistEvent: 'true',
                isGeneratedEvent: 'true',
                aiGenerated: 'true',
                isAIGenerated: 'true',
                originalEventId: originalEventId,
                originalEventTitle: originalEventTitle,
                priority: task.priority,
                category: task.category,
                estimatedTime: task.estimatedTime
              }
            }
          };

          const createdEvent = await calendar.events.insert({
            calendarId: 'primary',
            resource: googleEvent
          });

          addedEvents.push({
            id: createdEvent.data.id,
            title: `📋 ${taskTitle}`,
            type: 'ai-preparation',
            date: createdEvent.data.start.dateTime,
            endDate: createdEvent.data.end.dateTime,
            description: googleEvent.description,
            location: null,
            isAnalyzed: true,
            isChecklistEvent: true,
            isGeneratedEvent: true,
            isAIGenerated: true,
            source: 'google',
            originalEventId: originalEventId,
            originalEventTitle: originalEventTitle,
            priority: task.priority,
            category: task.category,
            estimatedTime: task.estimatedTime
          });
        }

        createdInGoogle = true;
        console.log(`✅ Created ${addedEvents.length} AI tasks in Google Calendar`);

        // Mark the original event as analyzed now that tasks have been added
        try {
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: originalEventId,
            resource: {
              extendedProperties: {
                private: {
                  isAnalyzed: 'true',
                  analyzedAt: new Date().toISOString(),
                  tasksCount: selectedTasks.length.toString()
                }
              }
            }
          });
          console.log(`✅ Marked original event as analyzed: ${originalEventId}`);
        } catch (patchError) {
          console.error('⚠️ Failed to mark original event as analyzed:', patchError.message);
        }

      } catch (googleError) {
        console.error('❌ Error creating tasks in Google Calendar:', googleError.message);
        // Fall through to create in mock events
      }
    }

    // If not created in Google Calendar, add to mock events
    if (!createdInGoogle) {
      let nextId = Math.max(...mockCalendarEvents.map(e => parseInt(e.id))) + 1;

      selectedTasks.forEach(task => {
        // Ensure we have a valid task title
        const taskTitle = task.task || task.description?.split('.')[0] || task.description?.split(',')[0] || 'Preparation Task';
        
        // Get original event title for mock events too
        let originalEventTitleForMock = 'the event';
        try {
          const originalEvent = mockCalendarEvents.find(e => e.id === originalEventId);
          if (originalEvent) {
            originalEventTitleForMock = originalEvent.title || 'the event';
          }
        } catch (err) {
          console.warn('Could not find original event for mock:', err.message);
        }
        
        const newEvent = {
          id: nextId.toString(),
          title: `📋 ${taskTitle}`,
          type: 'ai-preparation',
          date: task.suggestedDate,
          endDate: null,
          description: `AI-generated preparation task for "${originalEventTitleForMock}".\n\n${task.description || ''}\n\nEstimated time: ${task.estimatedTime}\nPriority: ${task.priority}\nCategory: ${task.category}`,
          location: null,
          isAnalyzed: true,
          isChecklistEvent: true,
          isGeneratedEvent: true,
          isAIGenerated: true,
          originalEventId: originalEventId,
          originalEventTitle: originalEventTitleForMock,
          taskId: task.id,
          priority: task.priority,
          category: task.category,
          estimatedTime: task.estimatedTime
        };

        mockCalendarEvents.push(newEvent);
        addedEvents.push(newEvent);
        nextId++;
      });
    }

    res.json({
      success: true,
      addedEvents: addedEvents,
      createdInGoogle: createdInGoogle,
      message: `Successfully added ${addedEvents.length} AI-generated preparation tasks${createdInGoogle ? ' to Google Calendar' : ''}`
    });
  } catch (error) {
    console.error('Error adding AI tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add AI tasks',
      error: error.message
    });
  }
});

// Get linked AI-generated tasks for an event
app.post('/api/get-linked-tasks', async (req, res) => {
  try {
    const { eventId } = req.body;
    const tokens = req.session?.tokens;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    const linkedTasks = [];

    // If user has Google Calendar tokens, fetch from Google Calendar
    if (tokens && tokens.access_token) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Fetch events from Google Calendar
        const now = new Date();
        const oneMonthLater = new Date(now);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: now.toISOString(),
          timeMax: oneMonthLater.toISOString(),
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime'
        });

        // Filter events that are linked to this event
        (response.data.items || []).forEach(event => {
          const originalEventId = event.extendedProperties?.private?.originalEventId;
          const isAIGenerated = event.extendedProperties?.private?.isAIGenerated === 'true' ||
                               event.extendedProperties?.private?.isChecklistEvent === 'true';

          if (originalEventId === eventId && isAIGenerated) {
            linkedTasks.push({
              id: event.id,
              title: event.summary,
              date: event.start?.dateTime || event.start?.date,
              endDate: event.end?.dateTime || event.end?.date,
              description: event.description || '',
              location: event.location || '',
              priority: event.extendedProperties?.private?.priority,
              category: event.extendedProperties?.private?.category,
              originalEventId: originalEventId,
              originalEventTitle: event.extendedProperties?.private?.originalEventTitle,
              isAIGenerated: true,
              isChecklistEvent: true,
              source: 'google'
            });
          }
        });

        console.log(`📋 Found ${linkedTasks.length} linked tasks for event ${eventId}`);

      } catch (googleError) {
        console.error('❌ Error fetching linked tasks from Google Calendar:', googleError.message);
        // Fall through to check mock events
      }
    }

    // If not found in Google Calendar, check mock events
    if (linkedTasks.length === 0) {
      mockCalendarEvents.forEach(event => {
        if (event.originalEventId === eventId && event.isAIGenerated) {
          linkedTasks.push(event);
        }
      });
    }

    res.json({
      success: true,
      linkedTasks: linkedTasks,
      count: linkedTasks.length
    });

  } catch (error) {
    console.error('Error fetching linked tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch linked tasks',
      error: error.message
    });
  }
});

// Get event title by ID (for displaying original event reference)
app.post('/api/get-event-title', async (req, res) => {
  try {
    const { eventId } = req.body;
    const tokens = req.session?.tokens;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    // Try to fetch from Google Calendar if user has tokens
    if (tokens && tokens.access_token) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const event = await calendar.events.get({
          calendarId: 'primary',
          eventId: eventId
        });

        return res.json({
          success: true,
          title: event.data.summary || 'Untitled Event'
        });
      } catch (googleError) {
        console.error('Error fetching event title from Google Calendar:', googleError.message);
      }
    }

    // Fallback to mock events if not found in Google Calendar
    const mockEvent = mockCalendarEvents.find(e => e.id === eventId);
    if (mockEvent) {
      return res.json({
        success: true,
        title: mockEvent.title
      });
    }

    res.json({
      success: false,
      message: 'Event not found'
    });

  } catch (error) {
    console.error('Error fetching event title:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event title',
      error: error.message
    });
  }
});

// Get weather for an event
app.post('/api/get-weather', async (req, res) => {
  try {
    const { location, eventDate, eventType, eventTitle } = req.body;

    console.log('🌤️ Weather API called:', { location, eventDate, eventType, eventTitle });

    if (!location || !eventDate) {
      return res.status(400).json({
        success: false,
        message: 'Location and event date are required'
      });
    }

    const weatherData = await weatherService.getWeatherForEvent(location, eventDate);

    console.log('🌤️ Weather service returned:', weatherData);

    if (!weatherData) {
      console.log('🌤️ No weather data available for this event');
      return res.json({
        success: true,
        weather: null,
        message: 'Weather data not available for this event'
      });
    }

    const suggestions = weatherService.generateWeatherSuggestions(
      weatherData,
      eventType,
      eventTitle
    );

    res.json({
      success: true,
      weather: {
        ...weatherData,
        suggestions
      }
    });

  } catch (error) {
    console.error('Error fetching weather:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data',
      error: error.message
    });
  }
});

// Uber service routes
app.use('/api/uber', uberRoutes);
app.use('/api/wishlist', wishlistRoutes);

// Initialize events store with mockCalendarEvents
eventsStore.initialize(mockCalendarEvents);

// Google Calendar routes
app.use('/api/google-calendar', googleCalendarRoutes);

// Voice assistant routes
app.use('/api/voice', voiceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Calendar events: http://localhost:${PORT}/api/calendar/events`);
});

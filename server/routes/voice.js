const express = require('express');
const router = express.Router();
const VoiceAdapterFactory = require('../services/voice/VoiceAdapterFactory');
const calendarConflictService = require('../services/calendarConflictService');
const eventsStore = require('../services/eventsStore');
const wishlistStore = require('../services/wishlistStore');

// Initialize voice adapter
let voiceAdapter;
try {
  voiceAdapter = VoiceAdapterFactory.createAdapter();
  console.log(`✅ Voice Adapter initialized: ${process.env.VOICE_ADAPTER || 'mock'}`);
} catch (error) {
  console.error('❌ Failed to initialize voice adapter:', error);
  voiceAdapter = VoiceAdapterFactory.createAdapter('mock');
}

/**
 * Process voice transcript and parse intent with follow-up question support
 */
router.post('/process', async (req, res) => {
  try {
    const { transcript, context = {} } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required'
      });
    }

    // Extract conversation state from context
    const conversationHistory = context.conversationHistory || [];
    const followUpCount = context.followUpCount || 0;

    // Parse intent and extract event details with conversation context
    const intentResult = await voiceAdapter.parseIntent(transcript, {
      currentDate: new Date().toISOString().split('T')[0],
      conversationHistory: conversationHistory,
      followUpCount: followUpCount,
      ...context
    });

    res.json({
      success: true,
      intent: intentResult.intent,
      eventDetails: intentResult.eventDetails || {},
      followUpQuestion: intentResult.followUpQuestion || null,
      missingInfo: intentResult.missingInfo || [],
      confidence: intentResult.confidence || 0.8,
      readyToProcess: intentResult.readyToProcess !== false,
      abort: intentResult.abort || false,
      abortMessage: intentResult.abortMessage || null,
      conversationHistory: intentResult.conversationHistory || conversationHistory
    });
  } catch (error) {
    console.error('Error processing voice input:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process voice input'
    });
  }
});

/**
 * Check for conflicts and suggest alternatives
 */
/**
 * Normalize events to a format compatible with conflict checking
 * Handles both Google Calendar events (with ISO date strings) and mock events
 */
function normalizeEventsForConflictCheck(events) {
  return events.map(event => {
    let dateStr, timeStr, duration;
    
    // Handle Google Calendar events (date is ISO string like "2024-01-15T14:30:00Z")
    if (event.date && (typeof event.date === 'string' && event.date.includes('T'))) {
      const dateTime = new Date(event.date);
      
      // Extract date in YYYY-MM-DD format (using local timezone to match conflict checker)
      const year = dateTime.getFullYear();
      const month = (dateTime.getMonth() + 1).toString().padStart(2, '0');
      const day = dateTime.getDate().toString().padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
      
      // Extract time in HH:MM format (using local timezone to match conflict checker)
      const hours = dateTime.getHours().toString().padStart(2, '0');
      const minutes = dateTime.getMinutes().toString().padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
      
      // Calculate duration from endDate if available
      if (event.endDate) {
        const start = new Date(event.date);
        const end = new Date(event.endDate);
        duration = Math.round((end - start) / 60000); // Convert ms to minutes
      } else {
        duration = event.duration || 60;
      }
    } 
    // Handle Date objects
    else if (event.date instanceof Date) {
      const year = event.date.getFullYear();
      const month = (event.date.getMonth() + 1).toString().padStart(2, '0');
      const day = event.date.getDate().toString().padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
      const hours = event.date.getHours().toString().padStart(2, '0');
      const minutes = event.date.getMinutes().toString().padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
      duration = event.duration || 60;
    }
    // Handle mock events with separate date and time fields
    else if (event.date && event.time) {
      // If date is already in YYYY-MM-DD format, use it; otherwise parse it
      if (typeof event.date === 'string' && event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateStr = event.date;
      } else {
        const date = new Date(event.date);
        dateStr = date.toISOString().split('T')[0];
      }
      // Ensure time is in HH:MM format
      if (typeof event.time === 'string' && event.time.match(/^\d{1,2}:\d{2}$/)) {
        // Normalize time format (e.g., "9:30" -> "09:30")
        const [h, m] = event.time.split(':').map(Number);
        timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      } else {
        timeStr = event.time;
      }
      duration = event.duration || 60;
    }
    // Fallback: try to parse any date-like field
    else {
      console.warn('Unable to normalize event for conflict check:', { 
        id: event.id, 
        title: event.title, 
        date: event.date,
        time: event.time 
      });
      return null;
    }
    
    return {
      ...event,
      date: dateStr,
      time: timeStr,
      duration: duration
    };
  }).filter(event => event !== null); // Remove null entries
}

router.post('/check-conflict', async (req, res) => {
  try {
    const { eventDetails, existingEvents, tokens } = req.body;

    if (!eventDetails || !eventDetails.date || !eventDetails.time) {
      return res.status(400).json({
        success: false,
        error: 'Event details with date and time are required'
      });
    }

    // Normalize existing events to ensure they have date, time, and duration
    let events = existingEvents || [];
    events = normalizeEventsForConflictCheck(events);
    
    console.log(`📅 Checking conflicts against ${events.length} normalized events`);

    // If tokens provided, fetch real calendar events from Google Calendar
    if (tokens && tokens.access_token) {
      try {
        // Fetch Google Calendar events
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Get events for the next 30 days
        const now = new Date();
        const thirtyDaysLater = new Date();
        thirtyDaysLater.setDate(now.getDate() + 30);
        
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: now.toISOString(),
          timeMax: thirtyDaysLater.toISOString(),
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime'
        });
        
        if (response.data.items) {
          const googleEvents = response.data.items.map(event => {
            const start = event.start?.dateTime || event.start?.date;
            const end = event.end?.dateTime || event.end?.date;
            return {
              id: event.id,
              title: event.summary || 'No Title',
              date: start,
              endDate: end,
              source: 'google'
            };
          });
          
          // Merge with existing events and normalize
          events = normalizeEventsForConflictCheck([...events, ...googleEvents]);
          console.log(`📅 Added ${googleEvents.length} Google Calendar events for conflict checking`);
        }
      } catch (googleError) {
        console.error('Error fetching Google Calendar events for conflict check:', googleError);
        // Continue with existing events if Google fetch fails
      }
    }

    // Check for conflicts
    const conflictResult = calendarConflictService.checkConflict(
      {
        date: eventDetails.date,
        time: eventDetails.time,
        duration: eventDetails.duration || 60
      },
      events
    );

    let alternatives = [];
    let conflictResponse = null;

    if (conflictResult.hasConflict) {
      // Find alternative slots
      const requestedDate = new Date(eventDetails.date + 'T00:00:00');
      alternatives = calendarConflictService.getAlternativeSuggestions(
        {
          date: eventDetails.date,
          duration: eventDetails.duration || 60
        },
        events,
        3
      );

      // Generate AI response with alternatives and override option
      conflictResponse = await voiceAdapter.generateConflictResponse(
        {
          conflictingEvent: conflictResult.conflictingEvent,
          requestedTime: eventDetails.time,
          requestedDate: eventDetails.date
        },
        alternatives
      );
    }

    res.json({
      success: true,
      hasConflict: conflictResult.hasConflict,
      conflictInfo: conflictResult.hasConflict ? {
        conflictingEvent: conflictResult.conflictingEvent,
        conflicts: conflictResult.conflicts
      } : null,
      alternatives: alternatives,
      response: conflictResponse || await voiceAdapter.generateResponse({
        type: 'success',
        message: 'No conflicts found'
      }),
      allowOverride: true // Always allow double booking
    });
  } catch (error) {
    console.error('Error checking conflict:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check conflict'
    });
  }
});

/**
 * Create calendar event (with optional override for conflicts)
 */
router.post('/create-event', async (req, res) => {
  try {
    const { eventDetails, override = false } = req.body;
    // Use tokens from session instead of request body for security
    const tokens = req.session?.tokens || req.body.tokens;

    console.log(`📅 Creating voice event: ${eventDetails?.title}`);
    console.log(`🔑 Tokens available: ${!!tokens}, From session: ${!!req.session?.tokens}`);

    if (!eventDetails || !eventDetails.title || !eventDetails.date || !eventDetails.time) {
      return res.status(400).json({
        success: false,
        error: 'Event details with title, date, and time are required'
      });
    }

    // Validate event details
    const validation = voiceAdapter.validateEventDetails(eventDetails);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event details',
        errors: validation.errors
      });
    }

    // LLM should return properly formatted date/time, but we validate and normalize here
    const duration = eventDetails.duration || 60; // Default 60 minutes
    const eventDate = eventDetails.date;
    let eventTime = eventDetails.time;
    
    // Normalize time format (LLM should return HH:MM, but handle edge cases)
    if (eventTime && !eventTime.includes(':')) {
      // Handle edge cases where time might not be properly formatted
      const timeMatch = eventTime.match(/(\d{1,2}):?(\d{2})?\s?(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const period = timeMatch[3]?.toLowerCase();
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        eventTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid time format. Expected HH:MM format.'
        });
      }
    }
    
    // Validate and normalize date format (LLM should return YYYY-MM-DD)
    let normalizedDate = eventDate;
    if (!eventDate || !eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const dateObj = new Date(eventDate);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Expected YYYY-MM-DD format.'
        });
      }
      normalizedDate = dateObj.toISOString().split('T')[0];
    }
    
    // Create datetime string (local time)
    const startDateTime = `${normalizedDate}T${eventTime}:00`;
    const startDate = new Date(startDateTime);
    
    // Validate the date was parsed correctly
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date or time format. Unable to parse event date/time.'
      });
    }
    
    const endDate = new Date(startDate.getTime() + duration * 60000);

    // Create event object
    let event = {
      id: `voice_${Date.now()}`,
      title: eventDetails.title,
      date: startDate.toISOString(),
      endDate: endDate.toISOString(),
      time: eventTime,
      duration: duration,
      location: eventDetails.location || null,
      description: eventDetails.description || '',
      type: _determineEventType(eventDetails.title),
      source: tokens ? 'google' : 'voice',
      isAnalyzed: false,
      isAIGenerated: true
    };

    let eventCreatedInGoogle = false;

    // If Google Calendar tokens provided, create in Google Calendar
    if (tokens && tokens.access_token) {
      try {
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials(tokens);
        
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Get user's timezone (default to America/New_York if not available)
        // TODO: Get timezone from user preferences or detect from tokens
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
        
        // Format dates in the specified timezone for Google Calendar
        const formatDateTime = (date, timezone) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        };
        
        // Create event in Google Calendar
        const googleEvent = {
          summary: eventDetails.title,
          description: eventDetails.description || '',
          location: eventDetails.location || '',
          start: {
            dateTime: formatDateTime(startDate, timeZone),
            timeZone: timeZone
          },
          end: {
            dateTime: formatDateTime(endDate, timeZone),
            timeZone: timeZone
          },
          extendedProperties: {
            private: {
              isAIGenerated: 'true',
              createdByVoice: 'true'
            }
          }
        };
        
        console.log(`📅 Creating Google Calendar event:`, {
          title: googleEvent.summary,
          start: googleEvent.start.dateTime,
          timezone: timeZone
        });
        
        const createdEvent = await calendar.events.insert({
          calendarId: 'primary',
          resource: googleEvent
        });

        // Update event with Google Calendar data
        event.id = createdEvent.data.id;
        event.date = createdEvent.data.start.dateTime || createdEvent.data.start.date;
        event.endDate = createdEvent.data.end.dateTime || createdEvent.data.end.date;
        event.source = 'google';
        event.isAIGenerated = true; // Ensure this is set on the returned event
        eventCreatedInGoogle = true;

        console.log(`✅ Created event in Google Calendar: ${event.title} (ID: ${event.id})`);
        console.log(`🤖 AI-generated flag set: ${event.isAIGenerated}`);
      } catch (googleError) {
        console.error('❌ Error creating Google Calendar event:', googleError);
        console.error('Error details:', {
          message: googleError.message,
          code: googleError.code,
          response: googleError.response?.data
        });
        // Fall through to create in local events as fallback
        console.log('⚠️ Google Calendar creation failed, adding to local calendar');
        eventCreatedInGoogle = false;
        
        // If it's an authentication error, throw it so user knows to re-authenticate
        if (googleError.code === 401 || googleError.code === 403) {
          throw new Error('Google Calendar authentication failed. Please sign in again.');
        }
      }
    }

    // Add to local events store for UI updates
    // If created in Google Calendar, it will be fetched on next refresh
    // But we add it locally for immediate UI feedback
    if (!eventCreatedInGoogle) {
      // For non-Google events, add to local store
      eventsStore.addEvent(event);
    }
    // Note: Google Calendar events will appear automatically when calendar is refreshed
    // since they're fetched from Google Calendar API

    // Generate success response
    const response = await voiceAdapter.generateResponse({
      type: 'success',
      eventTitle: eventDetails.title,
      date: eventDetails.date,
      time: eventDetails.time,
      override: override,
      location: eventDetails.location
    });

    res.json({
      success: true,
      event: event,
      response: response,
      message: override ? 
        'Event created despite conflict. You chose to double book.' : 
        `Event created successfully${eventCreatedInGoogle ? ' in Google Calendar' : ' in local calendar'}`,
      createdInGoogle: eventCreatedInGoogle
    });
  } catch (error) {
    console.error('❌ Error in create-event endpoint:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create event',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Generate voice response for any scenario
 */
router.post('/generate-response', async (req, res) => {
  try {
    const { responseData } = req.body;

    if (!responseData) {
      return res.status(400).json({
        success: false,
        error: 'Response data is required'
      });
    }

    const response = await voiceAdapter.generateResponse(responseData);

    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate response'
    });
  }
});

/**
 * Add item to wishlist via voice
 */
router.post('/add-to-wishlist', async (req, res) => {
  try {
    const { eventDetails } = req.body;

    if (!eventDetails || !eventDetails.title) {
      return res.status(400).json({
        success: false,
        error: 'Event details with title are required'
      });
    }

    const wishlistItem = wishlistStore.addItem({
      title: eventDetails.title,
      description: eventDetails.description || null,
      date: eventDetails.date || null,
      time: eventDetails.time || null,
      priority: 'medium',
      location: eventDetails.location || null,
      category: null,
      source: 'voice'
    });

    const response = await voiceAdapter.generateResponse({
      type: 'wishlist_added',
      itemTitle: wishlistItem.title,
      hasDateTime: !!(wishlistItem.date && wishlistItem.time)
    });

    res.json({
      success: true,
      item: wishlistItem,
      response: response || `Added "${wishlistItem.title}" to your wishlist. I'll suggest it when you have free time!`
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add to wishlist'
    });
  }
});

function _determineEventType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('dental') || lower.includes('doctor') || lower.includes('appointment')) {
    return 'Appointment';
  } else if (lower.includes('meeting')) {
    return 'Meeting';
  } else if (lower.includes('travel') || lower.includes('trip')) {
    return 'Travel';
  } else if (lower.includes('practice') || lower.includes('rehearsal')) {
    // Check practice BEFORE music/concert to avoid misclassification
    return 'Band Practice';
  } else if (lower.includes('concert') || lower.includes('show') || 
             (lower.includes('music') && !lower.includes('practice'))) {
    return 'Concert';
  }
  return 'General';
}

module.exports = router;


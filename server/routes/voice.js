const express = require('express');
const router = express.Router();
const VoiceAdapterFactory = require('../services/voice/VoiceAdapterFactory');
const calendarConflictService = require('../services/calendarConflictService');

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
 * Process voice transcript and parse intent
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

    // Parse intent and extract event details
    const intentResult = await voiceAdapter.parseIntent(transcript, {
      currentDate: new Date().toISOString().split('T')[0],
      ...context
    });

    res.json({
      success: true,
      intent: intentResult.intent,
      eventDetails: intentResult.eventDetails,
      confidence: intentResult.confidence
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
    const { eventDetails, tokens, override = false } = req.body;

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

    // If tokens provided and override is false, check for conflicts
    if (tokens && tokens.access_token && !override) {
      // TODO: Fetch and check conflicts from Google Calendar
      // For now, we'll proceed with creation
    }

    // Create event object
    const event = {
      id: `event_${Date.now()}`,
      title: eventDetails.title,
      date: `${eventDetails.date}T${eventDetails.time}:00`,
      time: eventDetails.time,
      duration: eventDetails.duration || 60,
      location: eventDetails.location || null,
      type: _determineEventType(eventDetails.title),
      source: tokens ? 'google' : 'voice'
    };

    // If Google Calendar tokens provided, create in Google Calendar
    if (tokens && tokens.access_token) {
      // TODO: Implement Google Calendar event creation
      // For now, return success
    }

    // Generate success response
    const response = await voiceAdapter.generateResponse({
      type: 'success',
      eventTitle: eventDetails.title,
      date: eventDetails.date,
      time: eventDetails.time,
      override: override
    });

    res.json({
      success: true,
      event: event,
      response: response,
      message: override ? 
        'Event created despite conflict. You chose to double book.' : 
        'Event created successfully'
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create event'
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

function _determineEventType(title) {
  const lower = title.toLowerCase();
  if (lower.includes('dental') || lower.includes('doctor') || lower.includes('appointment')) {
    return 'Appointment';
  } else if (lower.includes('meeting')) {
    return 'Meeting';
  } else if (lower.includes('travel') || lower.includes('trip')) {
    return 'Travel';
  } else if (lower.includes('concert') || lower.includes('show')) {
    return 'Concert';
  }
  return 'General';
}

module.exports = router;


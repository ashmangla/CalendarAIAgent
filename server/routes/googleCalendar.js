const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// Google OAuth2 client
let oauth2Client;

// Initialize OAuth2 client
function initOAuth2Client() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/google-calendar/callback'
    );
  }
  return oauth2Client;
}

// Generate authorization URL
router.get('/auth-url', (req, res) => {
  try {
    const oauth2Client = initOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.readonly' // For Google Docs access (Phase 1)
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
    
    res.json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?error=no_code`);
    }

    const oauth2Client = initOAuth2Client();

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    const userInfo = userInfoResponse.data;

    // Store tokens and user info in session (expires in 3 days)
    req.session.tokens = tokens;
    req.session.userInfo = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.verified_email
    };

    // Save session and redirect
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?error=session_failed`);
      }

      // Redirect back to client with success indicator
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?auth=success`);
    });
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?error=auth_failed`);
  }
});

// Fetch calendar events
router.post('/events', async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens) {
      return res.status(400).json({
        success: false,
        error: 'No authentication tokens provided'
      });
    }
    
    const oauth2Client = initOAuth2Client();
    oauth2Client.setCredentials(tokens);
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Set time window to one month from now (only fetch future events)
    const now = new Date();
    // Ensure we're getting events from today onwards, not past
    now.setHours(0, 0, 0, 0); // Start from beginning of today
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(), // Only fetch events from today onwards
      timeMax: oneMonthLater.toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    // Process events - keep at least one instance of recurring events
    const recurringEventSeries = new Set();
    const events = (response.data.items || [])
      .filter(event => {
        // Keep non-recurring events
        if (!event.recurrence && !event.recurringEventId) {
          return true;
        }
        
        // For recurring events with recurringEventId (instances of recurring events)
        // Keep only the first instance of each series
        if (event.recurringEventId) {
          if (recurringEventSeries.has(event.recurringEventId)) {
            return false; // Skip duplicate instances
          }
          recurringEventSeries.add(event.recurringEventId);
          return true; // Keep first instance
        }
        
        // For events with recurrence rules (parent recurring events)
        // Keep these as they represent the recurring series
        if (event.recurrence && !recurringEventSeries.has(event.id)) {
          recurringEventSeries.add(event.id);
          return true;
        }
        
        return false;
      })
      .map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        
        // Determine event type based on title and description
        // For checklist events, ensure the title is properly extracted
        let title = event.summary || 'Untitled Event';
        
        // If title starts with 📋 but is just the emoji or placeholder, extract from description
        if ((event.extendedProperties?.private?.isChecklistEvent === 'true' || 
             event.extendedProperties?.private?.isGeneratedEvent === 'true') &&
            (title === '📋' || title === '📋 ' || title.includes('Prep:') || title.includes('Prep for'))) {
          // Try to extract task title from description
          const descMatch = event.description?.match(/^📋\s*(.+?)(?:\n|$)/);
          if (descMatch) {
            title = `📋 ${descMatch[1]}`;
          }
        }
        
        const description = event.description || '';
        
        let type = 'general';
        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();
        
        if (titleLower.includes('meeting') || descLower.includes('meeting') || 
            titleLower.includes('call') || descLower.includes('call')) {
          type = 'meeting';
        } else if (titleLower.includes('travel') || titleLower.includes('trip') || 
                   titleLower.includes('flight') || titleLower.includes('train')) {
          type = 'travel';
        } else if (titleLower.includes('practice') || titleLower.includes('rehearsal') || 
                   titleLower.includes('training') || titleLower.includes('workout')) {
          // Check practice BEFORE music to avoid misclassifying "music band practice" as concert
          type = 'band practice';
        } else if (titleLower.includes('concert') || titleLower.includes('show') || 
                   (titleLower.includes('music') && !titleLower.includes('practice'))) {
          // Only classify as concert if it's music-related but NOT practice
          type = 'concert';
        } else if (titleLower.includes('pickup') || titleLower.includes('delivery') || 
                   titleLower.includes('appointment') || titleLower.includes('doctor')) {
          type = 'pickup';
        } else if (titleLower.includes('birthday') || titleLower.includes('anniversary') || 
                   titleLower.includes('party') || titleLower.includes('celebration')) {
          type = 'celebration';
        } else if (titleLower.includes('deadline') || titleLower.includes('due') || 
                   titleLower.includes('project') || titleLower.includes('work')) {
          type = 'work';
        }
        
        // Check if this event was created by voice assistant
        const isAIGenerated = event.extendedProperties?.private?.isAIGenerated === 'true' ||
                             event.extendedProperties?.private?.createdByVoice === 'true' ||
                             event.extendedProperties?.private?.aiGenerated === 'true';

        // Check if this event has been analyzed
        const isAnalyzed = event.extendedProperties?.private?.isAnalyzed === 'true';

        // Check if this is a checklist/generated event
        const isChecklistEvent = event.extendedProperties?.private?.isChecklistEvent === 'true';
        const isGeneratedEvent = event.extendedProperties?.private?.isGeneratedEvent === 'true';

        // Debug logging for AI-generated events
        if (isAIGenerated) {
          console.log(`🤖 Found AI-generated event: ${title} (Extended props: ${JSON.stringify(event.extendedProperties)})`);
        }

        // Debug logging for analyzed events
        if (isAnalyzed) {
          console.log(`✓ Found analyzed event: ${title}`);
        }

        return {
          id: event.id || `google-${Date.now()}-${Math.random()}`,
          title: title,
          type: type,
          date: start,
          endDate: end,
          description: description,
          location: event.location || '',
          isAnalyzed: isAnalyzed,
          isAIGenerated: isAIGenerated,
          isChecklistEvent: isChecklistEvent,
          isGeneratedEvent: isGeneratedEvent,
          originalEventId: event.extendedProperties?.private?.originalEventId,
          originalEventTitle: event.extendedProperties?.private?.originalEventTitle,
          source: 'google',
          colorId: event.colorId || null, // Include Google Calendar colorId
          attendees: event.attendees ? event.attendees.length : 0,
          allDay: !event.start?.dateTime, // true if only date is provided
          isRecurring: !!(event.recurrence || event.recurringEventId)
        };
      })
      .slice(0, 50); // Limit to 50 events
    
    res.json({
      success: true,
      events: events
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user information
router.post('/user-info', async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens) {
      return res.status(400).json({
        success: false,
        error: 'No authentication tokens provided'
      });
    }
    
    const oauth2Client = initOAuth2Client();
    oauth2Client.setCredentials(tokens);
    
    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    res.json({
      success: true,
      user: {
        id: userInfo.data.id,
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
        verified_email: userInfo.data.verified_email
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Revoke tokens (sign out)
router.post('/revoke', async (req, res) => {
  try {
    const { tokens } = req.body;
    
    if (!tokens || !tokens.access_token) {
      return res.status(400).json({
        success: false,
        error: 'No access token provided'
      });
    }
    
    const oauth2Client = initOAuth2Client();
    oauth2Client.setCredentials(tokens);
    
    // Revoke the token
    await oauth2Client.revokeToken(tokens.access_token);
    
    res.json({
      success: true,
      message: 'Tokens revoked successfully'
    });
  } catch (error) {
    console.error('Error revoking tokens:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res) => {
  try {
    const { tokens } = req.body;

    if (!tokens || !tokens.refresh_token) {
      return res.status(400).json({
        success: false,
        error: 'No refresh token provided'
      });
    }

    const oauth2Client = initOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const newTokens = await oauth2Client.refreshAccessToken();

    // Update session with new tokens
    if (req.session) {
      req.session.tokens = newTokens.credentials;
    }

    res.json({
      success: true,
      tokens: newTokens.credentials
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check session status
router.get('/session', (req, res) => {
  try {
    if (req.session && req.session.tokens && req.session.userInfo) {
      res.json({
        success: true,
        isAuthenticated: true,
        userInfo: req.session.userInfo,
        tokens: req.session.tokens
      });
    } else {
      res.json({
        success: true,
        isAuthenticated: false
      });
    }
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Logout and destroy session
router.post('/logout', async (req, res) => {
  try {
    // Revoke tokens if available
    if (req.session && req.session.tokens) {
      try {
        const oauth2Client = initOAuth2Client();
        oauth2Client.setCredentials(req.session.tokens);
        await oauth2Client.revokeToken(req.session.tokens.access_token);
      } catch (error) {
        console.warn('Failed to revoke tokens:', error);
      }
    }

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to logout'
        });
      }

      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

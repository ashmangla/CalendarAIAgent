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
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google-calendar/callback'
    );
  }
  return oauth2Client;
}

// Generate authorization URL
router.get('/auth-url', (req, res) => {
  try {
    const oauth2Client = initOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
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
    
    // Store tokens (in production, use a proper database)
    // For now, we'll pass tokens to the client
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}?tokens=${encodeURIComponent(JSON.stringify(tokens))}`);
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
    
    // Set time window to one month from now
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
        const title = event.summary || 'Untitled Event';
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
        } else if (titleLower.includes('concert') || titleLower.includes('music') || 
                   titleLower.includes('show') || titleLower.includes('performance')) {
          type = 'concert';
        } else if (titleLower.includes('practice') || titleLower.includes('rehearsal') || 
                   titleLower.includes('training') || titleLower.includes('workout')) {
          type = 'band practice';
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
        
        return {
          id: event.id || `google-${Date.now()}-${Math.random()}`,
          title: title,
          type: type,
          date: start,
          endDate: end,
          description: description,
          location: event.location || '',
          isAnalyzed: false,
          aiGenerated: false,
          source: 'google',
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

module.exports = router;

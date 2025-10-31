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
      'https://www.googleapis.com/auth/calendar.readonly'
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
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    const events = (response.data.items || []).map(event => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      
      // Determine event type
      const title = event.summary || 'Untitled Event';
      const description = event.description || '';
      
      let type = 'general';
      if (title.toLowerCase().includes('meeting') || description.toLowerCase().includes('meeting')) {
        type = 'meeting';
      } else if (title.toLowerCase().includes('travel') || title.toLowerCase().includes('trip')) {
        type = 'travel';
      } else if (title.toLowerCase().includes('concert') || title.toLowerCase().includes('music')) {
        type = 'concert';
      } else if (title.toLowerCase().includes('practice') || title.toLowerCase().includes('rehearsal')) {
        type = 'band practice';
      } else if (title.toLowerCase().includes('pickup')) {
        type = 'pickup';
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
        source: 'google'
      };
    });
    
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

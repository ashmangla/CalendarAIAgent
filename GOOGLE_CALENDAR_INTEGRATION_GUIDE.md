# Google Calendar Integration Guide

Complete setup guide for integrating Google Calendar with your Calendar AI Agent app.

## Overview

This app supports **server-side Google Calendar integration** for secure access to your Google Calendar events, with a fallback to sample data for testing.

### Current Status

✅ **Fully Implemented:**
- Server-side OAuth flow
- Google Calendar API integration
- Event fetching and transformation
- Secure token management
- Fallback to sample data

✅ **Configuration Complete:**
- API Key configured
- Client ID configured
- Client Secret configured
- Redirect URI configured (port 5001)

## Quick Start: Test with Sample Data

**Recommended for immediate testing:**
1. Visit `http://localhost:3000`
2. Click "Calendar Events" tab
3. Choose "📅 Continue with Sample Data"
4. Access:
   - ✅ 10 sample calendar events
   - ✅ AI event analysis
   - ✅ Event categorization
   - ✅ Preparation task suggestions
   - ✅ Uber booking integration

## Full Google Calendar Setup

### Step 1: Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Enable **Google Calendar API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### Step 2: Create OAuth Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Select "Web application"
4. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://yourdomain.com  (for production)
   ```
5. Add **Authorized redirect URIs**:
   ```
   http://localhost:5001/api/google-calendar/callback
   ```
6. Copy your **Client ID** and **Client Secret**

### Step 3: Environment Setup

**Server-side `.env`** (in project root):
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5001/api/google-calendar/callback
CLIENT_URL=http://localhost:3000
PORT=5001
```

**Client-side `.env`** (in `client` directory):
```env
REACT_APP_GOOGLE_API_KEY=your_api_key_here
REACT_APP_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

### Step 4: Add Test Users (Required for Testing)

Since your app is in testing mode, you need to add test users:

1. Go to Google Cloud Console > "APIs & Services" > "OAuth consent screen"
2. If your app is **External**, scroll to "Test users" section
3. Click "+ ADD USERS"
4. Enter your Google email address
5. Click "ADD" and "SAVE"
6. Wait 5-10 minutes for changes to propagate

**Note:** If you don't see "Test users" section:
- Your app might be "Internal" (Workspace only)
- Or your app might already be published
- Or you're in the wrong Google Cloud project

### Step 5: Start the Application

```bash
# From project root
npm run dev
```

This starts both:
- Server on `http://localhost:5001`
- Client on `http://localhost:3000`

## Using the Integration

### Option 1: Google Calendar

1. Visit `http://localhost:3000`
2. Click "Calendar Events" tab
3. Choose "Sign in with Google"
4. Complete OAuth flow in popup
5. View your real Google Calendar events

### Option 2: Sample Data

1. Visit `http://localhost:3000`
2. Click "Calendar Events" tab
3. Choose "📅 Continue with Sample Data"
4. Access all features with sample events

## Features

### Google Calendar Integration
- 🔐 Secure server-side authentication
- 📅 Real-time calendar events
- 🔄 Automatic token refresh
- 👤 Multi-user support

### AI Analysis
- 🤖 Event analysis and insights
- 📋 Preparation task suggestions
- ⏱️ Time estimates
- 📊 Priority categorization

### Event Management
- 🏷️ Automatic event categorization
- 🔄 Easy disconnect/reconnect
- 📍 Location support
- 📝 Description parsing

## Troubleshooting

### Error: "CalendarAI has not completed Google verification"

**Solution:** Add yourself as a test user (see Step 4 above)

### Error: "Failed to connect to Google Calendar"

**Check:**
- Server is running on port 5001
- `.env` files are configured correctly
- Client secret is valid
- Redirect URI matches Google Console

### Port 5000 Conflicts

**Solution:** Server is configured to use port 5001 to avoid conflicts

### Can't Find Test Users Section

**Reasons:**
- App is marked as "Internal" (Workspace only)
- App is already published
- Wrong Google Cloud project selected

**Solution:** Use sample data for testing (all features work)

## Security

- ✅ **Server-side OAuth** - Tokens never exposed to client
- ✅ **Secure token storage** - Managed by Google's OAuth system
- ✅ **Token refresh** - Automatic renewal
- ✅ **User control** - Revoke access anytime
- ✅ **No data storage** - Calendar data never stored on server

## Architecture

```
Browser → React App → Server OAuth → Google Calendar API
                      ↓
                  Mock Data (fallback)
```

**Benefits:**
- More secure (tokens on server)
- More reliable (no CORS issues)
- Better error handling
- Scalable for multiple users

## Files

**Server:**
- `server/routes/googleCalendar.js` - OAuth and API routes
- `server/server.js` - Main server with route integration
- `.env` - Server environment variables

**Client:**
- `client/src/components/GoogleAuth.js` - Authentication UI
- `client/src/components/CalendarEvents.js` - Event display
- `client/src/services/googleCalendarServiceServer.js` - Service layer
- `client/.env` - Client environment variables

## Next Steps

1. ✅ **Test with sample data** - Verify all features work
2. ⏳ **Add test users** - Enable Google Calendar access
3. 🚀 **Publish app** - Make it available to others (optional)

## Support

If you encounter issues:
1. Check `.env` files are correctly configured
2. Verify Google Cloud Console settings
3. Check server logs for detailed errors
4. Use "Continue with Sample Data" for immediate testing

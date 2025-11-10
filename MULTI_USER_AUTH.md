# Multi-User OAuth with localStorage

## Overview

The Calendar AI Agent now supports multi-user authentication, allowing multiple Google accounts to be stored and accessed on the same browser. This feature uses browser `localStorage` for client-side token management while maintaining backward compatibility with the original session-based authentication.

## Key Features

- **Multiple Accounts**: Store and switch between multiple Google accounts
- **Persistent Login**: Users stay logged in across browser sessions
- **Account Switcher UI**: Easy dropdown interface to switch between accounts
- **Hybrid Authentication**: Supports both localStorage (new) and session (legacy) approaches
- **Automatic Token Refresh**: Tokens are refreshed automatically before expiry
- **User Data Isolation**: Each user's tasks, events, and preferences are kept separate

## Architecture

### Client-Side Components

#### 1. AuthService (`client/src/services/authService.js`)
Centralized service for managing user authentication in localStorage.

**localStorage Structure:**
```javascript
{
  "cal_ai_current_user": "user@example.com",
  "cal_ai_users": {
    "user@example.com": {
      "userInfo": {
        "id": "123456",
        "email": "user@example.com",
        "name": "John Doe",
        "picture": "https://...",
        "verified_email": true
      },
      "tokens": {
        "access_token": "ya29...",
        "refresh_token": "1//...",
        "expiry_date": 1234567890
      },
      "lastUsed": 1234567890
    }
  }
}
```

**Key Methods:**
- `storeUserAuth(email, tokens, userInfo)` - Save user credentials
- `getCurrentUser()` - Get active user
- `switchUser(email)` - Switch to different account
- `getAllUsers()` - List all stored accounts
- `removeUser(email)` - Sign out a specific user
- `getTokensForCurrentUser()` - Get tokens for API calls
- `isTokenExpired(tokens)` - Check token expiry
- `clearAllAuth()` - Sign out all accounts

#### 2. Axios Interceptors (`client/src/services/axiosConfig.js`)
Automatically injects authentication tokens into API requests and handles token refresh.

**Features:**
- Adds `Authorization: Bearer <token>` header to requests
- Checks token expiry before each request
- Automatically refreshes expired tokens
- Retries failed requests after token refresh
- Triggers re-authentication if refresh fails

#### 3. UserSwitcher Component (`client/src/components/UserSwitcher.js`)
UI component for account management.

**Features:**
- Shows all stored accounts
- Indicates current user with checkmark
- "+ Add Account" button
- Individual "Sign out" for each account
- "Sign out all accounts" option
- Profile pictures and email display

### Server-Side Components

#### 1. Authentication Middleware (`server/middleware/authMiddleware.js`)
Hybrid middleware that accepts tokens from multiple sources.

**Token Sources (in priority order):**
1. `Authorization: Bearer <token>` header (new client-side auth)
2. `req.body.tokens` (existing pattern)
3. `req.session.tokens` (legacy session-based auth)

**Features:**
- Validates token expiry
- Fetches user info from tokens
- Attaches `req.auth = { tokens, userInfo, source }` to request
- Maintains backward compatibility

#### 2. Updated Routes
All protected routes now use `authMiddleware` or `optionalAuth`:
- `/api/analyze-event`
- `/api/generate-meal-plan`
- `/api/add-ai-tasks`
- `/api/get-remaining-tasks`
- `/api/get-linked-tasks`
- `/api/calendar/*` routes (in `googleCalendar.js`)
- `/api/wishlist/*` routes (in `wishlist.js`)

#### 3. Task Cache Scoping (`server/services/taskCache.js`)
Task cache now scopes by user email for multi-user isolation.

**Cache Key Format:**
- New: `"user@example.com:eventId123"`
- Legacy: `"eventId123"` (backward compatible)

**Methods Updated:**
- `setRemainingTasks(eventId, tasks, userEmail)`
- `getRemainingTasks(eventId, userEmail)`
- `markTasksCompleted(eventId, tasks, userEmail)`
- `clear(eventId, userEmail)`
- `getRemainingCount(eventId, userEmail)`

## Authentication Flow

### 1. Initial OAuth Flow

```
User clicks "Connect Google Calendar"
    ↓
Client requests auth URL from server
    ↓
User redirected to Google OAuth consent screen
    ↓
User authorizes app
    ↓
Google redirects to /api/google-calendar/callback
    ↓
Server exchanges code for tokens
    ↓
Server encodes {tokens, userInfo} as base64
    ↓
Redirect to client with ?auth=success&data=<base64>
    ↓
Client decodes and stores in localStorage
    ↓
User is authenticated!
```

### 2. Token Usage

```
User makes API request
    ↓
Axios interceptor checks token expiry
    ↓
If expired/expiring soon:
  - Call /api/calendar/refresh-token
  - Update localStorage with new tokens
  - Retry request with new token
    ↓
Add Authorization header to request
    ↓
Server receives request
    ↓
authMiddleware extracts token
    ↓
Server validates and processes request
```

### 3. Account Switching

```
User clicks account in UserSwitcher
    ↓
authService.switchUser(email)
    ↓
Update cal_ai_current_user in localStorage
    ↓
Page reloads
    ↓
App initializes with new user's tokens
    ↓
All API calls now use new user's context
```

## Token Lifecycle

### Token Expiry
- **Access Token**: Typically expires in 1 hour
- **Refresh Token**: Long-lived (weeks/months)

### Automatic Refresh
- Tokens are checked before each API request
- If expiry is within 5 minutes, token is refreshed
- Refresh happens transparently to the user

### Token Refresh Failure
If refresh fails (e.g., user revoked access):
1. User is removed from localStorage
2. `auth:token-expired` event is dispatched
3. Alert shown: "Your session has expired. Please sign in again."
4. User must re-authenticate

## Security Considerations

### localStorage Security
**Risks:**
- Vulnerable to XSS attacks if malicious JavaScript runs
- Tokens stored in plain text (not encrypted)

**Mitigations:**
- Use short-lived access tokens (1 hour)
- Implement Content Security Policy (CSP) headers
- Sanitize all user inputs
- Never use `eval()` or dangerous `innerHTML` patterns
- HTTPS only in production

### Token Storage
**What's Stored:**
- Access tokens (short-lived)
- Refresh tokens (long-lived but can be revoked)
- User profile info (name, email, picture)

**What's NOT Stored:**
- Passwords (handled by Google)
- Sensitive PII beyond basic profile

### Best Practices
1. **Always use HTTPS** in production
2. **Implement CSP headers** to prevent XSS
3. **Clear localStorage on explicit logout**
4. **Rotate tokens** regularly through refresh
5. **Validate all tokens** server-side

## User Experience

### For New Users
1. Click "Connect Google Calendar"
2. Authorize with Google
3. Start using the app immediately
4. Login persists across browser sessions

### For Returning Users
1. Open app - automatically logged in
2. See UserSwitcher with current account
3. Click to add another account or switch

### Adding Multiple Accounts
1. Click "+ Add another account" in UserSwitcher
2. Authorize new Google account
3. Both accounts now available in switcher
4. Switch anytime with one click

### Signing Out
**Individual Account:**
- Click "×" next to account in UserSwitcher
- That account removed, others remain
- Automatically switches to remaining account

**All Accounts:**
- Click "Sign out all accounts"
- All data cleared from localStorage
- Must re-authenticate to use app

## Backward Compatibility

The hybrid authentication system maintains full backward compatibility:

### Session-Based Auth (Legacy)
Still works for:
- Existing sessions from before the update
- Users who disable localStorage
- Testing/development environments

### Migration Path
- Existing users automatically migrated on next login
- Old sessions continue to work
- New sessions stored in localStorage
- No user action required

## Troubleshooting

### Tokens Not Refreshing
**Symptoms:** 401 errors, "Token expired" messages
**Solutions:**
1. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
2. Verify refresh token is stored in localStorage
3. Check browser console for refresh errors
4. Try signing out and signing in again

### UserSwitcher Not Showing
**Symptoms:** Can't see account switcher in header
**Solutions:**
1. Ensure user is authenticated (`isGoogleConnected === true`)
2. Check localStorage for stored users
3. Verify `UserSwitcher` component is imported in `App.js`
4. Check browser console for React errors

### Tasks Not Isolated Between Users
**Symptoms:** User A sees User B's tasks
**Solutions:**
1. Verify `userEmail` is being passed to taskCache methods
2. Check `authMiddleware` is extracting user info correctly
3. Clear taskCache with `taskCache.clearAll()` and re-analyze events
4. Check server logs for userEmail in cache operations

### localStorage Full Error
**Symptoms:** "QuotaExceededError" in console
**Solutions:**
1. Clear old/unused accounts from localStorage
2. Use "Sign out all accounts" to reset
3. localStorage limit is ~5-10MB (should be plenty for auth data)

## API Reference

### Client-Side

#### authService
```javascript
import authService from './services/authService';

// Store user
authService.storeUserAuth(email, tokens, userInfo);

// Get current user
const user = authService.getCurrentUser();
// Returns: { userInfo, tokens, lastUsed }

// Switch user
authService.switchUser('other@example.com');

// Check token expiry
if (authService.isTokenExpired(tokens)) {
  // Refresh needed
}

// Remove user
authService.removeUser('user@example.com');

// Clear all
authService.clearAllAuth();
```

#### Axios (Automatic)
```javascript
// Axios automatically adds headers
import axios from 'axios';

// Just make requests normally
const response = await axios.post('/api/analyze-event', { event });
// Authorization header added automatically
```

### Server-Side

#### authMiddleware
```javascript
const { authMiddleware, requireAuth, optionalAuth } = require('./middleware/authMiddleware');

// Optional auth (works with or without token)
app.post('/api/some-endpoint', optionalAuth, (req, res) => {
  const tokens = req.auth?.tokens || null;
  const userInfo = req.auth?.userInfo || null;
  // ...
});

// Required auth (401 if no token)
app.post('/api/protected', requireAuth, (req, res) => {
  // req.auth guaranteed to exist
  const { tokens, userInfo } = req.auth;
  // ...
});
```

#### taskCache
```javascript
const taskCache = require('./services/taskCache');

// Store tasks (with user email)
taskCache.setRemainingTasks(eventId, tasks, userEmail);

// Get tasks
const tasks = taskCache.getRemainingTasks(eventId, userEmail);

// Mark complete
taskCache.markTasksCompleted(eventId, completedTasks, userEmail);

// Clear
taskCache.clear(eventId, userEmail);

// Backward compatible (userEmail optional)
const tasks = taskCache.getRemainingTasks(eventId); // Works without userEmail
```

## Future Enhancements

### Planned Features
- **Token Encryption**: Encrypt tokens in localStorage
- **Account Nicknames**: Let users name accounts ("Work", "Personal")
- **Quick Switch**: Keyboard shortcut for account switching
- **Account Activity**: Show "Last used" timestamp for each account
- **Auto-Cleanup**: Remove inactive accounts after X days

### Potential Improvements
- **Biometric Auth**: Use WebAuthn for additional security layer
- **Push Notifications**: Notify user when token is about to expire
- **Account Sync**: Sync accounts across devices (requires backend storage)
- **Admin Dashboard**: View all authenticated users (enterprise feature)

## Related Documentation

- `ARCHITECTURE.md` - Overall system architecture
- `README.md` - Setup and installation instructions
- `GOOGLE_CALENDAR_INTEGRATION_GUIDE.md` - Google Calendar setup

## Support

For issues or questions about multi-user authentication:
1. Check this documentation
2. Review browser console for errors
3. Check server logs for auth issues
4. Open an issue on GitHub with logs and steps to reproduce


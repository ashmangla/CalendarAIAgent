/**
 * Authentication Middleware for Hybrid Auth
 * Supports both legacy session-based and new token-based authentication
 */

const { google } = require('googleapis');

/**
 * Initialize OAuth2 client for token validation
 */
function initOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Extract user info from tokens
 * @param {object} tokens - OAuth tokens
 * @returns {Promise<object>} User info from Google
 */
async function getUserInfoFromTokens(tokens) {
  try {
    const oauth2Client = initOAuth2Client();
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfoResponse = await oauth2.userinfo.get();
    
    return {
      id: userInfoResponse.data.id,
      email: userInfoResponse.data.email,
      name: userInfoResponse.data.name,
      picture: userInfoResponse.data.picture,
      verified_email: userInfoResponse.data.verified_email
    };
  } catch (error) {
    console.error('Error fetching user info from tokens:', error.message);
    return null;
  }
}

/**
 * Authentication middleware - extracts tokens from multiple sources
 * Priority:
 * 1. Authorization header (Bearer token)
 * 2. Request body tokens
 * 3. Session tokens (backward compatibility)
 * 
 * Attaches req.auth = { tokens, userInfo } if authentication is found
 */
async function authMiddleware(req, res, next) {
  let tokens = null;
  let userInfo = null;
  let source = null;

  // 1. Check Authorization header (new client-side auth)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Construct tokens object from bearer token
    tokens = {
      access_token: accessToken
    };
    
    // Try to get refresh token and other info from body if available
    if (req.body && req.body.tokens) {
      tokens = {
        ...req.body.tokens,
        access_token: accessToken // Override with header token
      };
    }
    
    source = 'header';
  }
  
  // 2. Check request body for tokens (existing pattern)
  if (!tokens && req.body && req.body.tokens) {
    tokens = req.body.tokens;
    source = 'body';
  }
  
  // 3. Check session for tokens (legacy backward compatibility)
  if (!tokens && req.session && req.session.tokens) {
    tokens = req.session.tokens;
    userInfo = req.session.userInfo || null;
    source = 'session';
  }

  // If no tokens found, continue without auth (some endpoints may not require it)
  if (!tokens) {
    return next();
  }

  // Validate token by checking expiry
  if (tokens.expiry_date) {
    const now = Date.now();
    if (tokens.expiry_date <= now) {
      console.warn('⚠️  Access token expired');
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
  }

  // If we don't have userInfo yet (from session), try to fetch it
  if (!userInfo && tokens.access_token) {
    userInfo = await getUserInfoFromTokens(tokens);
  }

  // Attach auth data to request
  req.auth = {
    tokens,
    userInfo,
    source // Useful for debugging
  };

  console.log(`🔐 Auth: ${source} | User: ${userInfo?.email || 'unknown'}`);
  
  next();
}

/**
 * Require authentication middleware
 * Use this after authMiddleware to enforce authentication
 */
function requireAuth(req, res, next) {
  if (!req.auth || !req.auth.tokens) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  next();
}

/**
 * Optional authentication middleware
 * Runs authMiddleware but doesn't require auth (for endpoints that work with or without auth)
 */
const optionalAuth = authMiddleware;

module.exports = {
  authMiddleware,
  requireAuth,
  optionalAuth
};


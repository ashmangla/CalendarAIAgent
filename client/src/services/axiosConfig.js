/**
 * Axios Configuration with Interceptors
 * Handles token injection and automatic refresh
 */

import axios from 'axios';
import authService from './authService';

// Track if we're currently refreshing to avoid multiple refresh calls
let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Subscribe to token refresh completion
 * @param {function} callback - Called when refresh completes
 */
function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers that token refresh completed
 * @param {object} newTokens - Refreshed tokens
 */
function onTokenRefreshed(newTokens) {
  refreshSubscribers.forEach(callback => callback(newTokens));
  refreshSubscribers = [];
}

/**
 * Refresh the access token for current user
 * @returns {Promise<object>} New tokens
 */
async function refreshAccessToken() {
  const user = authService.getCurrentUser();
  
  if (!user || !user.tokens || !user.tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  try {
    console.log('🔄 Refreshing access token...');
    
    const response = await axios.post('/api/calendar/refresh-token', {
      tokens: user.tokens
    });

    if (response.data.success && response.data.tokens) {
      const newTokens = response.data.tokens;
      const userEmail = user.userInfo.email;
      
      // Update tokens in localStorage
      authService.updateUserTokens(userEmail, newTokens);
      
      console.log('✅ Token refreshed successfully');
      return newTokens;
    } else {
      throw new Error('Token refresh failed');
    }
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    throw error;
  }
}

/**
 * Request Interceptor - Inject authentication token
 */
axios.interceptors.request.use(
  async (config) => {
    // Skip token injection for auth-related endpoints that don't need it
    const noAuthEndpoints = [
      '/api/calendar/auth-url',
      '/api/calendar/callback'
    ];
    
    if (noAuthEndpoints.some(endpoint => config.url?.includes(endpoint))) {
      return config;
    }

    // Get tokens from localStorage
    const tokens = authService.getTokensForCurrentUser();
    
    if (tokens && tokens.access_token) {
      // Check if token is expired or expiring soon
      if (authService.isTokenExpired(tokens)) {
        console.log('⚠️  Token expired or expiring soon, will refresh');
        
        // If already refreshing, wait for it
        if (isRefreshing) {
          console.log('⏳ Waiting for ongoing token refresh...');
          return new Promise((resolve) => {
            subscribeTokenRefresh((newTokens) => {
              config.headers.Authorization = `Bearer ${newTokens.access_token}`;
              resolve(config);
            });
          });
        }
        
        // Start refresh process
        isRefreshing = true;
        try {
          const newTokens = await refreshAccessToken();
          isRefreshing = false;
          onTokenRefreshed(newTokens);
          config.headers.Authorization = `Bearer ${newTokens.access_token}`;
        } catch (error) {
          isRefreshing = false;
          console.error('❌ Failed to refresh token in request interceptor');
          // Continue with expired token, let response interceptor handle 401
        }
      } else {
        // Token is valid, add to headers
        config.headers.Authorization = `Bearer ${tokens.access_token}`;
      }
    }
    
    // For backward compatibility, also send tokens in body for specific endpoints
    // This allows the server to work with both new (header) and old (body) patterns
    const bodyTokenEndpoints = [
      '/api/calendar/events',
      '/api/calendar/create-event',
      '/api/calendar/delete-event',
      '/api/calendar/user-info'
    ];
    
    if (bodyTokenEndpoints.some(endpoint => config.url?.includes(endpoint))) {
      if (tokens && config.method === 'post') {
        // Add tokens to request body if not already present
        if (config.data && !config.data.tokens) {
          config.data = {
            ...config.data,
            tokens
          };
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor - Handle 401 errors with token refresh
 */
axios.interceptors.response.use(
  (response) => {
    // Success response, return as-is
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if the error is specifically about token expiration
      const isTokenError = 
        error.response?.data?.error?.includes('token') ||
        error.response?.data?.error?.includes('auth') ||
        error.response?.data?.message?.includes('token');

      if (isTokenError) {
        originalRequest._retry = true;

        // If already refreshing, wait for it
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((newTokens) => {
              originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
              resolve(axios(originalRequest));
            });
          });
        }

        // Try to refresh token
        isRefreshing = true;
        
        try {
          const newTokens = await refreshAccessToken();
          isRefreshing = false;
          onTokenRefreshed(newTokens);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newTokens.access_token}`;
          
          // Update body tokens if present
          if (originalRequest.data && typeof originalRequest.data === 'string') {
            try {
              const data = JSON.parse(originalRequest.data);
              if (data.tokens) {
                data.tokens = newTokens;
                originalRequest.data = JSON.stringify(data);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }

          return axios(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          
          console.error('❌ Token refresh failed, user needs to re-authenticate');
          
          // Remove current user from storage
          const userEmail = authService.getCurrentUserEmail();
          if (userEmail) {
            authService.removeUser(userEmail);
          }

          // Dispatch custom event to trigger re-authentication UI
          window.dispatchEvent(new CustomEvent('auth:token-expired', {
            detail: { userEmail }
          }));

          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Configure axios defaults
 */
axios.defaults.withCredentials = true; // For backward compatibility with session cookies
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

console.log('✅ Axios interceptors configured for multi-user auth');

export default axios;


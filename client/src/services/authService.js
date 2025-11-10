/**
 * Authentication Service for Multi-User OAuth
 * Manages localStorage for multiple Google accounts
 */

const STORAGE_KEYS = {
  CURRENT_USER: 'cal_ai_current_user',
  USERS: 'cal_ai_users'
};

class AuthService {
  /**
   * Store user authentication data in localStorage
   * @param {string} userEmail - User's email address
   * @param {object} tokens - OAuth tokens { access_token, refresh_token, expiry_date }
   * @param {object} userInfo - User info { id, email, name, picture, verified_email }
   */
  storeUserAuth(userEmail, tokens, userInfo) {
    try {
      const users = this.getAllUsers();
      
      users[userEmail] = {
        userInfo,
        tokens,
        lastUsed: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userEmail);
      
      console.log('✅ Stored auth for user:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ Error storing user auth:', error);
      return false;
    }
  }

  /**
   * Get currently active user's email
   * @returns {string|null} Current user email or null
   */
  getCurrentUserEmail() {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  }

  /**
   * Get currently active user's full data
   * @returns {object|null} User data { userInfo, tokens, lastUsed } or null
   */
  getCurrentUser() {
    const currentEmail = this.getCurrentUserEmail();
    if (!currentEmail) return null;

    const users = this.getAllUsers();
    return users[currentEmail] || null;
  }

  /**
   * Get user info for current user
   * @returns {object|null} User info or null
   */
  getCurrentUserInfo() {
    const user = this.getCurrentUser();
    return user ? user.userInfo : null;
  }

  /**
   * Get tokens for current user
   * @returns {object|null} Tokens or null
   */
  getTokensForCurrentUser() {
    const user = this.getCurrentUser();
    return user ? user.tokens : null;
  }

  /**
   * Switch to a different stored user
   * @param {string} userEmail - Email of user to switch to
   * @returns {boolean} Success status
   */
  switchUser(userEmail) {
    try {
      const users = this.getAllUsers();
      
      if (!users[userEmail]) {
        console.warn('⚠️  User not found:', userEmail);
        return false;
      }
      
      // Update lastUsed timestamp
      users[userEmail].lastUsed = Date.now();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userEmail);
      
      console.log('✅ Switched to user:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ Error switching user:', error);
      return false;
    }
  }

  /**
   * Get all stored users
   * @returns {object} Object with email as key and user data as value
   */
  getAllUsers() {
    try {
      const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
      return usersJson ? JSON.parse(usersJson) : {};
    } catch (error) {
      console.error('❌ Error reading users from localStorage:', error);
      return {};
    }
  }

  /**
   * Get list of user emails
   * @returns {string[]} Array of user emails
   */
  getUserEmails() {
    const users = this.getAllUsers();
    return Object.keys(users);
  }

  /**
   * Remove a user from storage
   * @param {string} userEmail - Email of user to remove
   * @returns {boolean} Success status
   */
  removeUser(userEmail) {
    try {
      const users = this.getAllUsers();
      const currentUser = this.getCurrentUserEmail();
      
      if (!users[userEmail]) {
        console.warn('⚠️  User not found:', userEmail);
        return false;
      }
      
      delete users[userEmail];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      
      // If we removed the current user, switch to another or clear
      if (currentUser === userEmail) {
        const remainingEmails = Object.keys(users);
        if (remainingEmails.length > 0) {
          this.switchUser(remainingEmails[0]);
        } else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        }
      }
      
      console.log('✅ Removed user:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ Error removing user:', error);
      return false;
    }
  }

  /**
   * Check if access token is expired or will expire soon
   * @param {object} tokens - Token object with expiry_date
   * @param {number} bufferMinutes - Minutes before expiry to consider expired (default: 5)
   * @returns {boolean} True if expired or expiring soon
   */
  isTokenExpired(tokens, bufferMinutes = 5) {
    if (!tokens || !tokens.expiry_date) {
      return true; // No token or no expiry date means expired
    }
    
    const expiryDate = tokens.expiry_date;
    const now = Date.now();
    const bufferMs = bufferMinutes * 60 * 1000;
    
    return expiryDate <= (now + bufferMs);
  }

  /**
   * Update tokens for a specific user
   * @param {string} userEmail - User's email
   * @param {object} newTokens - New tokens to store
   * @returns {boolean} Success status
   */
  updateUserTokens(userEmail, newTokens) {
    try {
      const users = this.getAllUsers();
      
      if (!users[userEmail]) {
        console.warn('⚠️  User not found:', userEmail);
        return false;
      }
      
      users[userEmail].tokens = newTokens;
      users[userEmail].lastUsed = Date.now();
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      
      console.log('✅ Updated tokens for user:', userEmail);
      return true;
    } catch (error) {
      console.error('❌ Error updating tokens:', error);
      return false;
    }
  }

  /**
   * Clear all authentication data (global logout)
   */
  clearAllAuth() {
    try {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      console.log('✅ Cleared all authentication data');
      return true;
    } catch (error) {
      console.error('❌ Error clearing auth data:', error);
      return false;
    }
  }

  /**
   * Check if any users are stored
   * @returns {boolean} True if at least one user is stored
   */
  hasStoredUsers() {
    const users = this.getAllUsers();
    return Object.keys(users).length > 0;
  }

  /**
   * Get user by email
   * @param {string} userEmail - Email to look up
   * @returns {object|null} User data or null
   */
  getUser(userEmail) {
    const users = this.getAllUsers();
    return users[userEmail] || null;
  }

  /**
   * Check if a specific user exists in storage
   * @param {string} userEmail - Email to check
   * @returns {boolean} True if user exists
   */
  hasUser(userEmail) {
    const users = this.getAllUsers();
    return !!users[userEmail];
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;


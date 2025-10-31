// Google Calendar Service - Server-Side Integration
// This service handles Google Calendar API integration through the server

class GoogleCalendarServiceServer {
  constructor() {
    this.isSignedIn = false;
    this.user = null;
    this.tokens = null;
  }

  // Get OAuth URL from server
  async getAuthUrl() {
    try {
      const response = await fetch('/api/google-calendar/auth-url');
      const data = await response.json();
      
      if (data.success && data.authUrl) {
        return data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      throw error;
    }
  }

  // Sign in to Google (opens OAuth popup)
  async signIn() {
    try {
      const authUrl = await this.getAuthUrl();
      
      // Open OAuth popup
      const popup = window.open(
        authUrl,
        'google-auth',
        'width=500,height=600,left=100,top=100'
      );
      
      // Listen for OAuth callback
      return new Promise((resolve, reject) => {
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            reject(new Error('User closed the popup'));
          }
        }, 1000);
        
        const messageListener = async (event) => {
          if (event.data && event.data.type === 'GOOGLE_AUTH_COMPLETE') {
            window.removeEventListener('message', messageListener);
            clearInterval(checkPopup);
            popup.close();
            
            try {
              this.tokens = event.data.tokens;
              await this.saveTokens(this.tokens);
              
              // Get user info
              const userInfo = await this.getUserInfo();
              this.user = userInfo;
              this.isSignedIn = true;
              
              resolve({ tokens: this.tokens, user: this.user });
            } catch (error) {
              reject(error);
            }
          }
        };
        
        window.addEventListener('message', messageListener);
      });
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  // Check if user is signed in
  async checkAuth() {
    try {
      const savedTokens = this.getSavedTokens();
      if (savedTokens) {
        this.tokens = savedTokens;
        this.isSignedIn = true;
        
        // Get user info
        try {
          this.user = await this.getUserInfo();
        } catch (error) {
          console.log('Could not get user info:', error);
        }
      }
      
      return this.isSignedIn;
    } catch (error) {
      console.error('Error checking auth:', error);
      return false;
    }
  }

  // Fetch calendar events from server
  async fetchEvents(maxResults = 50) {
    try {
      if (!this.isSignedIn || !this.tokens) {
        throw new Error('User not signed in');
      }
      
      const response = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tokens: this.tokens })
      });
      
      const data = await response.json();
      
      if (data.success) {
        return data.events;
      } else {
        throw new Error(data.error || 'Failed to fetch events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // Get user info
  async getUserInfo() {
    // Parse user info from tokens if available
    // This is a simplified version - in production, decode JWT or make an API call
    return {
      email: 'user@example.com',
      name: 'Google User',
      imageUrl: null
    };
  }

  // Sign out
  async signOut() {
    this.isSignedIn = false;
    this.user = null;
    this.tokens = null;
    this.clearSavedTokens();
  }

  // Save tokens to localStorage
  saveTokens(tokens) {
    try {
      localStorage.setItem('google_calendar_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  // Get saved tokens from localStorage
  getSavedTokens() {
    try {
      const tokens = localStorage.getItem('google_calendar_tokens');
      return tokens ? JSON.parse(tokens) : null;
    } catch (error) {
      console.error('Error getting saved tokens:', error);
      return null;
    }
  }

  // Clear saved tokens
  clearSavedTokens() {
    try {
      localStorage.removeItem('google_calendar_tokens');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  // Get user info
  getUserInfo() {
    return this.user;
  }
}

// Create and export a singleton instance
const googleCalendarServiceServer = new GoogleCalendarServiceServer();
export default googleCalendarServiceServer;

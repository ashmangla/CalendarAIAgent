// Google Calendar Service
// This service handles Google Calendar API integration

class GoogleCalendarService {
  constructor() {
    this.gapi = null;
    this.isSignedIn = false;
    this.user = null;
    this.isInitialized = false;
  }

  // Initialize Google API
  async initialize() {
    return new Promise((resolve, reject) => {
      if (this.isInitialized) {
        resolve();
        return;
      }

      // Check if environment variables are present
      if (!process.env.REACT_APP_GOOGLE_API_KEY || !process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        reject(new Error('Google API credentials not found. Please check your .env file.'));
        return;
      }

      // Set a timeout for script loading
      const timeout = setTimeout(() => {
        reject(new Error('Google API script loading timeout'));
      }, 10000); // 10 second timeout

      // Load Google Identity Services (new library)
      if (!window.google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('Google Identity Services script loaded');
          clearTimeout(timeout);
          this.initializeGapi().then(resolve).catch(reject);
        };
        
        script.onerror = (error) => {
          console.error('Failed to load Google Identity Services script:', error);
          clearTimeout(timeout);
          reject(new Error('Failed to load Google Identity Services script'));
        };
        
        document.head.appendChild(script);
      } else {
        clearTimeout(timeout);
        this.initializeGapi().then(resolve).catch(reject);
      }
    });
  }

  // Initialize Google Identity Services
  async initializeGapi() {
    try {
      console.log('Initializing Google Identity Services...');
      console.log('API Key:', process.env.REACT_APP_GOOGLE_API_KEY ? 'Present' : 'Missing');
      console.log('Client ID:', process.env.REACT_APP_GOOGLE_CLIENT_ID ? 'Present' : 'Missing');
      
      // Initialize Google Identity Services
      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: (response) => {
          console.log('OAuth response received');
          // Handle OAuth response
          this.isSignedIn = true;
        }
      });

      console.log('Google Identity Services initialized successfully');
      this.isInitialized = true;
      this.isSignedIn = false; // User needs to sign in

      return true;
    } catch (error) {
      console.error('Error initializing Google Identity Services:', error);
      let errorMessage = 'Unknown error';
      
      if (error && typeof error === 'object') {
        // Handle Error objects
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        } else if (error.error) {
          errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        } else {
          errorMessage = JSON.stringify(error);
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      throw new Error(`Google API initialization failed: ${errorMessage}`);
    }
  }

  // Sign in to Google
  async signIn() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const authInstance = this.gapi.auth2.getAuthInstance();
      const user = await authInstance.signIn();
      this.isSignedIn = true;
      this.user = user.getBasicProfile();
      return user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  // Sign out from Google
  async signOut() {
    try {
      if (this.gapi && this.gapi.auth2) {
        const authInstance = this.gapi.auth2.getAuthInstance();
        await authInstance.signOut();
        this.isSignedIn = false;
        this.user = null;
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Get user info
  getUserInfo() {
    if (this.user) {
      return {
        name: this.user.getName(),
        email: this.user.getEmail(),
        imageUrl: this.user.getImageUrl()
      };
    }
    return null;
  }

  // Fetch calendar events
  async fetchEvents(maxResults = 50) {
    try {
      if (!this.isSignedIn) {
        throw new Error('User not signed in');
      }

      const response = await this.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return this.transformGoogleEvents(response.result.items || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  // Transform Google Calendar events to our format
  transformGoogleEvents(googleEvents) {
    return googleEvents.map((event, index) => {
      const start = event.start?.dateTime || event.start?.date;
      const end = event.end?.dateTime || event.end?.date;
      
      // Determine event type based on title and description
      const title = event.summary || 'Untitled Event';
      const description = event.description || '';
      const location = event.location || '';
      
      let type = 'general';
      if (title.toLowerCase().includes('meeting') || description.toLowerCase().includes('meeting')) {
        type = 'meeting';
      } else if (title.toLowerCase().includes('travel') || title.toLowerCase().includes('trip') || 
                 description.toLowerCase().includes('travel') || description.toLowerCase().includes('flight')) {
        type = 'travel';
      } else if (title.toLowerCase().includes('concert') || title.toLowerCase().includes('music') ||
                 description.toLowerCase().includes('concert') || description.toLowerCase().includes('music')) {
        type = 'concert';
      } else if (title.toLowerCase().includes('practice') || title.toLowerCase().includes('rehearsal')) {
        type = 'band practice';
      } else if (title.toLowerCase().includes('pickup') || title.toLowerCase().includes('pick up')) {
        type = 'pickup';
      }

      return {
        id: event.id || `google-${index}`,
        title: title,
        type: type,
        date: start,
        endDate: end,
        description: description,
        location: location,
        isAnalyzed: false,
        aiGenerated: false,
        source: 'google'
      };
    });
  }

  // Check if Google Calendar is available
  isAvailable() {
    return this.isInitialized && this.gapi && this.gapi.client && this.gapi.client.calendar;
  }
}

// Create and export a singleton instance
const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;

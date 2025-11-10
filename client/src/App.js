import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import './services/axiosConfig'; // Import axios configuration (sets up interceptors)
import authService from './services/authService';
import axios from 'axios';
import CalendarEvents from './components/CalendarEvents';
import Wishlist from './components/Wishlist';
import VoiceAssistant from './components/VoiceAssistant';
import UserSwitcher from './components/UserSwitcher';
import logo from './images/Logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [userInfo, setUserInfo] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [disconnectHandler, setDisconnectHandler] = useState(null);
  const [refreshEventsHandler, setRefreshEventsHandler] = useState(null);
  const [voiceAssistantHandler, setVoiceAssistantHandler] = useState(null);
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [events, setEvents] = useState([]);
  const eventsRef = useRef([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const wishlistItemsRef = useRef([]);

  const handleDisconnect = () => {
    if (disconnectHandler) {
      disconnectHandler();
    }
    setUserInfo(null);
    setIsGoogleConnected(false);
  };

  const handleRefreshEvents = () => {
    if (refreshEventsHandler) {
      refreshEventsHandler();
    }
  };

  // Memoize the onUserInfoChange callback to prevent infinite loops
  const handleUserInfoChange = useCallback((info, connected) => {
    setUserInfo(info);
    setIsGoogleConnected(connected);
  }, []);

  // Memoize the onDisconnectRequest callback
  const handleDisconnectRequest = useCallback((handler) => {
    setDisconnectHandler(() => handler);
  }, []);

  // Memoize the onRefreshEventsRequest callback
  const handleRefreshEventsRequest = useCallback((handler) => {
    setRefreshEventsHandler(() => handler);
  }, []);

  // Memoize the onVoiceAssistantRequest callback
  const handleVoiceAssistantRequest = useCallback((handler) => {
    setVoiceAssistantHandler(() => handler);
  }, []);

  const handleVoiceAssistant = () => {
    setShowVoiceAssistant(prev => !prev);
  };

  // Handle events update from CalendarEvents
  const handleEventsUpdate = useCallback((newEvents) => {
    setEvents(newEvents);
    eventsRef.current = newEvents;
  }, []);

  // Fetch events for voice assistant (needed for conflict checking)
  const fetchEventsForVoice = useCallback(async () => {
    try {
      const response = await axios.get('/api/calendar/events');
      if (response.data.success) {
        const fetchedEvents = response.data.events || [];
        setEvents(fetchedEvents);
        eventsRef.current = fetchedEvents;
        return fetchedEvents;
      }
      return eventsRef.current;
    } catch (error) {
      console.error('Error fetching events for voice assistant:', error);
      return eventsRef.current || [];
    }
  }, []);

  // Fetch wishlist items for voice assistant context
  const fetchWishlistForVoice = useCallback(async () => {
    try {
      const response = await axios.get('/api/wishlist/items');
      if (response.data.success) {
        const items = response.data.items || [];
        setWishlistItems(items);
        wishlistItemsRef.current = items;
        return items;
      }
      return wishlistItemsRef.current || [];
    } catch (error) {
      console.error('Error fetching wishlist for voice assistant:', error);
      return wishlistItemsRef.current || [];
    }
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    console.log('🔄 Initializing auth from localStorage...');
    const currentUser = authService.getCurrentUser();
    
    if (currentUser && currentUser.userInfo) {
      console.log('✅ Found stored user:', currentUser.userInfo.email);
      
      // Set user info from localStorage
      setUserInfo({
        name: currentUser.userInfo.name,
        email: currentUser.userInfo.email,
        imageUrl: currentUser.userInfo.picture,
        verified_email: currentUser.userInfo.verified_email
      });
      setIsGoogleConnected(true);
    } else {
      console.log('ℹ️  No stored user found');
    }

    // Listen for token expiration events
    const handleTokenExpired = (event) => {
      console.warn('⚠️  Token expired for user:', event.detail.userEmail);
      // User will need to re-authenticate
      setUserInfo(null);
      setIsGoogleConnected(false);
      alert('Your session has expired. Please sign in again.');
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
  }, []);

  // Fetch events and wishlist when voice assistant is opened (if not already loaded)
  useEffect(() => {
    if (showVoiceAssistant) {
      if (eventsRef.current.length === 0) {
        fetchEventsForVoice();
      }
      if (wishlistItemsRef.current.length === 0) {
        fetchWishlistForVoice();
      }
    }
  }, [showVoiceAssistant, fetchEventsForVoice, fetchWishlistForVoice]);

  // Handlers for UserSwitcher
  const handleUserSwitch = (newUserEmail) => {
    console.log('👤 User switched to:', newUserEmail);
    // Page will reload after switch
  };

  const handleAddAccount = () => {
    console.log('➕ Adding new account...');
    // Trigger OAuth flow (will be handled by CalendarEvents component)
    if (disconnectHandler) {
      // This will trigger the connect flow
      setActiveTab('calendar');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1 className="app-title">
            <img src={logo} alt="MotherBoard Logo" className="app-logo" />
            MotherBoard
          </h1>
          <div className="header-actions">
            <button
              className="header-action-btn voice-btn"
              onClick={handleVoiceAssistant}
              title="Voice Assistant"
            >
              🎤 Voice
            </button>
            {(activeTab === 'calendar' || activeTab === 'today') && (
              <button
                className="header-action-btn"
                onClick={handleRefreshEvents}
                title="Refresh Events"
              >
                🔄 Refresh
              </button>
            )}
            {isGoogleConnected && userInfo && (
              <>
                <UserSwitcher
                  currentUserEmail={userInfo.email}
                  onUserSwitch={handleUserSwitch}
                  onAddAccount={handleAddAccount}
                />
                <div className="google-user-info-header">
                  <img
                    src={userInfo.imageUrl}
                  alt={userInfo.name}
                  className="user-avatar-header"
                />
                <div className="user-details-header">
                  <span className="user-name-header">{userInfo.name}</span>
                  <span className="user-email-header">{userInfo.email}</span>
                </div>
                <button
                  className="disconnect-btn-header"
                  onClick={handleDisconnect}
                  title="Disconnect from Google Calendar"
                >
                  Sign Out
                </button>
              </div>
              </>
            )}
          </div>
        </div>
        
        <nav className="app-nav">
          <button
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button
            className={`nav-btn ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Today's Events
          </button>
          <button
            className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Generate Event Milestones
          </button>
          <button
            className={`nav-btn ${activeTab === 'wishlist' ? 'active' : ''}`}
            onClick={() => setActiveTab('wishlist')}
          >
            🌟 Wishlist
          </button>
        </nav>
      </header>

      <div className="app-content">
          {activeTab === 'home' && (
            <div className="welcome-section">
              <h2>Welcome to MotherBoard</h2>
              <p className="welcome-subtitle">Your intelligent calendar assistant that helps you prepare for events, manage your schedule, and book transportation seamlessly.</p>

              {!isGoogleConnected && (
                <div className="cta-section">
                  <button
                    className="cta-button"
                    onClick={() => setActiveTab('calendar')}
                  >
                    Get Started
                  </button>
                </div>
              )}

              <div className="features">
                <div className="feature-card">
                  <div className="feature-icon">📅</div>
                  <h3>Smart Calendar Management</h3>
                  <p>Connect your Google Calendar and get AI-powered insights for your events. Automatically generate preparation tasks and get recommendations.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🤖</div>
                  <h3>AI Event Analysis</h3>
                  <p>Let artificial intelligence analyze your events and suggest optimal preparation tasks, ensuring you're always ready.</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🚕</div>
                  <h3>Integrated Transportation</h3>
                  <p>AI automatically suggests transportation options including Uber booking for travel events, both local and global trips.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'today' && (
            <CalendarEvents
              onUserInfoChange={handleUserInfoChange}
              onDisconnectRequest={handleDisconnectRequest}
              onRefreshEventsRequest={handleRefreshEventsRequest}
              onVoiceAssistantRequest={handleVoiceAssistantRequest}
              onEventsUpdate={handleEventsUpdate}
              showTodayOnly={true}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarEvents
              onUserInfoChange={handleUserInfoChange}
              onDisconnectRequest={handleDisconnectRequest}
              onRefreshEventsRequest={handleRefreshEventsRequest}
              onVoiceAssistantRequest={handleVoiceAssistantRequest}
              onEventsUpdate={handleEventsUpdate}
            />
          )}

          {activeTab === 'wishlist' && (
            <Wishlist
              onScheduleItem={async (eventDetails, wishlistItemId) => {
                // Refresh calendar events after scheduling
                if (refreshEventsHandler) {
                  refreshEventsHandler();
                }
              }}
              onWishlistUpdate={fetchWishlistForVoice}
            />
          )}

          {/* Global Voice Assistant - Available on all tabs */}
          {showVoiceAssistant && (
            <div className="global-voice-assistant-container">
              <VoiceAssistant
                onEventAdded={(newEvent) => {
                  // Refresh events if handler exists
                  if (refreshEventsHandler) {
                    refreshEventsHandler();
                  }
                  // Fetch fresh events and wishlist for voice assistant
                  fetchEventsForVoice();
                  fetchWishlistForVoice();
                }}
                userInfo={userInfo}
                existingEvents={eventsRef.current}
                existingWishlistItems={wishlistItemsRef.current}
                onClose={() => setShowVoiceAssistant(false)}
              />
            </div>
          )}
      </div>
    </div>
  );
}

export default App;
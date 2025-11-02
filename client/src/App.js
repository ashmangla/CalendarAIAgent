import React, { useState, useCallback } from 'react';
import './App.css';
import CalendarEvents from './components/CalendarEvents';
import Wishlist from './components/Wishlist';
import logo from './images/Logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [userInfo, setUserInfo] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [disconnectHandler, setDisconnectHandler] = useState(null);
  const [refreshEventsHandler, setRefreshEventsHandler] = useState(null);
  const [voiceAssistantHandler, setVoiceAssistantHandler] = useState(null);

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
    if (voiceAssistantHandler) {
      voiceAssistantHandler();
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
            {(activeTab === 'calendar' || activeTab === 'today') && (
              <>
                <button
                  className="header-action-btn"
                  onClick={handleRefreshEvents}
                  title="Refresh Events"
                >
                  🔄 Refresh
                </button>
                <button
                  className="header-action-btn voice-btn"
                  onClick={handleVoiceAssistant}
                  title="Voice Assistant"
                >
                  🎤 Voice
                </button>
              </>
            )}
            {isGoogleConnected && userInfo && (
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
            Analyze Events
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
              showTodayOnly={true}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarEvents
              onUserInfoChange={handleUserInfoChange}
              onDisconnectRequest={handleDisconnectRequest}
              onRefreshEventsRequest={handleRefreshEventsRequest}
              onVoiceAssistantRequest={handleVoiceAssistantRequest}
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
            />
          )}
      </div>
    </div>
  );
}

export default App;
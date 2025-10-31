import React, { useState } from 'react';
import './App.css';
import CalendarEvents from './components/CalendarEvents';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [userInfo, setUserInfo] = useState(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [disconnectHandler, setDisconnectHandler] = useState(null);

  const handleDisconnect = () => {
    if (disconnectHandler) {
      disconnectHandler();
    }
    setUserInfo(null);
    setIsGoogleConnected(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-top">
          <h1 className="app-title">PrepLadder</h1>
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
        
        <nav className="app-nav">
          <button 
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button 
            className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            My Calendar
          </button>
        </nav>
      </header>

      <div className="app-content">
          {activeTab === 'home' && (
            <div className="welcome-section">
              <h2>Welcome to PrepLadder</h2>
              <p className="welcome-subtitle">Your intelligent calendar assistant that helps you prepare for events, manage your schedule, and book transportation seamlessly.</p>
              
              <div className="cta-section">
                <button 
                  className="cta-button"
                  onClick={() => setActiveTab('calendar')}
                >
                  Get Started
                </button>
              </div>

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
          
          {activeTab === 'calendar' && (
            <CalendarEvents 
              onUserInfoChange={(info, connected) => {
                setUserInfo(info);
                setIsGoogleConnected(connected);
              }}
              onDisconnectRequest={(handler) => {
                setDisconnectHandler(() => handler);
              }}
            />
          )}
      </div>
    </div>
  );
}

export default App;
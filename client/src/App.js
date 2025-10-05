import React, { useState } from 'react';
import './App.css';
import CalendarEvents from './components/CalendarEvents';
import UberBooking from './components/UberBooking';

function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="App">
      <header className="App-header">
        <h1>Calendar & Travel App</h1>
        
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
            Calendar Events
          </button>
          <button 
            className={`nav-btn ${activeTab === 'uber' ? 'active' : ''}`}
            onClick={() => setActiveTab('uber')}
          >
            Book Uber
          </button>
        </nav>

        <div className="app-content">
          {activeTab === 'home' && (
            <div className="welcome-section">
              <h2>Welcome to Your Travel Assistant</h2>
              <p>Manage your calendar events and book rides all in one place.</p>
              <div className="features">
                <div className="feature-card">
                  <h3>📅 Calendar Events</h3>
                  <p>View and manage your calendar events with AI-powered analysis</p>
                </div>
                <div className="feature-card">
                  <h3>🚕 Uber Booking</h3>
                  <p>Book rides, get fare estimates, and track your journey</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'calendar' && <CalendarEvents />}
          {activeTab === 'uber' && <UberBooking />}
        </div>
      </header>
    </div>
  );
}

export default App;
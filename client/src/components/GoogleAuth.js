import React, { useState } from 'react';
import axios from 'axios';
import './GoogleAuth.css';

const GoogleAuth = ({ onAuthSuccess, onSkip }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get OAuth URL from server
      const response = await axios.get('/api/google-calendar/auth-url');
      
      if (response.data.success && response.data.authUrl) {
        // Open OAuth in same window (server redirects back)
        window.location.href = response.data.authUrl;
      } else {
        setError('Failed to get authorization URL');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setIsLoading(false);
      setError('Failed to connect to Google Calendar. Please try again or use mock data.');
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  return (
    <div className="google-auth-container">
      <div className="google-auth-card">
        <div className="google-auth-header">
          <h2>🔗 Connect to Google Calendar</h2>
          <p>Connect your Google account to fetch real calendar events, or continue with sample data.</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="google-auth-options">
          <button 
            className="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner-small"></div>
                Connecting...
              </>
            ) : (
              <>
                <svg className="google-icon" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button 
            className="skip-btn"
            onClick={handleSkip}
            disabled={isLoading}
          >
            📅 Continue with Sample Data
          </button>
        </div>

        <div className="google-auth-info">
          <h3>What happens when you connect?</h3>
          <ul>
            <li>✅ View your real Google Calendar events</li>
            <li>✅ AI analysis of your actual schedule</li>
            <li>✅ Smart travel recommendations</li>
            <li>🔒 Your data stays private and secure</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuth;
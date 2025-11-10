import React, { useState, useEffect, useRef } from 'react';
import authService from '../services/authService';
import './UserSwitcher.css';

function UserSwitcher({ onUserSwitch, onAddAccount, currentUserEmail }) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState({});
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Load all stored users
    const allUsers = authService.getAllUsers();
    setUsers(allUsers);
  }, [currentUserEmail]); // Reload when current user changes

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchUser = (email) => {
    if (email !== currentUserEmail) {
      authService.switchUser(email);
      setIsOpen(false);
      if (onUserSwitch) {
        onUserSwitch(email);
      }
      // Reload page to refresh all data for new user
      window.location.reload();
    }
  };

  const handleSignOutUser = (email, event) => {
    event.stopPropagation(); // Prevent dropdown from closing immediately
    
    if (window.confirm(`Sign out ${email}?`)) {
      authService.removeUser(email);
      
      // Reload users list
      const remainingUsers = authService.getAllUsers();
      setUsers(remainingUsers);
      
      // If we signed out the current user, page will reload
      if (email === currentUserEmail) {
        if (onUserSwitch) {
          const newCurrentEmail = authService.getCurrentUserEmail();
          onUserSwitch(newCurrentEmail);
        }
        window.location.reload();
      }
    }
  };

  const handleSignOutAll = () => {
    if (window.confirm('Sign out all accounts?')) {
      authService.clearAllAuth();
      setUsers({});
      setIsOpen(false);
      if (onUserSwitch) {
        onUserSwitch(null);
      }
      window.location.reload();
    }
  };

  const handleAddAccount = () => {
    setIsOpen(false);
    if (onAddAccount) {
      onAddAccount();
    }
  };

  const userEmails = Object.keys(users);
  const hasMultipleUsers = userEmails.length > 1;

  if (userEmails.length === 0) {
    return null; // No users stored
  }

  const currentUser = users[currentUserEmail];

  return (
    <div className="user-switcher" ref={dropdownRef}>
      <button 
        className="user-switcher-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch account"
      >
        {currentUser?.userInfo?.picture && (
          <img 
            src={currentUser.userInfo.picture} 
            alt={currentUser.userInfo.name}
            className="user-avatar"
          />
        )}
        <span className="user-email">{currentUserEmail}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="user-switcher-dropdown">
          <div className="dropdown-header">Switch account</div>
          
          <div className="user-list">
            {userEmails.map(email => {
              const user = users[email];
              const isCurrent = email === currentUserEmail;
              
              return (
                <div 
                  key={email}
                  className={`user-item ${isCurrent ? 'current' : ''}`}
                  onClick={() => !isCurrent && handleSwitchUser(email)}
                >
                  <div className="user-item-content">
                    {user.userInfo?.picture && (
                      <img 
                        src={user.userInfo.picture} 
                        alt={user.userInfo.name}
                        className="user-item-avatar"
                      />
                    )}
                    <div className="user-item-info">
                      <div className="user-item-name">{user.userInfo?.name}</div>
                      <div className="user-item-email">{email}</div>
                    </div>
                    {isCurrent && <span className="checkmark">✓</span>}
                  </div>
                  <button
                    className="sign-out-btn"
                    onClick={(e) => handleSignOutUser(email, e)}
                    title="Sign out this account"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <div className="dropdown-divider"></div>

          <button 
            className="dropdown-action add-account"
            onClick={handleAddAccount}
          >
            + Add another account
          </button>

          {hasMultipleUsers && (
            <>
              <div className="dropdown-divider"></div>
              <button 
                className="dropdown-action sign-out-all"
                onClick={handleSignOutAll}
              >
                Sign out all accounts
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UserSwitcher;


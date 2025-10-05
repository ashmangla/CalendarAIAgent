import React, { useState } from 'react';

const UberBooking = () => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [fareEstimate, setFareEstimate] = useState(null);
  const [currentRide, setCurrentRide] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getFareEstimate = async () => {
    if (!pickup || !dropoff) {
      alert('Please enter both pickup and dropoff locations');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/uber/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickup, dropoff }),
      });

      const result = await response.json();
      if (result.success) {
        setFareEstimate(result.data);
      } else {
        alert('Error getting fare estimate: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error getting fare estimate');
    } finally {
      setIsLoading(false);
    }
  };

  const requestRide = async (rideType = 'standard') => {
    if (!pickup || !dropoff) {
      alert('Please enter both pickup and dropoff locations');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/uber/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pickup, dropoff, rideType }),
      });

      const result = await response.json();
      if (result.success) {
        setCurrentRide(result.data);
        setFareEstimate(null);
      } else {
        alert('Error requesting ride: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error requesting ride');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelRide = async () => {
    if (!currentRide) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/uber/rides/${currentRide.rideId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        setCurrentRide(null);
        alert('Ride cancelled successfully');
      } else {
        alert('Error cancelling ride: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error cancelling ride');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRideStatus = async () => {
    if (!currentRide) return;

    try {
      const response = await fetch(`/api/uber/rides/${currentRide.rideId}`);
      const result = await response.json();
      if (result.success) {
        setCurrentRide(result.data);
      }
    } catch (error) {
      console.error('Error refreshing ride status:', error);
    }
  };

  return (
    <div className="uber-booking">
      <div className="card">
        <div className="card-header">
          <h2>🚕 Uber Ride Booking</h2>
        </div>
        
        <div className="card-content">
          {!currentRide ? (
            <div className="booking-form">
              <div className="input-group">
                <label>Pickup Location</label>
                <input
                  type="text"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Enter pickup location"
                  className="input"
                />
              </div>

              <div className="input-group">
                <label>Dropoff Location</label>
                <input
                  type="text"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Enter dropoff location"
                  className="input"
                />
              </div>

              <div className="button-group">
                <button 
                  onClick={getFareEstimate}
                  disabled={isLoading}
                  className="btn btn-secondary"
                >
                  {isLoading ? 'Getting Estimate...' : 'Get Fare Estimate'}
                </button>
              </div>

              {fareEstimate && (
                <div className="fare-estimate">
                  <h3>Fare Estimates</h3>
                  <div className="ride-options">
                    {fareEstimate.estimates.map((estimate) => (
                      <div key={estimate.type} className="ride-option">
                        <div className="ride-info">
                          <span className="ride-type">{estimate.type.toUpperCase()}</span>
                          <span className="ride-price">${estimate.fare.toFixed(2)}</span>
                          <span className="ride-eta">{estimate.eta} min</span>
                        </div>
                        <button
                          onClick={() => requestRide(estimate.type)}
                          disabled={isLoading}
                          className="btn btn-primary"
                        >
                          Book {estimate.type.toUpperCase()}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="ride-status">
              <h3>🚗 Current Ride</h3>
              <div className="status-info">
                <p><strong>Ride ID:</strong> {currentRide.rideId}</p>
                <p><strong>Status:</strong> <span className={`status status-${currentRide.status}`}>{currentRide.status.toUpperCase()}</span></p>
                <p><strong>From:</strong> {currentRide.pickup}</p>
                <p><strong>To:</strong> {currentRide.dropoff}</p>
                <p><strong>Driver:</strong> {currentRide.driver.name} ({currentRide.driver.vehicle})</p>
                <p><strong>Rating:</strong> ⭐ {currentRide.driver.rating}</p>
                <p><strong>Fare:</strong> ${currentRide.fare.toFixed(2)}</p>
                <p><strong>ETA:</strong> {currentRide.eta} minutes</p>
              </div>

              <div className="button-group">
                <button 
                  onClick={refreshRideStatus}
                  disabled={isLoading}
                  className="btn btn-secondary"
                >
                  Refresh Status
                </button>
                <button 
                  onClick={cancelRide}
                  disabled={isLoading || currentRide.status === 'completed' || currentRide.status === 'cancelled'}
                  className="btn btn-danger"
                >
                  Cancel Ride
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UberBooking;
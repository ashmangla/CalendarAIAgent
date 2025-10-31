import React, { useState, useEffect } from 'react';
import './UberBookingModal.css';

const UberBookingModal = ({ event, onClose, onBook }) => {
  const [pickupLocation, setPickupLocation] = useState('');
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [rideType, setRideType] = useState('uberx');
  const [loading, setLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Mock fare estimates
  const rideOptions = [
    { id: 'uberx', name: 'UberX', price: 0, icon: '🚗' },
    { id: 'uberxl', name: 'UberXL', price: 5, icon: '🚙' },
    { id: 'comfort', name: 'Comfort', price: 8, icon: '🚕' },
    { id: 'black', name: 'Black', price: 15, icon: '🚖' }
  ];

  useEffect(() => {
    // Generate mock fare estimate when component mounts
    generateFareEstimate();
  }, [pickupLocation, rideType]);

  const generateFareEstimate = () => {
    if (!pickupLocation.trim()) {
      setEstimatedFare(null);
      return;
    }

    // Mock fare calculation (random between $8-$45 for base, then add ride type premium)
    const baseFare = Math.floor(Math.random() * 37) + 8;
    const selectedRide = rideOptions.find(r => r.id === rideType);
    const totalFare = baseFare + selectedRide.price;
    
    setEstimatedFare({
      low: totalFare,
      high: totalFare + 5,
      currency: 'USD',
      duration: Math.floor(Math.random() * 20) + 10, // 10-30 minutes
      distance: (Math.random() * 10 + 2).toFixed(1) // 2-12 miles
    });
  };

  const handleBookRide = () => {
    setLoading(true);
    
    // Simulate booking process
    setTimeout(() => {
      setLoading(false);
      setBookingSuccess(true);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        if (onBook) {
          onBook({
            pickup: pickupLocation,
            destination: event.location || 'Event Location',
            rideType: rideType,
            fare: estimatedFare,
            eventId: event.id
          });
        }
        onClose();
      }, 2000);
    }, 1500);
  };

  const getEventLocation = () => {
    return event.location || 'Event Location';
  };

  return (
    <div className="uber-modal-overlay" onClick={onClose}>
      <div className="uber-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="uber-modal-header">
          <h3>🚕 Book Uber Ride</h3>
          <button className="uber-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="uber-modal-body">
          {bookingSuccess ? (
            <div className="uber-success">
              <div className="success-icon">✅</div>
              <h4>Ride Booked Successfully!</h4>
              <p>Your ride has been scheduled for the event.</p>
            </div>
          ) : (
            <>
              <div className="ride-details">
                <div className="location-info">
                  <div className="location-row pickup">
                    <span className="location-icon">📍</span>
                    <div>
                      <label>Pickup Location</label>
                      <input
                        type="text"
                        placeholder="Enter your pickup address"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        className="location-input"
                      />
                    </div>
                  </div>
                  <div className="location-row destination">
                    <span className="location-icon">🎯</span>
                    <div>
                      <label>Destination</label>
                      <div className="destination-display">{getEventLocation()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {pickupLocation && (
                <>
                  <div className="ride-options">
                    <h4>Choose Ride Type</h4>
                    <div className="ride-options-grid">
                      {rideOptions.map((option) => (
                        <div
                          key={option.id}
                          className={`ride-option ${rideType === option.id ? 'selected' : ''}`}
                          onClick={() => setRideType(option.id)}
                        >
                          <span className="ride-icon">{option.icon}</span>
                          <span className="ride-name">{option.name}</span>
                          {option.price > 0 && (
                            <span className="ride-premium">+${option.price}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {estimatedFare && (
                    <div className="fare-estimate">
                      <h4>Estimated Fare</h4>
                      <div className="fare-details">
                        <div className="fare-amount">
                          ${estimatedFare.low} - ${estimatedFare.high}
                        </div>
                        <div className="fare-info">
                          <span>⏱️ {estimatedFare.duration} min</span>
                          <span>📏 {estimatedFare.distance} mi</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="uber-modal-actions">
                <button
                  className="book-ride-btn"
                  onClick={handleBookRide}
                  disabled={!pickupLocation || !estimatedFare || loading}
                >
                  {loading ? 'Booking...' : 'Book Ride'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UberBookingModal;


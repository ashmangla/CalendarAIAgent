const { v4: uuidv4 } = require('uuid');

class UberService {
  constructor() {
    this.mockMode = !process.env.UBER_CLIENT_ID;
    this.activeRides = new Map(); // Store active ride data
    this.rideHistory = [];
    
    // Mock driver pool
    this.mockDrivers = [
      {
        id: 'driver_001',
        name: 'John Smith',
        rating: 4.8,
        vehicle: { make: 'Toyota', model: 'Camry', year: 2022, color: 'White', licensePlate: 'ABC-123' },
        photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john'
      },
      {
        id: 'driver_002', 
        name: 'Maria Garcia',
        rating: 4.9,
        vehicle: { make: 'Honda', model: 'Accord', year: 2023, color: 'Silver', licensePlate: 'XYZ-789' },
        photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maria'
      },
      {
        id: 'driver_003',
        name: 'David Chen',
        rating: 4.7,
        vehicle: { make: 'Nissan', model: 'Altima', year: 2021, color: 'Black', licensePlate: 'DEF-456' },
        photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=david'
      }
    ];
  }

  async estimateFare(pickup, destination, rideType = 'uberx') {
    if (this.mockMode) {
      return this.getMockFareEstimate(pickup, destination, rideType);
    }
    
    // Real Uber API implementation would go here
    // const estimate = await this.realUberAPI.estimateFare(pickup, destination, rideType);
  }

  async requestRide(rideRequest) {
    if (this.mockMode) {
      return this.createMockRide(rideRequest);
    }
    
    // Real Uber API implementation would go here
    // const ride = await this.realUberAPI.requestRide(rideRequest);
  }

  async getRideStatus(rideId) {
    if (this.mockMode) {
      return this.getMockRideStatus(rideId);
    }
    
    // Real Uber API implementation would go here
    // const status = await this.realUberAPI.getRideStatus(rideId);
  }

  async cancelRide(rideId) {
    if (this.mockMode) {
      return this.cancelMockRide(rideId);
    }
    
    // Real Uber API implementation would go here
    // const result = await this.realUberAPI.cancelRide(rideId);
  }

  // Mock implementations
  getMockFareEstimate(pickup, destination, rideType) {
    // Calculate mock fare based on distance and ride type
    const distance = this.calculateMockDistance(pickup, destination);
    const baseFares = {
      'uberx': { base: 2.50, perMile: 1.15, perMinute: 0.25 },
      'comfort': { base: 3.50, perMile: 1.45, perMinute: 0.35 },
      'xl': { base: 4.50, perMile: 1.85, perMinute: 0.45 },
      'black': { base: 8.00, perMile: 2.75, perMinute: 0.65 }
    };

    const fare = baseFares[rideType] || baseFares['uberx'];
    const estimatedTime = Math.ceil(distance * 2.5); // Mock: ~2.5 minutes per mile
    const estimatedFare = fare.base + (distance * fare.perMile) + (estimatedTime * fare.perMinute);

    return {
      success: true,
      estimate: {
        rideType,
        distance: `${distance.toFixed(1)} miles`,
        estimatedTime: `${estimatedTime} minutes`,
        estimatedFare: `$${estimatedFare.toFixed(2)}`,
        fareBreakdown: {
          baseFare: `$${fare.base.toFixed(2)}`,
          distanceFare: `$${(distance * fare.perMile).toFixed(2)}`,
          timeFare: `$${(estimatedTime * fare.perMinute).toFixed(2)}`,
          total: `$${estimatedFare.toFixed(2)}`
        },
        surgeMultiplier: 1.0,
        currency: 'USD'
      }
    };
  }

  createMockRide(rideRequest) {
    const rideId = `ride_${uuidv4()}`;
    const driver = this.mockDrivers[Math.floor(Math.random() * this.mockDrivers.length)];
    const estimatedArrival = new Date(Date.now() + (Math.random() * 8 + 2) * 60000); // 2-10 minutes

    const ride = {
      rideId,
      status: 'searching',
      pickup: rideRequest.pickup,
      destination: rideRequest.destination,
      rideType: rideRequest.rideType || 'uberx',
      requestedAt: new Date().toISOString(),
      estimatedArrival: estimatedArrival.toISOString(),
      driver: null,
      fare: rideRequest.estimatedFare,
      passengerCount: rideRequest.passengerCount || 1,
      specialRequests: rideRequest.specialRequests || []
    };

    this.activeRides.set(rideId, ride);

    // Simulate ride progression
    this.simulateRideProgression(rideId, driver);

    return {
      success: true,
      ride: {
        rideId,
        status: 'searching',
        message: 'Looking for nearby drivers...',
        estimatedWait: '2-5 minutes'
      }
    };
  }

  simulateRideProgression(rideId, driver) {
    const ride = this.activeRides.get(rideId);
    if (!ride) return;

    // Simulate finding driver (2-10 seconds)
    setTimeout(() => {
      ride.status = 'driver_assigned';
      ride.driver = driver;
      ride.assignedAt = new Date().toISOString();
    }, Math.random() * 8000 + 2000);

    // Simulate driver arriving (3-8 minutes)
    setTimeout(() => {
      if (ride.status !== 'cancelled') {
        ride.status = 'driver_arriving';
        ride.estimatedArrival = new Date(Date.now() + 3 * 60000).toISOString();
      }
    }, Math.random() * 5000 + 8000);

    // Simulate driver arrived (after estimated time)
    setTimeout(() => {
      if (ride.status === 'driver_arriving') {
        ride.status = 'driver_arrived';
        ride.arrivedAt = new Date().toISOString();
      }
    }, Math.random() * 8 * 60000 + 3 * 60000);
  }

  getMockRideStatus(rideId) {
    const ride = this.activeRides.get(rideId);
    
    if (!ride) {
      return {
        success: false,
        message: 'Ride not found'
      };
    }

    const statusMessages = {
      'searching': 'Looking for nearby drivers...',
      'driver_assigned': `${ride.driver?.name} is on the way`,
      'driver_arriving': `${ride.driver?.name} is arriving in ${Math.ceil(Math.random() * 5 + 1)} minutes`,
      'driver_arrived': `${ride.driver?.name} has arrived`,
      'in_progress': 'Your ride is in progress',
      'completed': 'Ride completed',
      'cancelled': 'Ride was cancelled'
    };

    return {
      success: true,
      ride: {
        rideId,
        status: ride.status,
        message: statusMessages[ride.status],
        driver: ride.driver,
        pickup: ride.pickup,
        destination: ride.destination,
        estimatedArrival: ride.estimatedArrival,
        fare: ride.fare
      }
    };
  }

  cancelMockRide(rideId) {
    const ride = this.activeRides.get(rideId);
    
    if (!ride) {
      return {
        success: false,
        message: 'Ride not found'
      };
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return {
        success: false,
        message: 'Cannot cancel ride in current status'
      };
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date().toISOString();
    
    // Move to history after a delay
    setTimeout(() => {
      this.rideHistory.push(ride);
      this.activeRides.delete(rideId);
    }, 5000);

    return {
      success: true,
      message: 'Ride cancelled successfully',
      refund: ride.status === 'searching' ? 'Full refund' : 'Partial refund may apply'
    };
  }

  calculateMockDistance(pickup, destination) {
    // Simple mock distance calculation
    // In real implementation, would use Google Maps API or similar
    const locations = {
      'airport': { lat: 40.6892, lng: -74.1745 },
      'downtown': { lat: 40.7589, lng: -73.9851 },
      'times_square': { lat: 40.7580, lng: -73.9855 },
      'brooklyn': { lat: 40.6782, lng: -73.9442 },
      'queens': { lat: 40.7282, lng: -73.7949 }
    };

    // Simple distance formula (not geographically accurate, just for demo)
    const pickupKey = Object.keys(locations).find(key => 
      pickup.toLowerCase().includes(key) || pickup.toLowerCase().includes(key.replace('_', ' '))
    ) || 'downtown';
    
    const destKey = Object.keys(locations).find(key => 
      destination.toLowerCase().includes(key) || destination.toLowerCase().includes(key.replace('_', ' '))
    ) || 'downtown';

    if (pickupKey === destKey) return Math.random() * 2 + 1; // 1-3 miles for same area

    const p1 = locations[pickupKey];
    const p2 = locations[destKey];
    
    // Rough distance calculation (not accurate, just for demo)
    const distance = Math.sqrt(Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2)) * 69; // Convert to miles roughly
    
    return Math.max(distance, 1); // Minimum 1 mile
  }

  getAllActiveRides() {
    return Array.from(this.activeRides.values());
  }

  getRideHistory() {
    return this.rideHistory;
  }
}

module.exports = UberService;
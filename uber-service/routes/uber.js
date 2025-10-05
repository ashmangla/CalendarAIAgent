const express = require('express');
const router = express.Router();
const UberService = require('../services/uberService');
const FareEstimator = require('../services/fareEstimator');

// Initialize services
const uberService = new UberService();
const fareEstimator = new FareEstimator();

// Get fare estimates for all ride types
router.post('/estimate', async (req, res) => {
  try {
    const { pickup, destination, requestedTime } = req.body;

    if (!pickup || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and destination locations are required'
      });
    }

    const estimates = fareEstimator.calculateAllFares(pickup, destination, requestedTime);
    
    res.json(estimates);
  } catch (error) {
    console.error('Error calculating fare estimates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate fare estimates',
      error: error.message
    });
  }
});

// Request a ride
router.post('/request', async (req, res) => {
  try {
    const { pickup, destination, rideType, passengerCount, specialRequests, scheduledTime } = req.body;

    if (!pickup || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and destination locations are required'
      });
    }

    // Get fare estimate first
    const fareEstimate = await uberService.estimateFare(pickup, destination, rideType);
    
    const rideRequest = {
      pickup,
      destination,
      rideType: rideType || 'uberx',
      passengerCount: passengerCount || 1,
      specialRequests: specialRequests || [],
      scheduledTime,
      estimatedFare: fareEstimate.estimate.estimatedFare
    };

    const result = await uberService.requestRide(rideRequest);
    
    res.json(result);
  } catch (error) {
    console.error('Error requesting ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request ride',
      error: error.message
    });
  }
});

// Get ride status
router.get('/ride/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const result = await uberService.getRideStatus(rideId);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting ride status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride status',
      error: error.message
    });
  }
});

// Cancel ride
router.delete('/ride/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const result = await uberService.cancelRide(rideId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error cancelling ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel ride',
      error: error.message
    });
  }
});

// Get all active rides
router.get('/rides/active', (req, res) => {
  try {
    const activeRides = uberService.getAllActiveRides();
    
    res.json({
      success: true,
      rides: activeRides,
      count: activeRides.length
    });
  } catch (error) {
    console.error('Error getting active rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active rides',
      error: error.message
    });
  }
});

// Get ride history
router.get('/rides/history', (req, res) => {
  try {
    const rideHistory = uberService.getRideHistory();
    
    res.json({
      success: true,
      rides: rideHistory,
      count: rideHistory.length
    });
  } catch (error) {
    console.error('Error getting ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride history',
      error: error.message
    });
  }
});

// Get ride types info
router.get('/ride-types', (req, res) => {
  try {
    const rideTypesInfo = fareEstimator.getRideTypeInfo();
    res.json(rideTypesInfo);
  } catch (error) {
    console.error('Error getting ride types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ride types',
      error: error.message
    });
  }
});

// Quick fare estimate (simplified endpoint)
router.get('/quick-estimate/:pickup/:destination', async (req, res) => {
  try {
    const { pickup, destination } = req.params;
    const rideType = req.query.type || 'uberx';
    
    const estimate = await uberService.estimateFare(
      decodeURIComponent(pickup), 
      decodeURIComponent(destination), 
      rideType
    );
    
    res.json(estimate);
  } catch (error) {
    console.error('Error getting quick estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get fare estimate',
      error: error.message
    });
  }
});

module.exports = router;
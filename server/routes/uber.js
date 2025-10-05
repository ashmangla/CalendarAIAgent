const express = require('express');
const UberClient = require('../services/uberClient');

const router = express.Router();
const uberClient = new UberClient();

// Get fare estimate
router.post('/estimate', async (req, res) => {
  try {
    const { pickup, dropoff } = req.body;
    
    if (!pickup || !dropoff) {
      return res.status(400).json({
        success: false,
        error: 'Pickup and dropoff locations are required'
      });
    }

    const estimate = await uberClient.getFareEstimate(pickup, dropoff);
    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    console.error('Error in estimate route:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Request a ride
router.post('/request', async (req, res) => {
  try {
    const { pickup, dropoff, rideType } = req.body;
    
    if (!pickup || !dropoff) {
      return res.status(400).json({
        success: false,
        error: 'Pickup and dropoff locations are required'
      });
    }

    const ride = await uberClient.requestRide(pickup, dropoff, rideType);
    res.json({
      success: true,
      data: ride
    });
  } catch (error) {
    console.error('Error in request route:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get ride status
router.get('/rides/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const status = await uberClient.getRideStatus(rideId);
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error in status route:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel ride
router.delete('/rides/:rideId', async (req, res) => {
  try {
    const { rideId } = req.params;
    
    const result = await uberClient.cancelRide(rideId);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in cancel route:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check for Uber service
router.get('/health', async (req, res) => {
  try {
    const health = await uberClient.healthCheck();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Uber service unavailable'
    });
  }
});

module.exports = router;
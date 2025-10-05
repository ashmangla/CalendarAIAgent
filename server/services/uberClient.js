const axios = require('axios');

class UberClient {
  constructor(baseURL = 'http://localhost:5001') {
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getFareEstimate(pickup, dropoff) {
    try {
      const response = await this.axios.post('/api/uber/estimate', {
        pickup,
        dropoff
      });
      return response.data;
    } catch (error) {
      console.error('Error getting fare estimate:', error.message);
      throw new Error('Unable to get fare estimate');
    }
  }

  async requestRide(pickup, dropoff, rideType = 'standard') {
    try {
      const response = await this.axios.post('/api/uber/request', {
        pickup,
        dropoff,
        rideType
      });
      return response.data;
    } catch (error) {
      console.error('Error requesting ride:', error.message);
      throw new Error('Unable to request ride');
    }
  }

  async getRideStatus(rideId) {
    try {
      const response = await this.axios.get(`/api/uber/rides/${rideId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting ride status:', error.message);
      throw new Error('Unable to get ride status');
    }
  }

  async cancelRide(rideId) {
    try {
      const response = await this.axios.delete(`/api/uber/rides/${rideId}`);
      return response.data;
    } catch (error) {
      console.error('Error cancelling ride:', error.message);
      throw new Error('Unable to cancel ride');
    }
  }

  async healthCheck() {
    try {
      const response = await this.axios.get('/api/health');
      return response.data;
    } catch (error) {
      console.error('Uber service health check failed:', error.message);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = UberClient;
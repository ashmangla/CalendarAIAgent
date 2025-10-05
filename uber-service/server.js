require('dotenv').config();
const express = require('express');
const cors = require('cors');
const uberRoutes = require('./routes/uber');

const app = express();
const PORT = process.env.UBER_SERVICE_PORT || 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000'], // Allow both client and main server
  credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/uber', uberRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'Uber Service',
    message: 'Uber microservice is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error in Uber service',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Uber service endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚕 Uber Service is running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🚗 Uber API: http://localhost:${PORT}/api/uber`);
  
  // Log environment
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Uber API Mock Mode: ${!process.env.UBER_CLIENT_ID ? 'ENABLED' : 'DISABLED'}`);
});
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/authRoutes');
const blockRoutes = require('./src/routes/blockRoutes');
const { apiLimiter } = require('./src/middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Security HTTP Headers
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for dashboard demo UI
}));

// CORS Configuration
app.use(cors());

// Request Body Parser & Limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// General API Rate Limiting
app.use('/api', apiLimiter);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TechBlock Storage Gateway',
    timestamp: new Date().toISOString(),
    database: mongoose.connection && mongoose.connection.readyState === 1 ? 'connected' : 'in-memory-fallback',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/blocks', blockRoutes);

if (process.env.NODE_ENV === 'test') {
  app.get('/api/test-error', (req, res, next) => {
    next(new Error('Internal database connection error at /var/secret/db.key'));
  });
}

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.originalUrl} does not exist.`
  });
});

// Global Error Handler - Mask critical server info and stack traces
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  const statusCode = err.status || err.statusCode || 500;

  console.error(`[TechBlock Error] ${err.message}`);

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.name || 'Error',
    message: statusCode === 500 && !isDev 
      ? 'An unexpected error occurred. Please contact support.' 
      : err.message
  });
});

// Database Connection Attempt
if (process.env.MONGO_URI && process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 2000
  })
  .then(() => console.log('[TechBlock] MongoDB Connected Successfully'))
  .catch(() => console.log('[TechBlock] MongoDB connection timeout - using fast in-memory fallback'));
}

// Start Server if not imported by tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` TechBlock Storage Gateway Running on http://localhost:${PORT}`);
    console.log(` Security: Helmet Enabled | Rate Limiting Active`);
    console.log(`====================================================`);
  });
}

module.exports = app;

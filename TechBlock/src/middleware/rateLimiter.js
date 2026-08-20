const rateLimit = require('express-rate-limit');

// Strict rate limiter for Auth endpoints (Login & Register) to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP. Please slow down.'
  }
});

module.exports = {
  authLimiter,
  apiLimiter
};

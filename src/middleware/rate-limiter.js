/**
 * src/middleware/rate-limiter.js
 * 
 * Express Rate Limiting Middleware
 * 
 * Purpose:
 * - Defends authentication routes against brute-force password guessing.
 * - Protects API endpoints against denial-of-service (DoS) traffic spikes.
 * - Automatically bypasses throttling in 'test' environment to allow rapid automated testing.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'test' ? 1000 : 20, // 20 requests per IP per window in production/dev
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Too many login or registration attempts. Please try again after 15 minutes.'
  },
  skip: () => config.nodeEnv === 'test'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'test' ? 5000 : 200, // General API limiter
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many API requests from this IP address. Please slow down.'
  },
  skip: () => config.nodeEnv === 'test'
});

const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: config.nodeEnv === 'test' ? 1000 : 15, // 15 requests per 5 minutes in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many AI requests. Please wait a few minutes before generating again.'
  },
  skip: () => config.nodeEnv === 'test'
});

module.exports = {
  authLimiter,
  apiLimiter,
  aiLimiter
};

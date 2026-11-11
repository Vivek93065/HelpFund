/**
 * src/middleware/error-handler.js
 * 
 * Centralized Global Express Error Handler
 * 
 * Purpose:
 * - Prevents sensitive internal stack traces from leaking to clients in production.
 * - Standardizes error response format across the entire REST API.
 * - Gracefully catches bad JSON payloads and unexpected database errors.
 */

const config = require('../config/env');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Catch invalid JSON syntax in request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload in request body.'
    });
  }

  // Handle SQLite constraint errors
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      success: false,
      error: 'A resource with this unique value already exists.'
    });
  }

  // Log error internally in development mode
  if (config.nodeEnv !== 'test') {
    console.error('Unhandled Application Error:', err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = config.isProduction
    ? 'Internal server error. Please try again later.'
    : err.message || 'Internal server error.';

  return res.status(statusCode).json({
    success: false,
    error: message
  });
}

module.exports = errorHandler;

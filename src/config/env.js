/**
 * src/config/env.js
 * 
 * Centralized Environment Configuration Loader
 * 
 * Purpose:
 * - Loads environment variables from the root .env file via dotenv.
 * - Provides default fallback values for development so the app runs smoothly.
 * - Prevents hardcoding secrets in source files.
 * - Exports a single frozen config object used across the application.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEV_JWT_SECRET = 'dev_jwt_secret_change_in_production_key_32chars';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET)) {
  throw new Error('JWT_SECRET must be set to a strong random value when NODE_ENV=production.');
}

const config = {
  // Server Port & Environment
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5000',

  // Database Path
  dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../data/helpfund.db'),

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || DEV_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Google Gemini API Configuration
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  // Backups tried in order when the main model returns 503 (overloaded) or 429
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-3.5-flash')
    .split(',').map((m) => m.trim()).filter(Boolean),

  // Cloudflare Workers AI Configuration
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || ''
  },

  // PayPal Sandbox Configuration
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
    apiBase: process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com'
  }
};

module.exports = Object.freeze(config);
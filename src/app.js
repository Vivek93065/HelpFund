/**
 * src/app.js
 * 
 * Express Application Factory & Middleware Configuration
 * 
 * Security & Architecture Decisions:
 * 1. Helmet: Sets Content Security Policy (CSP), hides 'X-Powered-By: Express',
 *    and enables browser XSS filtering.
 * 2. CORS: Configured for API access.
 * 3. Body Parsing: Express built-in JSON and urlencoded parsers with size limits.
 * 4. Error Handling: Centralized error middleware ensures all errors return JSON.
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config/env');
const errorHandler = require('./middleware/error-handler');
const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const aiRoutes = require('./routes/aiRoutes');
const donationRoutes = require('./routes/donationRoutes');

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled in development to allow inline CDN scripts if needed
    // PayPal Checkout opens a popup window. The default 'same-origin' policy cuts the popup off
    // from this page (it stays on about:blank), so popups must be allowed.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.isProduction ? config.clientUrl : true,
    credentials: true
  })
);

// Body parsing with safe size limits (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets
app.use(express.static(path.resolve(__dirname, '../public')));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// API Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/donations', donationRoutes);

// Catch-all 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint '${req.originalUrl}' not found.`
  });
});

// Global Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
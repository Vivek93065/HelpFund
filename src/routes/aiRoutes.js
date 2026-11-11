/**
 * src/routes/aiRoutes.js
 * 
 * Express Router for Google Gemini AI Capabilities
 * 
 * Routes:
 * - POST /api/ai/generate-story : Generates structured campaign pitch (Creator/Admin + Rate Limited)
 * - POST /api/ai/analyze-trust  : Calculates trust score & credibility markers (Authenticated + Rate Limited)
 */

const express = require('express');
const router = express.Router();
const AiController = require('../controllers/aiController');
const { authenticate, requireRole } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rate-limiter');

// Story Generator: Restricted to Creator or Admin roles
router.post(
  '/generate-story',
  authenticate,
  requireRole('creator', 'admin'),
  aiLimiter,
  AiController.generateStory
);

// Trust Analyzer: Accessible to all authenticated users (backers, creators, admins)
router.post(
  '/analyze-trust',
  authenticate,
  aiLimiter,
  AiController.analyzeTrust
);

// AI Campaign Image Generator: Restricted to Creator or Admin roles
router.post(
  '/generate-image',
  authenticate,
  requireRole('creator', 'admin'),
  aiLimiter,
  AiController.generateImage
);

// AI Donation Impact Predictor: Accessible to all donors (Rate Limited)
router.post(
  '/predict-impact',
  aiLimiter,
  AiController.predictImpact
);

// AI Campaign Update Drafter: Restricted to Creator or Admin roles
router.post(
  '/draft-update',
  authenticate,
  requireRole('creator', 'admin'),
  aiLimiter,
  AiController.draftUpdate
);

module.exports = router;

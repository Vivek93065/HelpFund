/**
 * src/routes/donationRoutes.js
 * 
 * Express Router for PayPal Sandbox Donations
 * 
 * Endpoints:
 * - GET  /api/donations/config                 : Public PayPal client configuration
 * - GET  /api/donations/campaign/:campaignId   : Public donation history with privacy masking
 * - POST /api/donations/create-order           : Protected: Initiates PayPal order (Authentication required)
 * - POST /api/donations/capture-order          : Protected: Captures & verifies payment (Authentication required)
 */

const express = require('express');
const router = express.Router();
const DonationController = require('../controllers/donationController');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rate-limiter');

// Public endpoints
router.get('/config', DonationController.getClientConfig);
router.get('/campaign/:campaignId', DonationController.getCampaignDonations);

// Protected donation endpoints (requires logged-in donor or user)
router.post('/create-order', authenticate, apiLimiter, DonationController.createOrder);
router.post('/capture-order', authenticate, apiLimiter, DonationController.captureOrder);
router.get('/my', authenticate, DonationController.getMyDonations);

module.exports = router;

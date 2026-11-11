/**
 * src/routes/authRoutes.js
 * 
 * Express Authentication Router
 * 
 * Endpoints:
 * - POST /api/auth/register       : Register a new account
 * - POST /api/auth/login          : Authenticate and obtain JWT
 * - GET  /api/auth/me             : Retrieve currently authenticated profile (Bearer auth required)
 * - GET  /api/auth/admin-summary  : Role-protected administrative endpoint (Admin role required)
 */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rate-limiter');

// Public endpoints (rate-limited against brute-force attacks)
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);

// Protected endpoints (require valid JWT token)
router.get('/me', authenticate, AuthController.getProfile);

// Role-protected endpoint (requires admin role)
router.get('/admin-summary', authenticate, requireRole('admin'), AuthController.getAdminSummary);

module.exports = router;

/**
 * src/middleware/auth.js
 * 
 * JWT Authentication & Role-Based Access Control (RBAC) Middleware
 * 
 * Key Architecture Decisions for College Presentation / Viva:
 * 1. Stateless Authentication: Instead of server-side session stores that require
 *    shared state across server clusters, JWT encodes user identity in a tamper-proof,
 *    cryptographically signed token.
 * 2. Defense in Depth: After verifying the cryptographic signature, the middleware
 *    confirms the user still exists in SQLite (handling cases where a deleted user's token
 *    is presented).
 * 3. Granular RBAC: requireRole() middleware factory restricts endpoints based on roles
 *    ('creator', 'donor', 'admin').
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const UserModel = require('../models/UserModel');

/**
 * Middleware that authenticates incoming requests using a JWT Bearer token.
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Bearer token format invalid.'
      });
    }

    // Verify token cryptographic signature
    const decoded = jwt.verify(token, config.jwtSecret);

    // Verify that the user still exists in the database
    const user = UserModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account associated with this token no longer exists.'
      });
    }

    // Attach authenticated user profile to the request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware Factory
 * Restricts route access to specific roles.
 * 
 * @param  {...string} allowedRoles (e.g. 'creator', 'admin')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required prior to authorization.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access forbidden. This action requires one of the following roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};

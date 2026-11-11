/**
 * src/controllers/authController.js
 * 
 * Authentication Request Handler
 * 
 * Features & Security Best Practices:
 * 1. Password Hashing: bcryptjs with 12 salt rounds (adaptive cost factor that defeats rainbow tables).
 * 2. User Enumeration Defense: login returns generic "Invalid email or password" whether email exists or not.
 * 3. Sanitized Outputs: password_hash is never included in outgoing JSON payloads.
 * 4. Token Generation: Signed JWT tokens with configurable expiration (e.g., '7d').
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/UserModel');
const config = require('../config/env');
const { validateRegistration, validateLogin } = require('../utils/validators');

/**
 * Generates a signed JSON Web Token for an authenticated user.
 * @param {object} user
 * @returns {string}
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn
    }
  );
}

/**
 * Strips sensitive fields (like password_hash) from user object before sending response.
 * @param {object} user
 * @returns {object}
 */
function sanitizeUser(user) {
  const safe = { ...user };
  delete safe.password_hash;
  return safe;
}

class AuthController {
  /**
   * Registers a new user account.
   * POST /api/auth/register
   */
  static async register(req, res, next) {
    try {
      // Step 1: Input Validation
      const validation = validateRegistration(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      const { full_name, email, password, role, bio } = validation.sanitized;

      // Step 2: Check for existing account with same email
      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please log in instead.'
        });
      }

      // Step 3: Hash password securely using bcryptjs (12 salt rounds)
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Step 4: Persist user in SQLite database
      const newUser = UserModel.create({
        full_name,
        email,
        password_hash,
        role,
        bio
      });

      // Step 5: Issue JWT token for immediate authenticated session
      const token = generateToken(newUser);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        token,
        user: newUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Authenticates user credentials and issues a JWT token.
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      // Step 1: Input Validation
      const validation = validateLogin(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          errors: validation.errors
        });
      }

      const { email, password } = validation.sanitized;

      // Step 2: Retrieve user record (including password_hash)
      const user = UserModel.findByEmail(email);
      if (!user) {
        // Generic error message to prevent account enumeration attacks
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      // Step 3: Verify password against the stored bcrypt hash
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password.'
        });
      }

      // Step 4: Generate JWT token
      const token = generateToken(user);
      const safeUser = sanitizeUser(user);

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        token,
        user: safeUser
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves the profile of the currently authenticated user.
   * GET /api/auth/me
   */
  static async getProfile(req, res) {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  }

  /**
   * Sample role-protected endpoint (Admin only).
   * GET /api/auth/admin-summary
   */
  static async getAdminSummary(req, res) {
    const totalUsers = UserModel.count();
    return res.status(200).json({
      success: true,
      message: 'Admin authorization verified.',
      data: {
        totalUsers,
        adminUser: req.user.full_name
      }
    });
  }
}

module.exports = AuthController;

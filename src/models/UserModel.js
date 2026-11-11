/**
 * src/models/UserModel.js
 * 
 * User Data Access Layer (better-sqlite3 Prepared Statements)
 * 
 * Security & Design Principles for College Presentation / Viva:
 * 1. SQL Injection Immunity: Every database interaction uses prepared statements
 *    (e.g., db.prepare('... WHERE email = ?')). Variables are passed as bound parameters,
 *    never concatenated into SQL strings.
 * 2. Sensitive Data Isolation: findById() intentionally omits password_hash from the
 *    projection to prevent unintentional leakage in API responses.
 * 3. Atomic Single-Threaded Execution: better-sqlite3 handles execution synchronously
 *    without race conditions.
 */

const { db } = require('../config/db');

class UserModel {
  /**
   * Finds a user by email, including password_hash for authentication verification.
   * @param {string} email
   * @returns {object|undefined}
   */
  static findByEmail(email) {
    const stmt = db.prepare(`
      SELECT id, full_name, email, password_hash, role, avatar_url, bio, created_at, updated_at
      FROM users
      WHERE email = ? COLLATE NOCASE
    `);
    return stmt.get(email.trim().toLowerCase());
  }

  /**
   * Finds a user by ID, safely omitting the password_hash.
   * @param {number|string} id
   * @returns {object|undefined}
   */
  static findById(id) {
    const stmt = db.prepare(`
      SELECT id, full_name, email, role, avatar_url, bio, created_at, updated_at
      FROM users
      WHERE id = ?
    `);
    return stmt.get(id);
  }

  /**
   * Creates a new user record.
   * @param {object} userData
   * @returns {object} The created user profile (excluding password_hash)
   */
  static create({ full_name, email, password_hash, role = 'creator', bio = null, avatar_url = null }) {
    const stmt = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role, bio, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      full_name.trim(),
      email.trim().toLowerCase(),
      password_hash,
      role,
      bio,
      avatar_url
    );

    return {
      id: Number(result.lastInsertRowid),
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      role,
      bio,
      avatar_url
    };
  }

  /**
   * Returns total count of registered users.
   * @returns {number}
   */
  static count() {
    const stmt = db.prepare('SELECT COUNT(*) AS total FROM users');
    return stmt.get().total;
  }
}

module.exports = UserModel;

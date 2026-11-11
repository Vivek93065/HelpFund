/**
 * src/utils/validators.js
 * 
 * Reusable Input Validation & Sanitization Helpers
 * 
 * Purpose:
 * - Sanitizes user inputs before they reach controllers or database models.
 * - Prevents injection of invalid or malformed data.
 * - Enforces strong password rules and standard email syntax.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
// 'admin' is intentionally NOT self-assignable at registration (privilege escalation).
const ALLOWED_ROLES = ['creator', 'donor'];

/**
 * Validates an email address format and sanitizes it (trims & lowercases).
 * @param {string} email
 * @returns {{ isValid: boolean, sanitized: string }}
 */
function validateEmail(email) {
  if (typeof email !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  const sanitized = email.trim().toLowerCase();
  const isValid = sanitized.length > 3 && sanitized.length <= 254 && EMAIL_REGEX.test(sanitized);
  return { isValid, sanitized };
}

/**
 * Validates password strength (min 8 characters, at least 1 letter and 1 number).
 * @param {string} password
 * @returns {{ isValid: boolean, message?: string }}
 */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter and one number.' };
  }
  return { isValid: true };
}

/**
 * Validates and sanitizes a user's full name.
 * @param {string} name
 * @returns {{ isValid: boolean, sanitized: string }}
 */
function validateName(name) {
  if (typeof name !== 'string') {
    return { isValid: false, sanitized: '' };
  }
  const sanitized = name.trim().replace(/\s+/g, ' ');
  const isValid = sanitized.length >= 2 && sanitized.length <= 100;
  return { isValid, sanitized };
}

/**
 * Validates registration input payload.
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
function validateRegistration(body = {}) {
  const errors = [];

  const nameCheck = validateName(body.full_name);
  if (!nameCheck.isValid) {
    errors.push('Full name must be between 2 and 100 characters.');
  }

  const emailCheck = validateEmail(body.email);
  if (!emailCheck.isValid) {
    errors.push('A valid email address is required.');
  }

  const passCheck = validatePassword(body.password);
  if (!passCheck.isValid) {
    errors.push(passCheck.message);
  }

  let role = 'creator';
  if (body.role) {
    const requestedRole = String(body.role).toLowerCase().trim();
    if (ALLOWED_ROLES.includes(requestedRole)) {
      role = requestedRole;
    } else {
      errors.push(`Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      full_name: nameCheck.sanitized,
      email: emailCheck.sanitized,
      password: body.password,
      role,
      bio: typeof body.bio === 'string' ? body.bio.trim() : null
    }
  };
}

/**
 * Validates login input payload.
 * @param {object} body
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
function validateLogin(body = {}) {
  const errors = [];

  const emailCheck = validateEmail(body.email);
  if (!emailCheck.isValid) {
    errors.push('A valid email address is required.');
  }

  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      email: emailCheck.sanitized,
      password: body.password
    }
  };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateName,
  validateRegistration,
  validateLogin,
  ALLOWED_ROLES
};
/**
 * public/js/api.js
 * 
 * Centralized Client-Side Fetch Wrapper
 * 
 * Features:
 * - Automatically injects the JWT Bearer token into HTTP headers.
 * - Handles JSON serialization and response parsing.
 * - Throws descriptive error objects for catch blocks in UI controllers.
 */

const API_BASE = '/api';
const TOKEN_KEY = 'helpfund_token';
const USER_KEY = 'helpfund_user';

class ApiClient {
  /**
   * Retrieves the stored JWT token.
   * @returns {string|null}
   */
  static getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Stores the JWT token.
   * @param {string} token
   */
  static setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Removes the JWT token and user profile on logout.
   */
  static clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * General-purpose HTTP request dispatcher.
   * @param {string} endpoint - Relative path (e.g. '/auth/login')
   * @param {object} options - Fetch options (method, body, headers)
   * @returns {Promise<any>}
   */
  static async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = data.error || (data.errors ? data.errors.join('. ') : 'An unexpected error occurred.');
        const error = new Error(errorMessage);
        error.status = response.status;
        error.errors = data.errors || [];
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  static get(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  static post(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, { method: 'POST', body, headers });
  }

  static put(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, { method: 'PUT', body, headers });
  }

  static delete(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'DELETE', headers });
  }
}

/**
 * Escapes user-supplied text before it is placed into innerHTML templates (prevents stored XSS).
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.ApiClient = ApiClient;
window.escapeHtml = escapeHtml;
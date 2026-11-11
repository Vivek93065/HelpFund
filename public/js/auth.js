/**
 * public/js/auth.js
 * 
 * Client-Side Authentication State Manager
 */

const Auth = {
  /**
   * Registers a new user account.
   */
  async register({ full_name, email, password, role, bio }) {
    const response = await ApiClient.post('/auth/register', {
      full_name,
      email,
      password,
      role,
      bio
    });

    if (response.token && response.user) {
      ApiClient.setToken(response.token);
      localStorage.setItem('helpfund_user', JSON.stringify(response.user));
    }
    return response;
  },

  /**
   * Authenticates user credentials.
   */
  async login(email, password) {
    const response = await ApiClient.post('/auth/login', { email, password });

    if (response.token && response.user) {
      ApiClient.setToken(response.token);
      localStorage.setItem('helpfund_user', JSON.stringify(response.user));
    }
    return response;
  },

  /**
   * Logs out user and redirects to login page.
   */
  logout() {
    ApiClient.clearAuth();
    window.location.href = '/login.html';
  },

  /**
   * Returns current user object from localStorage.
   */
  getUser() {
    try {
      const user = localStorage.getItem('helpfund_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  /**
   * Returns true if a valid token is stored.
   */
  isLoggedIn() {
    return Boolean(ApiClient.getToken());
  },

  /**
   * Dynamically renders user status in the navbar.
   */
  renderNavUser() {
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    if (this.isLoggedIn()) {
      const user = this.getUser();
      const displayName = user ? user.full_name.split(' ')[0] : 'User';
      const roleBadge = user && user.role === 'admin' ? '<span class="badge badge-secondary" style="margin-left:4px;">Admin</span>' : '';

      navActions.innerHTML = `
        <span style="font-weight:600; font-size:0.9rem; color:var(--color-text-main);">
          Hi, ${displayName} ${roleBadge}
        </span>
        <button id="logout-btn" class="btn btn-secondary" style="padding:0.45rem 0.9rem; font-size:0.85rem;">
          Sign Out
        </button>
      `;

      document.getElementById('logout-btn')?.addEventListener('click', () => {
        this.logout();
      });
    } else {
      navActions.innerHTML = `
        <a href="/login.html" class="btn btn-secondary">Sign In</a>
        <a href="/login.html?tab=register" class="btn btn-primary">Start a Campaign</a>
      `;
    }
  }
};

window.Auth = Auth;

// Automatically initialize navbar if loaded
document.addEventListener('DOMContentLoaded', () => {
  Auth.renderNavUser();
});

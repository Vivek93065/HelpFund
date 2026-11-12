/**
 * public/js/auth.js
 * 
 * Client-Side Authentication, Navbar State & Toast Notification Engine
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
    showToast('Signed out successfully. See you soon!', 'info');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 600);
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
    const navLinks = document.querySelector('.nav-links');
    if (!navActions) return;

    if (this.isLoggedIn()) {
      const user = this.getUser();
      const displayName = user ? user.full_name : 'User';
      const roleBadge = user && user.role === 'admin'
        ? '<span class="badge badge-secondary" style="margin-left:4px;">Admin</span>'
        : '';

      // Ensure Dashboard is visible in main navigation links if not already present
      if (navLinks && !document.getElementById('nav-link-dashboard')) {
        const dashLi = document.createElement('li');
        dashLi.id = 'nav-link-dashboard';
        const isDashActive = window.location.pathname.includes('dashboard') ? 'active' : '';
        dashLi.innerHTML = `<a href="/dashboard.html" class="nav-link ${isDashActive}">Dashboard</a>`;
        navLinks.appendChild(dashLi);
      }

      navActions.innerHTML = `
        <a href="/create-campaign.html" class="btn btn-primary btn-sm" style="font-weight:600;">
          + New Campaign
        </a>
        <div style="display:flex; align-items:center; gap:0.5rem; background:var(--color-surface-hover); padding:0.35rem 0.75rem; border-radius:var(--radius-full); border:1px solid var(--color-border);">
          <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">
            Hi, ${escapeHtml(displayName)} ${roleBadge}
          </span>
        </div>
        <button id="logout-btn" class="btn btn-secondary btn-sm" style="padding:0.4rem 0.8rem; font-size:0.85rem;" title="Sign out of HelpFund">
          Sign Out
        </button>
      `;

      document.getElementById('logout-btn')?.addEventListener('click', () => {
        this.logout();
      });
    } else {
      navActions.innerHTML = `
        <a href="/login.html" class="btn btn-secondary btn-sm">Sign In</a>
        <a href="/login.html?tab=register" class="btn btn-primary btn-sm">Start a Campaign</a>
      `;
    }

    // Initialize mobile hamburger menu if present or needed
    this.initMobileNav();
  },

  initMobileNav() {
    const navbarContainer = document.querySelector('.navbar-container');
    const navLinks = document.querySelector('.nav-links');
    if (!navbarContainer || !navLinks || document.getElementById('mobile-toggle-btn')) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'mobile-toggle-btn';
    toggleBtn.className = 'mobile-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
    toggleBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;

    toggleBtn.addEventListener('click', () => {
      navLinks.classList.toggle('nav-links-mobile-open');
    });

    navbarContainer.insertBefore(toggleBtn, navLinks.parentElement);
  }
};

/**
 * Toast Notification System
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration
 */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close Notification">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.Auth = Auth;
window.showToast = showToast;

// Auto-mount navbar user status on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.renderNavUser());
} else {
  Auth.renderNavUser();
}

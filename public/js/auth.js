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
      const user = this.getUser() || {};
      const displayName = user.full_name || 'User';
      // Skip titles/suffixes ("Dr. Maya Lin, MD" -> "Maya Lin") for the short name and initials
      const shortName = displayName.replace(/,.*$/, '').replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim() || displayName;
      const firstName = shortName.split(/\s+/)[0];
      const initials = shortName.split(/\s+/).filter(Boolean).slice(0, 2)
        .map((w) => w[0].toUpperCase()).join('') || 'U';
      const role = user.role || 'creator';
      const roleLabel = { admin: 'Admin', creator: 'Campaign Creator', donor: 'Donor' }[role] || role;
      const canCreate = role === 'creator' || role === 'admin';

      // Ensure Dashboard is visible in main navigation links if not already present
      if (navLinks && !document.getElementById('nav-link-dashboard')) {
        const dashLi = document.createElement('li');
        dashLi.id = 'nav-link-dashboard';
        const isDashActive = window.location.pathname.includes('dashboard') ? 'active' : '';
        dashLi.innerHTML = `<a href="/dashboard.html" class="nav-link ${isDashActive}">Dashboard</a>`;
        navLinks.appendChild(dashLi);
      }

      const icon = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
      const ICONS = {
        dashboard: icon('<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>'),
        campaigns: icon('<path d="M3 11l18-8-8 18-2-8-8-2z"/>'),
        donations: icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
        plus: icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
        explore: icon('<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>'),
        logout: icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')
      };

      navActions.innerHTML = `
        ${canCreate ? '<a href="/create-campaign.html" class="btn btn-primary btn-sm nav-cta">+ New Campaign</a>' : ''}
        <div class="user-menu" id="user-menu">
          <button type="button" class="user-menu-trigger" id="user-menu-btn" aria-haspopup="true" aria-expanded="false" aria-controls="user-menu-panel">
            <span class="user-avatar">${escapeHtml(initials)}</span>
            <span class="user-menu-name">${escapeHtml(firstName)}</span>
            <svg class="user-menu-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="user-menu-panel" id="user-menu-panel" role="menu" hidden>
            <div class="user-menu-header">
              <span class="user-avatar user-avatar-lg">${escapeHtml(initials)}</span>
              <div class="user-menu-who">
                <strong>${escapeHtml(displayName)}</strong>
                <span class="user-menu-email">${escapeHtml(user.email || '')}</span>
                <span class="user-role-pill">${escapeHtml(roleLabel)}</span>
              </div>
            </div>
            <div class="user-menu-section">
              <a role="menuitem" href="/dashboard.html">${ICONS.dashboard}<span>Dashboard</span></a>
              <a role="menuitem" href="/dashboard.html#campaigns">${ICONS.campaigns}<span>My Campaigns</span></a>
              <a role="menuitem" href="/dashboard.html#donations">${ICONS.donations}<span>My Donations</span></a>
              ${canCreate ? `<a role="menuitem" href="/create-campaign.html">${ICONS.plus}<span>Start a Campaign</span></a>` : ''}
              <a role="menuitem" href="/explore.html">${ICONS.explore}<span>Explore Causes</span></a>
            </div>
            <div class="user-menu-section">
              <button type="button" role="menuitem" class="user-menu-logout" id="user-menu-logout">${ICONS.logout}<span>Sign Out</span></button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('user-menu-logout')?.addEventListener('click', () => this.logout());

      // Open/close behaviour (bound once for the whole page)
      if (!this._userMenuBound) {
        this._userMenuBound = true;
        const setOpen = (open) => {
          const btn = document.getElementById('user-menu-btn');
          const panel = document.getElementById('user-menu-panel');
          if (!btn || !panel) return;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          panel.hidden = !open;
        };
        document.addEventListener('click', (e) => {
          const wrap = document.getElementById('user-menu');
          if (!wrap) return;
          if (e.target.closest('#user-menu-btn')) {
            const open = document.getElementById('user-menu-btn').getAttribute('aria-expanded') === 'true';
            setOpen(!open);
          } else if (!wrap.contains(e.target) || e.target.closest('#user-menu-panel a')) {
            setOpen(false);
          }
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            document.getElementById('user-menu-btn')?.focus();
          }
        });
      }
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
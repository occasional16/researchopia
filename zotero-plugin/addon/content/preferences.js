/**
 * Preferences script for Researchopia plugin
 * Handles preference pane initialization and events
 */

var ResearchopiaPreferences = {
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize preference pane
    if (typeof Zotero !== 'undefined') {
      Zotero.debug("Researchopia preferences initialized");
    }

    // Set up event listeners
    this.setupEventListeners();

    // Load current auth state
    this.loadAuthState();
  },

  setupEventListeners() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const loginBtn = document.getElementById('researchopia-login-btn');
      const logoutBtn = document.getElementById('researchopia-logout-btn');
      const emailInput = document.getElementById('researchopia-email');
      const passwordInput = document.getElementById('researchopia-password');

      if (typeof Zotero !== 'undefined') {
        Zotero.debug("Researchopia: Setting up event listeners");
        Zotero.debug("Login button found: " + !!loginBtn);
        Zotero.debug("Logout button found: " + !!logoutBtn);
      }

      if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof Zotero !== 'undefined') {
            Zotero.debug("Researchopia: Login button clicked");
          }
          this.handleLogin();
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof Zotero !== 'undefined') {
            Zotero.debug("Researchopia: Logout button clicked");
          }
          this.handleLogout();
        });
      }

      // Handle Enter key in both email and password fields
      if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleLogin();
          }
        });
      }

      if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handleLogin();
          }
        });
      }
    }, 100);
  },

  async loadAuthState() {
    try {
      let isLoggedIn = false;
      let userEmail = null;

      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Loading auth state...');
      }

      // Check auth state with enhanced session verification
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia && Zotero.Researchopia.auth) {
        // Force re-check session validity
        isLoggedIn = await Zotero.Researchopia.auth.checkExistingSession();
        if (isLoggedIn) {
          const user = await Zotero.Researchopia.auth.getCurrentUser();
          userEmail = user?.email;

          if (typeof Zotero !== 'undefined') {
            Zotero.debug('Researchopia: Session restored for user: ' + userEmail);
          }
        } else {
          if (typeof Zotero !== 'undefined') {
            Zotero.debug('Researchopia: No valid session found');
          }
        }
      } else {
        if (typeof Zotero !== 'undefined') {
          Zotero.debug('Researchopia: Auth module not available');
        }
      }

      this.updateUI(isLoggedIn, userEmail);
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error loading auth state: ' + error.message);
      }
      this.updateUI(false);
    }
  },

  async handleLogin() {
    const emailInput = document.getElementById('researchopia-email');
    const passwordInput = document.getElementById('researchopia-password');
    const errorMsg = document.getElementById('researchopia-error-message');
    const loginBtn = document.getElementById('researchopia-login-btn');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.showError('Please enter both email and password');
      return;
    }

    // Show loading state
    if (loginBtn) loginBtn.disabled = true;
    if (errorMsg) errorMsg.textContent = '';

    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Attempting login for: ' + email);
      }

      // Check if auth module is available
      if (typeof Zotero === 'undefined' || !Zotero.Researchopia || !Zotero.Researchopia.auth) {
        this.showError('Authentication module not loaded. Please restart Zotero and try again.');
        return;
      }

      // Use real Supabase authentication
      const result = await Zotero.Researchopia.auth.signIn(email, password);

      if (result.success) {
        this.updateUI(true, email);
        this.showSuccess('Login successful!');
        // Clear password field
        passwordInput.value = '';
      } else {
        this.showError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Login error: ' + error.message);
      }
      this.showError('Login failed: ' + error.message);
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        if (loginBtn.textContent === 'Logging in...') {
          loginBtn.textContent = 'Login';
        }
      }
    }
  },

  async handleLogout() {
    const logoutBtn = document.getElementById('researchopia-logout-btn');

    if (logoutBtn) logoutBtn.disabled = true;

    try {
      // Check if auth module is available
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia && Zotero.Researchopia.auth) {
        await Zotero.Researchopia.auth.signOut();
      } else {
        this.showError('Authentication module not available.');
        return;
      }

      this.updateUI(false);
      this.showSuccess('Logged out successfully!');
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Logout error: ' + error.message);
      }
      this.showError('Logout failed: ' + error.message);
    } finally {
      if (logoutBtn) logoutBtn.disabled = false;
    }
  },

  updateUI(isLoggedIn, userEmail = null) {
    const loginSection = document.getElementById('researchopia-login-section');
    const loggedInSection = document.getElementById('researchopia-logged-in-section');
    const userEmailSpan = document.getElementById('researchopia-user-email');

    if (loginSection) {
      loginSection.style.display = isLoggedIn ? 'none' : 'block';
    }

    if (loggedInSection) {
      loggedInSection.style.display = isLoggedIn ? 'block' : 'none';
    }

    if (userEmailSpan && userEmail) {
      userEmailSpan.textContent = userEmail;
    }
  },

  showError(message) {
    const errorMsg = document.getElementById('researchopia-error-message');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.color = 'red';
    }
  },

  showSuccess(message) {
    const errorMsg = document.getElementById('researchopia-error-message');
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.color = 'green';
    }
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      if (errorMsg) errorMsg.textContent = '';
    }, 3000);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ResearchopiaPreferences.init());
} else {
  ResearchopiaPreferences.init();
}

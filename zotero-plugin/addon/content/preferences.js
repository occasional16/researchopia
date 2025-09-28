/**
 * Preferences script for Researchopia plugin
 * Handles preference pane initialization and events
 */

var ResearchopiaPreferences = {
  initialized: false,
  auth: null,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Initialize preference pane
    if (typeof Zotero !== 'undefined') {
      Zotero.debug("Researchopia preferences initialized");
    }

    // Load Supabase auth module
    this.loadAuthModule();

    // Set up event listeners
    this.setupEventListeners();

    // Load current auth state
    this.loadAuthState();
  },

  loadAuthModule() {
    try {
      // Create the auth module directly instead of loading from external script
      this.auth = this.createSupabaseAuth();
      // Load saved auth state
      this.auth.loadAuthState();
      Zotero.debug("Researchopia: Auth module created successfully");
    } catch (error) {
      Zotero.debug("Researchopia: Failed to create auth module: " + error.message);
    }
  },

  createSupabaseAuth() {
    return {
      supabaseUrl: 'https://obcblvdtqhwrihoddlez.supabase.co',
      supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4',
      currentUser: null,
      accessToken: null,

      async signIn(email, password) {
        try {
          Zotero.debug("Researchopia: Attempting to sign in with email: " + email);

          const response = await fetch(`${this.supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`
            },
            body: JSON.stringify({
              email: email,
              password: password
            })
          });

          const data = await response.json();

          if (response.ok && data.access_token) {
            this.accessToken = data.access_token;
            this.currentUser = data.user;

            // Save auth state
            this.saveAuthState(email, data.access_token, data.user);

            Zotero.debug("Researchopia: Sign in successful");
            return { success: true, user: data.user };
          } else {
            Zotero.debug("Researchopia: Sign in failed: " + (data.error_description || data.message || 'Unknown error'));
            return { success: false, error: data.error_description || data.message || 'Login failed' };
          }
        } catch (error) {
          Zotero.debug("Researchopia: Sign in error: " + error.message);
          return { success: false, error: error.message };
        }
      },

      async signUp(email, password) {
        try {
          Zotero.debug("Researchopia: Attempting to sign up with email: " + email);

          const response = await fetch(`${this.supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`
            },
            body: JSON.stringify({
              email: email,
              password: password
            })
          });

          const data = await response.json();

          if (response.ok) {
            Zotero.debug("Researchopia: Sign up successful");
            return { success: true, message: 'Registration successful. Please check your email for verification.' };
          } else {
            Zotero.debug("Researchopia: Sign up failed: " + (data.error_description || data.message || 'Unknown error'));
            return { success: false, error: data.error_description || data.message || 'Registration failed' };
          }
        } catch (error) {
          Zotero.debug("Researchopia: Sign up error: " + error.message);
          return { success: false, error: error.message };
        }
      },

      async signOut() {
        try {
          if (this.accessToken) {
            await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.accessToken}`
              }
            });
          }
        } catch (error) {
          Zotero.debug("Researchopia: Sign out API error: " + error.message);
        }

        // Clear local state regardless of API call result
        this.currentUser = null;
        this.accessToken = null;
        this.clearAuthState();

        Zotero.debug("Researchopia: Signed out successfully");
        return { success: true };
      },

      getCurrentUser() {
        return this.currentUser;
      },

      isLoggedIn() {
        return this.currentUser !== null && this.accessToken !== null;
      },

      getAccessToken() {
        return this.accessToken;
      },

      async testConnection() {
        try {
          const response = await fetch(`${this.supabaseUrl}/rest/v1/`, {
            method: 'GET',
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.supabaseKey}`
            }
          });

          if (response.ok) {
            return { success: true, message: 'Connection successful' };
          } else {
            return { success: false, error: `Connection failed: ${response.status}` };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      saveAuthState(email, accessToken, user) {
        try {
          Zotero.Prefs.set('extensions.zotero.researchopia.email', email, true);
          Zotero.Prefs.set('extensions.zotero.researchopia.accessToken', accessToken, true);
          Zotero.Prefs.set('extensions.zotero.researchopia.user', JSON.stringify(user), true);
          Zotero.Prefs.set('extensions.zotero.researchopia.isLoggedIn', true, true);
          Zotero.Prefs.set('extensions.zotero.researchopia.loginTime', new Date().toISOString(), true);

          Zotero.debug("Researchopia: Auth state saved");
        } catch (error) {
          Zotero.debug("Researchopia: Failed to save auth state: " + error.message);
        }
      },

      loadAuthState() {
        try {
          const isLoggedIn = Zotero.Prefs.get('extensions.zotero.researchopia.isLoggedIn', true);
          if (isLoggedIn) {
            const email = Zotero.Prefs.get('extensions.zotero.researchopia.email', true);
            const accessToken = Zotero.Prefs.get('extensions.zotero.researchopia.accessToken', true);
            const userJson = Zotero.Prefs.get('extensions.zotero.researchopia.user', true);

            if (email && accessToken && userJson) {
              this.accessToken = accessToken;
              this.currentUser = JSON.parse(userJson);
              Zotero.debug("Researchopia: Auth state loaded for user: " + email);
            }
          }
        } catch (error) {
          Zotero.debug("Researchopia: Failed to load auth state: " + error.message);
          this.clearAuthState();
        }
      },

      clearAuthState() {
        try {
          Zotero.Prefs.clear('extensions.zotero.researchopia.email', true);
          Zotero.Prefs.clear('extensions.zotero.researchopia.accessToken', true);
          Zotero.Prefs.clear('extensions.zotero.researchopia.user', true);
          Zotero.Prefs.clear('extensions.zotero.researchopia.isLoggedIn', true);
          Zotero.Prefs.clear('extensions.zotero.researchopia.loginTime', true);

          Zotero.debug("Researchopia: Auth state cleared");
        } catch (error) {
          Zotero.debug("Researchopia: Failed to clear auth state: " + error.message);
        }
      },

      async refreshSession() {
        if (!this.accessToken) {
          return { success: false, error: 'No access token available' };
        }

        try {
          const response = await fetch(`${this.supabaseUrl}/auth/v1/user`, {
            method: 'GET',
            headers: {
              'apikey': this.supabaseKey,
              'Authorization': `Bearer ${this.accessToken}`
            }
          });

          if (response.ok) {
            const user = await response.json();
            this.currentUser = user;
            
            // Update stored session with fresh user data
            this.saveAuthState(user.email, this.accessToken, user);
            
            return { success: true, user: user };
          } else {
            // Token might be expired, but don't clear auth state immediately
            // Let user try to re-login
            const data = response.status === 401 ? 'Token已过期，请重新登录' : 'Session validation failed';
            return { success: false, error: data };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  },

  setupEventListeners() {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const loginBtn = document.getElementById('researchopia-login-btn');
      const logoutBtn = document.getElementById('researchopia-logout-btn');
      const registerBtn = document.getElementById('researchopia-register-btn');
      const testBtn = document.getElementById('researchopia-test-connection-btn');
      const refreshBtn = document.getElementById('researchopia-refresh-btn');
      const emailInput = document.getElementById('researchopia-email');
      const passwordInput = document.getElementById('researchopia-password');

      if (typeof Zotero !== 'undefined') {
        Zotero.debug("Researchopia: Setting up event listeners");
        Zotero.debug("Login button found: " + !!loginBtn);
        Zotero.debug("Logout button found: " + !!logoutBtn);
        Zotero.debug("Register button found: " + !!registerBtn);
        Zotero.debug("Test button found: " + !!testBtn);
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

      if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRegister();
        });
      }

      if (testBtn) {
        testBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleTestConnection();
        });
      }

      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRefresh();
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

      // Check auth state using our loaded auth module
      if (this.auth) {
        // Force reload auth state from preferences
        this.auth.loadAuthState();

        isLoggedIn = this.auth.isLoggedIn();
        if (isLoggedIn) {
          const user = this.auth.getCurrentUser();
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

      // Always update UI after loading state
      setTimeout(() => {
        this.updateUI(isLoggedIn, userEmail);
      }, 100);

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
      if (!this.auth) {
        this.showError('Authentication module not loaded. Please restart Zotero and try again.');
        return;
      }

      // Use real Supabase authentication
      const result = await this.auth.signIn(email, password);

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
      // Use the auth module we loaded
      if (this.auth) {
        await this.auth.signOut();
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

  async handleRegister() {
    const emailInput = document.getElementById('researchopia-email');
    const passwordInput = document.getElementById('researchopia-password');
    const registerBtn = document.getElementById('researchopia-register-btn');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      this.showError('Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters long');
      return;
    }

    if (registerBtn) {
      registerBtn.disabled = true;
      registerBtn.textContent = 'Registering...';
    }

    try {
      if (!this.auth) {
        this.showError('Authentication module not available.');
        return;
      }

      const result = await this.auth.signUp(email, password);

      if (result.success) {
        this.showSuccess('Registration successful! Please check your email for verification.');
        passwordInput.value = '';
      } else {
        this.showError(result.error || 'Registration failed.');
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Registration error: ' + error.message);
      }
      this.showError('Registration failed: ' + error.message);
    } finally {
      if (registerBtn) {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
      }
    }
  },

  async handleTestConnection() {
    const testBtn = document.getElementById('researchopia-test-connection-btn');

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = 'Testing...';
    }

    try {
      if (!this.auth) {
        this.showError('Authentication module not available.');
        return;
      }

      const result = await this.auth.testConnection();

      if (result.success) {
        this.showSuccess('Connection successful! Supabase is reachable.');
      } else {
        this.showError('Connection failed: ' + result.error);
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Connection test error: ' + error.message);
      }
      this.showError('Connection test failed: ' + error.message);
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
      }
    }
  },

  async handleRefresh() {
    const refreshBtn = document.getElementById('researchopia-refresh-btn');

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
    }

    try {
      if (!this.auth) {
        this.showError('Authentication module not available.');
        return;
      }

      const result = await this.auth.refreshSession();

      if (result.success) {
        // Get user display name
        let displayName = result.user.email;
        const user = result.user;
        const username = user.user_metadata?.username || 
                        user.user_metadata?.name ||
                        user.user_metadata?.full_name;
        
        if (username) {
          displayName = username;
        } else if (user.email) {
          displayName = user.email.includes('@') ? user.email.split('@')[0] : user.email;
        }

        this.updateUI(true, displayName);
        this.showSuccess('会话状态刷新成功！');
      } else {
        // Don't update UI to logged out state immediately, just show error
        this.showError('会话验证失败: ' + result.error);
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Refresh error: ' + error.message);
      }
      this.showError('刷新失败: ' + error.message);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh Status';
      }
    }
  },

  updateUI(isLoggedIn, userEmail = null) {
    if (typeof Zotero !== 'undefined') {
      Zotero.debug(`Researchopia: Updating UI - isLoggedIn: ${isLoggedIn}, userEmail: ${userEmail}`);
    }

    const loginSection = document.getElementById('login-section');
    const logoutSection = document.getElementById('logout-section');
    const currentUserEmail = document.getElementById('current-user-email');
    const currentLoginTime = document.getElementById('current-login-time');
    const authStatus = document.getElementById('auth-status');

    if (typeof Zotero !== 'undefined') {
      Zotero.debug(`Researchopia: UI elements found - loginSection: ${!!loginSection}, logoutSection: ${!!logoutSection}, authStatus: ${!!authStatus}`);
    }

    if (loginSection) {
      loginSection.style.display = isLoggedIn ? 'none' : 'block';
    }

    if (logoutSection) {
      logoutSection.style.display = isLoggedIn ? 'block' : 'none';
    }

    // Get user display name from current user
    let displayName = userEmail;
    if (isLoggedIn && this.auth && this.auth.currentUser) {
      const user = this.auth.currentUser;
      // Try to extract username from user metadata
      const username = user.user_metadata?.username || 
                      user.user_metadata?.name ||
                      user.user_metadata?.full_name;
      
      if (username) {
        displayName = username;
      } else if (user.email) {
        // Use email prefix as fallback
        displayName = user.email.includes('@') ? user.email.split('@')[0] : user.email;
      }
    }

    if (currentUserEmail && displayName) {
      currentUserEmail.textContent = displayName;
    }

    if (currentLoginTime && isLoggedIn) {
      try {
        const loginTime = Zotero.Prefs.get('extensions.zotero.researchopia.loginTime', true);
        if (loginTime) {
          const date = new Date(loginTime);
          currentLoginTime.textContent = date.toLocaleString();
        }
      } catch (error) {
        if (typeof Zotero !== 'undefined') {
          Zotero.debug('Researchopia: Error getting login time: ' + error.message);
        }
      }
    }

    if (authStatus) {
      if (isLoggedIn) {
        authStatus.textContent = `已登录为 ${displayName || 'Unknown'}`;
        authStatus.className = 'status-message success';
      } else {
        authStatus.textContent = '请登录以访问共享标注功能';
        authStatus.className = 'status-message info';
      }
    }

    // Clear any input fields when logged in
    if (isLoggedIn) {
      const emailInput = document.getElementById('researchopia-email');
      const passwordInput = document.getElementById('researchopia-password');
      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';
    }
  },

  showError(message) {
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
      authStatus.textContent = message;
      authStatus.className = 'status-message error';
    }
  },

  showSuccess(message) {
    const authStatus = document.getElementById('auth-status');
    if (authStatus) {
      authStatus.textContent = message;
      authStatus.className = 'status-message success';
    }

    // Clear success message after 3 seconds and restore auth status
    setTimeout(() => {
      this.loadAuthState();
    }, 3000);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ResearchopiaPreferences.init());
} else {
  ResearchopiaPreferences.init();
}

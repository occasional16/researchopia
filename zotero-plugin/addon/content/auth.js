/**
 * Simplified Supabase Authentication Module for Zotero Plugin
 * This module provides direct authentication functionality without external dependencies
 */

var ResearchopiaAuth = {
  supabase: null,
  initialized: false,

  // Supabase configuration from .env.local
  config: {
    url: 'https://obcblvdtqhwrihoddlez.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4'
  },

  initialize() {
    if (this.initialized) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Auth module already initialized');
      }
      return;
    }

    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Initializing auth module');
        Zotero.debug('Researchopia: Supabase URL: ' + this.config.url);
        Zotero.debug('Researchopia: XMLHttpRequest available: ' + (typeof XMLHttpRequest !== 'undefined'));
      }

      // Initialize Supabase client using fetch API
      this.supabase = {
        url: this.config.url,
        key: this.config.anonKey,
        headers: {
          'apikey': this.config.anonKey,
          'Authorization': `Bearer ${this.config.anonKey}`,
          'Content-Type': 'application/json'
        }
      };

      this.initialized = true;

      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Auth module initialized successfully');
      }

      // Check for existing session
      this.checkExistingSession();
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Failed to initialize auth module:', error);
      }
    }
  },

  async checkExistingSession() {
    try {
      const storedSession = this.getStoredSession();
      if (storedSession && storedSession.expires_at > Date.now() / 1000) {
        if (typeof Zotero !== 'undefined') {
          Zotero.debug('Researchopia: Valid session found, expires at:', new Date(storedSession.expires_at * 1000));
        }

        // Verify session with server
        try {
          const userInfo = await this.makeRequest('GET', '/auth/v1/user', null, storedSession.access_token);
          if (userInfo && userInfo.id) {
            if (typeof Zotero !== 'undefined') {
              Zotero.debug('Researchopia: Session verified with server');
            }
            return true;
          }
        } catch (verifyError) {
          if (typeof Zotero !== 'undefined') {
            Zotero.debug('Researchopia: Session verification failed:', verifyError);
          }
          // Clear invalid session
          this.clearStoredSession();
          return false;
        }
      } else {
        // Clear expired session
        this.clearStoredSession();
        return false;
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error checking session:', error);
      }
      return false;
    }
  },

  async signIn(email, password) {
    if (!this.initialized) {
      this.initialize();
    }

    try {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Attempting sign in for:', email);
      }

      // Use XMLHttpRequest instead of fetch for better compatibility
      const data = await this.makeRequest('POST', '/auth/v1/token?grant_type=password', {
        email: email,
        password: password
      });

      if (data.access_token) {
        // Store session
        this.storeSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          user: data.user
        });

        if (typeof Zotero !== 'undefined') {
          Zotero.debug('Researchopia: Sign in successful');
        }

        return { success: true, user: data.user };
      } else {
        if (typeof Zotero !== 'undefined') {
          Zotero.debug('Researchopia: Sign in failed:', data.error_description || data.msg);
        }
        return { success: false, error: data.error_description || data.msg || 'Login failed' };
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Sign in error:', error);
      }
      return { success: false, error: 'Network error: ' + error.message };
    }
  },

  async signOut() {
    try {
      const session = this.getStoredSession();
      if (session && session.access_token) {
        // Make request to Supabase logout endpoint
        await this.makeRequest('POST', '/auth/v1/logout', null, session.access_token);
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Sign out error:', error);
      }
    } finally {
      // Always clear local session
      this.clearStoredSession();

      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Sign out completed');
      }
    }
  },

  // Helper method to make HTTP requests using XMLHttpRequest
  makeRequest(method, endpoint, body = null, accessToken = null) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        const url = this.config.url + endpoint;

        xhr.open(method, url, true);

        // Set headers
        xhr.setRequestHeader('apikey', this.config.anonKey);
        xhr.setRequestHeader('Content-Type', 'application/json');

        if (accessToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        } else {
          xhr.setRequestHeader('Authorization', `Bearer ${this.config.anonKey}`);
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            try {
              const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};

              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(data);
              } else {
                reject(new Error(data.error_description || data.msg || `HTTP ${xhr.status}`));
              }
            } catch (parseError) {
              reject(new Error('Failed to parse response: ' + parseError.message));
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network request failed'));
        };

        xhr.ontimeout = function() {
          reject(new Error('Request timeout'));
        };

        xhr.timeout = 30000; // 30 second timeout

        // Send request
        if (body) {
          xhr.send(JSON.stringify(body));
        } else {
          xhr.send();
        }
      } catch (error) {
        reject(error);
      }
    });
  },

  async isLoggedIn() {
    return await this.checkExistingSession();
  },

  async getCurrentUser() {
    const session = this.getStoredSession();
    return session ? session.user : null;
  },

  // Session storage helpers
  storeSession(session) {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        Zotero.Prefs.set('extensions.zotero.researchopia.session', JSON.stringify(session));
        Zotero.Prefs.set('extensions.zotero.researchopia.loggedIn', true);
        Zotero.Prefs.set('extensions.zotero.researchopia.userEmail', session.user.email);
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error storing session:', error);
      }
    }
  },

  getStoredSession() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const sessionStr = Zotero.Prefs.get('extensions.zotero.researchopia.session', '');
        return sessionStr ? JSON.parse(sessionStr) : null;
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error getting stored session:', error);
      }
    }
    return null;
  },

  clearStoredSession() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        Zotero.Prefs.clear('extensions.zotero.researchopia.session');
        Zotero.Prefs.clear('extensions.zotero.researchopia.loggedIn');
        Zotero.Prefs.clear('extensions.zotero.researchopia.userEmail');
      }
    } catch (error) {
      if (typeof Zotero !== 'undefined') {
        Zotero.debug('Researchopia: Error clearing session:', error);
      }
    }
  }
};

// Auto-initialize when loaded
if (typeof Zotero !== 'undefined') {
  Zotero.debug('Researchopia: Auth module script loaded');
  ResearchopiaAuth.initialize();
}

// Export to global context
if (typeof window !== 'undefined') {
  window.ResearchopiaAuth = ResearchopiaAuth;
} else {
  // For script loader context
  this.ResearchopiaAuth = ResearchopiaAuth;
}

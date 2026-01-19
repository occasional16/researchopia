/// <reference types="chrome" />
/**
 * Authentication module for the browser extension
 * Handles login state, token storage, and auth communication
 */

import type { AuthState, StorageAuth } from '../types';
import { showToast, setHidden } from '../utils';

// ============================================================================
// Auth Manager Class
// ============================================================================

export class AuthManager {
  private state: AuthState = {
    accessToken: null,
    userId: null,
    userEmail: null,
    userName: null,
    isLoggedIn: false,
  };

  private serverUrl: string;
  private onAuthChange?: (state: AuthState) => void;

  constructor(serverUrl: string, onAuthChange?: (state: AuthState) => void) {
    this.serverUrl = serverUrl;
    this.onAuthChange = onAuthChange;
  }

  // ==================== Getters ====================

  get accessToken(): string | null {
    return this.state.accessToken;
  }

  get userId(): string | null {
    return this.state.userId;
  }

  get userEmail(): string | null {
    return this.state.userEmail;
  }

  get userName(): string | null {
    return this.state.userName;
  }

  get isLoggedIn(): boolean {
    return this.state.isLoggedIn;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  // ==================== Server URL ====================

  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  // ==================== Auth State ====================

  /**
   * Check and restore auth status from storage
   */
  async checkAuthStatus(): Promise<boolean> {
    try {
      const result = await chrome.storage.sync.get(['authToken', 'userId', 'userEmail', 'userName']) as StorageAuth;
      
      if (result.authToken) {
        this.state = {
          accessToken: result.authToken,
          userId: result.userId || null,
          userEmail: result.userEmail || null,
          userName: result.userName || null,
          isLoggedIn: true,
        };
        
        // Fetch username from server if not cached
        if (!this.state.userName && this.state.accessToken) {
          await this.fetchUserProfile();
        }
        
        this.notifyAuthChange();
        return true;
      } else {
        // Try to get auth from website via background script
        const authData = await this.tryGetAuthFromWebsite();
        if (authData) {
          await this.setAuth(authData.token, authData.userId, authData.email);
          return true;
        }
      }
      
      this.notifyAuthChange();
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Fetch user profile from server to get username
   */
  private async fetchUserProfile(): Promise<void> {
    try {
      const response = await fetch(`${this.serverUrl}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${this.state.accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.username) {
          this.state.userName = data.username;
          await chrome.storage.sync.set({ userName: data.username });
          // Update UI immediately after fetching username
          this.updateUserInfo();
        }
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  }

  /**
   * Set authentication state and persist to storage
   */
  async setAuth(token: string, userId?: string, email?: string, userName?: string): Promise<void> {
    this.state = {
      accessToken: token,
      userId: userId || null,
      userEmail: email || null,
      userName: userName || null,
      isLoggedIn: true,
    };

    await chrome.storage.sync.set({
      authToken: token,
      userId: userId,
      userEmail: email,
      userName: userName,
    });

    // Fetch username if not provided
    if (!userName && token) {
      await this.fetchUserProfile();
    }

    this.notifyAuthChange();
  }

  /**
   * Clear authentication state
   */
  async clearAuth(): Promise<void> {
    this.state = {
      accessToken: null,
      userId: null,
      userEmail: null,
      userName: null,
      isLoggedIn: false,
    };

    await chrome.storage.sync.remove(['authToken', 'userId', 'userEmail', 'userName']);
    this.notifyAuthChange();
  }

  // ==================== Auth Actions ====================

  /**
   * Open website for login
   */
  async login(): Promise<void> {
    chrome.tabs.create({ url: this.serverUrl });
    showToast('请在网站上登录，然后刷新此侧边栏', 'success');
  }

  /**
   * Logout and clear state
   */
  async logout(): Promise<void> {
    await this.clearAuth();
    showToast('已退出登录', 'success');
  }

  // ==================== UI Updates ====================

  /**
   * Show login prompt UI (update both header and content area)
   */
  showLoginPrompt(): void {
    // Content area
    setHidden(document.getElementById('loginPrompt'), false);
    setHidden(document.getElementById('loggedInContent'), true);
    
    // Header area
    setHidden(document.getElementById('headerUser'), true);
    setHidden(document.getElementById('headerLoginBtn'), false);
  }

  /**
   * Show logged in content UI (update both header and content area)
   */
  showLoggedInContent(): void {
    // Content area
    setHidden(document.getElementById('loginPrompt'), true);
    setHidden(document.getElementById('loggedInContent'), false);
    
    // Header area
    setHidden(document.getElementById('headerUser'), false);
    setHidden(document.getElementById('headerLoginBtn'), true);
  }

  /**
   * Update user info display (both header avatar and any user info sections)
   */
  updateUserInfo(): void {
    // Use userName from users table, fallback to email prefix
    const displayName = this.state.userName || 
      (this.state.userEmail ? this.state.userEmail.split('@')[0] : '用户');
    const initial = displayName.charAt(0).toUpperCase();
    
    // Header avatar and username
    const headerAvatar = document.getElementById('headerAvatar');
    const headerUsername = document.getElementById('headerUsername');
    if (headerAvatar) {
      headerAvatar.textContent = initial;
      headerAvatar.title = this.state.userEmail || '点击退出登录';
    }
    if (headerUsername) {
      headerUsername.textContent = displayName;
    }
    
    // Legacy user info section (if exists)
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    
    if (avatar) {
      avatar.textContent = initial;
    }
    if (name) {
      name.textContent = displayName;
    }
  }

  // ==================== Message Listener ====================

  /**
   * Setup listener for auth messages from website
   */
  setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((
      message: { action?: string; token?: string; userId?: string; userEmail?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: { success: boolean }) => void
    ) => {
      if (message.action === 'authComplete' && message.token) {
        this.setAuth(message.token, message.userId, message.userEmail).then(() => {
          this.showLoggedInContent();
          this.updateUserInfo();
          showToast('登录成功', 'success');
          sendResponse({ success: true });
        });
      }
      return true; // Keep message channel open for async response
    });
  }

  // ==================== Private Helpers ====================

  private async tryGetAuthFromWebsite(): Promise<{ token: string; userId: string; email?: string } | null> {
    try {
      // Get auth from active tab's content script via background
      const response = await chrome.runtime.sendMessage({ action: 'getAuthFromPage' });
      if (response?.success && response.token) {
        console.log('✅ Got auth from page via background');
        return {
          token: response.token,
          userId: response.userId,
          email: response.email,
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get auth from website:', error);
      return null;
    }
  }

  private notifyAuthChange(): void {
    if (this.onAuthChange) {
      this.onAuthChange(this.getState());
    }
  }
}

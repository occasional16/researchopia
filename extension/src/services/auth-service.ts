/**
 * Auth Service
 * Handles authentication state management for the extension
 */

import { getLocalStorage, setLocalStorage } from '../utils/storage';
import type { AuthStorageData } from '../types/storage';

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  token: string | null;
  tokenExpiry: number | null;
}

export interface AuthCheckResult {
  success: boolean;
  state: AuthState;
  source?: 'cache' | 'page' | 'none';
}

// Token buffer time (5 minutes before expiry)
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

// Token default validity (1 hour)
const TOKEN_DEFAULT_VALIDITY = 60 * 60 * 1000;

/**
 * Auth Service for managing authentication state
 */
export class AuthService {
  private state: AuthState = {
    isLoggedIn: false,
    userId: null,
    token: null,
    tokenExpiry: null,
  };

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.isLoggedIn && !!this.state.token;
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.state.token;
  }

  /**
   * Get user ID
   */
  getUserId(): string | null {
    return this.state.userId;
  }

  /**
   * Check login status from storage and optionally from page
   */
  async checkLoginStatus(tabId?: number): Promise<AuthCheckResult> {
    // 1. Check cached auth in local storage
    const cachedResult = await this.checkCachedAuth();
    if (cachedResult.success) {
      return { ...cachedResult, source: 'cache' };
    }

    // 2. Try to get auth from current page (if on Researchopia site)
    if (tabId) {
      const pageResult = await this.syncFromPage(tabId);
      if (pageResult.success) {
        return { ...pageResult, source: 'page' };
      }
    }

    // 3. Not logged in
    this.clearState();
    return {
      success: false,
      state: this.state,
      source: 'none',
    };
  }

  /**
   * Check cached authentication from storage
   */
  async checkCachedAuth(): Promise<AuthCheckResult> {
    try {
      const storage = await getLocalStorage(['authToken', 'userId', 'tokenExpiry']) as AuthStorageData;

      if (storage.authToken && storage.userId && storage.tokenExpiry) {
        const now = Date.now();
        
        // Check if token is still valid (with buffer)
        if (now < storage.tokenExpiry - TOKEN_EXPIRY_BUFFER) {
          this.state = {
            isLoggedIn: true,
            userId: storage.userId,
            token: storage.authToken,
            tokenExpiry: storage.tokenExpiry,
          };
          console.log('✅ Auth: Using cached token');
          return { success: true, state: this.state };
        } else {
          console.log('⚠️ Auth: Cached token expired');
        }
      }
    } catch (error) {
      console.error('Auth: Error checking cached auth:', error);
    }

    return { success: false, state: this.state };
  }

  /**
   * Sync authentication from the current page (if on Researchopia)
   */
  async syncFromPage(tabId: number): Promise<AuthCheckResult> {
    try {
      // Get tab info to check URL
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url ? new URL(tab.url) : null;

      // Only try to sync from Researchopia pages
      if (!url || (!url.hostname.includes('researchopia.com') && url.hostname !== 'localhost')) {
        return { success: false, state: this.state };
      }

      console.log('🔄 Auth: Trying to sync from page...');

      // Send message to content script to get auth
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'getSupabaseAuth',
      });

      if (response?.success && response.token) {
        await this.setAuth({
          token: response.token,
          userId: response.userId,
          tokenExpiry: Date.now() + TOKEN_DEFAULT_VALIDITY,
        });
        console.log('✅ Auth: Synced from page');
        return { success: true, state: this.state };
      }
    } catch (error) {
      console.log('Auth: Could not sync from page:', error instanceof Error ? error.message : 'Unknown');
    }

    return { success: false, state: this.state };
  }

  /**
   * Set authentication data
   */
  async setAuth(data: { token: string; userId: string; tokenExpiry?: number }): Promise<void> {
    const expiry = data.tokenExpiry || Date.now() + TOKEN_DEFAULT_VALIDITY;

    this.state = {
      isLoggedIn: true,
      userId: data.userId,
      token: data.token,
      tokenExpiry: expiry,
    };

    // Save to storage
    await setLocalStorage({
      authToken: data.token,
      userId: data.userId,
      tokenExpiry: expiry,
    });

    console.log('✅ Auth: Credentials saved');
  }

  /**
   * Clear authentication
   */
  async logout(): Promise<void> {
    this.clearState();

    // Clear from storage
    await chrome.storage.local.remove(['authToken', 'userId', 'tokenExpiry']);

    console.log('✅ Auth: Logged out');
  }

  /**
   * Clear internal state
   */
  private clearState(): void {
    this.state = {
      isLoggedIn: false,
      userId: null,
      token: null,
      tokenExpiry: null,
    };
  }

  /**
   * Check if token needs refresh (within buffer time of expiry)
   */
  needsRefresh(): boolean {
    if (!this.state.tokenExpiry) return false;
    return Date.now() >= this.state.tokenExpiry - TOKEN_EXPIRY_BUFFER;
  }

  /**
   * Open login page
   */
  async openLoginPage(baseUrl: string = 'https://www.researchopia.com'): Promise<void> {
    await chrome.tabs.create({
      url: `${baseUrl}/?openLogin=true`,
      active: true,
    });
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let authServiceInstance: AuthService | null = null;

/**
 * Get or create the auth service instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

/**
 * Initialize auth service and check login status
 */
export async function initAuthService(tabId?: number): Promise<AuthService> {
  const service = getAuthService();
  await service.checkLoginStatus(tabId);
  return service;
}

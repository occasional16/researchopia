/**
 * Researchopia Content Script (Modular Version)
 * Detects DOI on academic pages and provides floating icon interface
 * v0.6.0 - Refactored to use modular architecture
 */

import { FloatingIcon, detectDOI } from './content/index';
import type { IconPosition } from './types/storage';

// ============================================================================
// Global Type Declaration
// ============================================================================

declare global {
  interface Window {
    researchopiaContentScript?: ContentScriptManager;
  }
}

// ============================================================================
// Content Script Manager (Coordinator)
// ============================================================================

class ContentScriptManager {
  private detectedDOI: string | null = null;
  private floatingIcon: FloatingIcon | null = null;
  private floatingEnabled: boolean = true;
  private savedPosition: IconPosition | null = null;

  constructor() {
    this.init();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async init(): Promise<void> {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startup());
    } else {
      this.startup();
    }
  }

  private async startup(): Promise<void> {
    // 1. Detect DOI
    const result = detectDOI();
    this.detectedDOI = result.doi;

    // 2. Load settings
    await this.loadSettings();

    // 3. Create floating icon
    this.createFloatingIcon();

    // 4. Setup message listener
    this.setupMessageListener();
  }

  // --------------------------------------------------------------------------
  // Settings Management
  // --------------------------------------------------------------------------

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['floatingEnabled', 'iconPosition']);
      this.floatingEnabled = result.floatingEnabled !== false;
      // Type assertion for iconPosition - ensure it has required properties
      const pos = result.iconPosition as IconPosition | undefined;
      this.savedPosition = (pos && typeof pos.left === 'string' && typeof pos.right === 'string' && typeof pos.top === 'string') 
        ? pos 
        : null;
    } catch {
      this.floatingEnabled = true;
      this.savedPosition = null;
    }
  }

  private async saveIconPosition(): Promise<void> {
    if (!this.floatingIcon) return;

    const position = this.floatingIcon.getPosition();
    if (position) {
      try {
        await chrome.storage.sync.set({ iconPosition: position });
      } catch {
        // Ignore storage errors
      }
    }
  }

  // --------------------------------------------------------------------------
  // Floating Icon
  // --------------------------------------------------------------------------

  private createFloatingIcon(): void {
    this.floatingIcon = new FloatingIcon({
      detectedDOI: this.detectedDOI,
      enabled: this.floatingEnabled,
      savedPosition: this.savedPosition,
      logoUrl: chrome.runtime.getURL('icons/logo-main.svg'),
      onClick: () => this.handleIconClick(),
      onHide: () => this.handleIconHide(),
      onPositionChange: () => this.saveIconPosition(),
    });

    this.floatingIcon.create();
  }

  private handleIconHide(): void {
    this.floatingEnabled = false;
    chrome.storage.sync.set({ floatingEnabled: false }).catch(() => {});
  }

  private handleIconClick(): void {
    try {
      chrome.runtime.sendMessage(
        {
          action: 'toggleSidePanel',
          doi: this.detectedDOI || null,
          url: window.location.href,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            return;
          }
          // Silently continue even if DOI not detected
        }
      );
    } catch {
      // Ignore errors
    }
  }

  // --------------------------------------------------------------------------
  // Message Handling
  // --------------------------------------------------------------------------

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      switch (request.action) {
        case 'toggleFloating':
        case 'toggleFloatingIcon':
          if (typeof request.enabled !== 'undefined') {
            this.setFloatingVisibility(request.enabled).then(() => {
              sendResponse({ success: true });
            });
            return true;
          } else {
            this.toggleFloatingIcon().then(() => {
              sendResponse({ success: true });
            });
            return true;
          }

        case 'getCurrentDOI':
          sendResponse({ success: true, doi: this.detectedDOI || null });
          break;

        case 'detectDOI':
          const result = detectDOI();
          this.detectedDOI = result.doi;
          sendResponse({ success: true, doi: result.doi });
          break;

        case 'getSupabaseAuth':
          this.getSupabaseAuth().then((authData) => {
            sendResponse(authData);
          });
          return true;

        case 'openSidebar':
          this.openSidebar().then((success) => {
            sendResponse({ success });
          });
          return true;

        case 'panelClosed':
          this.showClosedToast();
          sendResponse?.({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    });
  }

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  private async getSupabaseAuth(): Promise<{ success: boolean; token?: string; userId?: string; email?: string }> {
    try {
      // Supabase stores auth in localStorage with key pattern: sb-{project-ref}-auth-token
      const keys = Object.keys(localStorage);
      const supabaseKey = keys.find(key => key.includes('supabase') && key.includes('auth-token'));
      
      if (!supabaseKey) {
        // Try alternative key pattern: sb-*-auth-token
        const sbKey = keys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        if (!sbKey) {
          return { success: false };
        }
      }

      const authKey = supabaseKey || keys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
      if (!authKey) {
        return { success: false };
      }

      const authDataStr = localStorage.getItem(authKey);
      if (!authDataStr) {
        return { success: false };
      }

      const authData = JSON.parse(authDataStr);
      const accessToken = authData?.access_token;
      const userId = authData?.user?.id;
      const email = authData?.user?.email;

      if (accessToken && userId) {
        return {
          success: true,
          token: accessToken,
          userId,
          email,
        };
      }

      return { success: false };
    } catch {
      return { success: false };
    }
  }

  // --------------------------------------------------------------------------
  // Sidebar Operations
  // --------------------------------------------------------------------------

  private async openSidebar(): Promise<boolean> {
    // Save DOI info for sidebar to read
    if (this.detectedDOI) {
      try {
        await chrome.storage.sync.set({
          doiFromContentScript: this.detectedDOI,
          currentPageUrl: window.location.href,
          lastClickTime: Date.now(),
        });
      } catch {
        // Ignore storage errors
      }
    }

    try {
      const response = await new Promise<{ success: boolean }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'openSidePanel', doi: this.detectedDOI, url: window.location.href },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(resp);
            }
          }
        );
      });
      return response?.success ?? false;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Floating Icon Visibility
  // --------------------------------------------------------------------------

  private async toggleFloatingIcon(): Promise<boolean> {
    if (!this.floatingIcon) {
      this.floatingEnabled = true;
      await chrome.storage.sync.set({ floatingEnabled: true });
      this.createFloatingIcon();
      return true;
    }

    const isVisible = this.floatingIcon.getPosition() !== null;
    if (isVisible) {
      this.floatingIcon.hide();
      this.floatingEnabled = false;
    } else {
      this.floatingIcon.show();
      this.floatingEnabled = true;
    }

    await chrome.storage.sync.set({ floatingEnabled: this.floatingEnabled });
    return this.floatingEnabled;
  }

  private async setFloatingVisibility(enabled: boolean): Promise<void> {
    this.floatingEnabled = enabled;

    if (enabled) {
      if (!this.floatingIcon) {
        this.createFloatingIcon();
      } else {
        this.floatingIcon.show();
      }
    } else {
      this.floatingIcon?.hide();
    }

    await chrome.storage.sync.set({ floatingEnabled: enabled });
  }

  // --------------------------------------------------------------------------
  // UI Feedback
  // --------------------------------------------------------------------------

  private showClosedToast(): void {
    this.showToast('侧边栏已关闭', 1500);
  }

  private showToast(message: string, duration: number = 2000): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 2147483648;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  getDOI(): string | null {
    return this.detectedDOI;
  }

  redetectDOI(): string | null {
    const result = detectDOI();
    this.detectedDOI = result.doi;
    this.floatingIcon?.updateDOI(this.detectedDOI);
    return this.detectedDOI;
  }
}

// ============================================================================
// Initialize Content Script
// ============================================================================

if (typeof window !== 'undefined' && !window.researchopiaContentScript) {
  window.researchopiaContentScript = new ContentScriptManager();
}

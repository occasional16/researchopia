/**
 * Side Panel Manager Module
 * Handles Chrome side panel operations (open, close, toggle)
 */

import type { PanelState } from './types';

export class SidePanelManager {
  private panelState: Map<number, boolean> = new Map();

  /**
   * Get panel state for a tab
   */
  isOpen(tabId: number): boolean {
    return this.panelState.get(tabId) === true;
  }

  /**
   * Update panel state
   */
  setState(tabId: number, isOpen: boolean): void {
    this.panelState.set(tabId, isOpen);

    // Persist to storage
    const key = `panelOpen_${tabId}`;
    const store = chrome.storage?.session || chrome.storage.local;
    store.set({ [key]: isOpen }).catch(() => {});
  }

  /**
   * Clear panel state for a tab
   */
  clearState(tabId: number): void {
    this.panelState.delete(tabId);
  }

  /**
   * Open side panel for a tab
   */
  async open(tabId: number, doi?: string | null, url?: string): Promise<boolean> {
    try {
      // Enable and set path
      try {
        chrome.sidePanel?.setOptions?.({
          tabId,
          path: 'sidebar.html',
          enabled: true,
        });
      } catch {
        // Ignore setOptions errors
      }

      // Open panel (must be in user gesture context)
      await chrome.sidePanel.open({ tabId });

      // Update state
      this.setState(tabId, true);

      // Save DOI context
      if (doi) {
        await this.saveDOIContext(doi, url);
      }

      // Show success badge
      this.showBadge(tabId, '✅', '#10b981', 1200);
      return true;
    } catch (error) {
      console.error('Failed to open side panel:', error);
      this.showBadge(tabId, '👆', '#f59e0b', 3000);
      return false;
    }
  }

  /**
   * Close side panel for a tab
   */
  async close(tabId: number): Promise<boolean> {
    try {
      chrome.sidePanel?.setOptions?.({
        tabId,
        enabled: false,
      });

      // Update state
      this.setState(tabId, false);

      // Clear badge
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});

      // Notify content script
      chrome.tabs.sendMessage(tabId, { action: 'panelClosed' }).catch(() => {});
      return true;
    } catch (error) {
      console.error('Failed to close side panel:', error);
      return false;
    }
  }

  /**
   * Toggle side panel for a tab
   */
  async toggle(tabId: number, doi?: string | null, url?: string): Promise<boolean> {
    if (this.isOpen(tabId)) {
      return this.close(tabId);
    } else {
      return this.open(tabId, doi, url);
    }
  }

  /**
   * Save DOI context to storage
   */
  private async saveDOIContext(doi: string, url?: string): Promise<void> {
    try {
      await chrome.storage.sync.set({
        doiFromContentScript: doi,
        currentPageUrl: url,
        lastClickTime: Date.now(),
      });
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Show badge on extension icon
   */
  private showBadge(tabId: number, text: string, color: string, duration: number): void {
    chrome.action.setBadgeText({ text, tabId }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ color, tabId }).catch(() => {});

    if (duration > 0) {
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
      }, duration);
    }
  }
}

export const sidePanelManager = new SidePanelManager();

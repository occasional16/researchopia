/**
 * Settings Panel Module
 * Handles popup settings and floating icon toggle
 */

import { showToast } from '../utils/toast';
import { getSettings, saveSettings } from '../utils/storage';

// Local settings type that matches storage.ts getSettings() return
interface LocalSettings {
  floatingEnabled: boolean;
  researchopiaUrl: string;
  autoDetectDOI: boolean;
  sidebarWidth: number;
}

export interface SettingsState {
  settings: LocalSettings;
  currentTab: chrome.tabs.Tab | null;
}

export class SettingsPanel {
  private state: SettingsState = {
    settings: {
      floatingEnabled: true,
      researchopiaUrl: 'https://www.researchopia.com',
      autoDetectDOI: true,
      sidebarWidth: 400,
    },
    currentTab: null,
  };

  /**
   * Initialize settings panel
   */
  async init(tab: chrome.tabs.Tab | null): Promise<void> {
    this.state.currentTab = tab;
    await this.loadSettings();
    this.setupEventListeners();
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<void> {
    try {
      this.state.settings = await getSettings();
      this.updateDisplay();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Update UI to reflect current settings
   */
  private updateDisplay(): void {
    const floatingIconToggle = document.getElementById('floatingIconToggle') as HTMLInputElement | null;
    const autoDetectToggle = document.getElementById('autoDetectToggle') as HTMLInputElement | null;

    if (floatingIconToggle) {
      floatingIconToggle.checked = this.state.settings.floatingEnabled;
    }
    if (autoDetectToggle) {
      autoDetectToggle.checked = this.state.settings.autoDetectDOI;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Floating icon toggle
    const floatingIconToggle = document.getElementById('floatingIconToggle') as HTMLInputElement | null;
    floatingIconToggle?.addEventListener('change', async () => {
      await this.toggleFloatingIcon(floatingIconToggle.checked);
    });

    // Auto detect toggle
    const autoDetectToggle = document.getElementById('autoDetectToggle') as HTMLInputElement | null;
    autoDetectToggle?.addEventListener('change', async () => {
      await this.saveSettingChange('autoDetectDOI', autoDetectToggle.checked);
    });

    // Open sidebar button
    document.getElementById('openSidebarBtn')?.addEventListener('click', () => {
      this.openSidebar();
    });

    // Open settings page button
    document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  /**
   * Toggle floating icon on/off
   */
  async toggleFloatingIcon(enabled: boolean): Promise<void> {
    try {
      this.state.settings.floatingEnabled = enabled;
      await saveSettings(this.state.settings);

      // Notify content script
      if (this.state.currentTab?.id) {
        try {
          await chrome.tabs.sendMessage(this.state.currentTab.id, {
            action: enabled ? 'showFloatingIcon' : 'hideFloatingIcon',
          });
        } catch (error) {
          // Content script might not be loaded
          console.log('Content script not ready:', error);
        }
      }

      showToast(enabled ? '悬浮图标已启用' : '悬浮图标已禁用', 'success');
    } catch (error) {
      console.error('Failed to toggle floating icon:', error);
      showToast('设置保存失败', 'error');
    }
  }

  /**
   * Save a single setting change
   */
  async saveSettingChange<K extends keyof LocalSettings>(
    key: K,
    value: LocalSettings[K]
  ): Promise<void> {
    try {
      this.state.settings[key] = value;
      await saveSettings(this.state.settings);
      showToast('设置已保存', 'success');
    } catch (error) {
      console.error('Failed to save setting:', error);
      showToast('设置保存失败', 'error');
    }
  }

  /**
   * Open sidebar panel
   */
  async openSidebar(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'openSidePanel',
        tabId: this.state.currentTab?.id,
      });
      
      if (response?.success) {
        // Close popup after opening sidebar
        window.close();
      } else {
        console.error('Failed to open sidebar:', response?.error);
        showToast('无法打开侧边栏', 'error');
      }
    } catch (error) {
      console.error('Failed to open sidebar:', error);
      showToast('无法打开侧边栏', 'error');
    }
  }

  /**
   * Get current settings
   */
  getSettings(): LocalSettings {
    return { ...this.state.settings };
  }

  /**
   * Update settings state
   */
  updateSettings(newSettings: Partial<LocalSettings>): void {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.updateDisplay();
  }
}

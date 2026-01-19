/// <reference types="chrome" />
/**
 * Settings module for the browser extension
 * Handles settings persistence and UI
 * 
 * Simplified: Use devMode toggle instead of complex auto-detection
 */

import type { SidebarSettings, StorageSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { showToast, getElement } from '../utils';

// ============================================================================
// Constants
// ============================================================================

const DEV_SERVER_URL = 'http://localhost:3000';
const PROD_SERVER_URL = 'https://www.researchopia.com';

// ============================================================================
// Settings Manager Class
// ============================================================================

export class SettingsManager {
  private settings: SidebarSettings = { ...DEFAULT_SETTINGS };
  private onSettingsChange?: (settings: SidebarSettings) => void;

  constructor(onSettingsChange?: (settings: SidebarSettings) => void) {
    this.onSettingsChange = onSettingsChange;
  }

  // ==================== Getters ====================

  get serverUrl(): string {
    // Simple: devMode = localhost, otherwise = production
    return this.settings.devMode ? DEV_SERVER_URL : PROD_SERVER_URL;
  }

  get autoOpen(): boolean {
    return this.settings.autoOpen;
  }

  get darkMode(): boolean {
    return this.settings.darkMode;
  }

  get devMode(): boolean {
    return this.settings.devMode;
  }

  getSettings(): SidebarSettings {
    return { ...this.settings };
  }

  // ==================== Load/Save ====================

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<SidebarSettings> {
    try {
      const result = await chrome.storage.sync.get([
        'autoOpen', 'darkMode', 'devMode', 'floatingEnabled',
        'quickBookmarkEnabled', 'autoClosePopup'
      ]) as StorageSettings;
      
      if (typeof result.autoOpen === 'boolean') this.settings.autoOpen = result.autoOpen;
      if (typeof result.darkMode === 'boolean') this.settings.darkMode = result.darkMode;
      if (typeof result.devMode === 'boolean') this.settings.devMode = result.devMode;
      if (typeof result.floatingEnabled === 'boolean') this.settings.floatingEnabled = result.floatingEnabled;
      if (typeof result.quickBookmarkEnabled === 'boolean') this.settings.quickBookmarkEnabled = result.quickBookmarkEnabled;
      if (typeof result.autoClosePopup === 'boolean') this.settings.autoClosePopup = result.autoClosePopup;
      
      // Update serverUrl based on devMode
      this.settings.serverUrl = this.serverUrl;
      
      // Apply dark mode
      this.applyDarkMode();
      
      // Update UI inputs
      this.updateSettingsUI();
      
      return this.getSettings();
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.getSettings();
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(): Promise<void> {
    // Read from UI inputs
    const autoOpenInput = getElement<HTMLInputElement>('autoOpen');
    const darkModeInput = getElement<HTMLInputElement>('darkMode');
    const devModeInput = getElement<HTMLInputElement>('devMode');
    const floatingEnabledInput = getElement<HTMLInputElement>('floatingEnabled');
    const quickBookmarkEnabledInput = getElement<HTMLInputElement>('quickBookmarkEnabled');
    const autoClosePopupInput = getElement<HTMLInputElement>('autoClosePopup');

    if (autoOpenInput) this.settings.autoOpen = autoOpenInput.checked;
    if (darkModeInput) this.settings.darkMode = darkModeInput.checked;
    if (devModeInput) this.settings.devMode = devModeInput.checked;
    if (floatingEnabledInput) this.settings.floatingEnabled = floatingEnabledInput.checked;
    if (quickBookmarkEnabledInput) this.settings.quickBookmarkEnabled = quickBookmarkEnabledInput.checked;
    if (autoClosePopupInput) this.settings.autoClosePopup = autoClosePopupInput.checked;
    
    // Update serverUrl based on devMode
    this.settings.serverUrl = this.serverUrl;

    // Apply dark mode
    this.applyDarkMode();

    // Persist to storage
    await chrome.storage.sync.set({
      autoOpen: this.settings.autoOpen,
      darkMode: this.settings.darkMode,
      devMode: this.settings.devMode,
      floatingEnabled: this.settings.floatingEnabled,
      quickBookmarkEnabled: this.settings.quickBookmarkEnabled,
      autoClosePopup: this.settings.autoClosePopup,
    });

    // Close panel and notify
    this.closeSettings();
    showToast('设置已保存', 'success');
    
    if (this.onSettingsChange) {
      this.onSettingsChange(this.getSettings());
    }
  }

  /**
   * Reset settings to defaults in UI (not saved until user clicks save)
   */
  resetSettings(): void {
    const autoOpenInput = getElement<HTMLInputElement>('autoOpen');
    const darkModeInput = getElement<HTMLInputElement>('darkMode');
    const devModeInput = getElement<HTMLInputElement>('devMode');
    const floatingEnabledInput = getElement<HTMLInputElement>('floatingEnabled');
    const quickBookmarkEnabledInput = getElement<HTMLInputElement>('quickBookmarkEnabled');
    const autoClosePopupInput = getElement<HTMLInputElement>('autoClosePopup');

    if (autoOpenInput) autoOpenInput.checked = DEFAULT_SETTINGS.autoOpen;
    if (darkModeInput) darkModeInput.checked = DEFAULT_SETTINGS.darkMode;
    if (devModeInput) devModeInput.checked = DEFAULT_SETTINGS.devMode;
    if (floatingEnabledInput) floatingEnabledInput.checked = DEFAULT_SETTINGS.floatingEnabled;
    if (quickBookmarkEnabledInput) quickBookmarkEnabledInput.checked = DEFAULT_SETTINGS.quickBookmarkEnabled;
    if (autoClosePopupInput) autoClosePopupInput.checked = DEFAULT_SETTINGS.autoClosePopup;

    showToast('设置已重置（需点击保存生效）', 'info');
  }

  // ==================== Panel Control ====================

  /**
   * Open settings panel
   */
  openSettings(): void {
    document.getElementById('settingsPanel')?.classList.add('open');
    document.getElementById('settingsOverlay')?.classList.add('open');
  }

  /**
   * Close settings panel
   */
  closeSettings(): void {
    document.getElementById('settingsPanel')?.classList.remove('open');
    document.getElementById('settingsOverlay')?.classList.remove('open');
  }

  // ==================== Event Listeners ====================

  /**
   * Setup settings-related event listeners
   */
  setupEventListeners(): void {
    document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('settingsOverlay')?.addEventListener('click', () => this.closeSettings());
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('resetSettingsBtn')?.addEventListener('click', () => this.resetSettings());
  }

  // ==================== Private Helpers ====================

  private applyDarkMode(): void {
    document.body.classList.toggle('dark-mode', this.settings.darkMode);
  }

  private updateSettingsUI(): void {
    const autoOpenInput = getElement<HTMLInputElement>('autoOpen');
    const darkModeInput = getElement<HTMLInputElement>('darkMode');
    const devModeInput = getElement<HTMLInputElement>('devMode');
    const floatingEnabledInput = getElement<HTMLInputElement>('floatingEnabled');
    const quickBookmarkEnabledInput = getElement<HTMLInputElement>('quickBookmarkEnabled');
    const autoClosePopupInput = getElement<HTMLInputElement>('autoClosePopup');

    if (autoOpenInput) autoOpenInput.checked = this.settings.autoOpen;
    if (darkModeInput) darkModeInput.checked = this.settings.darkMode;
    if (devModeInput) devModeInput.checked = this.settings.devMode;
    if (floatingEnabledInput) floatingEnabledInput.checked = this.settings.floatingEnabled;
    if (quickBookmarkEnabledInput) quickBookmarkEnabledInput.checked = this.settings.quickBookmarkEnabled;
    if (autoClosePopupInput) autoClosePopupInput.checked = this.settings.autoClosePopup;
  }
}

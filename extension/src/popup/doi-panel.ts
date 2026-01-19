/**
 * DOI Panel Module
 * Handles DOI detection, display, and copy functionality
 */

import { detectDOI, isValidDOI, cleanDOI, buildDOIUrl } from '../utils/doi';
import { showToast } from '../utils/toast';
import type { MessageResponse } from '../types/api';

export interface DOIPanelState {
  detectedDOI: string | null;
  currentTabId: number | null;
}

export class DOIPanel {
  private state: DOIPanelState = {
    detectedDOI: null,
    currentTabId: null,
  };

  constructor() {}

  /**
   * Initialize the DOI panel with current tab
   */
  async init(tabId: number | null): Promise<void> {
    this.state.currentTabId = tabId;
    await this.detectDOI();
    this.setupEventListeners();
  }

  /**
   * Detect DOI from current page
   */
  async detectDOI(): Promise<string | null> {
    if (!this.state.currentTabId) {
      this.updateDisplay(null);
      return null;
    }

    try {
      // Try to get DOI from content script
      const response = await chrome.tabs.sendMessage(
        this.state.currentTabId,
        { action: 'getCurrentDOI' }
      ) as MessageResponse | undefined;

      if (response?.success && response.doi) {
        this.state.detectedDOI = response.doi;
        this.updateDisplay(response.doi);
        return response.doi;
      }

      // Fallback: try to detect from current URL
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const urlDOI = this.extractDOIFromURL(tab.url);
        if (urlDOI) {
          this.state.detectedDOI = urlDOI;
          this.updateDisplay(urlDOI);
          return urlDOI;
        }
      }

      this.updateDisplay(null);
      return null;
    } catch (error) {
      console.error('DOI detection failed:', error);
      this.updateDisplay(null);
      return null;
    }
  }

  /**
   * Extract DOI from URL
   */
  private extractDOIFromURL(url: string): string | null {
    const doiMatch = url.match(/10\.\d{4,9}\/[^\s&?#]+/);
    return doiMatch ? cleanDOI(doiMatch[0]) : null;
  }

  /**
   * Update DOI display in UI
   */
  private updateDisplay(doi: string | null): void {
    const doiDisplay = document.getElementById('doi-display');
    const copyBtn = document.getElementById('copyDOI');
    const noDOIMsg = document.getElementById('no-doi-message');
    const doiContainer = document.getElementById('doi-container');

    if (doi) {
      if (doiDisplay) doiDisplay.textContent = doi;
      if (copyBtn) copyBtn.classList.remove('hidden');
      if (noDOIMsg) noDOIMsg.classList.add('hidden');
      if (doiContainer) doiContainer.classList.remove('hidden');
    } else {
      if (doiDisplay) doiDisplay.textContent = '';
      if (copyBtn) copyBtn.classList.add('hidden');
      if (noDOIMsg) noDOIMsg.classList.remove('hidden');
      if (doiContainer) doiContainer.classList.add('hidden');
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.getElementById('copyDOI')?.addEventListener('click', () => {
      this.copyDOI();
    });

    document.getElementById('openDOI')?.addEventListener('click', () => {
      this.openDOIUrl();
    });
  }

  /**
   * Copy DOI to clipboard
   */
  async copyDOI(): Promise<void> {
    if (!this.state.detectedDOI) {
      showToast('未检测到DOI', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(this.state.detectedDOI);
      showToast('DOI已复制', 'success');
      
      // Visual feedback
      const copyBtn = document.getElementById('copyDOI');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }
    } catch (error) {
      console.error('Copy failed:', error);
      showToast('复制失败', 'error');
    }
  }

  /**
   * Open DOI URL in new tab
   */
  openDOIUrl(): void {
    if (!this.state.detectedDOI) {
      showToast('未检测到DOI', 'error');
      return;
    }

    const url = buildDOIUrl(this.state.detectedDOI);
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  /**
   * Get current DOI
   */
  getDOI(): string | null {
    return this.state.detectedDOI;
  }

  /**
   * Set DOI manually
   */
  setDOI(doi: string | null): void {
    this.state.detectedDOI = doi;
    this.updateDisplay(doi);
  }
}

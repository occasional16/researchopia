/**
 * Researchopia Background Service Worker (Modular Version)
 * Chrome Extension Manifest V3
 * v0.6.0 - Refactored to use modular architecture
 */

import { sidePanelManager, messageHandler, updateBadgeForSite, quickBookmarkCurrentTab, showBadgeNotification } from './background/index';

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  // Set default settings
  try {
    await chrome.storage.sync.set({
      floatingEnabled: true,
      researchopiaUrl: 'https://www.researchopia.com',
      autoDetectDOI: true,
      sidebarWidth: 400,
    });
  } catch {
    // Ignore storage errors
  }

  // Open welcome page on fresh install
  if (details.reason === 'install') {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    } catch {
      // Ignore errors
    }
  }
});

// ============================================================================
// Event Listeners Setup
// ============================================================================

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  // Set default settings
  try {
    await chrome.storage.sync.set({
      floatingEnabled: true,
      researchopiaUrl: 'https://www.researchopia.com',
      autoDetectDOI: true,
      sidebarWidth: 400,
    });
  } catch {
    // Ignore storage errors
  }

  // Open welcome page on fresh install
  if (details.reason === 'install') {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    } catch {
      // Ignore errors
    }
  }
});

/**
 * Handle keyboard command shortcuts
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-bookmark') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await quickBookmarkCurrentTab();
    
    // Show badge notification
    if (tab?.id) {
      await showBadgeNotification(result.success, tab.id);
    }
    
    // Log result for debugging
    console.log('[QuickBookmark]', result.message);
  }
});

/**
 * Handle tab updates - update badge for academic sites
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateBadgeForSite(tabId, tab.url);
  }
});

/**
 * Handle tab removal - cleanup panel state
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  sidePanelManager.clearState(tabId);
});

/**
 * Handle messages from popup, content scripts, and sidebar
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Always return true for async response
  messageHandler.handleMessage(request, sender, sendResponse);
  return true;
});

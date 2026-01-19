/**
 * Message Handler Module
 * Handles all chrome.runtime.onMessage events
 */

import { sidePanelManager } from './side-panel-manager';
import type { MessageRequest, MessageResponse } from './types';

export class MessageHandler {
  /**
   * Handle incoming messages
   */
  async handleMessage(
    request: MessageRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): Promise<void> {
    let tab = sender.tab;
    const action = request?.action;

    // Get active tab for popup-initiated messages
    if (!tab && ['toggleSidePanel', 'openSidebar', 'openSidePanel'].includes(action)) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = activeTab;
      } catch {
        // Ignore errors
      }
    }

    try {
      switch (action) {
        case 'floatingIconClicked':
        case 'openSidePanel': {
          const result = await sidePanelManager.open(tab?.id!, request.doi, request.url);
          sendResponse({ success: result });
          break;
        }

        case 'toggleSidePanel': {
          const result = await sidePanelManager.toggle(tab?.id!, request.doi, request.url);
          sendResponse({ success: result });
          break;
        }

        case 'triggerSidePanelFromFloating': {
          const result = await sidePanelManager.open(tab?.id!, request.doi, request.url);
          sendResponse({ success: result });
          break;
        }

        case 'openSidebar': {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await sidePanelManager.open(activeTab.id);
          }
          sendResponse({ success: true });
          break;
        }

        case 'getSettings': {
          const settings = await chrome.storage.sync.get([
            'floatingEnabled',
            'researchopiaUrl',
            'autoDetectDOI',
            'sidebarWidth',
          ]);
          sendResponse({ success: true, settings });
          break;
        }

        case 'updateSettings': {
          await chrome.storage.sync.set(request.settings || {});
          sendResponse({ success: true });
          break;
        }

        case 'detectDOI': {
          sendResponse({ success: true, message: 'DOI detection initiated' });
          break;
        }

        case 'getAuthFromPage': {
          // Get auth from Researchopia tab's content script
          try {
            const tabs = await chrome.tabs.query({ url: '*://*.researchopia.com/*' });
            // Also check localhost for development
            const localTabs = await chrome.tabs.query({ url: '*://localhost:*/*' });
            const allTabs = [...tabs, ...localTabs];
            
            for (const tab of allTabs) {
              if (tab.id) {
                try {
                  const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSupabaseAuth' });
                  if (response?.success && response.token) {
                    sendResponse({ 
                      success: true, 
                      token: response.token,
                      userId: response.userId,
                      email: response.email,
                    });
                    return;
                  }
                } catch {
                  // Tab might not have content script, continue to next
                }
              }
            }
            sendResponse({ success: false, error: 'No auth found' });
          } catch (error) {
            sendResponse({ success: false, error: String(error) });
          }
          break;
        }

        case 'updatePanelState': {
          const { tabId, isOpen, doi, url } = request;
          if (tabId && isOpen !== undefined) {
            sidePanelManager.setState(tabId, isOpen);

            if (isOpen && doi) {
              await chrome.storage.sync.set({
                doiFromContentScript: doi,
                currentPageUrl: url,
                lastClickTime: Date.now(),
              });
            }
          }
          sendResponse({ success: true });
          break;
        }

        default: {
          sendResponse({ success: false, error: 'Unknown action' });
        }
      }
    } catch (error) {
      sendResponse({ success: false, error: String(error) });
    }
  }
}

export const messageHandler = new MessageHandler();

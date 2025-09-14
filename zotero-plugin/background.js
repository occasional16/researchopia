/* global browser */
// Background service worker for Zotero WebExtension

browser.runtime.onInstalled.addListener(() => {
  console.log('Academic Rating Zotero addon installed');
});

// Minimal Zotero integration shims (to be implemented with Zotero APIs in app context)
// Respond to requests for selected item identifiers
browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'zotero.getSelectedItem') {
    // TODO: Replace with real Zotero item lookup from integration script
    // Return a promise with identifiers of the currently selected item
    return Promise.resolve({ doi: undefined, pmid: undefined, arxiv: undefined });
  }
});

// Add a toolbar button click to open page view
browser.action.onClicked.addListener(async () => {
  // Opens a page view (tab-like) within Zotero
  const url = browser.runtime.getURL('panel/panel.html');
  await browser.tabs.create({ url });
});

// Context-menu to open Academic Rating for selected item
browser.menus?.create?.({
  id: 'open-academic-rating',
  title: 'Open in Academic Rating',
  contexts: ['tab']
});

browser.menus?.onClicked?.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-academic-rating') {
    const url = browser.runtime.getURL('panel/panel.html');
    await browser.tabs.create({ url });
  }
});

// Message bridge (future use)
browser.runtime.onMessage.addListener((msg, sender) => {
  console.log('Message', msg, 'from', sender?.tab?.id);
});

// Command to refresh from selection (dev/testing)
browser.commands?.onCommand?.addListener(async (command) => {
  if (command === 'update-from-selection') {
    try {
      await browser.runtime.sendMessage({ type: 'zotero.selectionChanged' });
    } catch (e) {
      console.warn('Selection refresh failed', e);
    }
  }
});

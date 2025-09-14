/* global browser */
// Observes selection changes and updates the open panel page hash with identifiers

async function getSelectedItemIdentifiers() {
  try {
    const result = await browser.runtime.sendMessage({ type: 'zotero.getSelectedItem' });
    return result || {};
  } catch (e) {
    console.warn('Identifier fetch failed', e);
    return {};
  }
}

async function updatePanelForSelection() {
  const ids = await getSelectedItemIdentifiers();
  const params = new URLSearchParams();
  if (ids.doi) params.set('doi', ids.doi);
  if (ids.pmid) params.set('pmid', ids.pmid);
  if (ids.arxiv) params.set('arxiv', ids.arxiv);

  // Find extension tabs (Page View) and update their hash
  const tabs = await browser.tabs.query({});
  for (const t of tabs) {
    if (t.url?.includes(browser.runtime.getURL('panel/panel.html'))) {
      const newURL = t.url.split('#')[0] + '#' + params.toString();
      if (newURL !== t.url) {
        await browser.tabs.update(t.id, { url: newURL });
      }
    }
  }
}

// This relies on Zotero’s web-ext integration that forwards selection events to background
browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'zotero.selectionChanged') {
    updatePanelForSelection();
  }
});

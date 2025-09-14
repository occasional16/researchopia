const status = document.getElementById('status');
const frame = document.getElementById('appFrame');

// Base URL from Zotero prefs if available, else fallback
let BASE_URL = 'https://www.researchopia.com';
try {
  // Available when loaded inside Zotero chrome (xhtml) context; in webextension panel this will fail
  if (window?.Zotero?.Prefs?.get) {
    BASE_URL = Zotero.Prefs.get('extensions.academic-rating.baseURL') || BASE_URL;
  }
} catch {}

function getItemUrlFromHash() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const doi = hash.get('doi');
  const pmid = hash.get('pmid');
  const arxiv = hash.get('arxiv');
  // Construct a URL on your site that can show an item summary by identifier
  const url = new URL(BASE_URL);
  url.pathname = '/';
  if (doi) url.searchParams.set('doi', doi);
  if (pmid) url.searchParams.set('pmid', pmid);
  if (arxiv) url.searchParams.set('arxiv', arxiv);
  return url.toString();
}

function load() {
  const url = getItemUrlFromHash();
  status.textContent = 'Loading ' + url;
  frame.src = url;
}

window.addEventListener('hashchange', load);
window.addEventListener('DOMContentLoaded', load);

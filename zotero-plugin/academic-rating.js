/*
  Academic Rating for Zotero - Main Plugin File
  Based on official make-it-red plugin architecture
  Provides Item Pane integration for Academic Rating functionality
*/

Zotero.AcademicRating = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  addedElementIDs: [],
  registeredSection: null,
  lastURL: null,

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
  },

  log(msg) {
    Zotero.debug("Academic Rating: " + msg);
  },

  addToWindow(window) {
    let doc = window.document;

    // Add stylesheet for custom styling
    let link1 = doc.createElement('link');
    link1.id = 'academic-rating-stylesheet';
    link1.type = 'text/css';
    link1.rel = 'stylesheet';
    link1.href = this.rootURI + 'style.css';
    doc.documentElement.appendChild(link1);
    this.storeAddedElement(link1);

    // Use Fluent for localization if available (optional)
    // Skip manual FTL insertion to avoid noisy missing-locale logs; we rely on plain label fallbacks

    // Register Item Pane section for Academic Rating
    this.registerItemPaneSection();

    // Listen to item selection changes to refresh URL automatically
    try {
      const pane = window.ZoteroPane;
      if (pane && pane.onSelectionChange) {
        const orig = pane.onSelectionChange.bind(pane);
        pane.onSelectionChange = (...args) => {
          try {
            orig(...args);
          } catch {}
          try {
            const item = pane.getSelectedItems?.()[0];
            const node = doc.querySelector('.academic-rating-container');
            if (item && node) {
              const url = this.buildExternalURL(item);
              this.loadURL(doc, url);
            }
          } catch (e) {
            this.log('Auto refresh on selection failed: ' + e);
          }
        };
      }
    } catch (e) {
      this.log('Failed to attach selection listener: ' + e);
    }

    this.log("Added to window successfully");
  },

  addToAllWindows() {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      this.addToWindow(win);
    }
  },

  storeAddedElement(elem) {
    if (!elem.id) {
      throw new Error("Element must have an id");
    }
    this.addedElementIDs.push(elem.id);
  },

  removeFromWindow(window) {
    var doc = window.document;
    // Remove all elements added to DOM
    for (let id of this.addedElementIDs) {
      doc.getElementById(id)?.remove();
    }
    // Remove FTL file reference
    let ftlLink = doc.querySelector('[href="academic-rating.ftl"]');
    if (ftlLink) ftlLink.remove();

    // Unregister Item Pane section
    this.unregisterItemPaneSection();
  },

  removeFromAllWindows() {
    var windows = Zotero.getMainWindows();
    for (let win of windows) {
      if (!win.ZoteroPane) continue;
      this.removeFromWindow(win);
    }
  },

  registerItemPaneSection() {
    try {
      if (!Zotero.ItemPaneManager) {
        throw new Error("Zotero.ItemPaneManager not available");
      }

      this.registeredSection = Zotero.ItemPaneManager.registerSection({
        paneID: "academic-rating-section",
        pluginID: this.id,
        header: {
          // Prefer l10n, but provide plain label fallback for safety
          l10nID: "academic-rating-header-label",
          label: "Academic Rating",
          icon: this.rootURI + "icons/icon16.svg",
        },
        sidenav: {
          l10nID: "academic-rating-sidenav-label",
          label: "Academic Rating",
          icon: this.rootURI + "icons/icon16.svg",
        },
        onRender: ({ body, item, editable, tabType }) => {
          this.renderItemPane(body, item);
        },
      });

      this.log("Item Pane section registered successfully");
    } catch (e) {
      this.log("Failed to register Item Pane section: " + e);
    }
  },

  unregisterItemPaneSection() {
    try {
      if (this.registeredSection && Zotero.ItemPaneManager) {
        Zotero.ItemPaneManager.unregisterSection(this.registeredSection);
        this.registeredSection = null;
        this.log("Item Pane section unregistered");
      }
    } catch (e) {
      this.log("Failed to unregister Item Pane section: " + e);
    }
  },

  renderItemPane(body, item) {
    // Clear existing content
    body.replaceChildren();

    const container = body.ownerDocument.createElement("div");
    container.className = "academic-rating-container";

    // Create header info
    const header = body.ownerDocument.createElement("div");
    header.className = "academic-rating-header";
    const title = body.ownerDocument.createElement("span");
    title.textContent = "Academic Rating";
    const actions = body.ownerDocument.createElement("div");
    actions.className = "academic-rating-actions";
    const refreshBtn = body.ownerDocument.createElement("button");
    refreshBtn.className = "academic-rating-btn";
    refreshBtn.textContent = "Refresh";
    const openBtn = body.ownerDocument.createElement("button");
    openBtn.className = "academic-rating-btn secondary";
    openBtn.textContent = "Open in Browser";
    actions.appendChild(refreshBtn);
    actions.appendChild(openBtn);
    header.appendChild(title);
    header.appendChild(actions);

    // Create iframe container
    const iframeContainer = body.ownerDocument.createElement("div");
    iframeContainer.className = "academic-rating-iframe-container";

    // Prefer XUL browser to load remote content in Zotero chrome context
    const externalUrl = this.buildExternalURL(item);
    let viewer = null;
    try {
      if (body.ownerDocument.createXULElement) {
        const browser = body.ownerDocument.createXULElement('browser');
        browser.setAttribute('type', 'content');
        browser.setAttribute('remote', 'true');
        browser.setAttribute('src', externalUrl);
        browser.style.width = '100%';
        browser.style.height = '100%';
        browser.setAttribute('id', 'academic-rating-viewer');
        viewer = browser;
      }
    } catch (e) {
      this.log('Failed to create XUL browser, fallback to iframe: ' + e);
    }

    if (!viewer) {
      const iframe = body.ownerDocument.createElement('iframe');
      iframe.className = 'academic-rating-iframe';
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      // Keep minimal permissions
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.src = externalUrl;
      iframe.id = 'academic-rating-viewer';
      viewer = iframe;
    }

    // Assemble the elements
    iframeContainer.appendChild(viewer);
    container.appendChild(header);
    container.appendChild(iframeContainer);
    body.appendChild(container);

    this.lastURL = externalUrl;

    // Wire actions
    refreshBtn.addEventListener('click', () => {
      try {
        const url = this.buildExternalURL(item);
        this.loadURL(body, url);
      } catch (e) {
        this.log('Refresh failed: ' + e);
      }
    });
    openBtn.addEventListener('click', () => {
      try {
        const url = this.buildExternalURL(item);
        if (Zotero?.launchURL) {
          Zotero.launchURL(url);
        } else if (Zotero?.openInBrowser) {
          Zotero.openInBrowser(url);
        } else {
          // last resort: window.open
          body.ownerDocument.defaultView.open(url);
        }
      } catch (e) {
        this.log('Open in browser failed: ' + e);
      }
    });
  },

  buildExternalURL(item) {
    // Base URL from prefs with fallback
    let base = 'https://www.researchopia.com';
    try {
      const pref = Zotero.Prefs.get('extensions.academic-rating.baseURL', true);
      if (pref) base = pref;
    } catch {}
    const url = new URL(base);
    // Ensure pathname root for query display
    if (!url.pathname) url.pathname = '/';

    try {
      if (item) {
        const doi = item.getField?.("DOI");
        const arxiv = item.getField?.("archiveLocation");
        const link = item.getField?.("url");
        const extra = item.getField?.("extra");
        const pmid = /PMID\s*:\s*(\d+)/i.exec(extra || "")?.[1];

        if (doi) url.searchParams.set('doi', doi);
        if (pmid) url.searchParams.set('pmid', pmid);
        if (arxiv && /^(arXiv:|\d{4}\.\d{4,5})/i.test(arxiv)) {
          url.searchParams.set('arxiv', arxiv.replace(/^arXiv:/i, ''));
        }
        if (link) url.searchParams.set('url', link);
      }
    } catch (e) {
      this.log('Error building external URL: ' + e);
    }

    return url.toString();
  },

  loadURL(body, url) {
    try {
      if (this.lastURL === url) return;
      const viewer = body.ownerDocument.getElementById('academic-rating-viewer');
      if (!viewer) return;
      if (viewer.localName === 'browser') {
        viewer.setAttribute('src', url);
      } else if (viewer.localName === 'iframe') {
        viewer.src = url;
      }
      this.lastURL = url;
      this.log('Loaded URL: ' + url);
    } catch (e) {
      this.log('Failed to load URL: ' + e);
    }
  },

  buildAcademicRatingURL(item) {
    const baseURL = new URL("panel/panel.html", this.rootURI);
    const params = new URLSearchParams();

    try {
      if (item) {
        const doi = item.getField?.("DOI");
        const arxiv = item.getField?.("archiveLocation");
        const url = item.getField?.("url");
        const extra = item.getField?.("extra");
        const pmid = /PMID\s*:\s*(\d+)/i.exec(extra || "")?.[1];

        if (doi) params.set("doi", doi);
        if (pmid) params.set("pmid", pmid);
        if (arxiv && /^(arXiv:|\d{4}\.\d{4,5})/i.test(arxiv)) {
          params.set("arxiv", arxiv.replace(/^arXiv:/i, ""));
        }
        if (url) params.set("url", url);
      }
    } catch (e) {
      this.log("Error extracting item parameters: " + e);
    }

    baseURL.hash = params.toString();
    return baseURL.toString();
  },

  async main() {
    // Main plugin initialization
    this.log("Academic Rating plugin initialized");

    // Test URL parsing
    var testURL = new URL('https://www.researchopia.com');
    this.log(`Test URL host: ${testURL.host}`);

    // Log preferences
    this.log(`Plugin enabled: ${Zotero.Prefs.get('extensions.academic-rating.enabled', true)}`);
  },
};
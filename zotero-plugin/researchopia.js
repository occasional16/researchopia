/*
  Researchopia for Zotero - Main Plugin File
  Provides Item Pane integration for Researchopia functionality
*/

Zotero.Researchopia = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  addedElementIDs: [],
  registeredSection: null,
  lastURL: null,
  preferencePaneRegistered: false,
  paneHeight: '70vh',
  loadTimeoutMs: 3000,

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;
    try {
      this.paneHeight = Zotero.Prefs.get('extensions.researchopia.paneHeight', true) || '70vh';
      this.loadTimeoutMs = Zotero.Prefs.get('extensions.researchopia.loadTimeoutMs', true) || 3000;
    } catch {}
  },

  log(msg) {
    Zotero.debug("Researchopia: " + msg);
  },

  addToWindow(window) {
    let doc = window.document;

    // Add stylesheet for custom styling
    let link1 = doc.createElement('link');
    link1.id = 'researchopia-stylesheet';
    link1.type = 'text/css';
    link1.rel = 'stylesheet';
    link1.href = this.rootURI + 'style.css';
    doc.documentElement.appendChild(link1);
    this.storeAddedElement(link1);

    // Section 注册统一在 main() 中进行

    // Listen to item selection changes to refresh URL automatically
    try {
      const pane = window.ZoteroPane;
      if (pane && pane.onSelectionChange && !window.__ResearchopiaSelectionPatched) {
        window.__ResearchopiaSelectionPatched = true;
        const orig = pane.onSelectionChange.bind(pane);
        pane.onSelectionChange = (...args) => {
          try { orig(...args); } catch {}
          try {
            const item = pane.getSelectedItems?.()[0];
            const node = doc.querySelector('.researchopia-container');
            if (item && node) {
              const url = this.buildExternalURL(item);
              this.loadURL(node, url);
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
    for (let id of this.addedElementIDs) {
      doc.getElementById(id)?.remove();
    }
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
      if (this.registeredSection) {
        this.log('Section already registered');
        return;
      }
      this.registeredSection = Zotero.ItemPaneManager.registerSection({
        paneID: `${this.id}-section`,
        pluginID: this.id,
        header: {
          l10nID: "researchopia-header-label",
          label: "研学港 Researchopia",
          icon: this.rootURI + "icons/icon32.svg",
        },
        sidenav: {
          l10nID: "researchopia-sidenav-label",
          label: "研学港 Researchopia",
          icon: this.rootURI + "icons/icon32.svg",
        },
        onRender: ({ body, item }) => {
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
    body.replaceChildren();
    try {
      body.style.display = 'flex';
      body.style.flex = '1 1 auto';
      body.style.minHeight = '0';
      body.style.flexDirection = 'column';
      body.style.height = '100%';
    } catch {}

    const container = body.ownerDocument.createElement("div");
    container.className = "researchopia-container";
    try {
      container.style.flex = '1 1 auto';
      container.style.minHeight = '0';
      container.style.padding = '0';
      container.style.margin = '0';
    } catch {}

    // Compact header with only actions to avoid duplicate title misalignment
    const header = body.ownerDocument.createElement("div");
    header.className = "researchopia-header";
  const alert = body.ownerDocument.createElement('div');
    alert.className = 'researchopia-alert';
    const actions = body.ownerDocument.createElement("div");
    actions.className = "researchopia-actions";
  const titleEl = body.ownerDocument.createElement('span');
  titleEl.className = 'researchopia-title';
  titleEl.textContent = '研学港 Researchopia';
    const refreshBtn = body.ownerDocument.createElement("button");
    refreshBtn.className = "researchopia-btn";
    refreshBtn.textContent = "刷新";
    const openBtn = body.ownerDocument.createElement("button");
    openBtn.className = "researchopia-btn secondary";
    openBtn.textContent = "在浏览器打开";
  // Always keep open button highlighted and pulsing for quick access
  try { openBtn.classList.add('emphasis', 'pulse'); } catch {}
  actions.appendChild(refreshBtn);
    actions.appendChild(openBtn);
  header.appendChild(titleEl);
  header.appendChild(actions);

    const iframeContainer = body.ownerDocument.createElement("div");
    iframeContainer.className = "researchopia-iframe-container";
    try {
      iframeContainer.style.flex = '1 1 auto';
      iframeContainer.style.minHeight = '0';
    } catch {}

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
        browser.style.flex = '1 1 auto';
        browser.style.margin = '0';
        browser.style.borderWidth = '0';
        browser.setAttribute('id', 'researchopia-viewer');
        viewer = browser;
      }
    } catch (e) {
      this.log('Failed to create XUL browser, fallback to iframe: ' + e);
    }

    if (!viewer) {
      const iframe = body.ownerDocument.createElement('iframe');
      iframe.className = 'researchopia-iframe';
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.id = 'researchopia-viewer';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.flex = '1 1 auto';
      iframe.style.padding = '0';
      iframe.style.margin = '0';
      iframe.style.borderWidth = '0';
      iframe.src = externalUrl;
      viewer = iframe;
    }

    container.appendChild(header);
    container.appendChild(alert);
    iframeContainer.appendChild(viewer);
    container.appendChild(iframeContainer);
    body.appendChild(container);

    // Apply fixed larger min-height from prefs
  const prefHeight = (this.paneHeight && this.paneHeight !== '70vh') ? this.paneHeight : '80vh';
    try { container.style.minHeight = prefHeight; } catch {}
    try { iframeContainer.style.minHeight = prefHeight; } catch {}

    try { this.loadURL(container, externalUrl); } catch {}

    // Actions
    refreshBtn.addEventListener('click', () => {
      try {
        const url = this.buildExternalURL(item);
        this.loadURL(body, url);
        this.showAlert(alert, '');
      } catch (e) {
        this.log('Refresh failed: ' + e);
        this.showAlert(alert, '刷新失败：' + e);
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
          body.ownerDocument.defaultView.open(url);
        }
      } catch (e) {
        this.log('Open in browser failed: ' + e);
        this.showAlert(alert, '打开浏览器失败：' + e);
      }
    });
  },

  buildExternalURL(item) {
    // Base URL from prefs with fallback
    let base = 'https://www.researchopia.com';
    try {
      const pref = Zotero.Prefs.get('extensions.researchopia.baseURL', true);
      if (pref) base = pref;
    } catch {}
    const url = new URL(base);
    if (!url.pathname) url.pathname = '/';

    // Only use DOI as identifier
    let hasDOI = false;
    try {
      if (item) {
        const doi = item.getField?.('DOI');
        if (doi) { url.searchParams.set('doi', doi); hasDOI = true; }
      }
    } catch (e) { this.log('Error building external URL: ' + e); }

    url.searchParams.set('_src', 'zotero');
    return url.toString() + (hasDOI ? '' : '#no-identifiers');
  },

  openSettings(win) {
    // disabled by request
  },

  loadURL(body, url) {
    try {
      const viewer = body.ownerDocument.getElementById('researchopia-viewer');
      if (!viewer) return;
      const alertNode = body.querySelector('.researchopia-alert');
      const openBtn = body.querySelector('.researchopia-btn.secondary');
      if (url.includes('#no-identifiers')) {
        this.showAlert(alertNode, '当前条目未找到 DOI 标识符。您可以点击“在浏览器打开”了解功能，或为条目补充 DOI 后再试。');
        try { openBtn?.classList.add('emphasis'); } catch {}
      }
  const onLoaded = () => { this.showAlert(alertNode, ''); };
      if (viewer.localName === 'browser') {
        viewer.setAttribute('src', url);
        viewer.addEventListener('DOMFrameContentLoaded', onLoaded, { once: true });
        viewer.addEventListener('load', onLoaded, { once: true });
      } else {
        viewer.src = url;
        viewer.onload = onLoaded;
        viewer.onerror = () => this.showAlert(alertNode, '页面加载失败，请检查网络或稍后重试。');
      }
      this.lastURL = url;
      this.log('Loaded URL: ' + url);
    } catch (e) {
      this.log('Failed to load URL: ' + e);
    }
  },

  showAlert(alertNode, msg) {
    if (!alertNode) return;
    if (!msg) {
      alertNode.style.display = 'none';
      alertNode.textContent = '';
    } else {
      alertNode.style.display = 'block';
      alertNode.textContent = msg;
    }
  },

  async main() {
    this.log("Researchopia plugin initialized");
    this.registerItemPaneSection();
    try {
      var testURL = new URL('https://www.researchopia.com');
      this.log(`Test URL host: ${testURL.host}`);
      this.log(`Plugin enabled: ${Zotero.Prefs.get('extensions.researchopia.enabled', true)}`);
    } catch {}
  },
};

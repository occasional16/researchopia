// 研学港扩展 Background Service Worker - Manifest V3（干净重建版）
class ResearchopiaBackground {
  constructor() {
    // 每个 tab 的侧边栏开关内存状态：tabId -> boolean
    this.panelState = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // 安装
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });

    // 启动
    chrome.runtime.onStartup.addListener(() => {
      console.log('🔄 研学港扩展启动');
    });

    // 标签页更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // 标签页关闭：清理内存态
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.panelState.delete(tabId);
    });

    // 消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // 始终声明异步响应
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // 工具栏图标点击
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });
  }

  async handleInstall() {
    console.log('🧩 研学港扩展已安装');

    // 点击扩展图标打开侧边栏
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      try {
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('✅ 设置：点击扩展图标打开侧边栏');
      } catch (e) {
        console.warn('⚠️ setPanelBehavior 失败:', e);
      }
    }

    // 默认设置
    try {
      await chrome.storage.sync.set({
        floatingEnabled: true,
        researchopiaUrl: 'https://www.researchopia.com',
        autoDetectDOI: true,
        sidebarWidth: 400,
      });
    } catch {}

    // 欢迎页（若存在）
    try { chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }); } catch {}
  }

  async handleTabUpdate(tabId, tab) {
    try {
      if (this.isAcademicSite(tab.url)) {
        chrome.action.setBadgeText({ text: 'DOI', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#4ade80', tabId });
      } else {
        chrome.action.setBadgeText({ text: '', tabId });
      }
    } catch {}
  }

  async handleMessage(request, sender, sendResponse) {
    const tab = sender.tab;
    const action = request?.action;

    try {
      switch (action) {
        case 'floatingIconClicked':
        case 'openSidePanel': {
          this.handleFloatingOpen(tab, request.doi, request.url)
            .then((ok) => sendResponse({ success: ok }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'toggleSidePanel': {
          this.toggleSidePanel(tab, request.doi, request.url)
            .then((ok) => sendResponse({ success: ok }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'triggerSidePanelFromFloating': {
          this.handleFloatingOpen(tab, request.doi, request.url)
            .then((ok) => sendResponse({ success: ok }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'openSidebar': {
          this.openSidebar()
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'getSettings': {
          chrome.storage.sync
            .get(['floatingEnabled', 'researchopiaUrl', 'autoDetectDOI', 'sidebarWidth'])
            .then((settings) => sendResponse({ success: true, settings }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'updateSettings': {
          chrome.storage.sync
            .set(request.settings)
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
          return true;
        }

        case 'detectDOI': {
          sendResponse({ success: true, message: 'DOI detection initiated' });
          return true;
        }

        default: {
          sendResponse({ success: false, error: 'Unknown action' });
          return true;
        }
      }
    } catch (error) {
      console.error('❌ 处理消息失败:', error);
      try { sendResponse({ success: false, error: error?.message || String(error) }); } catch {}
      return true;
    }
  }

  async handleActionClick(tab) {
    try { await this.openSidebar(); } catch (e) { console.warn('⚠️ 打开侧边栏失败（action）:', e); }
  }

  // 浮标触发打开：先 open，后异步存储
  async handleFloatingOpen(tab, doi, url) {
    try {
      if (!tab || !tab.id) return false;

      // Edge 140：先启用，但不 await，避免丢失用户手势
      try { chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: 'sidebar.html', enabled: true }).catch(() => {}); } catch {}

      await chrome.sidePanel.open({ tabId: tab.id });

      // 打开成功后标记状态
      this.panelState.set(tab.id, true);
      const key = `panelOpen_${tab.id}`;
      const store = chrome.storage?.session || chrome.storage.local;
      try { await store.set({ [key]: true }); } catch {}

      // 异步保存上下文
      if (doi) {
        try { await chrome.storage.sync.set({ doiFromContentScript: doi, currentPageUrl: url, lastClickTime: Date.now() }); } catch {}
      }

      // 轻量徽章
      try {
        await chrome.action.setBadgeText({ text: '✅', tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id });
        setTimeout(async () => { try { await chrome.action.setBadgeText({ text: '', tabId: tab.id }); } catch {} }, 1200);
      } catch {}

      return true;
    } catch (e) {
      console.warn('⚠️ handleFloatingOpen 打开失败:', e);
      try {
        await chrome.action.setBadgeText({ text: '👆', tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId: tab.id });
        setTimeout(async () => { try { await chrome.action.setBadgeText({ text: '', tabId: tab.id }); } catch {} }, 3000);
      } catch {}
      return false;
    }
  }

  async openSidebar() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;
    await chrome.sidePanel.open({ tabId: activeTab.id });
  }

  // 切换侧边栏（先 open 后存储；关闭用 enabled:false）
  async toggleSidePanel(tab, doi, url) {
    try {
      if (!tab || !tab.id) return false;

      const key = `panelOpen_${tab.id}`;
      const store = chrome.storage?.session || chrome.storage.local;
      const isOpenMemory = this.panelState.get(tab.id) === true;

      if (isOpenMemory) {
        // 已打开 -> 关闭
        try { await chrome.sidePanel?.setOptions?.({ tabId: tab.id, enabled: false }); } catch (e) { console.warn('setOptions(enabled:false) 失败:', e); }
        this.panelState.set(tab.id, false);
        try { await store.set({ [key]: false }); } catch {}
        try { await chrome.action.setBadgeText({ text: '', tabId: tab.id }); } catch {}
        // 通知该标签页内容脚本显示关闭提示
        try { await chrome.tabs.sendMessage(tab.id, { action: 'panelClosed' }); } catch {}
        return true;
      }

      // 未打开 -> 打开：先 setOptions（不 await），再 open（保持用户手势）
      try { chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: 'sidebar.html', enabled: true }).catch(() => {}); } catch {}
      await chrome.sidePanel.open({ tabId: tab.id });

      // 记录状态
      this.panelState.set(tab.id, true);
      try { await store.set({ [key]: true }); } catch {}
      if (doi) { try { await chrome.storage.sync.set({ doiFromContentScript: doi, currentPageUrl: url, lastClickTime: Date.now() }); } catch {} }

      // 反馈徽章
      try {
        await chrome.action.setBadgeText({ text: '✅', tabId: tab.id });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id });
        setTimeout(async () => { try { await chrome.action.setBadgeText({ text: '', tabId: tab.id }); } catch {} }, 1200);
      } catch {}

      return true;
    } catch (error) {
      console.warn('toggleSidePanel 打开失败，尝试回退:', error);
      try {
        try { chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: 'sidebar.html', enabled: true }).catch(() => {}); } catch {}
        await chrome.sidePanel.open({ tabId: tab.id });
        this.panelState.set(tab.id, true);
        return true;
      } catch (e2) {
        console.error('回退也失败:', e2);
        return false;
      }
    }
  }

  // 站点判断（仅用于徽章显示）
  isAcademicSite(url) {
    if (!url) return false;
    const academicDomains = [
      'arxiv.org', 'scholar.google', 'pubmed.ncbi.nlm.nih.gov', 'ieee.org', 'acm.org',
      'springer.com', 'nature.com', 'science.org', 'cell.com', 'elsevier.com', 'wiley.com',
      'taylor', 'sage', 'jstor.org', 'researchgate.net', 'academia.edu', 'semanticscholar.org',
      'dblp.org', 'crossref.org', 'doi.org', 'ncbi.nlm.nih.gov', 'bioarxiv.org', 'medrxiv.org',
      'ssrn.com', 'preprints.org', 'f1000research.com', 'peerj.com', 'hindawi.com', 'mdpi.com', 'frontiersin.org'
    ];
    return academicDomains.some(domain => url.includes(domain));
  }

  // DOI 工具（备用）
  isValidDOI(doi) {
    if (!doi) return false;
    return /^10\.\d{4,}\/[\-._;()\/:A-Z0-9]+$/i.test(doi);
  }

  cleanDOI(rawDOI) {
    if (!rawDOI) return null;
    let cleaned = rawDOI.replace(/^(doi:|DOI:|\s*)/i, '').trim();
    cleaned = cleaned.replace(/[\"\"\"''']/g, '');
    cleaned = cleaned.replace(/[.,;:)\]}>]+$/, '');
    return cleaned;
  }
}

// 初始化
const researchopiaBackground = new ResearchopiaBackground();
console.log('🚀 研学港扩展 Background Service Worker 已初始化');
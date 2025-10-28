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

    // ❌ 移除工具栏图标点击监听器
    // 让 manifest.json 中的 default_popup 自动打开弹窗
  }

  async handleInstall() {
    console.log('🧩 研学港扩展已安装');

    // ❌ 移除：不再设置点击扩展图标打开侧边栏
    // 让 manifest.json 中的 default_popup 生效
    
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
    let tab = sender.tab;
    const action = request?.action;

    // 如果是从popup发送的消息,tab会是undefined,需要获取当前活动标签页
    if (!tab && ['toggleSidePanel', 'openSidebar'].includes(action)) {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tab = activeTab;
        console.log('📋 从popup调用,获取活动标签页:', tab?.id);
      } catch (error) {
        console.error('❌ 获取活动标签页失败:', error);
      }
    }

    try {
      switch (action) {
        case 'floatingIconClicked':
        case 'openSidePanel': {
          // 必须同步调用以保持用户手势上下文
          const result = await this.handleFloatingOpen(tab, request.doi, request.url);
          sendResponse({ success: result });
          return true;
        }

        case 'toggleSidePanel': {
          // 必须同步调用以保持用户手势上下文
          const result = await this.toggleSidePanel(tab, request.doi, request.url);
          sendResponse({ success: result });
          return true;
        }

        case 'triggerSidePanelFromFloating': {
          const result = await this.handleFloatingOpen(tab, request.doi, request.url);
          sendResponse({ success: result });
          return true;
        }

        case 'openSidebar': {
          await this.openSidebar();
          sendResponse({ success: true });
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

        case 'updatePanelState': {
          // 从popup直接打开后更新状态
          const tabId = request.tabId;
          const isOpen = request.isOpen;
          
          if (tabId && isOpen !== undefined) {
            this.panelState.set(tabId, isOpen);
            
            const key = `panelOpen_${tabId}`;
            const store = chrome.storage?.session || chrome.storage.local;
            store.set({ [key]: isOpen }).catch(() => {});
            
            // 保存DOI信息
            if (isOpen && request.doi) {
              chrome.storage.sync.set({
                doiFromContentScript: request.doi,
                currentPageUrl: request.url,
                lastClickTime: Date.now()
              }).catch(() => {});
            }
            
            console.log(`✅ 面板状态已更新: tabId=${tabId}, isOpen=${isOpen}`);
          }
          
          sendResponse({ success: true });
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

  // ❌ 移除 handleActionClick 方法（已不需要）

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

  // 切换侧边栏(优化:先同步操作open/close,后异步存储)
  async toggleSidePanel(tab, doi, url) {
    console.log('🔄 toggleSidePanel 被调用, tab:', tab?.id, 'doi:', doi);
    
    try {
      if (!tab || !tab.id) {
        console.error('❌ toggleSidePanel: tab或tab.id不存在');
        return false;
      }

      const key = `panelOpen_${tab.id}`;
      const store = chrome.storage?.session || chrome.storage.local;
      
      // 快速检查当前状态(不await,使用缓存)
      let isOpen = this.panelState.get(tab.id) === true;
      console.log(`🔄 当前状态(内存): ${isOpen ? '打开' : '关闭'} -> ${isOpen ? '关闭' : '打开'}`);

      if (isOpen) {
        // 已打开 -> 关闭(立即执行,不延迟)
        console.log('🚪 立即关闭侧边栏...');
        try { 
          chrome.sidePanel?.setOptions?.({ tabId: tab.id, enabled: false }); 
          console.log('✅ 侧边栏已设置为禁用');
        } catch (e) { 
          console.warn('⚠️ setOptions(enabled:false) 失败:', e); 
        }
        
        // 异步更新状态
        this.panelState.set(tab.id, false);
        store.set({ [key]: false }).catch(() => {});
        chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
        chrome.tabs.sendMessage(tab.id, { action: 'panelClosed' }).catch(() => {});
        
        console.log('✅ 侧边栏已关闭');
        return true;
      }

      // 未打开 -> 打开(立即执行chrome.sidePanel.open,保持用户手势)
      console.log('🚪 立即打开侧边栏...');
      
      // 1. 先setOptions(同步,不await)
      try { 
        chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: 'sidebar.html', enabled: true });
      } catch (e) {
        console.warn('⚠️ setOptions 失败:', e);
      }
      
      // 2. 立即open(在用户手势上下文中)
      await chrome.sidePanel.open({ tabId: tab.id });
      console.log('✅ chrome.sidePanel.open 成功');

      // 3. 异步更新状态(不阻塞)
      this.panelState.set(tab.id, true);
      store.set({ [key]: true }).catch(() => {});
      
      if (doi) { 
        chrome.storage.sync.set({ 
          doiFromContentScript: doi, 
          currentPageUrl: url, 
          lastClickTime: Date.now() 
        }).catch(() => {}); 
        console.log('✅ DOI已存储:', doi);
      }

      // 4. 徽章反馈(异步)
      chrome.action.setBadgeText({ text: '✅', tabId: tab.id }).catch(() => {});
      chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId: tab.id }).catch(() => {});
      setTimeout(() => { 
        chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {}); 
      }, 1200);

      console.log('✅ 侧边栏打开流程完成');
      return true;
      
    } catch (error) {
      console.error('❌ toggleSidePanel 失败:', error);
      
      // 简单回退:只尝试open,不做复杂操作
      try {
        chrome.sidePanel?.setOptions?.({ tabId: tab.id, path: 'sidebar.html', enabled: true });
        await chrome.sidePanel.open({ tabId: tab.id });
        this.panelState.set(tab.id, true);
        console.log('✅ 回退成功');
        return true;
      } catch (e2) {
        console.error('❌ 回退也失败:', e2);
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
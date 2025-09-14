// sidebar.js - 侧边栏逻辑
class ResearchopiaSidebar {
  constructor() {
    this.iframe = null;
    this.currentDoi = null;
    this.researchopiaUrl = 'https://www.researchopia.com';
    this.isLoaded = false;
    this.connectionAttempts = 0;
    this.maxAttempts = 3;
    this.urlCheckTimer = null;
    this.recentClickUsed = false;
  this.didPreviewOnOpen = false;
    
    this.init();
  }

  async init() {
    console.log('🚀 研学港侧边栏初始化...');
    
    // 加载设置
    await this.loadSettings();
    
    // 获取当前页面的DOI信息
    await this.getCurrentPageInfo();
    
    // 初始化iframe
    this.setupIframe();
    
    // 设置消息监听
    this.setupMessageListener();
    
    // 设置UI事件监听器
    this.setupEventListeners();
    
    // 检测服务器连接并更新指示点
    const dot = document.getElementById('connectionStatus');
    if (dot) {
      dot.classList.remove('ok', 'fail');
    }
    this.checkConnection();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'researchopiaUrl',
        'sidebarLastUrl',
        'doiFromContentScript',
        'lastClickTime'
      ]);
      
  this.researchopiaUrl = result.researchopiaUrl || 'https://www.researchopia.com';
  this.lastUrl = result.sidebarLastUrl;
  this.currentDoi = result.doiFromContentScript;
  this.lastClickTime = result.lastClickTime;
      
      console.log('📋 侧边栏设置加载完成:', {
        url: this.researchopiaUrl,
        doi: this.currentDoi,
        lastUrl: this.lastUrl,
        lastClickTime: this.lastClickTime
      });
      
      // 如果最近有点击（5秒内），优先使用点击的DOI
      if (this.lastClickTime && Date.now() - this.lastClickTime < 5000 && this.currentDoi) {
        this.recentClickUsed = true;
        console.log('🎯 使用最近点击的 DOI');
      }
    } catch (error) {
      console.error('设置加载失败:', error);
    }
  }

  async getCurrentPageInfo() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        // 更新页面状态文本
        const pageStatus = document.getElementById('pageStatus');
        if (pageStatus) {
          pageStatus.textContent = (new URL(tab.url || window.location.href)).host || '未知页面';
        }
        // 向content script请求DOI信息
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'getCurrentDOI'
        });
        
        if (response && response.success && response.doi) {
          this.currentDoi = response.doi;
          console.log('📄 获取当前页面DOI:', this.currentDoi);
          const doiStatus = document.getElementById('doiStatus');
          if (doiStatus) doiStatus.textContent = '已检测到 DOI';
        }
        else {
          const doiStatus = document.getElementById('doiStatus');
          if (doiStatus) doiStatus.textContent = '未检测到';
        }
      }
    } catch (error) {
      console.log('无法获取当前页面信息:', error.message);
      const doiStatus = document.getElementById('doiStatus');
      if (doiStatus) doiStatus.textContent = '检测失败';
    }
  }

  setupIframe() {
    this.iframe = document.getElementById('researchopiaFrame');
    
    // 构建URL - 借鉴豆包的简化逻辑
    let targetUrl = this.researchopiaUrl;
    
    // 如果有DOI，添加搜索参数
    if (this.currentDoi) {
      targetUrl += `/?doi=${encodeURIComponent(this.currentDoi)}`;
      console.log('🔗 构建带DOI的URL:', targetUrl);
    } else {
      console.log('� 使用默认URL:', targetUrl);
    }
    
    // 显示加载状态
    this.showLoading();
    
    this.iframe.src = targetUrl;
    
    // iframe加载事件
    this.iframe.onload = () => {
      console.log('✅ 研学港页面加载完成');
      this.hideLoading();
      this.showSuccess();
      this.isLoaded = true;
      
      // 保存当前URL
      chrome.storage.sync.set({ sidebarLastUrl: targetUrl });

      // 更新 DOI 信息条（确保展示当前 DOI + 来源）
      this.updateDoiBar();

      // 页面加载成功也更新连接指示点为 ok（以防 no-cors 健康检查无法判断）
      const dot = document.getElementById('connectionStatus');
      if (dot) {
        dot.classList.remove('fail');
        dot.classList.add('ok');
      }
    };

    this.iframe.onerror = () => {
      console.error('❌ 研学港页面加载失败');
      this.showError();
    };
  }

  // 使用CSS类而不是内联样式
  hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    const error = document.getElementById('errorContainer');
    
    loading.classList.add('hidden');
    error.classList.add('hidden');
  }

  showSuccess() {
    this.iframe.classList.remove('hidden');
  }

  showError() {
    const loading = document.getElementById('loadingOverlay');
    const error = document.getElementById('errorContainer');
    
    loading.classList.add('hidden');
    error.classList.remove('hidden');
    this.iframe.classList.add('hidden');
  }

  setupEventListeners() {
    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');
    
    // 功能按钮
  const toggleFloatBtn = document.getElementById('toggleFloatBtn');
    const detectDOIBtn = document.getElementById('detectDOIBtn');
  const openWebsiteBtn = document.getElementById('openWebsiteBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchBtn = document.getElementById('searchInResearchopiaBtn');
  const urlInput = document.getElementById('serverUrlInput');
  const copyDoiBtn = document.getElementById('copyDoiBtn');
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        const panel = document.getElementById('settingsPanel');
        if (panel && !panel.classList.contains('hidden')) {
          this.hideSettings();
        } else {
          this.showSettings();
        }
      });
    }
    
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener('click', () => this.hideSettings());
    }
    
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }
    
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => this.resetSettings());
    }
    
    if (toggleFloatBtn) {
      toggleFloatBtn.addEventListener('click', () => this.toggleFloatingIcon());
    }
    
    if (detectDOIBtn) {
      detectDOIBtn.addEventListener('click', () => this.detectCurrentDOI());
    }
    
    if (openWebsiteBtn) {
      openWebsiteBtn.addEventListener('click', () => this.openInNewTab());
    }
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshContent());
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.searchInResearchopia());
    }

    if (copyDoiBtn) {
      copyDoiBtn.addEventListener('click', () => this.copyCurrentDoi());
    }

    if (urlInput) {
      // 实时连通性检查（输入停止 500ms 后）
      urlInput.addEventListener('input', () => {
        if (this.urlCheckTimer) clearTimeout(this.urlCheckTimer);
        this.urlCheckTimer = setTimeout(() => {
          const url = urlInput.value?.trim();
          if (!url) return;
          this.previewConnection(url);
        }, 500);
      });
    }
  }

  showSettings() {
    const panel = document.getElementById('settingsPanel');
    
    // 检查当前状态
    if (panel.classList.contains('hidden')) {
      // 加载当前设置到UI
      this.loadSettingsUI();
      // 显示面板
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
      
      // 设置焦点到第一个可交互元素
      const firstInput = panel.querySelector('input, button');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
      
      console.log('⚙️ 显示设置面板');

      // 首次展开时，根据当前 URL 自动预检连通性
      if (!this.didPreviewOnOpen) {
        const urlInput = document.getElementById('serverUrlInput');
        const url = (urlInput?.value || this.researchopiaUrl || '').trim();
        if (url) this.previewConnection(url);
        this.didPreviewOnOpen = true;
      }
    }
  }

  hideSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    
    // 移除所有子元素的焦点
    const focusableElements = panel.querySelectorAll('button, input, select, textarea');
    focusableElements.forEach(el => {
      el.setAttribute('tabindex', '-1');
    });
    
    console.log('⚙️ 隐藏设置面板');
  }

  async loadSettingsUI() {
    try {
      const result = await chrome.storage.sync.get([
        'researchopiaUrl',
        'floatingEnabled'
      ]);
      
  const urlInput = document.getElementById('serverUrlInput');
      const currentDOIDisplay = document.getElementById('currentDOIDisplay');
      
      if (urlInput) {
        urlInput.value = result.researchopiaUrl || 'https://www.researchopia.com';
      }
      
      if (currentDOIDisplay) {
        currentDOIDisplay.textContent = this.currentDoi || '未检测到';
      }
    } catch (error) {
      console.error('加载设置UI失败:', error);
    }
  }

  async saveSettings() {
    try {
      const urlInput = document.getElementById('serverUrlInput');
      const newUrl = urlInput?.value || 'https://www.researchopia.com';
      
      await chrome.storage.sync.set({
        researchopiaUrl: newUrl
      });
      
      this.researchopiaUrl = newUrl;
      this.hideSettings();
      this.refreshContent();
      
      console.log('💾 设置已保存:', newUrl);
    } catch (error) {
      console.error('保存设置失败:', error);
    }
  }

  async resetSettings() {
    try {
      await chrome.storage.sync.set({
        researchopiaUrl: 'https://www.researchopia.com',
        floatingEnabled: true,
        autoDetectDOI: true,
        sidebarWidth: 400
      });
      
      this.researchopiaUrl = 'https://www.researchopia.com';
      this.loadSettingsUI();
      this.refreshContent();
      
      console.log('🔄 设置已重置');
    } catch (error) {
      console.error('重置设置失败:', error);
    }
  }

  async toggleFloatingIcon() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleFloating'
        });
        
        if (response && response.success) {
          console.log('🎯 悬浮图标状态已切换');
        }
      }
    } catch (error) {
      console.error('切换悬浮图标失败:', error);
    }
  }

  async detectCurrentDOI() {
    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.id) {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'detectDOI'
        });
        
        if (response && response.success && response.doi) {
          this.currentDoi = response.doi;
          const display = document.getElementById('currentDOIDisplay');
          if (display) {
            display.textContent = this.currentDoi;
          }
          const doiStatus = document.getElementById('doiStatus');
          if (doiStatus) doiStatus.textContent = '已检测到 DOI';
          this.updateDoiBar('页面检测');
          
          console.log('🔍 重新检测DOI:', this.currentDoi);
          
          // 更新iframe URL
          this.refreshWithDOI(this.currentDoi);
        } else {
          console.log('❌ 未检测到DOI');
          const doiStatus = document.getElementById('doiStatus');
          if (doiStatus) doiStatus.textContent = '未检测到';
        }
      }
    } catch (error) {
      console.error('检测DOI失败:', error);
      const doiStatus = document.getElementById('doiStatus');
      if (doiStatus) doiStatus.textContent = '检测失败';
    }
  }

  openInNewTab() {
    if (this.iframe && this.iframe.src) {
      window.open(this.iframe.src, '_blank');
    }
  }

  refreshContent() {
    if (this.iframe) {
      this.showLoading();
      this.iframe.src = this.iframe.src;
    }
  }

  refreshWithDOI(doi) {
    if (this.iframe) {
      this.showLoading();
      const newUrl = `${this.researchopiaUrl}/?doi=${encodeURIComponent(doi)}`;
      this.iframe.src = newUrl;
    }
  }

  async searchInResearchopia() {
    try {
      if (!this.currentDoi) {
        console.log('⚠️ 当前无DOI，无法搜索');
        return;
      }
      const searchUrl = `${this.researchopiaUrl}/?doi=${encodeURIComponent(this.currentDoi)}&autoSearch=true`;
      await chrome.tabs.create({ url: searchUrl, active: true });
      console.log('🔍 已在新标签页中打开研学港搜索:', searchUrl);
    } catch (error) {
      console.error('打开研学港搜索失败:', error);
    }
  }

  showLoading() {
    const loading = document.getElementById('loadingOverlay');
    const error = document.getElementById('errorContainer');
    
    loading.classList.remove('hidden');
    error.classList.add('hidden');
    this.iframe.classList.add('hidden');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 侧边栏收到消息:', request);
      
      switch (request.action) {
        case 'updateDOI':
          if (request.doi) {
            this.currentDoi = request.doi;
            this.refreshWithDOI(request.doi);
            
            const display = document.getElementById('currentDOIDisplay');
            if (display) {
              display.textContent = this.currentDoi;
            }
            this.updateDoiBar('最近点击');
          }
          sendResponse({ success: true });
          break;
          
        case 'refresh':
          this.refreshContent();
          sendResponse({ success: true });
          break;
          
        default:
          // 侧边栏不拦截未识别的动作，交由 background 处理
          // 不发送失败响应，避免覆盖后台的应答
          return false;
      }
      
      return true;
    });
  }

  // 更新 DOI 信息条内容
  updateDoiBar(source) {
    const codeEl = document.getElementById('doiCode');
    const srcEl = document.getElementById('doiSource');
    const btn = document.getElementById('copyDoiBtn');

    const hasDoi = !!this.currentDoi;
    if (codeEl) codeEl.textContent = hasDoi ? this.currentDoi : '未检测到';

    let label = '';
    if (source) label = source;
    else if (this.recentClickUsed && hasDoi) label = '来自最近点击';
    else if (hasDoi) label = '当前页面';

    if (srcEl) {
      srcEl.textContent = label;
      if (label) srcEl.classList.remove('dim');
      else srcEl.classList.add('dim');
    }

    if (btn) btn.disabled = !hasDoi;
  }

  async copyCurrentDoi() {
    if (!this.currentDoi) return;
    try {
      await navigator.clipboard.writeText(this.currentDoi);
      this.showTinyToast('DOI已复制');
    } catch {
      this.showTinyToast('复制失败');
    }
  }

  showTinyToast(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:absolute; top:8px; right:8px; background:rgba(17,24,39,.92); color:#fff; padding:6px 10px; border-radius:8px; font-size:12px; z-index:30; opacity:0; transition:opacity .15s ease';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = '1');
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 150); }, 1000);
  }

  async previewConnection(url) {
    const dot = document.getElementById('connectionStatus');
    if (!dot) return;
    dot.classList.remove('ok', 'fail');
    try {
      // 使用 HEAD 或 GET(no-cors) 探测；若被CORS限制，仍以可达为准
      await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      dot.classList.add('ok');
    } catch {
      try {
        await fetch(url, { method: 'GET', mode: 'no-cors' });
        dot.classList.add('ok');
        return;
      } catch {}
      dot.classList.add('fail');
    }
  }

  async checkConnection() {
    this.connectionAttempts++;
    
    try {
      const response = await fetch(`${this.researchopiaUrl}/health`, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      
      console.log('✅ 研学港服务器连接正常');
      this.connectionAttempts = 0;
      const dot = document.getElementById('connectionStatus');
      if (dot) {
        dot.classList.remove('fail');
        dot.classList.add('ok');
      }
    } catch (error) {
      console.warn(`⚠️ 研学港服务器连接失败 (尝试 ${this.connectionAttempts}/${this.maxAttempts}):`, error.message);
      const dot = document.getElementById('connectionStatus');
      if (dot) {
        dot.classList.remove('ok');
        dot.classList.add('fail');
      }
      if (this.connectionAttempts < this.maxAttempts) {
        setTimeout(() => this.checkConnection(), 2000);
      } else {
        this.showError();
      }
    }
  }
}

// 初始化侧边栏
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 研学港侧边栏准备就绪');
  window.researchopiaSidebar = new ResearchopiaSidebar();
});
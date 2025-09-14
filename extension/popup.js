// popup.js - 扩展弹窗逻辑
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.detectedDOI = null;
    this.isFloating = false;
    this.init();
  }

  async init() {
    await this.getCurrentTab();
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.detectDOI();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['floatingEnabled', 'researchopiaUrl']);
      this.isFloating = result.floatingEnabled || false;
      this.researchopiaUrl = result.researchopiaUrl || 'https://www.researchopia.com';
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.isFloating = false;
      this.researchopiaUrl = 'https://www.researchopia.com';
    }
  }

  detectLocalUrl() {
    // 检测本地研学港服务器地址
    const possiblePorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
    return `http://localhost:${possiblePorts[0]}`;
  }

  setupEventListeners() {
    console.log('🎛️ 设置popup事件监听器...');
    
    // 测试：验证DOM元素是否存在
    const sidebarButton = document.getElementById('openSidebar');
    if (sidebarButton) {
      console.log('✅ 找到侧边栏按钮元素');
    } else {
      console.error('❌ 未找到侧边栏按钮元素');
    }
    
    // 浮动图标切换
    document.getElementById('toggleFloat').addEventListener('click', () => {
      console.log('📌 浮动图标切换按钮被点击');
      this.toggleFloatingIcon();
    });

    // 搜索按钮
    document.getElementById('searchBtn').addEventListener('click', () => {
      console.log('🔍 搜索按钮被点击');
      this.searchInResearchopia();
    });

    // 打开侧边栏
    document.getElementById('openSidebar').addEventListener('click', async (e) => {
      console.log('📖 打开侧边栏按钮被点击');
      
      // 阻止默认行为和事件传播
      e.preventDefault();
      e.stopPropagation();
      
      // 添加视觉反馈
      const button = e.target.closest('.btn');
      const originalText = button.querySelector('span:last-child').textContent;
      button.querySelector('span:last-child').textContent = '正在打开...';
      button.disabled = true;
      
      // 向background发送日志消息
      chrome.runtime.sendMessage({
        action: 'log',
        message: '📖 Popup中的侧边栏按钮被点击',
        timestamp: new Date().toISOString()
      });
      
      // 防止popup立即关闭，确保能看到日志
      try {
        console.log('📖 开始执行openSidebar方法');
        const result = await this.openSidebar();
        console.log('📖 侧边栏打开结果:', result);
        
        // 恢复按钮状态
        setTimeout(() => {
          button.querySelector('span:last-child').textContent = originalText;
          button.disabled = false;
        }, 1000);
        
      } catch (error) {
        console.error('📖 侧边栏打开错误:', error);
        // 恢复按钮状态
        button.querySelector('span:last-child').textContent = originalText;
        button.disabled = false;
      }
    });

    // 访问网站
    document.getElementById('openWebsite').addEventListener('click', (e) => {
      console.log('🌐 访问研学港网站按钮被点击');
      e.preventDefault(); // 阻止默认的链接行为
      this.openWebsite();
    });
    
    // 全局点击监听器用于调试
    document.addEventListener('click', (e) => {
      console.log('🖱️ 全局点击事件，目标:', e.target.tagName, e.target.id, e.target.className);
    });
    
    console.log('✅ Popup事件监听器设置完成');
  }

  updateUI() {
    // 更新页面状态
    const pageStatus = document.getElementById('pageStatus');
    if (this.currentTab) {
      const url = new URL(this.currentTab.url);
      pageStatus.textContent = this.isAcademicSite(url.hostname) ? '学术网站' : '普通网站';
    } else {
      pageStatus.textContent = '未知';
    }

    // 更新浮动图标状态
    const floatText = document.getElementById('floatText');
    floatText.textContent = this.isFloating ? '隐藏浮动图标' : '显示浮动图标';

    // 更新网站链接
    const websiteLink = document.getElementById('openWebsite');
    websiteLink.href = this.researchopiaUrl;
  }

  async detectDOI() {
    if (!this.currentTab) return;

    try {
      // 向content script发送消息检测DOI
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'detectDOI'
      });

      if (response && response.success && response.doi) {
        this.detectedDOI = response.doi;
        this.showDOI(response.doi);
        document.getElementById('doiStatus').textContent = '已检测到';
      } else {
        document.getElementById('doiStatus').textContent = '未找到DOI';
      }
    } catch (error) {
      console.error('DOI detection failed:', error);
      document.getElementById('doiStatus').textContent = '检测失败';
    }
  }

  showDOI(doi) {
    const doiInfo = document.getElementById('doiInfo');
    const doiValue = document.getElementById('doiValue');
    const searchBtn = document.getElementById('searchBtn');

    doiValue.textContent = doi;
    doiInfo.classList.remove('hidden');
    searchBtn.classList.remove('hidden');
  }

  async toggleFloatingIcon() {
    console.log('🔄 开始切换浮动图标状态...');
    console.log('当前状态:', this.isFloating);
    
    this.isFloating = !this.isFloating;
    
    try {
      console.log('💾 保存新状态到storage:', this.isFloating);
      // 保存设置
      await chrome.storage.sync.set({ floatingEnabled: this.isFloating });
      
      // 向content script发送消息
      if (this.currentTab) {
        console.log('📤 向标签页发送消息:', this.currentTab.id);
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'toggleFloating',
          enabled: this.isFloating
        });
        console.log('📨 收到响应:', response);
      } else {
        console.warn('⚠️ 当前标签页不存在');
      }
      
      this.updateUI();
      console.log('✅ 浮动图标状态切换完成');
    } catch (error) {
      console.error('❌ 切换浮动图标失败:', error);
    }
  }

  async searchInResearchopia() {
    if (!this.detectedDOI) return;

    try {
      const searchUrl = `${this.researchopiaUrl}/?doi=${encodeURIComponent(this.detectedDOI)}&autoSearch=true`;
      
      // 在新标签页中打开搜索页面
      await chrome.tabs.create({
        url: searchUrl,
        active: true
      });

      // 关闭弹窗
      window.close();
    } catch (error) {
      console.error('Failed to search in Researchopia:', error);
    }
  }

  async openSidebar() {
    console.log('📖 尝试打开侧边栏...');
    
    try {
      if (this.currentTab) {
        console.log('📤 发送打开侧边栏消息到background script');
        // 首先尝试使用Chrome原生侧边栏API
        const response = await chrome.runtime.sendMessage({
          action: 'openSidePanel',
          doi: this.detectedDOI,
          url: this.currentTab.url
        });
        
        console.log('📨 Background script响应:', response);
        
        if (response && response.success) {
          console.log('✅ 原生侧边栏打开成功');
          return true;
        } else {
          console.log('⚠️ 原生侧边栏打开失败，尝试备用方案');
          // 备用方案：向content script发送消息
          try {
            const contentResponse = await chrome.tabs.sendMessage(this.currentTab.id, {
              action: 'openSidebar',
              doi: this.detectedDOI,
              researchopiaUrl: this.researchopiaUrl
            });
            console.log('📨 Content script响应:', contentResponse);
            return contentResponse && contentResponse.success;
          } catch (contentError) {
            console.error('📨 Content script消息发送失败:', contentError);
            return false;
          }
        }
      } else {
        console.warn('⚠️ 当前标签页不存在');
        return false;
      }
      
      // 关闭弹窗
      window.close();
    } catch (error) {
      console.error('❌ 打开侧边栏时发生错误:', error);
      return false;
    }
  }

  openWebsite() {
    console.log('🌐 打开研学港网站:', this.researchopiaUrl);
    chrome.tabs.create({
      url: this.researchopiaUrl,
      active: true
    });
    console.log('✅ 网站标签页创建请求已发送');
  }

  isAcademicSite(hostname) {
    const academicSites = [
      'nature.com',
      'science.org',
      'ieee.org',
      'springer.com',
      'sciencedirect.com',
      'wiley.com',
      'tandfonline.com',
      'acm.org',
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'doi.org'
    ];

    return academicSites.some(site => hostname.includes(site));
  }
}

// 初始化弹窗管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
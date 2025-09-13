// popup.js - 扩展弹窗逻辑
class PopupManager {
  constructor() {
    this.currentTab = null;
    this.detectedDoi = null;
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
      this.researchopiaUrl = result.researchopiaUrl || this.detectLocalUrl();
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.isFloating = false;
      this.researchopiaUrl = this.detectLocalUrl();
    }
  }

  detectLocalUrl() {
    // 检测本地研学港服务器地址
    const possiblePorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
    return `http://localhost:${possiblePorts[0]}`;
  }

  setupEventListeners() {
    // 浮动图标切换
    document.getElementById('toggleFloat').addEventListener('click', () => {
      this.toggleFloatingIcon();
    });

    // 搜索按钮
    document.getElementById('searchBtn').addEventListener('click', () => {
      this.searchInResearchopia();
    });

    // 打开侧边栏
    document.getElementById('openSidebar').addEventListener('click', () => {
      this.openSidebar();
    });

    // 访问网站
    document.getElementById('openWebsite').addEventListener('click', () => {
      this.openWebsite();
    });
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
        this.detectedDoi = response.doi;
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
    this.isFloating = !this.isFloating;
    
    try {
      // 保存设置
      await chrome.storage.sync.set({ floatingEnabled: this.isFloating });
      
      // 向content script发送消息
      if (this.currentTab) {
        await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'toggleFloating',
          enabled: this.isFloating
        });
      }
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to toggle floating icon:', error);
    }
  }

  async searchInResearchopia() {
    if (!this.detectedDoi) return;

    try {
      const searchUrl = `${this.researchopiaUrl}/?doi=${encodeURIComponent(this.detectedDoi)}&autoSearch=true`;
      
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
    try {
      if (this.currentTab) {
        await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'openSidebar',
          doi: this.detectedDoi,
          researchopiaUrl: this.researchopiaUrl
        });
      }
      
      // 关闭弹窗
      window.close();
    } catch (error) {
      console.error('Failed to open sidebar:', error);
    }
  }

  openWebsite() {
    chrome.tabs.create({
      url: this.researchopiaUrl,
      active: true
    });
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
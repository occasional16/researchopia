// background.js - 服务工作进程
class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkResearchopiaConnection();
  }

  setupEventListeners() {
    // 扩展安装时
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    // 标签页更新时
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // 处理来自content script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 处理扩展图标点击
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });
  }

  async handleInstall() {
    console.log('研学港扩展已安装');
    
    // 设置默认配置
    await chrome.storage.sync.set({
      floatingEnabled: true,
      researchopiaUrl: 'http://localhost:3000',
      autoDetectDOI: true,
      sidebarWidth: 400
    });

    // 显示欢迎页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html')
    });
  }

  async handleUpdate(previousVersion) {
    console.log(`研学港扩展已更新: ${previousVersion} -> ${chrome.runtime.getManifest().version}`);
  }

  async handleTabUpdate(tabId, tab) {
    // 检查是否为学术网站
    if (this.isAcademicSite(tab.url)) {
      // 更新扩展图标状态
      chrome.action.setBadgeText({
        text: 'DOI',
        tabId: tabId
      });
      
      chrome.action.setBadgeBackgroundColor({
        color: '#4ade80',
        tabId: tabId
      });
    } else {
      chrome.action.setBadgeText({
        text: '',
        tabId: tabId
      });
    }
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'detectDOI':
          await this.handleDOIDetection(request, sender, sendResponse);
          break;
        case 'openResearchopia':
          await this.openResearchopia(request.doi);
          sendResponse({ success: true });
          break;
        case 'checkConnection':
          await this.checkResearchopiaConnection();
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleDOIDetection(request, sender, sendResponse) {
    // 这里主要是协调工作，实际检测在content script中进行
    sendResponse({ success: true, message: 'DOI detection initiated' });
  }

  async openResearchopia(doi = null) {
    try {
      const settings = await chrome.storage.sync.get(['researchopiaUrl']);
      const baseUrl = settings.researchopiaUrl || 'http://localhost:3000';
      
      let url = baseUrl;
      if (doi) {
        url += `/?doi=${encodeURIComponent(doi)}&autoSearch=true`;
      }

      await chrome.tabs.create({
        url: url,
        active: true
      });
    } catch (error) {
      console.error('Failed to open Researchopia:', error);
    }
  }

  async checkResearchopiaConnection() {
    try {
      const settings = await chrome.storage.sync.get(['researchopiaUrl']);
      const baseUrl = settings.researchopiaUrl || 'http://localhost:3000';
      
      // 尝试连接研学港服务器
      const response = await fetch(baseUrl, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      
      console.log('Researchopia connection status:', response.ok ? 'Connected' : 'Disconnected');
      
      // 更新连接状态
      await chrome.storage.local.set({
        connectionStatus: response.ok ? 'connected' : 'disconnected',
        lastChecked: Date.now()
      });
    } catch (error) {
      console.log('Researchopia connection failed:', error.message);
      await chrome.storage.local.set({
        connectionStatus: 'disconnected',
        lastChecked: Date.now()
      });
    }
  }

  async handleActionClick(tab) {
    // 当用户点击扩展图标时的处理
    console.log('Extension icon clicked on:', tab.url);
  }

  isAcademicSite(url) {
    if (!url) return false;
    
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

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return academicSites.some(site => hostname.includes(site));
    } catch (error) {
      return false;
    }
  }
}

// 初始化背景脚本
new BackgroundManager();
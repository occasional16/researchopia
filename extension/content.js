// content.js - 内容脚本：DOI检测和悬浮图标
class ResearchopiaContentScript {
  constructor() {
    this.detectedDOI = null;
    this.floatingIcon = null;
    this.sidebar = null;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.settings = {};
    
    this.init();
  }

  async init() {
    // 等待页面完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    try {
      await this.loadSettings();
      await this.detectDOI();
      this.setupMessageListener();
      
      // 如果设置了显示浮动图标，则显示
      if (this.settings.floatingEnabled) {
        this.createFloatingIcon();
      }
      
      console.log('研学港扩展已加载');
    } catch (error) {
      console.error('研学港扩展初始化失败:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'floatingEnabled',
        'researchopiaUrl',
        'autoDetectDOI',
        'sidebarWidth'
      ]);
      
      this.settings = {
        floatingEnabled: result.floatingEnabled !== false, // 默认为true
        researchopiaUrl: result.researchopiaUrl || 'http://localhost:3000',
        autoDetectDOI: result.autoDetectDOI !== false, // 默认为true
        sidebarWidth: result.sidebarWidth || 400
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      // 使用默认设置
      this.settings = {
        floatingEnabled: true,
        researchopiaUrl: 'http://localhost:3000',
        autoDetectDOI: true,
        sidebarWidth: 400
      };
    }
  }

  async detectDOI() {
    if (!this.settings.autoDetectDOI) return null;

    try {
      // 多种DOI检测方法
      const methods = [
        () => this.extractDOIFromMeta(),
        () => this.extractDOIFromJSON(),
        () => this.extractDOIFromText(),
        () => this.extractDOIFromURL()
      ];

      for (const method of methods) {
        const doi = await method();
        if (doi) {
          this.detectedDOI = this.cleanDOI(doi);
          console.log('检测到DOI:', this.detectedDOI);
          return this.detectedDOI;
        }
      }

      console.log('未检测到DOI');
      return null;
    } catch (error) {
      console.error('DOI检测失败:', error);
      return null;
    }
  }

  extractDOIFromMeta() {
    // 从meta标签中提取DOI
    const metaSelectors = [
      'meta[name="citation_doi"]',
      'meta[name="dc.identifier"]',
      'meta[name="DC.identifier"]',
      'meta[property="article:doi"]',
      'meta[name="doi"]',
      'meta[name="DOI"]'
    ];

    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      if (meta) {
        const content = meta.getAttribute('content') || meta.getAttribute('scheme');
        if (content && this.isValidDOI(content)) {
          return content;
        }
      }
    }
    return null;
  }

  extractDOIFromJSON() {
    // 从JSON-LD或其他结构化数据中提取DOI
    try {
      const jsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonScripts) {
        try {
          const data = JSON.parse(script.textContent);
          const doi = this.findDOIInObject(data);
          if (doi) return doi;
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.error('JSON DOI extraction failed:', error);
    }
    return null;
  }

  extractDOIFromText() {
    // 从页面文本中提取DOI
    const doiRegex = /(?:doi:|DOI:|https?:\/\/(?:www\.)?doi\.org\/|https?:\/\/dx\.doi\.org\/)?(10\.\d{4,}\/[^\s\])"'<]+)/gi;
    const textContent = document.body.textContent || '';
    
    const matches = textContent.match(doiRegex);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const cleanMatch = this.cleanDOI(match);
        if (this.isValidDOI(cleanMatch)) {
          return cleanMatch;
        }
      }
    }
    return null;
  }

  extractDOIFromURL() {
    // 从当前URL中提取DOI
    const url = window.location.href;
    const doiRegex = /(?:doi\/|DOI\/|doi:|DOI:)?(10\.\d{4,}\/[^\s\])"'<\?#]+)/i;
    const match = url.match(doiRegex);
    
    if (match && match[1]) {
      const doi = this.cleanDOI(match[1]);
      if (this.isValidDOI(doi)) {
        return doi;
      }
    }
    return null;
  }

  findDOIInObject(obj) {
    if (typeof obj !== 'object' || obj === null) return null;
    
    // 直接检查DOI字段
    const doiFields = ['doi', 'DOI', 'identifier', '@id', 'url'];
    for (const field of doiFields) {
      if (obj[field]) {
        const value = typeof obj[field] === 'string' ? obj[field] : JSON.stringify(obj[field]);
        if (this.isValidDOI(value)) {
          return this.cleanDOI(value);
        }
      }
    }
    
    // 递归搜索
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const result = this.findDOIInObject(obj[key]);
        if (result) return result;
      }
    }
    
    return null;
  }

  cleanDOI(doi) {
    if (!doi) return null;
    
    // 移除常见前缀
    doi = doi.replace(/^(doi:|DOI:|https?:\/\/(?:www\.|dx\.)?doi\.org\/)/i, '');
    
    // 移除尾部的标点符号和特殊字符
    doi = doi.replace(/[.,;:)\]}"'>]*$/, '');
    
    // 移除HTML标签
    doi = doi.replace(/<[^>]*>/g, '');
    
    return doi.trim();
  }

  isValidDOI(doi) {
    if (!doi || typeof doi !== 'string') return false;
    
    // DOI的基本格式检查：10.xxxx/xxxx
    const doiPattern = /^10\.\d{4,}\/\S+$/;
    return doiPattern.test(this.cleanDOI(doi));
  }

  createFloatingIcon() {
    if (this.floatingIcon) {
      this.floatingIcon.remove();
    }

    this.floatingIcon = document.createElement('div');
    this.floatingIcon.className = 'researchopia-floating-icon';
    this.floatingIcon.innerHTML = `
      <div class="icon-content">
        <div class="icon-text">研</div>
        ${this.detectedDOI ? '<div class="doi-indicator"></div>' : ''}
      </div>
    `;

    // 设置样式
    Object.assign(this.floatingIcon.style, {
      position: 'fixed',
      top: '100px',
      right: '20px',
      width: '56px',
      height: '56px',
      backgroundColor: '#667eea',
      borderRadius: '50%',
      cursor: 'move',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      userSelect: 'none'
    });

    // 添加内部样式
    const iconContent = this.floatingIcon.querySelector('.icon-content');
    Object.assign(iconContent.style, {
      position: 'relative',
      color: 'white',
      fontSize: '20px',
      fontWeight: 'bold',
      textAlign: 'center'
    });

    // DOI指示器样式
    const doiIndicator = this.floatingIcon.querySelector('.doi-indicator');
    if (doiIndicator) {
      Object.assign(doiIndicator.style, {
        position: 'absolute',
        top: '-2px',
        right: '-2px',
        width: '12px',
        height: '12px',
        backgroundColor: '#10b981',
        borderRadius: '50%',
        border: '2px solid white'
      });
    }

    // 添加事件监听器
    this.setupFloatingIconEvents();

    // 添加到页面
    document.body.appendChild(this.floatingIcon);
  }

  setupFloatingIconEvents() {
    if (!this.floatingIcon) return;

    let isHovering = false;

    // 鼠标悬停效果
    this.floatingIcon.addEventListener('mouseenter', () => {
      isHovering = true;
      this.floatingIcon.style.transform = 'scale(1.1)';
      this.floatingIcon.style.backgroundColor = '#5b21b6';
    });

    this.floatingIcon.addEventListener('mouseleave', () => {
      isHovering = false;
      if (!this.isDragging) {
        this.floatingIcon.style.transform = 'scale(1)';
        this.floatingIcon.style.backgroundColor = '#667eea';
      }
    });

    // 拖拽功能
    this.floatingIcon.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX - this.floatingIcon.offsetLeft;
      this.dragStartY = e.clientY - this.floatingIcon.offsetTop;
      
      this.floatingIcon.style.transition = 'none';
      document.body.style.cursor = 'move';
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const x = e.clientX - this.dragStartX;
      const y = e.clientY - this.dragStartY;
      
      // 边界限制
      const maxX = window.innerWidth - this.floatingIcon.offsetWidth;
      const maxY = window.innerHeight - this.floatingIcon.offsetHeight;
      
      const constrainedX = Math.max(0, Math.min(maxX, x));
      const constrainedY = Math.max(0, Math.min(maxY, y));
      
      this.floatingIcon.style.left = constrainedX + 'px';
      this.floatingIcon.style.top = constrainedY + 'px';
      this.floatingIcon.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      document.body.style.cursor = 'default';
      this.floatingIcon.style.transition = 'all 0.3s ease';
      
      // 边缘吸附
      const rect = this.floatingIcon.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const isLeftHalf = centerX < window.innerWidth / 2;
      
      setTimeout(() => {
        if (isLeftHalf) {
          this.floatingIcon.style.left = '20px';
          this.floatingIcon.style.right = 'auto';
        } else {
          this.floatingIcon.style.right = '20px';
          this.floatingIcon.style.left = 'auto';
        }
      }, 100);
      
      // 如果没有移动太多，则认为是点击
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - (this.dragStartX + this.floatingIcon.offsetLeft), 2) +
        Math.pow(e.clientY - (this.dragStartY + this.floatingIcon.offsetTop), 2)
      );
      
      if (moveDistance < 5) {
        this.handleFloatingIconClick();
      }
      
      if (!isHovering) {
        this.floatingIcon.style.transform = 'scale(1)';
        this.floatingIcon.style.backgroundColor = '#667eea';
      }
    });

    // 防止拖拽时选择文本
    this.floatingIcon.addEventListener('dragstart', (e) => {
      e.preventDefault();
    });
  }

  handleFloatingIconClick() {
    // 打开侧边栏
    this.openSidebar();
  }

  openSidebar() {
    if (this.sidebar) {
      // 如果侧边栏已存在，则切换显示/隐藏
      const isVisible = this.sidebar.style.transform === 'translateX(0px)';
      this.sidebar.style.transform = isVisible ? `translateX(${this.settings.sidebarWidth}px)` : 'translateX(0px)';
      return;
    }

    this.createSidebar();
  }

  createSidebar() {
    this.sidebar = document.createElement('div');
    this.sidebar.className = 'researchopia-sidebar';
    
    // 构建研学港URL
    let researchopiaUrl = this.settings.researchopiaUrl;
    if (this.detectedDOI) {
      researchopiaUrl += `/?doi=${encodeURIComponent(this.detectedDOI)}&autoSearch=true`;
    }

    this.sidebar.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-title">
          <span class="sidebar-icon">研</span>
          <span class="sidebar-text">研学港</span>
        </div>
        <button class="sidebar-close" title="关闭">×</button>
      </div>
      <div class="sidebar-content">
        <iframe src="${researchopiaUrl}" frameborder="0"></iframe>
      </div>
    `;

    // 设置样式
    Object.assign(this.sidebar.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: this.settings.sidebarWidth + 'px',
      height: '100vh',
      backgroundColor: 'white',
      zIndex: '999998',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      transform: `translateX(${this.settings.sidebarWidth}px)`,
      transition: 'transform 0.3s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });

    // 设置内部样式
    this.setupSidebarStyles();
    this.setupSidebarEvents();

    // 添加到页面
    document.body.appendChild(this.sidebar);

    // 显示侧边栏
    setTimeout(() => {
      this.sidebar.style.transform = 'translateX(0px)';
    }, 50);
  }

  setupSidebarStyles() {
    const header = this.sidebar.querySelector('.sidebar-header');
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f9fafb'
    });

    const title = this.sidebar.querySelector('.sidebar-title');
    Object.assign(title.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#1f2937'
    });

    const icon = this.sidebar.querySelector('.sidebar-icon');
    Object.assign(icon.style, {
      width: '32px',
      height: '32px',
      backgroundColor: '#667eea',
      color: 'white',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      fontWeight: 'bold'
    });

    const closeBtn = this.sidebar.querySelector('.sidebar-close');
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      color: '#6b7280',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px'
    });

    const content = this.sidebar.querySelector('.sidebar-content');
    Object.assign(content.style, {
      height: 'calc(100vh - 65px)',
      overflow: 'hidden'
    });

    const iframe = this.sidebar.querySelector('iframe');
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: 'none'
    });
  }

  setupSidebarEvents() {
    const closeBtn = this.sidebar.querySelector('.sidebar-close');
    closeBtn.addEventListener('click', () => {
      this.closeSidebar();
    });

    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.backgroundColor = '#f3f4f6';
    });

    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.backgroundColor = 'transparent';
    });
  }

  closeSidebar() {
    if (this.sidebar) {
      this.sidebar.style.transform = `translateX(${this.settings.sidebarWidth}px)`;
      setTimeout(() => {
        if (this.sidebar) {
          this.sidebar.remove();
          this.sidebar = null;
        }
      }, 300);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'detectDOI':
          await this.detectDOI();
          sendResponse({
            success: true,
            doi: this.detectedDOI,
            url: window.location.href
          });
          break;
          
        case 'toggleFloating':
          if (request.enabled) {
            this.createFloatingIcon();
          } else {
            if (this.floatingIcon) {
              this.floatingIcon.remove();
              this.floatingIcon = null;
            }
          }
          sendResponse({ success: true });
          break;
          
        case 'openSidebar':
          this.settings.researchopiaUrl = request.researchopiaUrl || this.settings.researchopiaUrl;
          this.openSidebar();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Content script message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // 清理函数
  cleanup() {
    if (this.floatingIcon) {
      this.floatingIcon.remove();
      this.floatingIcon = null;
    }
    if (this.sidebar) {
      this.sidebar.remove();
      this.sidebar = null;
    }
  }
}

// 初始化内容脚本
let researchopiaCS = null;

if (!researchopiaCS) {
  researchopiaCS = new ResearchopiaContentScript();
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (researchopiaCS) {
    researchopiaCS.cleanup();
  }
});
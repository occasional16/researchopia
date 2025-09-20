/*
 * 研学港 Zotero插件 - 简化最终版
 * Simple Final Version of Researchopia Zotero Plugin
 */

Zotero.Researchopia = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  registeredSection: null,
  
  // 配置
  config: {
    apiPorts: [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009],
    currentApiUrl: null,
    timeout: 10000
  },

  // 状态管理
  state: {
    isOnline: false,
    isAuthenticated: false,
    userInfo: null,
    currentItem: null
  },

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;

    this.log('研学港插件初始化成功');
    
    // 检测可用端口
    this.detectAvailablePorts();
    
    // 注册Item Pane部分
    this.registerItemPaneSection();
    
    // 检查认证状态
    this.checkAuthenticationStatus();
  },

  /**
   * 检测可用端口
   */
  async detectAvailablePorts() {
    this.log('正在检测可用端口...');
    
    for (const port of this.config.apiPorts) {
      try {
        const isAvailable = await this.testPortAvailability(port);
        if (isAvailable) {
          this.config.currentApiUrl = `http://localhost:${port}`;
          this.log(`找到可用端口: ${port}`);
          this.state.isOnline = true;
          return;
        }
      } catch (error) {
        this.log(`端口 ${port} 不可用: ${error.message}`);
      }
    }
    
    this.log('未找到可用端口');
    this.config.currentApiUrl = 'http://localhost:3000';
    this.state.isOnline = false;
  },

  /**
   * 测试端口可用性
   */
  async testPortAvailability(port) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 2000;
      
      xhr.onload = () => {
        resolve(xhr.status === 200 || xhr.status === 404);
      };
      
      xhr.onerror = () => resolve(false);
      xhr.ontimeout = () => resolve(false);
      
      try {
        xhr.open('GET', `http://localhost:${port}/api/health`, true);
        xhr.send();
      } catch (error) {
        resolve(false);
      }
    });
  },

  /**
   * 检查认证状态
   */
  async checkAuthenticationStatus() {
    try {
      const userInfo = Zotero.Prefs.get('researchopia.userInfo', null);
      if (userInfo && userInfo.token) {
        this.state.isAuthenticated = true;
        this.state.userInfo = userInfo;
        this.log('用户已认证: ' + userInfo.name);
      } else {
        this.state.isAuthenticated = false;
        this.state.userInfo = null;
      }
    } catch (error) {
      this.log('检查认证状态失败: ' + error.message);
      this.state.isAuthenticated = false;
    }
  },

  /**
   * 注册Item Pane部分
   */
  registerItemPaneSection() {
    try {
      if (!Zotero.ItemPaneManager) {
        throw new Error("Zotero.ItemPaneManager 不可用");
      }
      
      if (this.registeredSection) {
        this.log('部分已注册');
        return;
      }

      this.registeredSection = Zotero.ItemPaneManager.registerSection({
        paneID: `${this.id}-section`,
        pluginID: this.id,
        header: {
          l10nID: "researchopia-header-label",
          label: "研学港 Researchopia",
          icon: `${this.rootURI}icons/icon32.svg`,
        },
        sidenav: {
          l10nID: "researchopia-sidenav-label",
          label: "研学港 Researchopia",
          icon: `${this.rootURI}icons/icon32.svg`,
        },
        onRender: ({ body, item }) => {
          this.renderItemPane(body, item);
        },
      });

      this.log("Item Pane 部分注册成功");
    } catch (error) {
      this.log("注册 Item Pane 部分失败: " + error.message);
    }
  },

  /**
   * 渲染Item Pane
   */
  renderItemPane(body, item) {
    try {
      body.replaceChildren();
      this.state.currentItem = item;

      const container = body.ownerDocument.createElement("div");
      container.className = "researchopia-container";
      container.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        background: #fff;
        padding: 16px;
        border-radius: 8px;
        max-width: 100%;
        box-sizing: border-box;
      `;

      // 创建主界面
      this.createMainInterface(container, item);

      body.appendChild(container);

      this.log('Item Pane 渲染成功');
    } catch (error) {
      this.log('渲染 Item Pane 失败: ' + error.message);
      body.innerHTML = '<div style="color: red; padding: 16px;">界面渲染失败: ' + error.message + '</div>';
    }
  },

  /**
   * 创建主界面
   */
  createMainInterface(container, item) {
    // 标题
    const title = container.ownerDocument.createElement('h3');
    title.textContent = '研学港 Researchopia';
    title.style.cssText = `
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 8px;
    `;

    const subtitle = container.ownerDocument.createElement('p');
    subtitle.textContent = '学术标注分享平台 - 简化版';
    subtitle.style.cssText = `
      font-size: 12px;
      margin: 0 0 16px 0;
      color: #666;
    `;

    // 状态指示器
    const statusIndicator = container.ownerDocument.createElement('div');
    statusIndicator.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      margin-bottom: 16px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #e1e5e9;
    `;
    
    const statusDot = container.ownerDocument.createElement('span');
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${this.state.isOnline ? '#28a745' : '#dc3545'};
      animation: pulse 2s infinite;
    `;
    
    const statusText = container.ownerDocument.createElement('span');
    statusText.textContent = this.state.isOnline ? '已连接' : '未连接';
    statusText.style.fontWeight = '500';
    
    const portInfo = container.ownerDocument.createElement('span');
    portInfo.textContent = `端口: ${this.config.currentApiUrl?.split(':').pop() || '未知'}`;
    portInfo.style.color = '#666';
    portInfo.style.marginLeft = 'auto';

    statusIndicator.appendChild(statusDot);
    statusIndicator.appendChild(statusText);
    statusIndicator.appendChild(portInfo);

    // 用户认证区域
    const userArea = container.ownerDocument.createElement('div');
    userArea.style.cssText = `
      margin: 16px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e1e5e9;
    `;
    
    if (this.state.isAuthenticated && this.state.userInfo) {
      userArea.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 600; font-size: 14px; color: #495057;">${this.state.userInfo.name}</div>
            <div style="font-size: 12px; color: #6c757d;">${this.state.userInfo.email || ''}</div>
          </div>
          <button id="logout-btn" style="background: #dc3545; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.2s;">登出</button>
        </div>
      `;
    } else {
      userArea.innerHTML = `
        <div style="text-align: center; color: #6c757d;">
          <p style="margin: 0 0 8px 0; font-size: 14px;">请先登录以使用研学港功能</p>
          <button id="login-btn" style="background: #28a745; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s;">登录</button>
        </div>
      `;
    }

    // 快速操作按钮
    const quickActions = container.ownerDocument.createElement('div');
    quickActions.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 16px 0;
    `;

    const syncBtn = container.ownerDocument.createElement('button');
    syncBtn.textContent = '🔄 同步标注';
    syncBtn.style.cssText = `
      background: #28a745;
      border: none;
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    syncBtn.disabled = !this.state.isAuthenticated;

    const shareBtn = container.ownerDocument.createElement('button');
    shareBtn.textContent = '📤 分享标注';
    shareBtn.style.cssText = `
      background: #6c757d;
      border: none;
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    shareBtn.disabled = !this.state.isAuthenticated;

    const browseBtn = container.ownerDocument.createElement('button');
    browseBtn.textContent = '🌐 浏览共享';
    browseBtn.style.cssText = `
      background: #6c757d;
      border: none;
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    browseBtn.disabled = !this.state.isAuthenticated;

    const refreshBtn = container.ownerDocument.createElement('button');
    refreshBtn.textContent = '🔄 刷新';
    refreshBtn.style.cssText = `
      background: #17a2b8;
      border: none;
      color: white;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    `;

    quickActions.appendChild(syncBtn);
    quickActions.appendChild(shareBtn);
    quickActions.appendChild(browseBtn);
    quickActions.appendChild(refreshBtn);

    // 文献信息
    const annotationInfo = container.ownerDocument.createElement('div');
    annotationInfo.style.cssText = `
      margin-top: 16px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e1e5e9;
    `;

    const doi = this.extractDOI(item);
    if (doi) {
      annotationInfo.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">📄 文献信息</h4>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;"><strong>DOI:</strong> ${doi}</p>
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666;"><strong>标题:</strong> ${item.getField('title') || '未知'}</p>
        <p style="margin: 0; font-size: 12px; color: #28a745;">✅ 此文献支持研学港功能</p>
      `;
    } else {
      annotationInfo.innerHTML = `
        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #495057;">📄 文献信息</h4>
        <p style="margin: 0; font-size: 12px; color: #dc3545;">❌ 此文献没有DOI，无法使用研学港功能</p>
      `;
    }

    // 添加CSS动画
    const style = container.ownerDocument.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    container.appendChild(style);

    container.appendChild(title);
    container.appendChild(subtitle);
    container.appendChild(statusIndicator);
    container.appendChild(userArea);
    container.appendChild(quickActions);
    container.appendChild(annotationInfo);

    // 添加事件监听器
    this.addEventListeners(container, item);
  },

  /**
   * 添加事件监听器
   */
  addEventListeners(container, item) {
    // 登录按钮
    const loginBtn = container.querySelector('#login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    // 登出按钮
    const logoutBtn = container.querySelector('#logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // 刷新按钮
    const refreshBtn = container.querySelector('button[style*="background: #17a2b8"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshStatus());
    }

    // 同步按钮
    const syncBtn = container.querySelector('button[style*="background: #28a745"]');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.handleSync());
    }

    // 分享按钮
    const shareBtn = container.querySelector('button[style*="background: #6c757d"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.handleShare());
    }

    // 浏览按钮
    const browseBtn = container.querySelectorAll('button[style*="background: #6c757d"]')[1];
    if (browseBtn) {
      browseBtn.addEventListener('click', () => this.handleBrowse());
    }
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    try {
      const loginUrl = `${this.config.currentApiUrl}/auth/login`;
      Zotero.launchURL(loginUrl);
      this.showFeedback('请在浏览器中完成登录，然后点击刷新按钮', 'info');
    } catch (error) {
      this.log('登录处理失败: ' + error.message);
      this.showFeedback('登录失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理登出
   */
  async handleLogout() {
    try {
      Zotero.Prefs.clear('researchopia.userInfo');
      this.state.isAuthenticated = false;
      this.state.userInfo = null;
      this.showFeedback('已登出', 'success');
    } catch (error) {
      this.log('登出处理失败: ' + error.message);
    }
  },

  /**
   * 刷新状态
   */
  async refreshStatus() {
    try {
      await this.detectAvailablePorts();
      await this.checkAuthenticationStatus();
      this.showFeedback('状态已刷新', 'success');
    } catch (error) {
      this.log('刷新状态失败: ' + error.message);
    }
  },

  /**
   * 处理同步
   */
  async handleSync() {
    this.showFeedback('同步功能开发中...', 'info');
  },

  /**
   * 处理分享
   */
  async handleShare() {
    this.showFeedback('分享功能开发中...', 'info');
  },

  /**
   * 处理浏览
   */
  async handleBrowse() {
    try {
      const doi = this.extractDOI(this.state.currentItem);
      if (doi) {
        const webUrl = `${this.config.currentApiUrl}/papers/${doi}`;
        Zotero.launchURL(webUrl);
      } else {
        this.showFeedback('此文献没有DOI', 'warning');
      }
    } catch (error) {
      this.log('浏览处理失败: ' + error.message);
    }
  },

  /**
   * 提取DOI
   */
  extractDOI(item) {
    const doiFields = ['DOI', 'doi', 'extra'];
    for (const field of doiFields) {
      const value = item.getField(field);
      if (value) {
        const doiMatch = value.match(/10\.\d+\/[^\s]+/);
        if (doiMatch) {
          return doiMatch[0];
        }
      }
    }
    return null;
  },

  /**
   * 日志记录
   */
  log(msg, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] 研学港: ${msg}`;
    
    Zotero.debug(logMessage);
    
    try {
      console.log(logMessage);
    } catch (e) {
      // 忽略控制台错误
    }
  },

  /**
   * 显示反馈
   */
  showFeedback(message, type = 'info') {
    this.log(`反馈 [${type}]: ${message}`);
    
    // 简单的反馈显示
    try {
      if (Zotero.Alert) {
        Zotero.Alert(message, '研学港');
      } else {
        alert(`研学港: ${message}`);
      }
    } catch (e) {
      this.log('显示反馈失败: ' + e.message);
    }
  }
};

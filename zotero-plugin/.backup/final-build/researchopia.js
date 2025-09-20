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

  // 定时器
  statusCheckInterval: null,

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
    
    // 启动定期状态检查
    this.startStatusCheck();
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
      this.log('开始检查认证状态...');
      
      // 首先检查本地存储的用户信息
      const localUserInfo = Zotero.Prefs.get('researchopia.userInfo', null);
      this.log('本地存储用户信息: ' + (localUserInfo ? '存在' : '不存在'));
      
      // 然后尝试从网站API获取最新状态
      if (this.config.currentApiUrl) {
        try {
          this.log('正在从网站API检查认证状态...');
          const response = await this.makeApiRequest('/api/auth/status');
          this.log('API响应: ' + JSON.stringify(response));
          
          if (response && response.authenticated) {
            this.state.isAuthenticated = true;
            this.state.userInfo = {
              name: response.user?.name || response.user?.username || '用户',
              email: response.user?.email || '',
              token: response.token || 'test-token',
              id: response.user?.id || 'unknown'
            };
            
            // 保存到本地存储
            Zotero.Prefs.set('researchopia.userInfo', this.state.userInfo);
            this.log('✅ 从网站API获取认证状态成功: ' + this.state.userInfo.name);
            this.showFeedback('已同步网站登录状态', 'success');
          } else {
            this.state.isAuthenticated = false;
            this.state.userInfo = null;
            this.log('❌ 网站API显示用户未认证');
            
            // 立即清除本地存储（安全措施）
            Zotero.Prefs.clear('researchopia.userInfo');
            this.log('🔒 已清除本地存储的用户信息（安全措施）');
            this.showFeedback('网站未登录，已清除本地信息', 'warning');
          }
        } catch (apiError) {
          this.log('❌ 从网站API检查认证状态失败: ' + apiError.message);
          
          // 如果API失败，回退到本地存储
          if (localUserInfo && localUserInfo.token) {
            this.state.isAuthenticated = true;
            this.state.userInfo = localUserInfo;
            this.log('⚠️ 使用本地存储的认证信息: ' + localUserInfo.name);
            this.showFeedback('使用本地登录信息（可能已过期）', 'warning');
          } else {
            this.state.isAuthenticated = false;
            this.state.userInfo = null;
            this.log('❌ 本地存储中无认证信息');
            this.showFeedback('未登录，请点击登录按钮', 'info');
          }
        }
      } else {
        // 没有API URL，使用本地存储
        if (localUserInfo && localUserInfo.token) {
          this.state.isAuthenticated = true;
          this.state.userInfo = localUserInfo;
          this.log('⚠️ 使用本地存储的认证信息（无API连接）: ' + localUserInfo.name);
          this.showFeedback('使用本地登录信息（无网络连接）', 'warning');
        } else {
          this.state.isAuthenticated = false;
          this.state.userInfo = null;
          this.log('❌ 本地存储中无认证信息');
          this.showFeedback('未登录，请点击登录按钮', 'info');
        }
      }
      
      // 更新界面状态
      this.updateStatusDisplay();
      this.log('认证状态检查完成: 认证=' + this.state.isAuthenticated + ', 用户=' + (this.state.userInfo?.name || '无'));
    } catch (error) {
      this.log('❌ 检查认证状态失败: ' + error.message);
      this.state.isAuthenticated = false;
      this.state.userInfo = null;
      this.showFeedback('状态检查失败: ' + error.message, 'error');
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
    statusDot.className = 'status-dot';
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${this.state.isOnline ? '#28a745' : '#dc3545'};
      animation: pulse 2s infinite;
    `;
    
    const statusText = container.ownerDocument.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = this.state.isOnline ? '已连接' : '未连接';
    statusText.style.fontWeight = '500';
    
    const portInfo = container.ownerDocument.createElement('span');
    portInfo.className = 'port-info';
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
      // 已登录状态 - 使用DOM创建
      const userInfoDiv = container.ownerDocument.createElement('div');
      userInfoDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
      
      const userDetails = container.ownerDocument.createElement('div');
      const userName = container.ownerDocument.createElement('div');
      userName.textContent = this.state.userInfo.name || '未知用户';
      userName.style.cssText = 'font-weight: 600; font-size: 14px; color: #495057;';
      
      const userEmail = container.ownerDocument.createElement('div');
      userEmail.textContent = this.state.userInfo.email || '';
      userEmail.style.cssText = 'font-size: 12px; color: #6c757d;';
      
      userDetails.appendChild(userName);
      userDetails.appendChild(userEmail);
      
      const logoutBtn = container.ownerDocument.createElement('button');
      logoutBtn.id = 'logout-btn';
      logoutBtn.textContent = '登出';
      logoutBtn.style.cssText = 'background: #dc3545; border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background 0.2s;';
      
      userInfoDiv.appendChild(userDetails);
      userInfoDiv.appendChild(logoutBtn);
      userArea.appendChild(userInfoDiv);
    } else {
      // 未登录状态 - 使用DOM创建
      const loginDiv = container.ownerDocument.createElement('div');
      loginDiv.style.cssText = 'text-align: center; color: #6c757d;';
      
      const loginText = container.ownerDocument.createElement('p');
      loginText.textContent = '请先登录以使用研学港功能';
      loginText.style.cssText = 'margin: 0 0 8px 0; font-size: 14px;';
      
      const loginBtn = container.ownerDocument.createElement('button');
      loginBtn.id = 'login-btn';
      loginBtn.textContent = '登录';
      loginBtn.style.cssText = 'background: #28a745; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s;';
      
      loginDiv.appendChild(loginText);
      loginDiv.appendChild(loginBtn);
      userArea.appendChild(loginDiv);
      
      this.log('登录按钮已创建，ID: ' + loginBtn.id + ', 文本: ' + loginBtn.textContent);
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
    // 不要禁用按钮，让事件处理函数来处理状态检查
    syncBtn.style.opacity = this.state.isAuthenticated ? '1' : '0.6';

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
    // 不要禁用按钮，让事件处理函数来处理状态检查
    shareBtn.style.opacity = this.state.isAuthenticated ? '1' : '0.6';

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
    // 不要禁用按钮，让事件处理函数来处理状态检查

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
    this.log('开始添加事件监听器...');
    
    // 登录按钮
    const loginBtn = container.querySelector('#login-btn');
    if (loginBtn) {
      this.log('找到登录按钮，添加事件监听器');
      this.log('登录按钮文本: ' + loginBtn.textContent);
      this.log('登录按钮样式: ' + loginBtn.style.cssText);
      loginBtn.addEventListener('click', () => {
        this.log('登录按钮被点击');
        this.handleLogin();
      });
    } else {
      this.log('未找到登录按钮');
      // 尝试查找所有按钮
      const allButtons = container.querySelectorAll('button');
      this.log('容器中的所有按钮:');
      allButtons.forEach((btn, index) => {
        this.log(`按钮 ${index}: id="${btn.id}", text="${btn.textContent}"`);
      });
    }

    // 登出按钮
    const logoutBtn = container.querySelector('#logout-btn');
    if (logoutBtn) {
      this.log('找到登出按钮，添加事件监听器');
      logoutBtn.addEventListener('click', () => {
        this.log('登出按钮被点击');
        this.handleLogout();
      });
    } else {
      this.log('未找到登出按钮');
    }

    // 获取所有按钮
    const buttons = container.querySelectorAll('button');
    this.log(`找到 ${buttons.length} 个按钮`);
    
    // 为每个按钮添加事件监听器
    buttons.forEach((button, index) => {
      const text = button.textContent;
      this.log(`按钮 ${index}: "${text}"`);
      
      if (text.includes('刷新')) {
        this.log('为刷新按钮添加事件监听器');
        button.addEventListener('click', () => {
          this.log('刷新按钮被点击');
          this.refreshStatus();
        });
      } else if (text.includes('同步标注')) {
        this.log('为同步按钮添加事件监听器');
        button.addEventListener('click', () => {
          this.log('同步按钮被点击');
          this.handleSync();
        });
      } else if (text.includes('分享标注')) {
        this.log('为分享按钮添加事件监听器');
        button.addEventListener('click', () => {
          this.log('分享按钮被点击');
          this.handleShare();
        });
      } else if (text.includes('浏览共享')) {
        this.log('为浏览按钮添加事件监听器');
        button.addEventListener('click', () => {
          this.log('浏览按钮被点击');
          this.handleBrowse();
        });
      }
    });
    
    this.log('事件监听器添加完成');
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    this.log('handleLogin 被调用');
    try {
      this.showFeedback('正在打开登录页面...', 'info');
      
      // 打开网站主页，登录按钮在右上角
      const loginUrl = this.config.currentApiUrl;
      Zotero.launchURL(loginUrl);
      this.log('已打开网站主页，请点击右上角登录按钮');
      
      // 提示用户完成登录后刷新
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
      this.log('开始登出流程...');
      
      // 清除本地存储
      Zotero.Prefs.clear('researchopia.userInfo');
      this.state.isAuthenticated = false;
      this.state.userInfo = null;
      
      // 尝试清除网站cookie（通过API）
      if (this.config.currentApiUrl) {
        try {
          await this.makeApiRequest('/api/auth/logout');
          this.log('已请求网站清除认证信息');
        } catch (e) {
          this.log('清除网站认证信息失败: ' + e.message);
        }
      }
      
      this.updateStatusDisplay();
      this.showFeedback('已安全登出', 'success');
      this.log('登出完成');
    } catch (error) {
      this.log('登出处理失败: ' + error.message);
      this.showFeedback('登出失败: ' + error.message, 'error');
    }
  },

  /**
   * 刷新状态
   */
  async refreshStatus() {
    try {
      this.showFeedback('正在刷新状态...', 'info');
      this.log('手动刷新状态开始...');
      
      // 重新检测端口
      await this.detectAvailablePorts();
      this.log('端口检测完成: ' + this.config.currentApiUrl);
      
      // 重新检查认证状态
      await this.checkAuthenticationStatus();
      
      // 更新界面状态显示
      this.updateStatusDisplay();
      
      // 显示最终状态
      const statusText = this.state.isAuthenticated ? 
        `已登录: ${this.state.userInfo?.name || '用户'}` : 
        '未登录';
      this.showFeedback(`状态已刷新 - ${statusText}`, 'success');
      
      this.log('手动刷新状态完成: ' + statusText);
    } catch (error) {
      this.log('刷新状态失败: ' + error.message);
      this.showFeedback('刷新失败: ' + error.message, 'error');
    }
  },

  /**
   * 更新状态显示
   */
  updateStatusDisplay() {
    try {
      this.log(`状态更新: 在线=${this.state.isOnline}, 认证=${this.state.isAuthenticated}, 端口=${this.config.currentApiUrl}`);
      
      // 触发界面重新渲染，让界面根据最新状态重新绘制
      if (this.registeredSection) {
        try {
          Zotero.Notifier.trigger('refresh', 'itempane', [], {});
          this.log('已触发界面重新渲染');
        } catch (e) {
          this.log('触发界面刷新失败: ' + e.message);
        }
      }
    } catch (error) {
      this.log('更新状态显示失败: ' + error.message);
    }
  },

  /**
   * 处理同步
   */
  async handleSync() {
    this.log('handleSync 被调用');
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录以使用同步功能', 'warning');
        return;
      }
      
      this.showFeedback('同步功能开发中，敬请期待...', 'info');
    } catch (error) {
      this.log('同步处理失败: ' + error.message);
      this.showFeedback('同步失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理分享
   */
  async handleShare() {
    this.log('handleShare 被调用');
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录以使用分享功能', 'warning');
        return;
      }
      
      this.showFeedback('分享功能开发中，敬请期待...', 'info');
    } catch (error) {
      this.log('分享处理失败: ' + error.message);
      this.showFeedback('分享失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理浏览
   */
  async handleBrowse() {
    this.log('handleBrowse 被调用');
    try {
      const doi = this.extractDOI(this.state.currentItem);
      if (doi) {
        const webUrl = `${this.config.currentApiUrl}/papers/${doi}`;
        Zotero.launchURL(webUrl);
        this.showFeedback('正在打开浏览器...', 'info');
      } else {
        this.showFeedback('此文献没有DOI，无法浏览', 'warning');
      }
    } catch (error) {
      this.log('浏览处理失败: ' + error.message);
      this.showFeedback('浏览失败: ' + error.message, 'error');
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
   * 启动定期状态检查
   */
  startStatusCheck() {
    // 清除现有定时器
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    
    // 每30秒检查一次状态（更频繁的安全检查）
    this.statusCheckInterval = setInterval(() => {
      this.log('定期状态检查...');
      this.checkAuthenticationStatus();
    }, 30000);
    
    this.log('定期状态检查已启动（每30秒）');
  },

  /**
   * 强制安全清理
   */
  forceSecurityCleanup() {
    this.log('🔒 执行强制安全清理...');
    
    // 清除所有本地存储
    Zotero.Prefs.clear('researchopia.userInfo');
    
    // 重置状态
    this.state.isAuthenticated = false;
    this.state.userInfo = null;
    
    // 更新界面
    this.updateStatusDisplay();
    
    this.log('🔒 安全清理完成');
    this.showFeedback('已执行安全清理', 'info');
  },

  /**
   * 停止定期状态检查
   */
  stopStatusCheck() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
      this.log('定期状态检查已停止');
    }
  },

  /**
   * 插件关闭清理
   */
  shutdown() {
    this.log('插件正在关闭...');
    this.stopStatusCheck();
    this.log('插件已关闭');
  },

  /**
   * 发送API请求
   */
  async makeApiRequest(endpoint) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;
      
      xhr.onload = () => {
        try {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        } catch (e) {
          reject(new Error('解析响应失败: ' + e.message));
        }
      };
      
      xhr.onerror = () => reject(new Error('网络请求失败'));
      xhr.ontimeout = () => reject(new Error('请求超时'));
      
      try {
        const url = `${this.config.currentApiUrl}${endpoint}`;
        this.log('发送API请求: ' + url);
        xhr.open('GET', url, true);
        xhr.send();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * 显示反馈
   */
  showFeedback(message, type = 'info') {
    this.log(`反馈 [${type}]: ${message}`);
    
    // 使用Zotero的提示系统
    try {
      // 尝试使用Zotero的提示框
      if (typeof Zotero.Alert === 'function') {
        Zotero.Alert(message, '研学港');
      } else if (typeof alert === 'function') {
        alert(`研学港: ${message}`);
      } else {
        // 如果都不可用，只记录日志
        this.log(`用户反馈 [${type}]: ${message}`);
      }
    } catch (e) {
      this.log('显示反馈失败: ' + e.message);
    }
  }
};

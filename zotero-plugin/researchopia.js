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
    apiPorts: [3002, 3001, 3000, 3003, 3004, 3005, 3006, 3007, 3008, 3009],
    currentApiUrl: null,
    timeout: 10000,
    // 优先使用在线网站，避免localhost问题
    authPageUrl: 'https://www.researchopia.com/plugin/auth',
    apiUrl: 'https://www.researchopia.com/api',
    localAuthPageUrl: 'http://localhost:3001/plugin/auth',
    useOnlineFirst: true // 新增：优先使用在线服务
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

    // 初始化iframe认证系统
    this.initIframeAuth();

    // 异步初始化其他组件
    this.initializeAsync();
  },

  /**
   * 异步初始化
   */
  async initializeAsync() {
    try {
      this.log('🔄 开始异步初始化...');

      // 检测可用端口
      await this.detectAvailablePorts();
      this.log('✅ 端口检测完成: ' + (this.config.currentApiUrl || '未找到'));

      // 注册Item Pane部分
      this.registerItemPaneSection();

      // 检查认证状态（作为备用）
      await this.checkAuthenticationStatus();

      // 启动定期状态检查
      this.startStatusCheck();

      this.log('🎉 异步初始化完成');
    } catch (error) {
      this.log('❌ 异步初始化失败: ' + error.message);

      // 即使初始化失败，也要注册Item Pane部分
      try {
        this.registerItemPaneSection();
      } catch (registerError) {
        this.log('❌ 注册Item Pane失败: ' + registerError.message);
      }
    }
  },

  /**
   * 检测可用端口
   */
  async detectAvailablePorts() {
    this.log('正在检测可用端口...');

    for (const port of this.config.apiPorts) {
      try {
        this.log(`正在测试端口 ${port}...`);
        const isAvailable = await this.testPortAvailability(port);
        if (isAvailable) {
          this.config.currentApiUrl = `http://localhost:${port}`;
          this.log(`✅ 检测到可用端口: ${port}`);
          this.state.isOnline = true;

          // 立即测试认证状态API是否可用
          try {
            const testResponse = await this.makeApiRequest('/api/auth/status');
            this.log(`✅ 端口 ${port} 认证API测试成功`);
            return;
          } catch (apiError) {
            this.log(`⚠️ 端口 ${port} 可用但认证API测试失败: ${apiError.message}`);
            // 继续使用这个端口，可能是认证问题而不是连接问题
            return;
          }
        }
      } catch (error) {
        this.log(`❌ 端口 ${port} 检测失败: ${error.message}`);
      }
    }

    this.log('❌ 未找到可用端口');
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
        xhr.open('GET', `http://localhost:${port}/api/auth/status`, true);
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
      this.log('🔍 开始检查认证状态...');
      this.log('当前API URL: ' + (this.config.currentApiUrl || '未设置'));
      this.log('在线状态: ' + this.state.isOnline);

      // 首先检查本地存储的用户信息
      const localUserInfo = Zotero.Prefs.get('researchopia.userInfo', null);
      this.log('本地存储用户信息: ' + (localUserInfo ? `${localUserInfo.name} (${localUserInfo.authMethod || '未知方式'})` : '无'));

      // 然后尝试从网站API获取最新状态
      const apiUrl = this.config.useOnlineFirst ? this.config.apiUrl : this.config.currentApiUrl;
      if (apiUrl) {
        try {
          this.log('🌐 正在从网站API检查认证状态...');
          this.log('请求URL: ' + apiUrl + '/auth/status');
          this.log('使用在线API: ' + this.config.useOnlineFirst);

          // 使用在线API或本地API
          const response = await this.checkOnlineAuthStatus(apiUrl);
          this.log('📥 API响应: ' + JSON.stringify(response, null, 2));

          if (response && response.authenticated) {
            this.state.isAuthenticated = true;
            this.state.userInfo = {
              name: response.user?.name || response.user?.username || '用户',
              email: response.user?.email || '',
              token: response.token || 'test-token',
              id: response.user?.id || 'unknown',
              authMethod: response.authMethod || 'unknown'
            };

            // 保存到本地存储
            Zotero.Prefs.set('researchopia.userInfo', this.state.userInfo);

            const authMethodText = response.authMethod === 'supabase' ? 'Supabase认证' :
                                 response.authMethod === 'dev' ? '开发认证' : '未知认证';
            this.log(`✅ 从网站API获取认证状态成功: ${this.state.userInfo.name} (${authMethodText})`);
            this.log(`✅ 用户详细信息: ID=${this.state.userInfo.id}, Email=${this.state.userInfo.email}`);
            this.showFeedback(`已同步网站登录状态 (${authMethodText})`, 'success');
          } else {
            this.state.isAuthenticated = false;
            this.state.userInfo = null;
            this.log('❌ 网站API显示用户未认证');
            this.log('API响应详情: ' + JSON.stringify(response, null, 2));

            // 检查是否是网络问题还是认证问题
            if (response) {
              this.log('⚠️ API响应正常但用户未认证');
              this.log('可能原因: 浏览器中未登录或cookie未正确传递');
            } else {
              this.log('⚠️ API响应为空，可能是网络问题');
            }

            // 立即清除本地存储（安全措施）
            Zotero.Prefs.clear('researchopia.userInfo');
            this.log('🔒 已清除本地存储的用户信息（安全措施）');

            if (response && response.error) {
              this.showFeedback(`网站未登录: ${response.error}`, 'warning');
            } else {
              this.showFeedback('网站未登录，请在浏览器中登录研学港', 'warning');
            }
          }
        } catch (apiError) {
          this.log('❌ 从网站API检查认证状态失败: ' + apiError.message);

          // 如果API失败，回退到本地存储
          if (localUserInfo && localUserInfo.token) {
            this.state.isAuthenticated = true;
            this.state.userInfo = localUserInfo;
            this.log('⚠️ 使用本地存储的认证信息: ' + localUserInfo.name);
            this.showFeedback('使用本地登录信息（网络连接失败）', 'warning');
          } else {
            this.state.isAuthenticated = false;
            this.state.userInfo = null;
            this.log('❌ 本地存储中无认证信息');

            // 提供更具体的错误信息
            if (apiError.message.includes('认证失败')) {
              this.showFeedback('请在浏览器中登录研学港网站', 'info');
            } else if (apiError.message.includes('网络请求失败')) {
              this.showFeedback('网络连接失败，请检查服务器状态', 'error');
            } else {
              this.showFeedback('未登录，请点击登录按钮', 'info');
            }
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

    // 认证区域 - 使用iframe
    const authArea = container.ownerDocument.createElement('div');
    authArea.style.cssText = `
      margin: 16px 0;
    `;

    // 创建加载提示
    const loadingDiv = container.ownerDocument.createElement('div');
    loadingDiv.style.cssText = 'padding: 20px; text-align: center; color: #6c757d; border: 1px solid #dee2e6; border-radius: 6px; background: #f8f9fa;';
    loadingDiv.innerHTML = `
      <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <p style="margin: 10px 0 0 0;">正在初始化认证系统...</p>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    authArea.appendChild(loadingDiv);

    // 创建认证iframe（异步）
    this.createAuthIframe(container).then(authIframe => {
      // 移除加载提示
      if (loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
      }
      authArea.appendChild(authIframe);
    }).catch(error => {
      this.log('❌ 创建认证iframe失败: ' + error.message);

      // 移除加载提示
      if (loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
      }

      const errorDiv = container.ownerDocument.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #dc3545; border: 1px solid #f5c6cb; border-radius: 6px; background: #f8d7da;';
      errorDiv.innerHTML = `
        <p>认证系统初始化失败</p>
        <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">重试</button>
      `;
      authArea.appendChild(errorDiv);
    });

    // 传统认证状态显示（作为备用）
    const userArea = container.ownerDocument.createElement('div');
    userArea.style.cssText = `
      margin: 16px 0;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e1e5e9;
      display: none;
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

      const authMethod = container.ownerDocument.createElement('div');
      const authMethodText = this.state.userInfo.authMethod === 'supabase' ? 'Supabase认证' :
                            this.state.userInfo.authMethod === 'dev' ? '开发认证' : '未知认证';
      authMethod.textContent = authMethodText;
      authMethod.style.cssText = 'font-size: 11px; color: #28a745; font-weight: 500;';

      userDetails.appendChild(userName);
      userDetails.appendChild(userEmail);
      userDetails.appendChild(authMethod);
      
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
      
      const buttonContainer = container.ownerDocument.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';

      const loginBtn = container.ownerDocument.createElement('button');
      loginBtn.id = 'login-btn';
      loginBtn.textContent = '登录';
      loginBtn.style.cssText = 'background: #28a745; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s; flex: 1;';

      const syncStatusBtn = container.ownerDocument.createElement('button');
      syncStatusBtn.id = 'sync-status-btn';
      syncStatusBtn.textContent = '同步状态';
      syncStatusBtn.style.cssText = 'background: #007bff; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s; flex: 1;';

      buttonContainer.appendChild(loginBtn);
      buttonContainer.appendChild(syncStatusBtn);

      loginDiv.appendChild(loginText);
      loginDiv.appendChild(buttonContainer);
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
    container.appendChild(authArea);
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

    // 同步状态按钮
    const syncStatusBtn = container.querySelector('#sync-status-btn');
    if (syncStatusBtn) {
      this.log('找到同步状态按钮，添加事件监听器');
      syncStatusBtn.addEventListener('click', () => {
        this.log('同步状态按钮被点击');
        this.handleSyncStatus();
      });
    } else {
      this.log('未找到同步状态按钮');
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
   * 处理同步状态
   */
  async handleSyncStatus() {
    try {
      this.log('🔄 同步状态按钮被点击，开始处理...');
      this.showFeedback('正在同步登录状态...', 'info');
      this.log('🔄 开始同步登录状态...');

      // 显示当前状态
      this.log('当前认证状态: ' + this.state.isAuthenticated);
      this.log('当前用户信息: ' + JSON.stringify(this.state.userInfo, null, 2));
      this.log('当前API URL: ' + this.config.currentApiUrl);
      this.log('当前在线状态: ' + this.state.isOnline);

      // 测试cookie获取方法
      this.testCookieMethods();

      // 重新检测端口
      this.log('🔍 开始重新检测端口...');
      await this.detectAvailablePorts();
      this.log('✅ 端口检测完成: ' + this.config.currentApiUrl);
      this.log('✅ 在线状态: ' + this.state.isOnline);

      // 重新检查认证状态 - 优先使用iframe
      this.log('🔍 开始重新检查认证状态...');

      // 首先尝试从iframe获取认证状态
      const iframeSuccess = this.requestAuthStatus();
      if (iframeSuccess) {
        this.log('✅ 已向iframe请求认证状态，等待响应...');
        // 给iframe一些时间响应
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        this.log('⚠️ iframe认证不可用，使用传统方法...');
        await this.checkAuthenticationStatus();
      }

      this.log('✅ 认证状态检查完成');
      this.log('最新认证状态: ' + this.state.isAuthenticated);
      this.log('最新用户信息: ' + JSON.stringify(this.state.userInfo, null, 2));

      // 更新界面状态显示
      this.log('🔄 开始更新界面显示...');
      this.updateStatusDisplay();
      this.log('✅ 界面显示更新完成');

      // 显示最终状态
      const statusText = this.state.isAuthenticated ?
        `已同步登录状态: ${this.state.userInfo?.name || '用户'} (${this.state.userInfo?.authMethod || '未知认证'})` :
        '未检测到登录状态，请确保已在浏览器中登录研学港网站';

      this.showFeedback(statusText, this.state.isAuthenticated ? 'success' : 'warning');
      this.log('🎉 同步登录状态完成: ' + statusText);

      // 如果仍未认证，提供额外的调试信息
      if (!this.state.isAuthenticated) {
        this.log('⚠️ 同步后仍未认证，可能的原因：');
        this.log('  1. 浏览器中未登录研学港网站');
        this.log('  2. 浏览器cookie未正确传递到插件');
        this.log('  3. 服务器未运行或端口不匹配');
        this.log('  4. CORS配置问题');
        this.showFeedback('提示：请确保在浏览器中已登录研学港网站，然后重试', 'info');
      }

    } catch (error) {
      this.log('❌ 同步登录状态失败: ' + error.message);
      this.log('❌ 错误堆栈: ' + error.stack);
      this.showFeedback('同步失败: ' + error.message, 'error');
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
   * 尝试通过文件系统同步认证状态
   */
  async tryFileSystemSync() {
    try {
      this.log('🔄 尝试通过文件系统同步认证状态...');

      // 尝试读取浏览器的cookie文件或本地存储
      // 这是一个备用方案，当XMLHttpRequest无法传递cookie时使用

      // 方案1: 尝试创建一个临时API端点来获取认证状态
      const tempResponse = await this.makeApiRequest('/api/auth/status', {
        headers: {
          'X-Sync-Request': 'true',
          'X-Zotero-Plugin': 'researchopia'
        }
      });

      if (tempResponse && tempResponse.authenticated) {
        this.log('✅ 通过特殊请求头获取到认证状态');
        return tempResponse;
      }

      this.log('⚠️ 文件系统同步未成功');
      return null;
    } catch (error) {
      this.log('❌ 文件系统同步失败: ' + error.message);
      return null;
    }
  },

  /**
   * 尝试多种方式获取认证状态
   */
  async tryMultipleAuthMethods() {
    this.log('🔄 尝试多种认证状态获取方式...');

    // 方法1: 标准XMLHttpRequest with withCredentials
    try {
      this.log('方法1: 标准XMLHttpRequest with withCredentials');
      const response1 = await this.makeApiRequest('/api/auth/status');
      if (response1 && response1.authenticated) {
        this.log('✅ 方法1成功');
        return response1;
      }
    } catch (error) {
      this.log('❌ 方法1失败: ' + error.message);
    }

    // 方法2: 带特殊请求头的请求
    try {
      this.log('方法2: 带特殊请求头的请求');
      const response2 = await this.tryFileSystemSync();
      if (response2 && response2.authenticated) {
        this.log('✅ 方法2成功');
        return response2;
      }
    } catch (error) {
      this.log('❌ 方法2失败: ' + error.message);
    }

    // 方法3: 检查本地存储是否有有效的认证信息
    try {
      this.log('方法3: 检查本地存储认证信息');
      const localUserInfo = Zotero.Prefs.get('researchopia.userInfo', null);
      if (localUserInfo && typeof localUserInfo === 'object') {
        // 验证本地存储的信息是否仍然有效
        const testResponse = await this.makeApiRequest('/api/auth/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: localUserInfo.id,
            token: localUserInfo.token
          })
        });

        if (testResponse && testResponse.valid) {
          this.log('✅ 方法3成功 - 本地认证信息有效');
          return {
            authenticated: true,
            authMethod: localUserInfo.authMethod || 'local',
            user: localUserInfo,
            token: localUserInfo.token
          };
        }
      }
    } catch (error) {
      this.log('❌ 方法3失败: ' + error.message);
    }

    this.log('❌ 所有认证方法都失败了');
    return null;
  },

  /**
   * 初始化iframe认证
   */
  initIframeAuth() {
    this.log('🔧 初始化iframe认证系统...');

    // 在Zotero环境中，我们将通过iframe的onload事件来处理认证
    // 而不是依赖window.postMessage
    this.log('✅ iframe认证系统初始化完成（使用简化模式）');
  },

  /**
   * 处理来自认证iframe的消息
   */
  handleAuthMessage(event) {
    try {
      const data = event.data;

      // 验证消息来源和格式
      if (data && data.type === 'AUTH_STATUS_RESPONSE' && data.source === 'researchopia-auth') {
        this.log('📨 收到认证状态消息: ' + JSON.stringify(data, null, 2));

        if (data.authenticated && data.user) {
          // 更新认证状态
          this.state.isAuthenticated = true;
          this.state.userInfo = {
            name: data.user.name || '用户',
            email: data.user.email || '',
            token: data.token || 'iframe-token',
            id: data.user.id || 'unknown',
            authMethod: 'iframe'
          };

          // 保存到本地存储
          Zotero.Prefs.set('researchopia.userInfo', this.state.userInfo);

          this.log('✅ iframe认证成功: ' + this.state.userInfo.name);
          this.showFeedback('已同步网站登录状态 (iframe认证)', 'success');
        } else {
          // 清除认证状态
          this.state.isAuthenticated = false;
          this.state.userInfo = null;

          // 清除本地存储
          Zotero.Prefs.clear('researchopia.userInfo');

          this.log('❌ iframe显示用户未认证');
          this.showFeedback('网站未登录', 'warning');
        }

        // 更新界面
        this.updateStatusDisplay();
      }
    } catch (error) {
      this.log('❌ 处理认证消息失败: ' + error.message);
    }
  },

  /**
   * 请求认证状态（向iframe发送消息）
   */
  requestAuthStatus() {
    try {
      this.log('📤 向iframe请求认证状态...');

      // 查找认证iframe
      const authIframe = document.querySelector('#researchopia-auth-iframe');
      if (authIframe && authIframe.contentWindow) {
        const message = {
          type: 'REQUEST_AUTH_STATUS',
          source: 'zotero-plugin'
        };

        authIframe.contentWindow.postMessage(message, '*');
        this.log('✅ 认证状态请求已发送');
        return true;
      } else {
        this.log('❌ 未找到认证iframe');
        return false;
      }
    } catch (error) {
      this.log('❌ 请求认证状态失败: ' + error.message);
      return false;
    }
  },

  /**
   * 创建认证iframe
   */
  async createAuthIframe(container) {
    try {
      this.log('🔧 创建认证iframe...');

      // 确保已经检测到可用端口
      if (!this.config.currentApiUrl) {
        this.log('⚠️ 尚未检测到可用API端口，开始检测...');
        await this.detectAvailablePorts();
      }

      const iframeContainer = container.ownerDocument.createElement('div');
      iframeContainer.style.cssText = `
        margin: 16px 0;
        border: 1px solid #e1e5e9;
        border-radius: 6px;
        overflow: hidden;
        background: #f8f9fa;
      `;

      const iframe = container.ownerDocument.createElement('iframe');
      iframe.id = 'researchopia-auth-iframe';
      iframe.style.cssText = `
        width: 100%;
        height: 350px;
        border: none;
        display: block;
      `;

      // 优先使用在线网站，避免localhost问题
      let authUrl;
      if (this.config.useOnlineFirst) {
        // 优先使用在线网站认证页面
        authUrl = this.config.authPageUrl;
        this.log('🌐 使用在线认证页面: ' + authUrl);
      } else if (this.config.currentApiUrl) {
        // 如果检测到本地API服务器，动态构建本地认证页面URL
        authUrl = this.config.currentApiUrl + '/plugin/auth';
        this.log('🏠 使用本地认证页面: ' + authUrl);
      } else {
        // 否则使用生产环境认证页面
        authUrl = this.config.authPageUrl;
        this.log('🌐 使用生产环境认证页面: ' + authUrl);
      }

      iframe.src = authUrl;
      this.log('🌐 iframe URL: ' + authUrl);

      // iframe加载完成后的处理
      iframe.onload = () => {
        this.log('✅ 认证iframe加载完成');
        this.log('ℹ️ 用户可以在iframe中进行登录操作');

        // 在iframe加载完成后，启动定期检查认证状态
        setTimeout(() => {
          this.log('🔄 开始定期检查认证状态...');
          this.checkAuthenticationStatus();
        }, 2000);
      };

      iframe.onerror = (error) => {
        this.log('❌ 认证iframe加载失败: ' + JSON.stringify(error));
        this.log('❌ 尝试加载的URL: ' + authUrl);
        this.log('❌ 当前API URL: ' + (this.config.currentApiUrl || '未设置'));

        iframeContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #dc3545;">
            <p>认证页面加载失败</p>
            <p style="font-size: 12px; margin-top: 8px;">URL: ${authUrl}</p>
            <p style="font-size: 12px; margin-top: 4px;">请检查网络连接或服务器状态</p>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">重试</button>
          </div>
        `;
      };

      iframeContainer.appendChild(iframe);
      return iframeContainer;
    } catch (error) {
      this.log('❌ 创建认证iframe失败: ' + error.message);

      // 返回错误提示
      const errorDiv = container.ownerDocument.createElement('div');
      errorDiv.style.cssText = 'padding: 20px; text-align: center; color: #dc3545; border: 1px solid #f5c6cb; border-radius: 6px; background: #f8d7da;';
      errorDiv.innerHTML = `
        <p>认证系统初始化失败</p>
        <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
      `;
      return errorDiv;
    }
  },

  /**
   * 测试cookie获取方法
   */
  testCookieMethods() {
    this.log('🍪 测试各种cookie获取方法:');

    // 方法1: Zotero.HTTP
    try {
      if (typeof Zotero.HTTP !== 'undefined') {
        this.log('  Zotero.HTTP 可用: true');
        if (Zotero.HTTP.getCookies) {
          const cookies1 = Zotero.HTTP.getCookies('localhost');
          this.log('  Zotero.HTTP.getCookies结果: ' + JSON.stringify(cookies1));
        } else {
          this.log('  Zotero.HTTP.getCookies 不可用');
        }
      } else {
        this.log('  Zotero.HTTP 不可用');
      }
    } catch (e) {
      this.log('  Zotero.HTTP 测试失败: ' + e.message);
    }

    // 方法2: document.cookie
    try {
      if (typeof document !== 'undefined') {
        this.log('  document 可用: true');
        this.log('  document.cookie: ' + (document.cookie || '空'));
      } else {
        this.log('  document 不可用');
      }
    } catch (e) {
      this.log('  document.cookie 测试失败: ' + e.message);
    }

    // 方法3: 本地存储
    try {
      const localUserInfo = Zotero.Prefs.get('researchopia.userInfo', null);
      this.log('  本地存储用户信息: ' + JSON.stringify(localUserInfo));
    } catch (e) {
      this.log('  本地存储测试失败: ' + e.message);
    }

    // 方法4: 手动构造cookie
    try {
      const manualCookie = this.getManualAuthCookie();
      this.log('  手动构造cookie: ' + (manualCookie || '无'));
    } catch (e) {
      this.log('  手动构造cookie失败: ' + e.message);
    }
  },

  /**
   * 尝试获取浏览器cookie
   */
  async getBrowserCookies() {
    try {
      // 尝试从Zotero的HTTP模块获取cookie
      if (typeof Zotero.HTTP !== 'undefined' && Zotero.HTTP.getCookies) {
        const cookies = Zotero.HTTP.getCookies('localhost');
        this.log('从Zotero.HTTP获取到的cookies: ' + JSON.stringify(cookies));
        return cookies;
      }

      // 尝试从浏览器获取cookie（如果可用）
      if (typeof document !== 'undefined' && document.cookie) {
        this.log('从document.cookie获取到的cookies: ' + document.cookie);
        return document.cookie;
      }

      this.log('无法获取浏览器cookies');
      return null;
    } catch (error) {
      this.log('获取浏览器cookies失败: ' + error.message);
      return null;
    }
  },

  /**
   * 手动构造认证cookie
   */
  getManualAuthCookie() {
    // 尝试从本地存储获取用户信息来构造cookie
    const localUserInfo = Zotero.Prefs.get('researchopia.userInfo', null);
    if (localUserInfo && typeof localUserInfo === 'object') {
      try {
        const userInfo = {
          username: localUserInfo.name || 'user',
          id: localUserInfo.id || 'unknown',
          email: localUserInfo.email || ''
        };
        const cookieValue = encodeURIComponent(JSON.stringify(userInfo));
        const authCookie = `rp_dev_auth=1; rp_dev_user=${cookieValue}`;
        this.log('构造的认证cookie: ' + authCookie);
        return authCookie;
      } catch (error) {
        this.log('构造认证cookie失败: ' + error.message);
      }
    }
    return null;
  },

  /**
   * 检查在线认证状态
   */
  async checkOnlineAuthStatus(apiUrl) {
    try {
      this.log('🌐 检查在线认证状态...');

      // 使用fetch API，避免XMLHttpRequest的问题
      const response = await fetch(`${apiUrl}/auth/status`, {
        method: 'GET',
        credentials: 'include', // 包含cookies
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Zotero-Plugin-Researchopia/1.0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.log('✅ 在线认证状态检查成功');
        return data;
      } else {
        this.log(`❌ 在线认证状态检查失败: ${response.status}`);
        return null;
      }
    } catch (error) {
      this.log(`❌ 在线认证状态检查异常: ${error.message}`);
      return null;
    }
  },

  /**
   * 发送API请求
   */
  async makeApiRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.timeout = 5000;

      xhr.onload = () => {
        try {
          this.log(`📥 API响应状态: ${xhr.status} ${xhr.statusText}`);
          this.log(`📥 响应内容: ${xhr.responseText}`);

          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            this.log(`✅ API请求成功，解析响应: ${JSON.stringify(response, null, 2)}`);
            resolve(response);
          } else if (xhr.status === 401) {
            // 认证失败，提供更详细的错误信息
            this.log(`❌ 认证失败 (401): ${xhr.responseText}`);
            reject(new Error('认证失败：请确保已在浏览器中登录研学港网站'));
          } else if (xhr.status === 403) {
            this.log(`❌ 访问被拒绝 (403): ${xhr.responseText}`);
            reject(new Error('访问被拒绝：请检查权限设置'));
          } else {
            this.log(`❌ HTTP错误 (${xhr.status}): ${xhr.responseText}`);
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        } catch (e) {
          this.log(`❌ 解析响应失败: ${e.message}, 原始响应: ${xhr.responseText}`);
          reject(new Error('解析响应失败: ' + e.message));
        }
      };

      xhr.onerror = () => reject(new Error('网络请求失败：请检查网络连接和服务器状态'));
      xhr.ontimeout = () => reject(new Error('请求超时：服务器响应时间过长'));

      try {
        const url = `${this.config.currentApiUrl}${endpoint}`;
        const method = options.method || 'GET';

        this.log(`🌐 发送API请求:`);
        this.log(`  URL: ${url}`);
        this.log(`  Method: ${method}`);
        this.log(`  Timeout: ${xhr.timeout}ms`);

        // 在open()之前设置withCredentials
        xhr.withCredentials = true;
        this.log(`  withCredentials: ${xhr.withCredentials}`);

        xhr.open(method, url, true);

        // 设置请求头
        const headers = options.headers || {};

        // 尝试手动设置cookie来绕过CookieSandbox
        if (!headers['Cookie']) {
          // 首先尝试获取浏览器cookie（同步方式）
          try {
            let browserCookies = null;

            // 尝试从Zotero的HTTP模块获取cookie
            if (typeof Zotero.HTTP !== 'undefined' && Zotero.HTTP.getCookies) {
              browserCookies = Zotero.HTTP.getCookies('localhost');
              this.log('从Zotero.HTTP获取到的cookies: ' + JSON.stringify(browserCookies));
            }

            // 尝试从document获取cookie
            if (!browserCookies && typeof document !== 'undefined' && document.cookie) {
              browserCookies = document.cookie;
              this.log('从document.cookie获取到的cookies: ' + browserCookies);
            }

            if (browserCookies) {
              headers['Cookie'] = browserCookies;
              this.log('  使用浏览器cookies');
            } else {
              // 如果无法获取浏览器cookie，尝试构造认证cookie
              const manualCookie = this.getManualAuthCookie();
              if (manualCookie) {
                headers['Cookie'] = manualCookie;
                this.log('  使用手动构造的认证cookie');
              } else {
                this.log('  无可用的认证cookie');
              }
            }
          } catch (cookieError) {
            this.log('  获取cookie时出错: ' + cookieError.message);
          }
        }

        if (Object.keys(headers).length > 0) {
          this.log(`  Headers: ${JSON.stringify(headers, null, 2)}`);
          Object.keys(headers).forEach(key => {
            try {
              xhr.setRequestHeader(key, headers[key]);
            } catch (headerError) {
              this.log(`  设置请求头失败 ${key}: ${headerError.message}`);
            }
          });
        } else {
          this.log(`  Headers: 无自定义头部`);
        }

        // 发送请求体（如果有）
        const body = options.body || null;
        if (body) {
          this.log(`  Body: ${body}`);
        } else {
          this.log(`  Body: 无请求体`);
        }

        this.log(`🚀 正在发送请求...`);
        xhr.send(body);
      } catch (error) {
        this.log(`❌ 发送请求时出错: ${error.message}`);
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

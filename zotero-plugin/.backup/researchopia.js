/*
 * 研学港 Zotero插件 - 修复版
 * Fixed Researchopia Zotero Plugin
 */

Zotero.Researchopia = {
  id: null,
  version: null,
  rootURI: null,
  initialized: false,
  registeredSection: null,
  
  // 配置
  config: {
    // 支持多个端口，自动检测可用端口
    apiPorts: [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009],
    currentApiUrl: null,
    maxRetries: 3,
    timeout: 10000
  },

  // 状态管理
  state: {
    isOnline: false,
    isAuthenticated: false,
    userInfo: null,
    currentItem: null,
    annotations: [],
    sharedAnnotations: []
  },

  init({ id, version, rootURI }) {
    if (this.initialized) return;
    
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.initialized = true;

    // 加载配置
    this.loadConfig();
    
    // 检测可用端口
    this.detectAvailablePorts();
    
    // 注册Item Pane部分
    this.registerItemPaneSection();
    
    // 初始化认证状态
    this.checkAuthenticationStatus();

    this.log('Fixed Researchopia plugin initialized successfully');
  },

  /**
   * 加载配置
   */
  loadConfig() {
    try {
      const savedConfig = Zotero.Prefs.get('researchopia.config', {});
      this.config = { ...this.config, ...savedConfig };
      this.log('Configuration loaded');
    } catch (error) {
      this.log('Failed to load config: ' + error.message);
    }
  },

  /**
   * 保存配置
   */
  saveConfig() {
    try {
      Zotero.Prefs.set('researchopia.config', this.config);
      this.log('Configuration saved');
    } catch (error) {
      this.log('Failed to save config: ' + error.message);
    }
  },

  /**
   * 检测可用端口
   */
  async detectAvailablePorts() {
    this.log('Detecting available ports...');
    
    for (const port of this.config.apiPorts) {
      try {
        const isAvailable = await this.testPortAvailability(port);
        if (isAvailable) {
          this.config.currentApiUrl = `http://localhost:${port}`;
          this.log(`Found available API port: ${port}`);
          this.state.isOnline = true;
          this.saveConfig();
          return;
        }
      } catch (error) {
        this.log(`Port ${port} not available: ${error.message}`);
      }
    }
    
    this.log('No available ports found, using default');
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
        // 验证token是否有效
        const isValid = await this.validateToken(userInfo.token);
        if (isValid) {
          this.state.isAuthenticated = true;
          this.state.userInfo = userInfo;
          this.log('User authenticated: ' + userInfo.name);
        } else {
          this.log('Token expired, clearing user info');
          Zotero.Prefs.clear('researchopia.userInfo');
          this.state.isAuthenticated = false;
          this.state.userInfo = null;
        }
      } else {
        this.state.isAuthenticated = false;
        this.state.userInfo = null;
      }
    } catch (error) {
      this.log('Failed to check authentication: ' + error.message);
      this.state.isAuthenticated = false;
    }
  },

  /**
   * 验证token
   */
  async validateToken(token) {
    try {
      const response = await this.makeRequest('/api/auth/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response && response.success;
    } catch (error) {
      return false;
    }
  },

  /**
   * 注册Item Pane部分
   */
  registerItemPaneSection() {
    try {
      if (!Zotero.ItemPaneManager) {
        throw new Error("Zotero.ItemPaneManager not available");
      }
      
      if (this.registeredSection) {
        this.log('Section already registered');
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

      this.log("Item Pane section registered successfully");
    } catch (error) {
      this.log("Failed to register Item Pane section: " + error.message);
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

      // 创建主界面
      this.createMainInterface(container, item);
      
      // 创建标注管理界面
      this.createAnnotationInterface(container, item);

      body.appendChild(container);

      // 初始化界面事件
      this.initializeInterfaceEvents(container, item);

      // 加载数据
      this.loadItemData(item);

      this.log('Item Pane rendered successfully');
    } catch (error) {
      this.log('Failed to render Item Pane: ' + error.message);
      body.innerHTML = '<div class="researchopia-error">界面渲染失败: ' + error.message + '</div>';
    }
  },

  /**
   * 创建主界面
   */
  createMainInterface(container, item) {
    const headerArea = container.ownerDocument.createElement('div');
    headerArea.className = 'researchopia-header';

    // 标题
    const title = container.ownerDocument.createElement('h3');
    title.textContent = '研学港 Researchopia';
    title.className = 'researchopia-title';

    const subtitle = container.ownerDocument.createElement('p');
    subtitle.textContent = '学术标注分享平台 - 增强版';
    subtitle.className = 'researchopia-subtitle';

    // 状态指示器
    const statusIndicator = container.ownerDocument.createElement('div');
    statusIndicator.className = 'status-indicator';
    statusIndicator.innerHTML = `
      <span class="status-dot ${this.state.isOnline ? 'online' : 'offline'}"></span>
      <span class="status-text">${this.state.isOnline ? '已连接' : '未连接'}</span>
      <span class="port-info">端口: ${this.config.currentApiUrl?.split(':').pop() || '未知'}</span>
    `;

    headerArea.appendChild(title);
    headerArea.appendChild(subtitle);
    headerArea.appendChild(statusIndicator);

    // 用户认证区域
    const userArea = container.ownerDocument.createElement('div');
    userArea.className = 'user-area';
    userArea.id = 'user-info-panel';
    
    if (this.state.isAuthenticated && this.state.userInfo) {
      userArea.innerHTML = `
        <div class="user-info">
          <div class="user-details">
            <div class="user-name">${this.state.userInfo.name}</div>
            <div class="user-email">${this.state.userInfo.email || ''}</div>
          </div>
          <button class="logout-btn" id="logout-btn">登出</button>
        </div>
      `;
    } else {
      userArea.innerHTML = `
        <div class="login-prompt">
          <p>请先登录以使用研学港功能</p>
          <button class="login-btn" id="login-btn">登录</button>
        </div>
      `;
    }

    // 快速操作按钮
    const quickActions = container.ownerDocument.createElement('div');
    quickActions.className = 'quick-actions';

    const syncBtn = container.ownerDocument.createElement('button');
    syncBtn.textContent = '🔄 同步标注';
    syncBtn.className = 'action-btn primary';
    syncBtn.id = 'sync-annotations-btn';
    syncBtn.disabled = !this.state.isAuthenticated;

    const shareBtn = container.ownerDocument.createElement('button');
    shareBtn.textContent = '📤 分享标注';
    shareBtn.className = 'action-btn';
    shareBtn.id = 'share-annotations-btn';
    shareBtn.disabled = !this.state.isAuthenticated;

    const browseBtn = container.ownerDocument.createElement('button');
    browseBtn.textContent = '🌐 浏览共享';
    browseBtn.className = 'action-btn';
    browseBtn.id = 'browse-shared-btn';
    browseBtn.disabled = !this.state.isAuthenticated;

    const refreshBtn = container.ownerDocument.createElement('button');
    refreshBtn.textContent = '🔄 刷新';
    refreshBtn.className = 'action-btn';
    refreshBtn.id = 'refresh-btn';

    quickActions.appendChild(syncBtn);
    quickActions.appendChild(shareBtn);
    quickActions.appendChild(browseBtn);
    quickActions.appendChild(refreshBtn);

    container.appendChild(headerArea);
    container.appendChild(userArea);
    container.appendChild(quickActions);
  },

  /**
   * 创建标注管理界面
   */
  createAnnotationInterface(container, item) {
    const annotationArea = container.ownerDocument.createElement('div');
    annotationArea.className = 'annotation-area';

    // 标签页
    const tabContainer = container.ownerDocument.createElement('div');
    tabContainer.className = 'tab-container';

    const tabButtons = container.ownerDocument.createElement('div');
    tabButtons.className = 'tab-buttons';

    const myAnnotationsTab = container.ownerDocument.createElement('button');
    myAnnotationsTab.textContent = '我的标注';
    myAnnotationsTab.className = 'tab-btn active';
    myAnnotationsTab.dataset.tab = 'my-annotations';

    const sharedAnnotationsTab = container.ownerDocument.createElement('button');
    sharedAnnotationsTab.textContent = '社区标注';
    sharedAnnotationsTab.className = 'tab-btn';
    sharedAnnotationsTab.dataset.tab = 'shared-annotations';

    tabButtons.appendChild(myAnnotationsTab);
    tabButtons.appendChild(sharedAnnotationsTab);

    // 标签页内容
    const tabContent = container.ownerDocument.createElement('div');
    tabContent.className = 'tab-content';

    // 我的标注标签页
    const myAnnotationsPanel = container.ownerDocument.createElement('div');
    myAnnotationsPanel.className = 'tab-panel active';
    myAnnotationsPanel.id = 'my-annotations-panel';
    myAnnotationsPanel.innerHTML = `
      <div class="panel-header">
        <h4>我的标注</h4>
        <div class="panel-actions">
          <button class="panel-btn" id="refresh-my-annotations">🔄 刷新</button>
        </div>
      </div>
      <div class="annotations-list" id="my-annotations-list">
        <div class="loading-indicator">正在加载标注...</div>
      </div>
    `;

    // 社区标注标签页
    const sharedAnnotationsPanel = container.ownerDocument.createElement('div');
    sharedAnnotationsPanel.className = 'tab-panel';
    sharedAnnotationsPanel.id = 'shared-annotations-panel';
    sharedAnnotationsPanel.innerHTML = `
      <div class="panel-header">
        <h4>社区标注</h4>
        <div class="panel-actions">
          <button class="panel-btn" id="refresh-shared-annotations">🔄 刷新</button>
        </div>
      </div>
      <div class="annotations-list" id="shared-annotations-list">
        <div class="loading-indicator">正在加载社区标注...</div>
      </div>
    `;

    tabContent.appendChild(myAnnotationsPanel);
    tabContent.appendChild(sharedAnnotationsPanel);

    tabContainer.appendChild(tabButtons);
    tabContainer.appendChild(tabContent);

    annotationArea.appendChild(tabContainer);
    container.appendChild(annotationArea);
  },

  /**
   * 初始化界面事件
   */
  initializeInterfaceEvents(container, item) {
    try {
      // 标签页切换
      const tabButtons = container.querySelectorAll('.tab-btn');
      const tabPanels = container.querySelectorAll('.tab-panel');

      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const targetTab = button.dataset.tab;
          
          // 更新按钮状态
          tabButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          // 更新面板状态
          tabPanels.forEach(panel => panel.classList.remove('active'));
          const targetPanel = container.querySelector(`#${targetTab}-panel`);
          if (targetPanel) {
            targetPanel.classList.add('active');
          }
        });
      });

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
      const refreshBtn = container.querySelector('#refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => this.refreshStatus());
      }

      // 同步标注按钮
      const syncBtn = container.querySelector('#sync-annotations-btn');
      if (syncBtn) {
        syncBtn.addEventListener('click', () => this.handleSyncAnnotations(item));
      }

      // 分享标注按钮
      const shareBtn = container.querySelector('#share-annotations-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => this.handleShareAnnotations(item));
      }

      // 浏览共享按钮
      const browseBtn = container.querySelector('#browse-shared-btn');
      if (browseBtn) {
        browseBtn.addEventListener('click', () => this.handleBrowseShared(item));
      }

      // 刷新我的标注按钮
      const refreshMyBtn = container.querySelector('#refresh-my-annotations');
      if (refreshMyBtn) {
        refreshMyBtn.addEventListener('click', () => this.loadMyAnnotations(item));
      }

      // 刷新社区标注按钮
      const refreshSharedBtn = container.querySelector('#refresh-shared-annotations');
      if (refreshSharedBtn) {
        refreshSharedBtn.addEventListener('click', () => this.loadSharedAnnotations(item));
      }

      this.log('Interface events initialized successfully');
    } catch (error) {
      this.log('Failed to initialize interface events: ' + error.message);
    }
  },

  /**
   * 加载项目数据
   */
  async loadItemData(item) {
    try {
      if (!item || !item.isRegularItem()) {
        this.log('No valid item selected');
        return;
      }

      // 检查是否有DOI
      const doi = this.extractDOI(item);
      if (!doi) {
        this.showFeedback('此文献没有DOI，无法使用研学港功能', 'warning');
        return;
      }

      // 加载我的标注
      await this.loadMyAnnotations(item);
      
      // 加载社区标注
      await this.loadSharedAnnotations(item);

    } catch (error) {
      this.log('Failed to load item data: ' + error.message);
    }
  },

  /**
   * 加载我的标注
   */
  async loadMyAnnotations(item) {
    try {
      const doi = this.extractDOI(item);
      if (!doi) return;

      const myAnnotationsList = document.querySelector('#my-annotations-list');
      if (!myAnnotationsList) return;

      myAnnotationsList.innerHTML = '<div class="loading-indicator">正在加载我的标注...</div>';

      // 获取Zotero中的标注
      const annotations = this.getZoteroAnnotations(item);
      
      if (annotations.length === 0) {
        myAnnotationsList.innerHTML = '<div class="no-data">暂无标注</div>';
        return;
      }

      // 显示标注
      this.renderAnnotations(myAnnotationsList, annotations, 'my');

    } catch (error) {
      this.log('Failed to load my annotations: ' + error.message);
      const myAnnotationsList = document.querySelector('#my-annotations-list');
      if (myAnnotationsList) {
        myAnnotationsList.innerHTML = '<div class="error-message">加载失败: ' + error.message + '</div>';
      }
    }
  },

  /**
   * 加载社区标注
   */
  async loadSharedAnnotations(item) {
    try {
      const doi = this.extractDOI(item);
      if (!doi) return;

      const sharedAnnotationsList = document.querySelector('#shared-annotations-list');
      if (!sharedAnnotationsList) return;

      sharedAnnotationsList.innerHTML = '<div class="loading-indicator">正在加载社区标注...</div>';

      if (!this.state.isAuthenticated) {
        sharedAnnotationsList.innerHTML = '<div class="no-data">请先登录以查看社区标注</div>';
        return;
      }

      // 从API获取共享标注
      const response = await this.makeRequest(`/api/v1/annotations?documentId=${doi}&visibility=public,shared`);
      
      if (response && response.success) {
        this.state.sharedAnnotations = response.data.annotations || [];
        this.renderAnnotations(sharedAnnotationsList, this.state.sharedAnnotations, 'shared');
      } else {
        sharedAnnotationsList.innerHTML = '<div class="no-data">暂无社区标注</div>';
      }

    } catch (error) {
      this.log('Failed to load shared annotations: ' + error.message);
      const sharedAnnotationsList = document.querySelector('#shared-annotations-list');
      if (sharedAnnotationsList) {
        sharedAnnotationsList.innerHTML = '<div class="error-message">加载失败: ' + error.message + '</div>';
      }
    }
  },

  /**
   * 渲染标注列表
   */
  renderAnnotations(container, annotations, type) {
    if (!annotations || annotations.length === 0) {
      container.innerHTML = '<div class="no-data">暂无标注</div>';
      return;
    }

    const annotationsHTML = annotations.map(annotation => {
      const isMyAnnotation = type === 'my';
      const authorName = isMyAnnotation ? '我' : (annotation.metadata?.author?.name || '匿名用户');
      const createdAt = new Date(annotation.createdAt).toLocaleString();
      
      return `
        <div class="annotation-item ${isMyAnnotation ? 'my-annotation' : 'shared-annotation'}">
          <div class="annotation-header">
            <div class="annotation-type">${this.getAnnotationTypeLabel(annotation.type)}</div>
            <div class="annotation-meta">
              <span class="author">${authorName}</span>
              <span class="date">${createdAt}</span>
            </div>
          </div>
          ${annotation.content?.text ? `<div class="annotation-text">"${annotation.content.text}"</div>` : ''}
          ${annotation.content?.comment ? `<div class="annotation-comment">${annotation.content.comment}</div>` : ''}
          ${!isMyAnnotation ? `
            <div class="annotation-actions">
              <button class="action-btn small" onclick="Zotero.Researchopia.likeAnnotation('${annotation.id}')">❤️ 点赞</button>
              <button class="action-btn small" onclick="Zotero.Researchopia.commentAnnotation('${annotation.id}')">💬 评论</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = annotationsHTML;
  },

  /**
   * 获取Zotero标注
   */
  getZoteroAnnotations(item) {
    try {
      const annotations = [];
      const childItems = item.getChildItems();
      
      for (const childItem of childItems) {
        if (childItem.isAnnotation()) {
          const annotation = {
            id: `zotero_${childItem.id}`,
            type: this.mapAnnotationType(childItem),
            content: {
              text: childItem.getField('annotationText') || '',
              comment: childItem.getField('annotationComment') || '',
              color: childItem.getField('annotationColor') || '#ffd400'
            },
            createdAt: childItem.dateAdded,
            metadata: {
              author: {
                name: this.state.userInfo?.name || '我',
                id: this.state.userInfo?.id || 'local'
              }
            }
          };
          annotations.push(annotation);
        }
      }
      
      return annotations;
    } catch (error) {
      this.log('Failed to get Zotero annotations: ' + error.message);
      return [];
    }
  },

  /**
   * 映射标注类型
   */
  mapAnnotationType(annotation) {
    const type = annotation.getField('annotationType');
    const typeMap = {
      'highlight': 'highlight',
      'underline': 'underline',
      'strikeout': 'strikeout',
      'note': 'note',
      'ink': 'ink',
      'image': 'image'
    };
    return typeMap[type] || 'highlight';
  },

  /**
   * 获取标注类型标签
   */
  getAnnotationTypeLabel(type) {
    const typeLabels = {
      'highlight': '高亮',
      'underline': '下划线',
      'strikeout': '删除线',
      'note': '便笺',
      'ink': '手绘',
      'image': '图片'
    };
    return typeLabels[type] || '标注';
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    try {
      // 使用当前检测到的端口打开登录页面
      const loginUrl = `${this.config.currentApiUrl}/auth/login`;
      Zotero.launchURL(loginUrl);
      
      // 显示登录提示
      this.showFeedback('请在浏览器中完成登录，然后点击刷新按钮', 'info');
      
    } catch (error) {
      this.log('Failed to handle login: ' + error.message);
      this.showFeedback('登录失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理登出
   */
  async handleLogout() {
    try {
      // 清除用户信息
      Zotero.Prefs.clear('researchopia.userInfo');
      this.state.isAuthenticated = false;
      this.state.userInfo = null;
      
      // 刷新界面
      this.refreshStatus();
      
      this.showFeedback('已登出', 'success');
      
    } catch (error) {
      this.log('Failed to handle logout: ' + error.message);
    }
  },

  /**
   * 刷新状态
   */
  async refreshStatus() {
    try {
      // 检测网络连接
      await this.detectAvailablePorts();
      
      // 检查认证状态
      await this.checkAuthenticationStatus();
      
      // 更新界面
      this.updateStatusDisplay();
      
      this.showFeedback('状态已刷新', 'success');
      
    } catch (error) {
      this.log('Failed to refresh status: ' + error.message);
    }
  },

  /**
   * 更新状态显示
   */
  updateStatusDisplay() {
    // 更新连接状态
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const portInfo = document.querySelector('.port-info');
    
    if (statusDot && statusText) {
      statusDot.className = `status-dot ${this.state.isOnline ? 'online' : 'offline'}`;
      statusText.textContent = this.state.isOnline ? '已连接' : '未连接';
    }

    if (portInfo) {
      portInfo.textContent = `端口: ${this.config.currentApiUrl?.split(':').pop() || '未知'}`;
    }

    // 更新按钮状态
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(btn => {
      if (btn.id !== 'refresh-btn') {
        btn.disabled = !this.state.isAuthenticated;
      }
    });
  },

  /**
   * 处理同步标注
   */
  async handleSyncAnnotations(item) {
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录', 'warning');
        return;
      }

      this.showFeedback('正在同步标注...', 'info');
      
      const doi = this.extractDOI(item);
      if (!doi) {
        this.showFeedback('此文献没有DOI', 'warning');
        return;
      }

      const annotations = this.getZoteroAnnotations(item);
      if (annotations.length === 0) {
        this.showFeedback('没有标注可同步', 'info');
        return;
      }

      // 同步到服务器
      const response = await this.makeRequest('/api/v1/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.userInfo.token}`
        },
        body: JSON.stringify(annotations)
      });

      if (response && response.success) {
        this.showFeedback(`成功同步 ${annotations.length} 个标注`, 'success');
        // 刷新标注列表
        await this.loadMyAnnotations(item);
      } else {
        this.showFeedback('同步失败: ' + (response?.error?.message || '未知错误'), 'error');
      }

    } catch (error) {
      this.log('Failed to sync annotations: ' + error.message);
      this.showFeedback('同步失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理分享标注
   */
  async handleShareAnnotations(item) {
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录', 'warning');
        return;
      }

      const doi = this.extractDOI(item);
      if (!doi) {
        this.showFeedback('此文献没有DOI', 'warning');
        return;
      }

      const annotations = this.getZoteroAnnotations(item);
      if (annotations.length === 0) {
        this.showFeedback('没有标注可分享', 'info');
        return;
      }

      this.showFeedback('正在分享标注...', 'info');

      // 将标注设为公开
      for (const annotation of annotations) {
        try {
          await this.makeRequest(`/api/v1/annotations/${annotation.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.state.userInfo.token}`
            },
            body: JSON.stringify({
              metadata: { visibility: 'public' }
            })
          });
        } catch (error) {
          this.log(`Failed to share annotation ${annotation.id}: ${error.message}`);
        }
      }

      this.showFeedback(`成功分享 ${annotations.length} 个标注`, 'success');
      
      // 刷新社区标注
      await this.loadSharedAnnotations(item);

    } catch (error) {
      this.log('Failed to share annotations: ' + error.message);
      this.showFeedback('分享失败: ' + error.message, 'error');
    }
  },

  /**
   * 处理浏览共享
   */
  async handleBrowseShared(item) {
    try {
      const doi = this.extractDOI(item);
      if (!doi) {
        this.showFeedback('此文献没有DOI', 'warning');
        return;
      }

      // 使用当前检测到的端口打开Web界面
      const webUrl = `${this.config.currentApiUrl}/papers/${doi}`;
      Zotero.launchURL(webUrl);
      
    } catch (error) {
      this.log('Failed to browse shared: ' + error.message);
      this.showFeedback('打开失败: ' + error.message, 'error');
    }
  },

  /**
   * 点赞标注
   */
  async likeAnnotation(annotationId) {
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录', 'warning');
        return;
      }

      const response = await this.makeRequest(`/api/v1/annotations/${annotationId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.state.userInfo.token}`
        }
      });

      if (response && response.success) {
        this.showFeedback('点赞成功', 'success');
      } else {
        this.showFeedback('点赞失败', 'error');
      }

    } catch (error) {
      this.log('Failed to like annotation: ' + error.message);
      this.showFeedback('点赞失败: ' + error.message, 'error');
    }
  },

  /**
   * 评论标注
   */
  async commentAnnotation(annotationId) {
    try {
      if (!this.state.isAuthenticated) {
        this.showFeedback('请先登录', 'warning');
        return;
      }

      const comment = prompt('请输入评论:');
      if (!comment) return;

      const response = await this.makeRequest(`/api/v1/annotations/${annotationId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.userInfo.token}`
        },
        body: JSON.stringify({ content: comment })
      });

      if (response && response.success) {
        this.showFeedback('评论成功', 'success');
      } else {
        this.showFeedback('评论失败', 'error');
      }

    } catch (error) {
      this.log('Failed to comment annotation: ' + error.message);
      this.showFeedback('评论失败: ' + error.message, 'error');
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
   * 发送HTTP请求
   */
  async makeRequest(url, options = {}) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.config.currentApiUrl}${url}`;
      
      const response = await fetch(fullUrl, {
        timeout: this.config.timeout,
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      this.log(`Request failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * 日志记录
   */
  log(msg, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] Researchopia: ${msg}`;
    
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
    this.log(`Feedback [${type}]: ${message}`);
    
    // 在界面上显示反馈
    const feedbackArea = document.querySelector('.researchopia-feedback');
    if (feedbackArea) {
      feedbackArea.textContent = message;
      feedbackArea.className = `researchopia-feedback ${type}`;
      feedbackArea.style.display = 'block';
      
      setTimeout(() => {
        feedbackArea.style.display = 'none';
      }, 3000);
    }
  },

  /**
   * 显示警告
   */
  showAlert(title, message, type = 'info') {
    try {
      if (Zotero.Alert) {
        Zotero.Alert(message, title);
      } else {
        alert(`${title}: ${message}`);
      }
    } catch (e) {
      this.log('Failed to show alert: ' + e.message);
    }
  }
};

// 注意：startup 和 shutdown 函数在 bootstrap.js 中定义

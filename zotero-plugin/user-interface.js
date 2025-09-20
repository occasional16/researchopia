/**
 * Researchopia User Interface Manager
 * 用户界面和交互管理模块
 */

const UserInterface = {
  // UI元素引用
  elements: {},
  
  // 当前状态
  currentView: 'main',
  isInitialized: false,

  /**
   * 初始化用户界面
   */
  init() {
    this.log("Initializing User Interface");
    this.isInitialized = true;
    return this;
  },

  /**
   * 处理认证状态变化
   */
  onAuthStatusChanged(isAuthenticated, isAnonymous) {
    try {
      this.log(`Auth status changed: authenticated=${isAuthenticated}, anonymous=${isAnonymous}`);

      // 查找并更新所有用户界面容器
      const containers = this.findAllUserContainers();
      for (const container of containers) {
        this.updateAuthStatus(container);
      }
    } catch (error) {
      this.log(`Error handling auth status change: ${error.message}`, 'error');
    }
  },

  /**
   * 查找所有用户界面容器
   */
  findAllUserContainers() {
    try {
      const containers = [];

      // 查找所有可能的容器
      const selectors = [
        '[data-researchopia-user-panel]',
        '.researchopia-user-panel',
        '#researchopia-user-panel'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        containers.push(...elements);
      }

      return containers;
    } catch (error) {
      this.log(`Error finding user containers: ${error.message}`, 'error');
      return [];
    }
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-UI [${level.toUpperCase()}]: ${message}`;

      // 使用Zotero的日志系统
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(logMessage, level === 'error' ? 1 : 3);
      } else if (typeof console !== 'undefined') {
        console.log(logMessage);
      }
    } catch (e) {
      // 静默处理日志错误
    }
  },

  /**
   * 创建用户面板
   */
  createUserPanel(container) {
    try {
      this.log("Creating user panel");

      if (!container) {
        this.log("No container provided for user panel", 'warn');
        return;
      }

      // 获取正确的document对象
      const doc = container.ownerDocument;

      // 清空容器（安全方式）
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      // 创建用户认证区域（使用纯DOM API避免安全策略问题）
      const userSection = doc.createElement('div');
      userSection.id = 'researchopia-user-section';
      userSection.className = 'researchopia-section';

      // 使用纯DOM API创建内容，避免innerHTML安全问题
      this.buildUserSectionDOM(userSection, doc);

      // 添加到容器
      container.appendChild(userSection);

      // 缓存重要元素
      this.elements = {
        userSection: userSection,
        loginButton: userSection.querySelector('#researchopia-login-btn'),
        logoutButton: userSection.querySelector('#researchopia-logout-btn'),
        userInfo: userSection.querySelector('#researchopia-user-info'),
        userAvatar: userSection.querySelector('#researchopia-user-avatar'),
        userName: userSection.querySelector('#researchopia-user-name'),
        anonymousMode: userSection.querySelector('#researchopia-anonymous-mode'),
        authStatus: userSection.querySelector('#researchopia-auth-status'),
        syncToggle: userSection.querySelector('#sync-enabled'),
        syncStatusText: userSection.querySelector('#sync-status-text'),
        syncLastTime: userSection.querySelector('#sync-last-time'),
        syncPendingCount: userSection.querySelector('#sync-pending-count'),
        syncNowBtn: userSection.querySelector('#researchopia-sync-now-btn'),
        syncSettingsBtn: userSection.querySelector('#researchopia-sync-settings-btn')
      };

      // 设置事件监听器
      this.setupEventListeners(container);

      // 更新认证状态
      this.updateAuthStatus(container);

      // 添加共享标注区域
      this.addSharedAnnotationsSection(container);

      this.log("User panel created successfully");
    } catch (error) {
      this.log(`Error creating user panel: ${error.message}`, 'error');
    }
  },

  /**
   * 使用纯DOM API构建用户区域（避免innerHTML安全问题）
   */
  buildUserSectionDOM(container, doc) {
    try {
      // 创建标题区域
      const header = doc.createElement('div');
      header.className = 'researchopia-user-header';

      const title = doc.createElement('h3');
      title.textContent = '🔐 用户认证';
      header.appendChild(title);

      const authStatus = doc.createElement('div');
      authStatus.id = 'researchopia-auth-status';
      authStatus.className = 'auth-status';

      const statusIndicator = doc.createElement('span');
      statusIndicator.className = 'status-indicator';
      authStatus.appendChild(statusIndicator);

      const statusText = doc.createElement('span');
      statusText.className = 'status-text';
      statusText.textContent = '检查中...';
      authStatus.appendChild(statusText);

      header.appendChild(authStatus);
      container.appendChild(header);

      // 创建登录区域
      const loginSection = doc.createElement('div');
      loginSection.id = 'researchopia-login-section';
      loginSection.className = 'auth-section';
      loginSection.style.display = 'block';

      const loginOptions = doc.createElement('div');
      loginOptions.className = 'login-options';

      const loginBtn = doc.createElement('button');
      loginBtn.id = 'researchopia-login-btn';
      loginBtn.className = 'primary-button';
      loginBtn.textContent = '🔑 登录研学港';
      loginOptions.appendChild(loginBtn);

      const anonymousBtn = doc.createElement('button');
      anonymousBtn.id = 'researchopia-anonymous-btn';
      anonymousBtn.className = 'secondary-button';
      anonymousBtn.textContent = '👤 匿名模式';
      loginOptions.appendChild(anonymousBtn);

      loginSection.appendChild(loginOptions);
      container.appendChild(loginSection);

      // 创建用户信息区域
      const userInfo = doc.createElement('div');
      userInfo.id = 'researchopia-user-info';
      userInfo.className = 'auth-section';
      userInfo.style.display = 'none';

      const userProfile = doc.createElement('div');
      userProfile.className = 'user-profile';

      const userAvatar = doc.createElement('div');
      userAvatar.id = 'researchopia-user-avatar';
      userAvatar.className = 'user-avatar';
      userAvatar.textContent = '👤';
      userProfile.appendChild(userAvatar);

      const userDetails = doc.createElement('div');
      userDetails.className = 'user-details';

      const userName = doc.createElement('div');
      userName.id = 'researchopia-user-name';
      userName.className = 'user-name';
      userName.textContent = '用户名';
      userDetails.appendChild(userName);

      const userEmail = doc.createElement('div');
      userEmail.id = 'researchopia-user-email';
      userEmail.className = 'user-email';
      userEmail.textContent = 'user@example.com';
      userDetails.appendChild(userEmail);

      userProfile.appendChild(userDetails);
      userInfo.appendChild(userProfile);

      // 用户操作按钮
      const userActions = doc.createElement('div');
      userActions.className = 'user-actions';

      const profileBtn = doc.createElement('button');
      profileBtn.id = 'researchopia-profile-btn';
      profileBtn.className = 'secondary-button';
      profileBtn.innerHTML = '<span class="icon">👤</span>个人中心';
      userActions.appendChild(profileBtn);

      const settingsBtn = doc.createElement('button');
      settingsBtn.id = 'researchopia-settings-btn';
      settingsBtn.className = 'secondary-button';
      settingsBtn.innerHTML = '<span class="icon">⚙️</span>设置';
      userActions.appendChild(settingsBtn);

      const logoutBtn = doc.createElement('button');
      logoutBtn.id = 'researchopia-logout-btn';
      logoutBtn.className = 'secondary-button';
      logoutBtn.innerHTML = '<span class="icon">🚪</span>登出';
      userActions.appendChild(logoutBtn);

      const diagnosticBtn = doc.createElement('button');
      diagnosticBtn.id = 'researchopia-diagnostic-btn';
      diagnosticBtn.className = 'secondary-button';
      diagnosticBtn.innerHTML = '<span class="icon">🔍</span>诊断工具';
      userActions.appendChild(diagnosticBtn);

      userActions.appendChild(logoutBtn);
      userInfo.appendChild(userActions);
      container.appendChild(userInfo);

      // 创建匿名模式区域
      const anonymousInfo = doc.createElement('div');
      anonymousInfo.id = 'researchopia-anonymous-info';
      anonymousInfo.className = 'auth-section';
      anonymousInfo.style.display = 'none';

      const anonymousNotice = doc.createElement('div');
      anonymousNotice.className = 'anonymous-notice';

      const noticeIcon = doc.createElement('span');
      noticeIcon.className = 'icon';
      noticeIcon.textContent = '👤';
      anonymousNotice.appendChild(noticeIcon);

      const noticeContent = doc.createElement('div');
      noticeContent.className = 'notice-content';

      const noticeTitle = doc.createElement('strong');
      noticeTitle.textContent = '匿名模式';
      noticeContent.appendChild(noticeTitle);

      const noticeDesc = doc.createElement('p');
      noticeDesc.textContent = '您正在使用匿名模式，部分功能受限';
      noticeContent.appendChild(noticeDesc);

      anonymousNotice.appendChild(noticeContent);
      anonymousInfo.appendChild(anonymousNotice);

      const switchLoginBtn = doc.createElement('button');
      switchLoginBtn.id = 'researchopia-switch-login-btn';
      switchLoginBtn.className = 'primary-button';
      switchLoginBtn.textContent = '切换到登录模式';
      anonymousInfo.appendChild(switchLoginBtn);

      container.appendChild(anonymousInfo);

      this.log("User section DOM built successfully");
    } catch (error) {
      this.log(`Error building user section DOM: ${error.message}`, 'error');
    }
  },

  /**
   * 获取用户区域HTML（已弃用，保留用于兼容性）
   */
  getUserSectionHTML() {
    return `
      <div class="researchopia-user-header">
        <h3>🔐 用户认证</h3>
        <div id="researchopia-auth-status" class="auth-status">
          <span class="status-indicator"></span>
          <span class="status-text">检查中...</span>
        </div>
      </div>

      <!-- 未登录状态 -->
      <div id="researchopia-login-section" class="auth-section" style="display: block;">
        <div class="login-options">
          <button id="researchopia-login-btn" class="primary-button">
            <span class="icon">🔑</span>
            登录 Researchopia
          </button>
          <label class="anonymous-option">
            <input type="checkbox" id="researchopia-anonymous-mode" />
            <span>匿名模式（功能受限）</span>
          </label>
        </div>
        <div class="login-benefits">
          <h4>登录后可享受：</h4>
          <ul>
            <li>✨ 完整的标注分享功能</li>
            <li>👥 查看其他用户的标注</li>
            <li>💬 评论和点赞标注</li>
            <li>🔔 接收互动通知</li>
            <li>⚙️ 个性化设置</li>
          </ul>
        </div>
      </div>

      <!-- 已登录状态 -->
      <div id="researchopia-user-info" class="auth-section" style="display: none;">
        <div class="user-profile">
          <img id="researchopia-user-avatar" class="user-avatar" src="" alt="用户头像" />
          <div class="user-details">
            <div id="researchopia-user-name" class="user-name"></div>
            <div class="user-stats">
              <span id="researchopia-user-annotations">0 个标注</span>
              <span id="researchopia-user-likes">0 个点赞</span>
            </div>
          </div>
        </div>
        <div class="user-actions">
          <button id="researchopia-profile-btn" class="secondary-button">
            <span class="icon">👤</span>
            个人中心
          </button>
          <button id="researchopia-settings-btn" class="secondary-button">
            <span class="icon">⚙️</span>
            设置
          </button>
          <button id="researchopia-logout-btn" class="secondary-button">
            <span class="icon">🚪</span>
            登出
          </button>
          <button id="researchopia-diagnostic-btn" class="secondary-button">
            <span class="icon">🔍</span>
            诊断工具
          </button>
        </div>
      </div>

      <!-- 匿名模式状态 -->
      <div id="researchopia-anonymous-info" class="auth-section" style="display: none;">
        <div class="anonymous-notice">
          <span class="icon">👤</span>
          <div class="notice-content">
            <strong>匿名模式</strong>
            <p>您正在使用匿名模式，部分功能受限</p>
          </div>
        </div>
        <button id="researchopia-switch-login-btn" class="primary-button">
          切换到登录模式
        </button>
      </div>

      <!-- 同步状态区域 -->
      <div id="researchopia-sync-section" class="sync-section">
        <div class="sync-header">
          <h4>🔄 实时同步</h4>
          <div id="researchopia-sync-toggle" class="sync-toggle">
            <input type="checkbox" id="sync-enabled" checked />
            <label for="sync-enabled">启用同步</label>
          </div>
        </div>
        <div id="researchopia-sync-status" class="sync-status">
          <div class="sync-indicator">
            <span class="sync-dot"></span>
            <span id="sync-status-text">同步已启用</span>
          </div>
          <div class="sync-details">
            <div id="sync-last-time">上次同步: 从未</div>
            <div id="sync-pending-count">待同步: 0 项</div>
          </div>
        </div>
        <div class="sync-actions">
          <button id="researchopia-sync-now-btn" class="secondary-button">
            <span class="icon">🔄</span>
            立即同步
          </button>
          <button id="researchopia-sync-settings-btn" class="secondary-button">
            <span class="icon">⚙️</span>
            同步设置
          </button>
        </div>
      </div>
    `;
  },

  /**
   * 设置事件监听器
   */
  setupEventListeners(container) {
    try {
      if (!container) {
        this.log("No container provided for event listeners", 'warn');
        return;
      }

      const doc = container.ownerDocument;

      // 登录按钮
      const loginBtn = doc.getElementById('researchopia-login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          this.handleLogin();
        });
      }

      // 登出按钮
      const logoutBtn = doc.getElementById('researchopia-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this.handleLogout();
        });
      }

      // 诊断工具按钮
      const diagnosticBtn = doc.getElementById('researchopia-diagnostic-btn');
      if (diagnosticBtn) {
        diagnosticBtn.addEventListener('click', () => {
          this.handleDiagnostic();
        });
      }

      // 匿名模式切换
      const anonymousMode = doc.getElementById('researchopia-anonymous-mode');
      if (anonymousMode) {
        anonymousMode.addEventListener('change', (e) => {
          this.handleAnonymousMode(e.target.checked);
        });
      }

      // 个人中心按钮
      const profileBtn = doc.getElementById('researchopia-profile-btn');
      if (profileBtn) {
        profileBtn.addEventListener('click', () => {
          this.openProfileWindow();
        });
      }

      // 设置按钮
      const settingsBtn = doc.getElementById('researchopia-settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          this.openSettingsWindow();
        });
      }

      // 切换登录按钮
      const switchLoginBtn = doc.getElementById('researchopia-switch-login-btn');
      if (switchLoginBtn) {
        switchLoginBtn.addEventListener('click', () => {
          this.handleSwitchToLogin();
        });
      }

      // 同步开关
      const syncToggle = doc.getElementById('sync-enabled');
      if (syncToggle) {
        syncToggle.addEventListener('change', (e) => {
          this.handleSyncToggle(e.target.checked);
        });
      }

      // 立即同步按钮
      const syncNowBtn = doc.getElementById('researchopia-sync-now-btn');
      if (syncNowBtn) {
        syncNowBtn.addEventListener('click', () => {
          this.handleSyncNow();
        });
      }

      // 同步设置按钮
      const syncSettingsBtn = doc.getElementById('researchopia-sync-settings-btn');
      if (syncSettingsBtn) {
        syncSettingsBtn.addEventListener('click', () => {
          this.handleSyncSettings();
        });
      }

      this.log("Event listeners setup completed");
    } catch (error) {
      this.log(`Error setting up event listeners: ${error.message}`, 'error');
    }
  },

  /**
   * 更新认证状态显示
   */
  updateAuthStatus(container) {
    try {
      // 即使 AuthManager 未就绪，也要展示“未登录”界面，避免一直停留在“检查中...”
      let isAuthenticated = false;
      let currentUser = null;

      if (typeof AuthManager === 'undefined') {
        this.log("AuthManager not available, fallback to unauthenticated UI", 'warn');
      } else {
        isAuthenticated = AuthManager.isUserAuthenticated();
        currentUser = AuthManager.getCurrentUser?.();
      }
      const isAnonymous = this.isAnonymousMode();

      // 更新状态指示器
      this.updateStatusIndicator(isAuthenticated, isAnonymous, container);

      // 显示对应的界面
      this.showAuthSection(isAuthenticated, isAnonymous, container);

      // 如果已登录，更新用户信息
      if (isAuthenticated && currentUser) {
        this.updateUserInfo(currentUser, container);
      }

      this.log(`Auth status updated: authenticated=${isAuthenticated}, anonymous=${isAnonymous}`);
    } catch (error) {
      this.log(`Error updating auth status: ${error.message}`, 'error');
    }
  },

  /**
   * 更新状态指示器
   */
  updateStatusIndicator(isAuthenticated, isAnonymous, container) {
    try {
      if (!container) return;

      const doc = container.ownerDocument;
      const statusElement = doc.getElementById('researchopia-auth-status');
      if (!statusElement) return;

      const indicator = statusElement.querySelector('.status-indicator');
      const text = statusElement.querySelector('.status-text');

      if (indicator && text) {
        if (isAuthenticated) {
          indicator.className = 'status-indicator online';
          text.textContent = '已登录';
        } else if (isAnonymous) {
          indicator.className = 'status-indicator anonymous';
          text.textContent = '匿名模式';
        } else {
          indicator.className = 'status-indicator offline';
          text.textContent = '未登录';
        }
      }
    } catch (error) {
      this.log(`Error updating status indicator: ${error.message}`, 'error');
    }
  },

  /**
   * 显示对应的认证区域
   */
  showAuthSection(isAuthenticated, isAnonymous, container) {
    try {
      if (!container) return;

      const doc = container.ownerDocument;
      const loginSection = doc.getElementById('researchopia-login-section');
      const userInfo = doc.getElementById('researchopia-user-info');
      const anonymousInfo = doc.getElementById('researchopia-anonymous-info');

      this.log(`Showing auth section: authenticated=${isAuthenticated}, anonymous=${isAnonymous}`);
      this.log(`Elements found: login=${!!loginSection}, user=${!!userInfo}, anonymous=${!!anonymousInfo}`);

      // 隐藏所有区域
      [loginSection, userInfo, anonymousInfo].forEach(section => {
        if (section) {
          section.style.display = 'none';
          this.log(`Hidden section: ${section.id}`);
        }
      });

      // 显示对应区域
      if (isAuthenticated && userInfo) {
        userInfo.style.display = 'block';
        this.log('Showing user info section');
      } else if (isAnonymous && anonymousInfo) {
        anonymousInfo.style.display = 'block';
        this.log('Showing anonymous info section');
      } else if (loginSection) {
        loginSection.style.display = 'block';
        this.log('Showing login section');
      } else {
        this.log('No suitable section to show', 'warn');
      }
    } catch (error) {
      this.log(`Error showing auth section: ${error.message}`, 'error');
    }
  },

  /**
   * 更新用户信息显示
   */
  updateUserInfo(user, container) {
    if (!user || !container) return;

    try {
      const doc = container.ownerDocument;

      // 更新头像
      const userAvatar = doc.getElementById('researchopia-user-avatar');
      if (userAvatar) {
        userAvatar.src = user.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiM2MzY2RjEiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik0xMiAxMkM5Ljc5IDEyIDggMTAuMjEgOCA4UzkuNzkgNCA1IDRTMTYgNS43OSAxNiA4UzE0LjIxIDEyIDEyIDEyWk0xMiAxNEM5LjMzIDE0IDQgMTUuMzQgNCAyMFYyMkgyMFYyMEMxNiAxNS4zNCAxNC42NyAxNCAxMiAxNFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo8L3N2Zz4K';
        userAvatar.alt = `${user.username}的头像`;
      }

      // 更新用户名
      const userName = doc.getElementById('researchopia-user-name');
      if (userName) {
        userName.textContent = user.displayName || user.username;
      }

      // 更新统计信息
      this.updateUserStats(user);

      this.log(`User info updated for: ${user.username}`);
    } catch (error) {
      this.log(`Error updating user info: ${error.message}`, 'error');
    }
  },

  /**
   * 更新用户统计信息
   */
  async updateUserStats(user) {
    try {
      // 这里可以调用API获取用户统计信息
      const annotationsElement = document.getElementById('researchopia-user-annotations');
      const likesElement = document.getElementById('researchopia-user-likes');

      if (annotationsElement) {
        annotationsElement.textContent = `${user.annotationCount || 0} 个标注`;
      }
      
      if (likesElement) {
        likesElement.textContent = `${user.likeCount || 0} 个点赞`;
      }
    } catch (error) {
      this.log(`Error updating user stats: ${error.message}`, 'error');
    }
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    try {
      this.log("Handling login request");
      this.setButtonLoading(this.elements.loginButton, true);

      const user = await AuthManager.openLoginWindow();
      // 刷新所有用户界面
      this.refreshAllUserPanels();
      
      // 显示成功消息
      this.showNotification('登录成功！', 'success');
      
      this.log(`Login successful for user: ${user.username}`);
    } catch (error) {
      this.log(`Login failed: ${error.message}`, 'error');
      this.showNotification('登录失败，请重试', 'error');
    } finally {
      this.setButtonLoading(this.elements.loginButton, false);
    }
  },

  /**
   * 处理登出
   */
  async handleLogout() {
    try {
      this.log("Handling logout request");
      
      const confirmed = await this.showConfirmDialog(
        '确认登出',
        '您确定要登出吗？登出后将无法使用完整功能。'
      );
      
      if (confirmed) {
        await AuthManager.logout();
        // 刷新所有用户界面
        this.refreshAllUserPanels();
        this.showNotification('已成功登出', 'info');
        this.log("Logout successful");
      }
    } catch (error) {
      this.log(`Logout failed: ${error.message}`, 'error');
      this.showNotification('登出失败，请重试', 'error');
    }
  },

  /**
   * 处理匿名模式
   */
  handleAnonymousMode(enabled) {
    try {
      this.log(`Anonymous mode ${enabled ? 'enabled' : 'disabled'}`);
      
      // 保存匿名模式设置
      Zotero.Prefs.set('extensions.researchopia.anonymousMode', enabled);

      // 刷新所有用户界面
      this.refreshAllUserPanels();
      
      if (enabled) {
        this.showNotification('已切换到匿名模式', 'info');
      } else {
        this.showNotification('已退出匿名模式', 'info');
      }
    } catch (error) {
      this.log(`Error handling anonymous mode: ${error.message}`, 'error');
    }
  },

  /**
   * 处理切换到登录模式
   */
  handleSwitchToLogin() {
    // 取消匿名模式
    this.elements.anonymousMode.checked = false;
    this.handleAnonymousMode(false);
  },

  /**
   * 检查是否为匿名模式
   */
  isAnonymousMode() {
    try {
      return Zotero.Prefs.get('extensions.researchopia.anonymousMode', false) === true;
    } catch (error) {
      this.log(`Error checking anonymous mode: ${error.message}`, 'error');
      return false;
    }
  },

  /**
   * 刷新所有用户面板
   */
  refreshAllUserPanels() {
    try {
      // 通过Services.obs通知所有面板刷新
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(null, 'researchopia:refreshUserPanels', '');
      }
      this.log("Refreshed all user panels");
    } catch (error) {
      this.log(`Error refreshing user panels: ${error.message}`, 'error');
    }
  },

  /**
   * 打开个人中心窗口
   */
  openProfileWindow() {
    try {
      const profileUrl = 'https://researchopia.com/profile';
      Zotero.launchURL(profileUrl);
      this.log("Profile window opened");
    } catch (error) {
      this.log(`Error opening profile window: ${error.message}`, 'error');
    }
  },

  /**
   * 打开设置窗口
   */
  openSettingsWindow() {
    try {
      this.log("Opening settings window");

      if (typeof PrivacyManager !== 'undefined') {
        PrivacyManager.showPrivacySettings();
      } else {
        this.showNotification('隐私设置模块未加载', 'error');
      }
    } catch (error) {
      this.log(`Error opening settings window: ${error.message}`, 'error');
      this.showNotification('打开设置失败: ' + error.message, 'error');
    }
  },

  /**
   * 设置按钮加载状态
   */
  setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
      button.disabled = true;
      button.classList.add('loading');
      const originalText = button.textContent;
      button.dataset.originalText = originalText;
      button.innerHTML = '<span class="spinner"></span> 处理中...';
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      const originalText = button.dataset.originalText;
      if (originalText) {
        button.textContent = originalText;
      }
    }
  },

  /**
   * 显示通知消息
   */
  showNotification(message, type = 'info') {
    try {
      // 创建通知元素
      const notification = document.createElement('div');
      notification.className = `researchopia-notification ${type}`;
      notification.innerHTML = `
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      `;

      // 添加到页面
      document.body.appendChild(notification);

      // 设置关闭事件
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => {
        notification.remove();
      });

      // 自动关闭
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);

      this.log(`Notification shown: ${message} (${type})`);
    } catch (error) {
      this.log(`Error showing notification: ${error.message}`, 'error');
    }
  },

  /**
   * 获取通知图标
   */
  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  },

  /**
   * 显示确认对话框
   */
  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      try {
        const ps = Services.prompt;
        const result = ps.confirm(null, title, message);
        resolve(result);
      } catch (error) {
        this.log(`Error showing confirm dialog: ${error.message}`, 'error');
        resolve(false);
      }
    });
  },

  /**
   * 处理同步开关切换
   */
  handleSyncToggle(enabled) {
    try {
      this.log(`Sync toggle changed: ${enabled}`);

      if (Zotero.Researchopia.AnnotationSharing) {
        Zotero.Researchopia.AnnotationSharing.setSyncEnabled(enabled);
        this.updateSyncStatus();
      }
    } catch (error) {
      this.log(`Error handling sync toggle: ${error.message}`, 'error');
    }
  },

  /**
   * 处理立即同步
   */
  async handleSyncNow() {
    try {
      this.log("Manual sync triggered");

      if (Zotero.Researchopia.AnnotationSharing) {
        const syncBtn = this.elements.syncNowBtn;
        if (syncBtn) {
          syncBtn.disabled = true;
          syncBtn.textContent = '🔄 同步中...';
        }

        await Zotero.Researchopia.AnnotationSharing.processPendingChanges();
        this.updateSyncStatus();

        if (syncBtn) {
          syncBtn.disabled = false;
          syncBtn.innerHTML = '<span class="icon">🔄</span>立即同步';
        }
      }
    } catch (error) {
      this.log(`Error handling manual sync: ${error.message}`, 'error');

      const syncBtn = this.elements.syncNowBtn;
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<span class="icon">🔄</span>立即同步';
      }
    }
  },

  /**
   * 处理同步设置
   */
  handleSyncSettings() {
    try {
      this.log("Opening sync settings");
      this.showSyncSettingsDialog();
    } catch (error) {
      this.log(`Error handling sync settings: ${error.message}`, 'error');
    }
  },

  /**
   * 显示同步设置对话框
   */
  showSyncSettingsDialog() {
    try {
      const currentStatus = Zotero.Researchopia.AnnotationSharing?.getSyncStatus() || {};

      const message = `同步设置:\n\n当前状态: ${currentStatus.isEnabled ? '已启用' : '已禁用'}\n上次同步: ${currentStatus.lastSyncTime ? new Date(currentStatus.lastSyncTime).toLocaleString() : '从未'}\n待同步项目: ${currentStatus.pendingChanges || 0} 个\n同步进行中: ${currentStatus.syncInProgress ? '是' : '否'}\n\n同步间隔: 30秒\n重试次数: 3次`;

      alert(message);
    } catch (error) {
      this.log(`Error showing sync settings dialog: ${error.message}`, 'error');
    }
  },

  /**
   * 处理诊断工具
   */
  async handleDiagnostic() {
    try {
      this.log("Running diagnostic tool");

      if (typeof DiagnosticTool !== 'undefined') {
        // 显示加载提示
        if (typeof FeedbackSystem !== 'undefined') {
          const loadingId = FeedbackSystem.showLoading('正在运行诊断检查...');

          try {
            await DiagnosticTool.showDiagnosticReport();
            FeedbackSystem.hideNotification(loadingId);
          } catch (error) {
            FeedbackSystem.hideNotification(loadingId);
            FeedbackSystem.showError(`诊断失败: ${error.message}`);
          }
        } else {
          await DiagnosticTool.showDiagnosticReport();
        }
      } else {
        // 回退到简单诊断
        this.showSimpleDiagnostic();
      }
    } catch (error) {
      this.log(`Error running diagnostic: ${error.message}`, 'error');
      if (typeof FeedbackSystem !== 'undefined') {
        FeedbackSystem.showError(`诊断工具出错: ${error.message}`);
      } else {
        alert(`诊断工具出错: ${error.message}`);
      }
    }
  },

  /**
   * 添加共享标注区域
   */
  addSharedAnnotationsSection(container) {
    try {
      // 获取当前选中的项目
      const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
      if (selectedItems.length === 0) {
        this.log("No items selected, skipping shared annotations section");
        return;
      }

      const item = selectedItems[0];
      if (!item) {
        this.log("No valid item found");
        return;
      }

      // 使用DOI标注显示模块
      if (typeof DOIAnnotationDisplay !== 'undefined') {
        DOIAnnotationDisplay.createSharedAnnotationsSection(container, item);
      } else {
        this.log("DOI Annotation Display module not available", 'warn');
        // 创建占位符
        this.createSharedAnnotationsPlaceholder(container);
      }
    } catch (error) {
      this.log(`Error adding shared annotations section: ${error.message}`, 'error');
    }
  },

  /**
   * 创建共享标注占位符
   */
  createSharedAnnotationsPlaceholder(container) {
    try {
      const doc = container.ownerDocument;
      if (!doc) return;

      const placeholder = doc.createElement('div');
      placeholder.className = 'researchopia-section';

      // 创建标题区域
      const header = doc.createElement('div');
      header.className = 'researchopia-section-header';

      const title = doc.createElement('h3');
      title.textContent = '🌍 社区标注';
      header.appendChild(title);

      placeholder.appendChild(header);

      // 创建内容区域
      const content = doc.createElement('div');
      content.className = 'shared-annotations-content';

      const placeholderText = doc.createElement('p');
      placeholderText.className = 'placeholder';
      placeholderText.textContent = '社区标注功能正在加载中...';
      content.appendChild(placeholderText);

      placeholder.appendChild(content);
      container.appendChild(placeholder);
    } catch (error) {
      this.log(`Error creating shared annotations placeholder: ${error.message}`, 'error');
    }
  },

  /**
   * 显示简单诊断信息
   */
  showSimpleDiagnostic() {
    try {
      let diagnostic = '研学港插件诊断信息\n\n';

      // 检查基本状态
      diagnostic += `Zotero版本: ${typeof Zotero !== 'undefined' ? Zotero.version : '未知'}\n`;
      diagnostic += `插件状态: ${typeof Zotero !== 'undefined' && Zotero.Researchopia ? '已加载' : '未加载'}\n`;
      diagnostic += `认证状态: ${typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated?.() ? '已登录' : '未登录'}\n`;
      diagnostic += `网络状态: ${typeof navigator !== 'undefined' ? (navigator.onLine ? '在线' : '离线') : '未知'}\n`;

      // 检查模块
      diagnostic += '\n模块状态:\n';
      const modules = [
        'ErrorHandler', 'FeedbackSystem', 'AnnotationSelector',
        'SocialFeatures', 'UserInterface', 'AuthManager'
      ];

      modules.forEach(module => {
        diagnostic += `- ${module}: ${typeof window[module] !== 'undefined' ? '✓' : '✗'}\n`;
      });

      diagnostic += '\n如需详细诊断，请在开发者控制台运行: runResearchopiaDiagnostic()';

      alert(diagnostic);
    } catch (error) {
      this.log(`Error showing simple diagnostic: ${error.message}`, 'error');
    }
  },

  /**
   * 更新同步状态显示
   */
  updateSyncStatus() {
    try {
      if (!Zotero.Researchopia.AnnotationSharing) {
        return;
      }

      const status = Zotero.Researchopia.AnnotationSharing.getSyncStatus();

      // 更新同步开关状态
      if (this.elements.syncToggle) {
        this.elements.syncToggle.checked = status.isEnabled;
      }

      // 更新状态文本
      if (this.elements.syncStatusText) {
        if (status.syncInProgress) {
          this.elements.syncStatusText.textContent = '同步中...';
        } else if (status.isEnabled) {
          this.elements.syncStatusText.textContent = '同步已启用';
        } else {
          this.elements.syncStatusText.textContent = '同步已禁用';
        }
      }

      // 更新上次同步时间
      if (this.elements.syncLastTime) {
        const lastSyncText = status.lastSyncTime
          ? `上次同步: ${new Date(status.lastSyncTime).toLocaleString()}`
          : '上次同步: 从未';
        this.elements.syncLastTime.textContent = lastSyncText;
      }

      // 更新待同步数量
      if (this.elements.syncPendingCount) {
        this.elements.syncPendingCount.textContent = `待同步: ${status.pendingChanges || 0} 项`;
      }

    } catch (error) {
      this.log(`Error updating sync status: ${error.message}`, 'error');
    }
  },

  /**
   * 启动同步状态定期更新
   */
  startSyncStatusUpdater() {
    if (this.syncStatusTimer) {
      clearInterval(this.syncStatusTimer);
    }

    this.syncStatusTimer = setInterval(() => {
      this.updateSyncStatus();
    }, 5000); // 每5秒更新一次

    this.log("Sync status updater started");
  },

  /**
   * 停止同步状态更新
   */
  stopSyncStatusUpdater() {
    if (this.syncStatusTimer) {
      clearInterval(this.syncStatusTimer);
      this.syncStatusTimer = null;
    }
    this.log("Sync status updater stopped");
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserInterface;
}

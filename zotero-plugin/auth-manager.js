/**
 * Researchopia Authentication Manager
 * 用户认证和会话管理模块
 */

const AuthManager = {
  // 认证状态
  isAuthenticated: false,
  currentUser: null,
  authToken: null,
  refreshToken: null,
  
  // 配置
  config: {
    // 优先使用本地开发服务器，如果不可用则回退到在线服务器
    authBaseUrl: 'http://localhost:3001/api/auth',
    fallbackAuthBaseUrl: 'https://researchopia.com/api/auth',
    tokenStorageKey: 'researchopia_auth_token',
    userStorageKey: 'researchopia_user_info',
    refreshTokenKey: 'researchopia_refresh_token',
    tokenExpiryKey: 'researchopia_token_expiry'
  },

  /**
   * 初始化认证管理器
   */
  init() {
    this.log("Initializing Authentication Manager");
    this.loadStoredAuth();
    this.setupTokenRefresh();
    this.startWebsiteAuthCheck();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Auth [${level.toUpperCase()}]: ${message}`;

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
   * 从本地存储加载认证信息
   */
  loadStoredAuth() {
    try {
      const token = Zotero.Prefs.get(`extensions.researchopia.${this.config.tokenStorageKey}`, '');
      const userInfo = Zotero.Prefs.get(`extensions.researchopia.${this.config.userStorageKey}`, '');
      const refreshToken = Zotero.Prefs.get(`extensions.researchopia.${this.config.refreshTokenKey}`, '');
      const expiry = Zotero.Prefs.get(`extensions.researchopia.${this.config.tokenExpiryKey}`, 0);

      if (token && userInfo && expiry > Date.now()) {
        this.authToken = token;
        this.currentUser = JSON.parse(userInfo);
        this.refreshToken = refreshToken;
        this.isAuthenticated = true;
        this.log(`Loaded stored auth for user: ${this.currentUser.username}`);
      } else if (token && expiry <= Date.now()) {
        this.log("Stored token expired, attempting refresh");
        this.refreshAuthToken();
      }
    } catch (error) {
      this.log(`Error loading stored auth: ${error.message}`, 'error');
      this.clearStoredAuth();
    }
  },

  /**
   * 保存认证信息到本地存储
   */
  saveAuthInfo(token, user, refreshToken, expiresIn = 3600) {
    try {
      const expiry = Date.now() + (expiresIn * 1000);
      
      Zotero.Prefs.set(`extensions.researchopia.${this.config.tokenStorageKey}`, token);
      Zotero.Prefs.set(`extensions.researchopia.${this.config.userStorageKey}`, JSON.stringify(user));
      Zotero.Prefs.set(`extensions.researchopia.${this.config.refreshTokenKey}`, refreshToken || '');
      Zotero.Prefs.set(`extensions.researchopia.${this.config.tokenExpiryKey}`, expiry);

      this.authToken = token;
      this.currentUser = user;
      this.refreshToken = refreshToken;
      this.isAuthenticated = true;

      this.log(`Auth info saved for user: ${user.username}`);
    } catch (error) {
      this.log(`Error saving auth info: ${error.message}`, 'error');
    }
  },

  /**
   * 清除存储的认证信息
   */
  clearStoredAuth() {
    try {
      Zotero.Prefs.clear(`extensions.researchopia.${this.config.tokenStorageKey}`);
      Zotero.Prefs.clear(`extensions.researchopia.${this.config.userStorageKey}`);
      Zotero.Prefs.clear(`extensions.researchopia.${this.config.refreshTokenKey}`);
      Zotero.Prefs.clear(`extensions.researchopia.${this.config.tokenExpiryKey}`);

      this.authToken = null;
      this.currentUser = null;
      this.refreshToken = null;
      this.isAuthenticated = false;

      this.log("Auth info cleared");
    } catch (error) {
      this.log(`Error clearing auth info: ${error.message}`, 'error');
    }
  },

  /**
   * 打开登录窗口
   */
  async openLoginWindow() {
    try {
      this.log("Opening login window");

      // 先探测本地/远程可用的认证基址（会更新 this.config.authBaseUrl）
      await this.checkWebsiteAuthStatus();

      // 将 /api/auth 基址还原为站点根，用于打开主站页面以进行登录
      const hostBase = this.config.authBaseUrl.replace(/\/api\/auth$/, '');
      // 直接打开主页，用户可以在主页上登录
      const loginUrl = `${hostBase}/`;

      // 首选在外部浏览器打开，提升成功率（Zotero 里脚本/弹窗可能被策略限制）
      if (typeof Zotero !== 'undefined' && typeof Zotero.launchURL === 'function') {
        Zotero.launchURL(loginUrl);
        // 轮询网站状态，等待用户在浏览器里完成登录
        return new Promise((resolve, reject) => {
          const started = Date.now();
          const interval = setInterval(async () => {
            try {
              await this.checkWebsiteAuthStatus();
              if (this.isAuthenticated) {
                clearInterval(interval);
                resolve(this.currentUser);
              } else if (Date.now() - started > 300000) { // 5分钟
                clearInterval(interval);
                reject(new Error('Login timeout'));
              }
            } catch (e) {
              // 忽略临时错误，继续轮询
            }
          }, 2000);
        });
      }

      // 回退：在Zotero内部打开窗口
      const win = Services.ww.openWindow(
        null,
        loginUrl,
        'researchopia-login',
        'chrome,centerscreen,resizable=yes,width=500,height=600',
        null
      );

      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(async () => {
          if (win.closed) {
            clearInterval(checkClosed);
            await this.checkWebsiteAuthStatus();
            if (this.isAuthenticated) {
              resolve(this.currentUser);
            } else {
              reject(new Error('Login cancelled or failed'));
            }
          }
        }, 1000);

        setTimeout(() => {
          clearInterval(checkClosed);
          if (!win.closed) {
            win.close();
          }
          reject(new Error('Login timeout'));
        }, 300000);
      });
    } catch (error) {
      this.log(`Error opening login window: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 处理登录回调
   */
  async handleLoginCallback(authCode) {
    try {
      this.log("Processing login callback");
      
      const response = await this.makeAuthRequest('/token', {
        method: 'POST',
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: authCode,
          client_id: 'zotero-plugin'
        })
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        this.saveAuthInfo(
          data.access_token,
          data.user,
          data.refresh_token,
          data.expires_in
        );
        
        this.log(`Login successful for user: ${data.user.username}`);
        return data.user;
      } else {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.log(`Login callback error: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 刷新访问令牌
   */
  async refreshAuthToken() {
    if (!this.refreshToken) {
      this.log("No refresh token available", 'warn');
      return false;
    }

    try {
      this.log("Refreshing auth token");
      
      const response = await this.makeAuthRequest('/token', {
        method: 'POST',
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: 'zotero-plugin'
        })
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        this.saveAuthInfo(
          data.access_token,
          data.user || this.currentUser,
          data.refresh_token || this.refreshToken,
          data.expires_in
        );
        
        this.log("Token refreshed successfully");
        return true;
      } else {
        this.log(`Token refresh failed: ${response.status}`, 'error');
        this.clearStoredAuth();
        return false;
      }
    } catch (error) {
      this.log(`Token refresh error: ${error.message}`, 'error');
      this.clearStoredAuth();
      return false;
    }
  },

  /**
   * 设置自动令牌刷新
   */
  setupTokenRefresh() {
    // 每30分钟检查一次令牌是否需要刷新
    setInterval(() => {
      if (this.isAuthenticated && this.authToken) {
        const expiry = Zotero.Prefs.get(`extensions.researchopia.${this.config.tokenExpiryKey}`, 0);
        const timeUntilExpiry = expiry - Date.now();

        // 如果令牌在10分钟内过期，尝试刷新
        if (timeUntilExpiry < 600000) { // 10分钟 = 600000毫秒
          this.refreshAuthToken();
        }
      }
    }, 1800000); // 30分钟 = 1800000毫秒
  },

  /**
   * 启动主网站认证状态检查
   */
  startWebsiteAuthCheck() {
    try {
      // 每5分钟检查一次主网站的登录状态
      if (this.websiteAuthTimer) {
        clearInterval(this.websiteAuthTimer);
      }

      this.websiteAuthTimer = setInterval(() => {
        this.checkWebsiteAuthStatus();
      }, 5 * 60 * 1000); // 5分钟

      // 立即执行一次检查
      setTimeout(() => {
        this.checkWebsiteAuthStatus();
      }, 2000); // 2秒后执行，避免启动时的冲突

      this.log("Website auth check timer setup completed");
    } catch (error) {
      this.log(`Error setting up website auth check: ${error.message}`, 'error');
    }
  },

  /**
   * 检查主网站的认证状态
   */
  async checkWebsiteAuthStatus() {
    try {
      this.log("Checking website authentication status...");

      const hosts = [
        'http://localhost:3001', // 当前运行端口
        'http://localhost:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3000',
        'https://researchopia.com'
      ];

      for (const host of hosts) {
        const statusUrl = `${host}/api/auth/status`;
        try {
          const response = await this.httpGetJson(statusUrl, { withCredentials: true, timeout: 5000 });
          if (response) {
            // 命中可用主机，更新authBaseUrl
            this.config.authBaseUrl = `${host}/api/auth`;
            this.handleWebsiteAuthResponse(response);
            return;
          }
        } catch (err) {
          // 继续尝试下一个候选主机
          this.log(`Auth status probe failed for ${host}: ${err.message}`, 'warn');
        }
      }

      this.log('No reachable auth host found for status check', 'warn');
    } catch (error) {
      this.log(`Error checking website auth status: ${error.message}`, 'error');
    }
  },

  /**
   * 以JSON形式GET指定URL（支持withCredentials），返回解析对象
   */
  httpGetJson(url, opts = {}) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.timeout = opts.timeout || 8000;
        xhr.open('GET', url, true);

        // 在open之后设置withCredentials，避免Zotero环境报错
        if (typeof opts.withCredentials === 'boolean') {
          xhr.withCredentials = opts.withCredentials;
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText || '{}');
              resolve(data);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.send();
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * 处理主网站认证响应
   */
  handleWebsiteAuthResponse(response) {
    try {
      if (response && response.authenticated) {
        this.log("User is authenticated on website");

        // 更新本地认证状态
        if (response.user) {
          this.currentUser = response.user;
          this.authToken = response.token || this.authToken;
          this.isAuthenticated = true;

          // 保存认证信息
          this.saveAuthData();

          // 通知UI更新
          this.notifyAuthStatusChange(true, false);

          this.log(`Synced user from website: ${response.user.name || response.user.email}`);
        }
      } else {
        // 用户在网站上未登录，但本地可能还有token
        if (this.isAuthenticated) {
          this.log("User logged out from website, clearing local auth");
          this.logout();
        }
      }
    } catch (error) {
      this.log(`Error handling website auth response: ${error.message}`, 'error');
    }
  },

  /**
   * 通知认证状态变化
   */
  notifyAuthStatusChange(isAuthenticated, isAnonymous) {
    try {
      this.log(`Notifying auth status change: authenticated=${isAuthenticated}, anonymous=${isAnonymous}`);

      // 通知用户界面更新
      if (typeof UserInterface !== 'undefined' && UserInterface.onAuthStatusChanged) {
        UserInterface.onAuthStatusChanged(isAuthenticated, isAnonymous);
      }

      // 通知其他模块
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('researchopia-auth-changed', {
          detail: { isAuthenticated, isAnonymous, user: this.currentUser }
        }));
      }
    } catch (error) {
      this.log(`Error notifying auth status change: ${error.message}`, 'error');
    }
  },

  /**
   * 登出
   */
  async logout() {
    try {
      this.log("Logging out user");
      
      if (this.authToken) {
        // 通知服务器登出
        await this.makeAuthRequest('/logout', {
          method: 'POST'
        });
      }
      
      this.clearStoredAuth();
      this.log("Logout successful");
    } catch (error) {
      this.log(`Logout error: ${error.message}`, 'error');
      // 即使服务器请求失败，也要清除本地认证信息
      this.clearStoredAuth();
    }
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    return this.currentUser;
  },

  /**
   * 检查是否已认证
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.authToken && this.currentUser;
  },

  /**
   * 获取认证头
   */
  getAuthHeaders() {
    if (!this.authToken) {
      return {};
    }
    
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json'
    };
  },

  /**
   * 发送认证请求
   */
  makeAuthRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.config.authBaseUrl}${endpoint}`;
      
      xhr.timeout = options.timeout || 10000;
      xhr.open(options.method || 'GET', url, true);
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      if (this.authToken && !endpoint.includes('/token')) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });
      
      xhr.onload = function() {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          ok: xhr.status >= 200 && xhr.status < 300
        });
      };
      
      xhr.onerror = function() {
        reject(new Error(`Network error: ${xhr.statusText || 'Connection failed'}`));
      };
      
      xhr.ontimeout = function() {
        reject(new Error(`Request timeout after ${xhr.timeout}ms`));
      };
      
      xhr.send(options.body || null);
    });
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}

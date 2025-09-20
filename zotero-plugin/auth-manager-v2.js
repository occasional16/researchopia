/*
 * 研学港 Zotero插件 - 认证管理器 v2.0
 * Authentication Manager for Researchopia Zotero Plugin v2.0
 */

Zotero.Researchopia.AuthManager = {
  // 配置
  config: {
    apiPorts: [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009],
    currentApiUrl: null,
    tokenKey: 'researchopia.userInfo',
    refreshTokenKey: 'researchopia.refreshToken',
    tokenExpiryKey: 'researchopia.tokenExpiry'
  },

  // 状态
  state: {
    isAuthenticated: false,
    userInfo: null,
    token: null,
    refreshToken: null,
    tokenExpiry: null
  },

  /**
   * 初始化认证管理器
   */
  init() {
    try {
      this.loadStoredAuth();
      this.log('Auth Manager initialized');
    } catch (error) {
      this.log('Failed to initialize Auth Manager: ' + error.message);
    }
  },

  /**
   * 加载存储的认证信息
   */
  loadStoredAuth() {
    try {
      const userInfo = Zotero.Prefs.get(this.config.tokenKey, null);
      const refreshToken = Zotero.Prefs.get(this.config.refreshTokenKey, null);
      const tokenExpiry = Zotero.Prefs.get(this.config.tokenExpiryKey, null);

      if (userInfo && userInfo.token) {
        this.state.userInfo = userInfo;
        this.state.token = userInfo.token;
        this.state.refreshToken = refreshToken;
        this.state.tokenExpiry = tokenExpiry ? new Date(tokenExpiry) : null;
        
        // 检查token是否过期
        if (this.isTokenExpired()) {
          this.log('Stored token is expired');
          this.clearAuth();
        } else {
          this.state.isAuthenticated = true;
          this.log('Loaded stored authentication');
        }
      }
    } catch (error) {
      this.log('Failed to load stored auth: ' + error.message);
      this.clearAuth();
    }
  },

  /**
   * 检查token是否过期
   */
  isTokenExpired() {
    if (!this.state.tokenExpiry) return true;
    return new Date() >= this.state.tokenExpiry;
  },

  /**
   * 检测可用的API端口
   */
  async detectAvailablePort() {
    for (const port of this.config.apiPorts) {
      try {
        const isAvailable = await this.testPortAvailability(port);
        if (isAvailable) {
          this.config.currentApiUrl = `http://localhost:${port}`;
          this.log(`Found available API port: ${port}`);
          return true;
        }
      } catch (error) {
        this.log(`Port ${port} not available: ${error.message}`);
      }
    }
    
    this.log('No available ports found');
    return false;
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
   * 用户登录
   */
  async login(credentials) {
    try {
      // 检测可用端口
      const portAvailable = await this.detectAvailablePort();
      if (!portAvailable) {
        throw new Error('无法连接到研学港服务器，请确保服务器正在运行');
      }

      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      if (response && response.success) {
        await this.saveAuth(response.data);
        this.log('Login successful');
        return { success: true, user: response.data };
      } else {
        throw new Error(response?.error?.message || '登录失败');
      }

    } catch (error) {
      this.log('Login failed: ' + error.message);
      throw error;
    }
  },

  /**
   * 用户注册
   */
  async register(userData) {
    try {
      const portAvailable = await this.detectAvailablePort();
      if (!portAvailable) {
        throw new Error('无法连接到研学港服务器，请确保服务器正在运行');
      }

      const response = await this.makeRequest('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      if (response && response.success) {
        await this.saveAuth(response.data);
        this.log('Registration successful');
        return { success: true, user: response.data };
      } else {
        throw new Error(response?.error?.message || '注册失败');
      }

    } catch (error) {
      this.log('Registration failed: ' + error.message);
      throw error;
    }
  },

  /**
   * 刷新token
   */
  async refreshToken() {
    try {
      if (!this.state.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.makeRequest('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: this.state.refreshToken
        })
      });

      if (response && response.success) {
        await this.saveAuth(response.data);
        this.log('Token refreshed successfully');
        return true;
      } else {
        throw new Error('Token refresh failed');
      }

    } catch (error) {
      this.log('Token refresh failed: ' + error.message);
      this.clearAuth();
      return false;
    }
  },

  /**
   * 验证token
   */
  async validateToken() {
    try {
      if (!this.state.token) {
        return false;
      }

      const response = await this.makeRequest('/api/auth/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.state.token}`
        }
      });

      return response && response.success;

    } catch (error) {
      this.log('Token validation failed: ' + error.message);
      return false;
    }
  },

  /**
   * 登出
   */
  async logout() {
    try {
      if (this.state.token) {
        try {
          await this.makeRequest('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.state.token}`
            }
          });
        } catch (error) {
          this.log('Logout request failed: ' + error.message);
        }
      }

      this.clearAuth();
      this.log('Logout successful');

    } catch (error) {
      this.log('Logout failed: ' + error.message);
    }
  },

  /**
   * 保存认证信息
   */
  async saveAuth(authData) {
    try {
      const userInfo = {
        id: authData.user.id,
        name: authData.user.name,
        email: authData.user.email,
        avatar: authData.user.avatar,
        token: authData.token
      };

      const tokenExpiry = new Date();
      tokenExpiry.setTime(tokenExpiry.getTime() + (authData.expiresIn || 3600) * 1000);

      // 保存到Zotero偏好设置
      Zotero.Prefs.set(this.config.tokenKey, userInfo);
      Zotero.Prefs.set(this.config.refreshTokenKey, authData.refreshToken || '');
      Zotero.Prefs.set(this.config.tokenExpiryKey, tokenExpiry.toISOString());

      // 更新状态
      this.state.isAuthenticated = true;
      this.state.userInfo = userInfo;
      this.state.token = authData.token;
      this.state.refreshToken = authData.refreshToken || '';
      this.state.tokenExpiry = tokenExpiry;

      this.log('Auth data saved successfully');

    } catch (error) {
      this.log('Failed to save auth data: ' + error.message);
      throw error;
    }
  },

  /**
   * 清除认证信息
   */
  clearAuth() {
    try {
      Zotero.Prefs.clear(this.config.tokenKey);
      Zotero.Prefs.clear(this.config.refreshTokenKey);
      Zotero.Prefs.clear(this.config.tokenExpiryKey);

      this.state.isAuthenticated = false;
      this.state.userInfo = null;
      this.state.token = null;
      this.state.refreshToken = null;
      this.state.tokenExpiry = null;

      this.log('Auth data cleared');

    } catch (error) {
      this.log('Failed to clear auth data: ' + error.message);
    }
  },

  /**
   * 获取认证头
   */
  getAuthHeaders() {
    if (!this.state.isAuthenticated || !this.state.token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${this.state.token}`
    };
  },

  /**
   * 检查是否需要刷新token
   */
  shouldRefreshToken() {
    if (!this.state.tokenExpiry) return false;
    
    const now = new Date();
    const expiry = new Date(this.state.tokenExpiry);
    const timeUntilExpiry = expiry.getTime() - now.getTime();
    
    // 如果token在5分钟内过期，则需要刷新
    return timeUntilExpiry < 5 * 60 * 1000;
  },

  /**
   * 自动刷新token
   */
  async autoRefreshToken() {
    if (this.shouldRefreshToken()) {
      this.log('Auto-refreshing token');
      return await this.refreshToken();
    }
    return true;
  },

  /**
   * 发送HTTP请求
   */
  async makeRequest(url, options = {}) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.config.currentApiUrl}${url}`;
      
      // 自动添加认证头
      const headers = {
        ...options.headers,
        ...this.getAuthHeaders()
      };

      const response = await fetch(fullUrl, {
        timeout: 10000,
        ...options,
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token过期，尝试刷新
          this.log('Token expired, attempting refresh');
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // 重新发送请求
            return await this.makeRequest(url, options);
          } else {
            throw new Error('Authentication failed');
          }
        }
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
   * 显示登录对话框
   */
  showLoginDialog() {
    return new Promise((resolve) => {
      const dialog = new Zotero.ProgressWindow();
      dialog.changeHeadline('研学港登录');
      dialog.addDescription('请选择登录方式：');
      
      // 这里可以添加更复杂的登录界面
      // 暂时使用简单的提示
      dialog.addDescription('请在浏览器中打开研学港网站进行登录');
      dialog.show();
      
      // 打开登录页面
      const loginUrl = `${this.config.currentApiUrl}/auth/login`;
      Zotero.launchURL(loginUrl);
      
      resolve({ success: false, message: '请在浏览器中完成登录' });
    });
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return this.state.userInfo;
  },

  /**
   * 检查是否已认证
   */
  isAuthenticated() {
    return this.state.isAuthenticated && !this.isTokenExpired();
  },

  /**
   * 日志记录
   */
  log(msg) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] AuthManager: ${msg}`;
    
    Zotero.debug(logMessage);
    
    try {
      console.log(logMessage);
    } catch (e) {
      // 忽略控制台错误
    }
  }
};

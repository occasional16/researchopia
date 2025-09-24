/**
 * 用户认证管理器 - 与Supabase集成
 */
class AuthManager {
  constructor() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authToken = null;
    this.supabaseUrl = 'https://your-project.supabase.co'; // TODO: 配置实际URL
    this.supabaseKey = 'your-anon-key'; // TODO: 配置实际密钥
  }

  /**
   * 初始化认证管理器
   */
  async initialize() {
    try {
      // 检查本地存储的认证信息
      await this.loadStoredAuth();
      
      if (this.authToken) {
        // 验证token有效性
        const isValid = await this.validateToken();
        if (!isValid) {
          await this.clearAuth();
        }
      }
      
      Zotero.debug('AuthManager: Initialized');
    } catch (error) {
      Zotero.debug(`AuthManager: Initialization failed: ${error.message}`);
    }
  }

  /**
   * 用户登录
   * @param {string} email - 邮箱
   * @param {string} password - 密码
   * @returns {Promise<boolean>} 登录结果
   */
  async login(email, password) {
    try {
      const response = await this.makeAuthRequest('/auth/v1/token?grant_type=password', {
        email,
        password
      });

      if (response.access_token) {
        this.authToken = response.access_token;
        this.currentUser = response.user;
        this.isAuthenticated = true;
        
        await this.saveAuth();
        Zotero.debug('AuthManager: Login successful');
        return true;
      }
      
      return false;
    } catch (error) {
      Zotero.debug(`AuthManager: Login failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 用户登出
   */
  async logout() {
    try {
      if (this.authToken) {
        await this.makeAuthRequest('/auth/v1/logout', {}, 'POST');
      }
    } catch (error) {
      Zotero.debug(`AuthManager: Logout request failed: ${error.message}`);
    } finally {
      await this.clearAuth();
      Zotero.debug('AuthManager: Logged out');
    }
  }

  /**
   * 获取当前用户信息
   * @returns {Object|null} 用户信息
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 检查是否已认证
   * @returns {boolean} 认证状态
   */
  isLoggedIn() {
    return this.isAuthenticated && this.authToken && this.currentUser;
  }

  /**
   * 获取认证头
   * @returns {Object} 认证头
   */
  getAuthHeaders() {
    if (!this.authToken) {
      return {};
    }
    
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'apikey': this.supabaseKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 验证token有效性
   * @returns {Promise<boolean>} token是否有效
   */
  async validateToken() {
    try {
      const response = await this.makeAuthRequest('/auth/v1/user', {}, 'GET');
      return !!response.id;
    } catch (error) {
      Zotero.debug(`AuthManager: Token validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 发起认证请求
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   * @param {string} method - HTTP方法
   * @returns {Promise<Object>} 响应数据
   */
  async makeAuthRequest(endpoint, data = {}, method = 'POST') {
    const url = this.supabaseUrl + endpoint;
    const headers = {
      'apikey': this.supabaseKey,
      'Content-Type': 'application/json'
    };

    if (this.authToken && method !== 'POST') {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const options = {
      method,
      headers
    };

    if (method !== 'GET' && Object.keys(data).length > 0) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 保存认证信息到本地
   */
  async saveAuth() {
    try {
      const authData = {
        token: this.authToken,
        user: this.currentUser,
        timestamp: Date.now()
      };
      
      // 使用Zotero的偏好设置存储
      Zotero.Prefs.set('extensions.researchopia.auth', JSON.stringify(authData));
    } catch (error) {
      Zotero.debug(`AuthManager: Failed to save auth: ${error.message}`);
    }
  }

  /**
   * 从本地加载认证信息
   */
  async loadStoredAuth() {
    try {
      const authDataStr = Zotero.Prefs.get('extensions.researchopia.auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        
        // 检查是否过期（24小时）
        const isExpired = Date.now() - authData.timestamp > 24 * 60 * 60 * 1000;
        if (!isExpired) {
          this.authToken = authData.token;
          this.currentUser = authData.user;
          this.isAuthenticated = true;
        }
      }
    } catch (error) {
      Zotero.debug(`AuthManager: Failed to load stored auth: ${error.message}`);
    }
  }

  /**
   * 清除认证信息
   */
  async clearAuth() {
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authToken = null;
    
    try {
      Zotero.Prefs.clear('extensions.researchopia.auth');
    } catch (error) {
      Zotero.debug(`AuthManager: Failed to clear auth: ${error.message}`);
    }
  }

  /**
   * 显示登录对话框
   * @returns {Promise<boolean>} 登录结果
   */
  async showLoginDialog() {
    return new Promise((resolve) => {
      // TODO: 实现登录对话框UI
      // 这里可以创建一个简单的对话框或者打开网页登录
      const email = prompt('请输入邮箱:');
      const password = prompt('请输入密码:');
      
      if (email && password) {
        this.login(email, password).then(resolve);
      } else {
        resolve(false);
      }
    });
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
} else if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}

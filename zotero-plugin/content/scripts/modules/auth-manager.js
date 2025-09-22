/**
 * 认证管理器 - Auth Manager
 * 负责用户认证和会话管理
 */

class AuthManager {
  constructor() {
    this.initialized = false;
    this.currentUser = null;
    this.authToken = null;
    this.authWindow = null;
    this.authCheckInterval = null;
    this.isAuthenticating = false;
    
    Researchopia.log('AuthManager initialized');
  }

  /**
   * 初始化认证管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 恢复保存的认证状态
      await this.restoreAuthState();
      
      // 验证当前认证状态
      if (this.authToken) {
        await this.validateAuthToken();
      }
      
      // 启动定期认证检查
      this.startAuthCheck();
      
      Researchopia.log('AuthManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.initialize');
    }
  }

  /**
   * 启动认证流程
   */
  async startAuthentication() {
    try {
      if (this.isAuthenticating) {
        Researchopia.log('Authentication already in progress');
        return;
      }

      this.isAuthenticating = true;
      Researchopia.log('Starting authentication process');

      // 获取服务器URL
      const serverUrl = Researchopia.config.activeServerUrl || await this.getActiveServerUrl();
      const authUrl = `${serverUrl}/plugin/auth`;

      // 打开认证窗口
      this.authWindow = window.open(
        authUrl,
        'researchopia-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!this.authWindow) {
        throw new Error('Failed to open authentication window');
      }

      // 监听认证结果
      return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
          try {
            if (event.origin !== new URL(serverUrl).origin) {
              return; // 忽略非目标域的消息
            }

            if (event.data?.type === 'AUTH_STATUS_RESPONSE' && event.data?.source === 'researchopia-auth') {
              window.removeEventListener('message', messageHandler);
              
              if (event.data.authenticated) {
                this.handleAuthSuccess(event.data);
                resolve(this.currentUser);
              } else {
                this.handleAuthFailure('Authentication failed');
                reject(new Error('Authentication failed'));
              }
            }
          } catch (error) {
            window.removeEventListener('message', messageHandler);
            this.handleAuthFailure(error.message);
            reject(error);
          }
        };

        window.addEventListener('message', messageHandler);

        // 监听窗口关闭
        const checkClosed = setInterval(() => {
          if (this.authWindow && this.authWindow.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            
            if (!this.currentUser) {
              this.handleAuthFailure('Authentication window closed');
              reject(new Error('Authentication cancelled'));
            }
          }
        }, 1000);

        // 设置超时
        setTimeout(() => {
          if (this.isAuthenticating) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            this.handleAuthFailure('Authentication timeout');
            reject(new Error('Authentication timeout'));
          }
        }, 300000); // 5分钟超时
      });

    } catch (error) {
      this.handleAuthFailure(error.message);
      throw error;
    }
  }

  /**
   * 处理认证成功
   * @param {Object} authData - 认证数据
   */
  handleAuthSuccess(authData) {
    try {
      this.currentUser = authData.user;
      this.authToken = authData.token;
      this.isAuthenticating = false;

      // 关闭认证窗口
      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }

      // 保存认证状态
      this.saveAuthState();

      // 通知其他模块
      this.notifyAuthStateChange(true);

      Researchopia.log(`Authentication successful for user: ${this.currentUser.name}`);
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.handleAuthSuccess');
    }
  }

  /**
   * 处理认证失败
   * @param {string} reason - 失败原因
   */
  handleAuthFailure(reason) {
    try {
      this.isAuthenticating = false;

      // 关闭认证窗口
      if (this.authWindow) {
        this.authWindow.close();
        this.authWindow = null;
      }

      Researchopia.log(`Authentication failed: ${reason}`);
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.handleAuthFailure');
    }
  }

  /**
   * 登出
   */
  async logout() {
    try {
      Researchopia.log('Logging out user');

      // 清除认证状态
      this.currentUser = null;
      this.authToken = null;

      // 清除保存的状态
      this.clearAuthState();

      // 通知其他模块
      this.notifyAuthStateChange(false);

      Researchopia.log('Logout completed');
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.logout');
    }
  }

  /**
   * 验证认证令牌
   */
  async validateAuthToken() {
    try {
      if (!this.authToken) {
        return false;
      }

      const serverUrl = Researchopia.config.activeServerUrl || await this.getActiveServerUrl();
      const response = await fetch(`${serverUrl}/api/auth/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          this.currentUser = data.user;
          return true;
        }
      }

      // 令牌无效，清除认证状态
      this.currentUser = null;
      this.authToken = null;
      this.clearAuthState();
      
      return false;
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.validateAuthToken');
      return false;
    }
  }

  /**
   * 获取活跃的服务器URL
   */
  async getActiveServerUrl() {
    // 优先尝试本地开发服务器
    for (const url of Researchopia.config.localUrls) {
      try {
        const response = await fetch(`${url}/api/v1/health`, {
          method: 'GET',
          timeout: 3000
        });
        if (response.ok) {
          Researchopia.config.activeServerUrl = url;
          return url;
        }
      } catch (error) {
        // 继续尝试下一个URL
      }
    }
    
    // 回退到生产服务器
    Researchopia.config.activeServerUrl = Researchopia.config.serverUrl;
    return Researchopia.config.serverUrl;
  }

  /**
   * 启动定期认证检查
   */
  startAuthCheck() {
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }

    this.authCheckInterval = setInterval(async () => {
      if (this.authToken) {
        const isValid = await this.validateAuthToken();
        if (!isValid) {
          Researchopia.log('Auth token expired, user needs to re-authenticate');
          this.notifyAuthStateChange(false);
        }
      }
    }, 300000); // 每5分钟检查一次

    Researchopia.log('Auth check started');
  }

  /**
   * 停止认证检查
   */
  stopAuthCheck() {
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
      this.authCheckInterval = null;
      Researchopia.log('Auth check stopped');
    }
  }

  /**
   * 通知认证状态变化
   * @param {boolean} isAuthenticated - 是否已认证
   */
  notifyAuthStateChange(isAuthenticated) {
    try {
      // 通知UI管理器更新界面
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAuthStatus(isAuthenticated, this.currentUser);
      }

      // 通知同步管理器
      if (Researchopia.modules.syncManager) {
        if (isAuthenticated) {
          Researchopia.modules.syncManager.triggerManualSync();
        }
      }

      // 通知实时协作管理器
      if (Researchopia.modules.realtimeManager) {
        if (isAuthenticated) {
          Researchopia.modules.realtimeManager.connect();
        } else {
          Researchopia.modules.realtimeManager.disconnect();
        }
      }

      Researchopia.log(`Auth state changed: ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`);
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.notifyAuthStateChange');
    }
  }

  /**
   * 保存认证状态
   */
  saveAuthState() {
    try {
      const authState = {
        user: this.currentUser,
        token: this.authToken,
        timestamp: Date.now()
      };

      Zotero.Prefs.set('extensions.researchopia.authState', JSON.stringify(authState));
      Researchopia.log('Auth state saved');
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.saveAuthState');
    }
  }

  /**
   * 恢复认证状态
   */
  async restoreAuthState() {
    try {
      const authStateJson = Zotero.Prefs.get('extensions.researchopia.authState');
      if (authStateJson) {
        const authState = JSON.parse(authStateJson);
        
        // 检查状态是否过期（24小时）
        const maxAge = 24 * 60 * 60 * 1000; // 24小时
        if (Date.now() - authState.timestamp < maxAge) {
          this.currentUser = authState.user;
          this.authToken = authState.token;
          Researchopia.log('Auth state restored');
        } else {
          Researchopia.log('Saved auth state expired');
          this.clearAuthState();
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.restoreAuthState');
      this.clearAuthState();
    }
  }

  /**
   * 清除认证状态
   */
  clearAuthState() {
    try {
      Zotero.Prefs.clear('extensions.researchopia.authState');
      Researchopia.log('Auth state cleared');
    } catch (error) {
      Researchopia.handleError(error, 'AuthManager.clearAuthState');
    }
  }

  /**
   * 获取当前用户
   * @returns {Object|null} 当前用户对象
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 获取认证令牌
   * @returns {string|null} 认证令牌
   */
  getToken() {
    return this.authToken;
  }

  /**
   * 设置认证令牌（用于测试）
   * @param {string} token - 认证令牌
   */
  setToken(token) {
    this.authToken = token;
  }

  /**
   * 检查是否已认证
   * @returns {boolean} 是否已认证
   */
  isAuthenticated() {
    return !!(this.currentUser && this.authToken);
  }

  /**
   * 获取认证状态
   * @returns {Object} 认证状态对象
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated(),
      user: this.currentUser,
      isAuthenticating: this.isAuthenticating
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopAuthCheck();
    
    if (this.authWindow) {
      this.authWindow.close();
      this.authWindow = null;
    }

    this.initialized = false;
    this.isAuthenticating = false;
    
    Researchopia.log('AuthManager cleaned up');
  }
}

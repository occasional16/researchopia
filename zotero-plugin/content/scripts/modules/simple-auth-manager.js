/**
 * 简化认证管理器 - Simple Auth Manager
 * 专门为Zotero环境设计的轻量级认证系统
 */

class SimpleAuthManager {
  constructor() {
    this.initialized = false;
    this.isAuthenticated = false;
    this.currentUser = null;
    this.authToken = null;
    this.baseURL = 'https://www.researchopia.com';
    
    if (typeof Researchopia !== 'undefined') {
      Researchopia.log('SimpleAuthManager initialized');
    }
  }

  /**
   * 初始化认证管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 尝试从本地存储恢复认证状态
      await this.restoreAuthState();
      
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('SimpleAuthManager initialization completed');
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.handleError(error, 'SimpleAuthManager.initialize');
      }
    }
  }

  /**
   * 恢复认证状态
   */
  async restoreAuthState() {
    try {
      // 从Zotero偏好设置中读取认证信息
      const savedToken = Zotero.Prefs.get('extensions.researchopia.authToken', '');
      const savedUser = Zotero.Prefs.get('extensions.researchopia.currentUser', '');
      
      if (savedToken && savedUser) {
        this.authToken = savedToken;
        try {
          this.currentUser = JSON.parse(savedUser);
          this.isAuthenticated = true;
          
          if (typeof Researchopia !== 'undefined') {
            Researchopia.log('Auth state restored: ' + this.currentUser.name);
          }
        } catch (parseError) {
          // 清除无效的用户数据
          this.clearAuthState();
        }
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Failed to restore auth state: ' + error.message);
      }
    }
  }

  /**
   * 保存认证状态
   */
  async saveAuthState() {
    try {
      if (this.authToken && this.currentUser) {
        Zotero.Prefs.set('extensions.researchopia.authToken', this.authToken);
        Zotero.Prefs.set('extensions.researchopia.currentUser', JSON.stringify(this.currentUser));
      } else {
        this.clearAuthState();
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Failed to save auth state: ' + error.message);
      }
    }
  }

  /**
   * 清除认证状态
   */
  clearAuthState() {
    try {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.authToken = null;
      
      Zotero.Prefs.clear('extensions.researchopia.authToken');
      Zotero.Prefs.clear('extensions.researchopia.currentUser');
      
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Auth state cleared');
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Failed to clear auth state: ' + error.message);
      }
    }
  }

  /**
   * 打开认证页面
   */
  async openAuthPage() {
    try {
      const authURL = this.baseURL + '/plugin/auth?source=zotero&version=0.1.92';
      
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Opening auth page: ' + authURL);
      }
      
      // 在默认浏览器中打开认证页面
      Zotero.launchURL(authURL);
      
      // 显示认证指引
      const message = '🔐 认证页面已在浏览器中打开\n\n' +
                     '请在浏览器中完成登录，然后返回Zotero\n' +
                     '登录成功后，插件将自动获取您的认证信息';
      
      Zotero.alert(null, 'Researchopia 认证', message);
      
      // 开始轮询认证状态
      this.startAuthPolling();
      
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.handleError(error, 'SimpleAuthManager.openAuthPage');
      }
      
      Zotero.alert(null, 'Researchopia', '打开认证页面失败: ' + error.message);
    }
  }

  /**
   * 开始轮询认证状态
   */
  startAuthPolling() {
    if (typeof Researchopia !== 'undefined') {
      Researchopia.log('Starting auth polling...');
    }
    
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询60次（5分钟）
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        const authResult = await this.checkAuthStatus();
        
        if (authResult.success) {
          clearInterval(pollInterval);
          
          this.isAuthenticated = true;
          this.currentUser = authResult.user;
          this.authToken = authResult.token;
          
          await this.saveAuthState();
          
          if (typeof Researchopia !== 'undefined') {
            Researchopia.log('Authentication successful: ' + this.currentUser.name);
          }
          
          Zotero.alert(null, 'Researchopia', 
            '🎉 认证成功！\n\n' +
            '欢迎，' + this.currentUser.name + '！\n' +
            '您现在可以分享和查看标注了。'
          );
          
          // 触发认证成功事件
          this.onAuthSuccess();
          
        } else if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          
          if (typeof Researchopia !== 'undefined') {
            Researchopia.log('Auth polling timeout');
          }
          
          Zotero.alert(null, 'Researchopia', 
            '⏰ 认证超时\n\n' +
            '请重新尝试登录，或检查网络连接。'
          );
        }
      } catch (error) {
        if (typeof Researchopia !== 'undefined') {
          Researchopia.log('Auth polling error: ' + error.message);
        }
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 检查认证状态
   */
  async checkAuthStatus() {
    try {
      // 模拟认证检查
      // 在实际实现中，这里会调用API检查认证状态
      
      // 暂时返回模拟的成功结果（用于测试）
      if (Math.random() > 0.8) { // 20%的概率返回成功（模拟用户完成登录）
        return {
          success: true,
          user: {
            id: 'user_' + Date.now(),
            name: '测试用户',
            email: 'test@researchopia.com',
            avatar: null
          },
          token: 'mock_token_' + Date.now()
        };
      }
      
      return { success: false };
      
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Check auth status failed: ' + error.message);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * 认证成功回调
   */
  onAuthSuccess() {
    try {
      // 通知其他组件认证成功
      if (typeof Researchopia !== 'undefined' && Researchopia.eventBus) {
        Researchopia.eventBus.emit('auth:success', {
          user: this.currentUser,
          token: this.authToken
        });
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Auth success callback failed: ' + error.message);
      }
    }
  }

  /**
   * 登出
   */
  async logout() {
    try {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('Logging out user: ' + (this.currentUser ? this.currentUser.name : 'unknown'));
      }
      
      this.clearAuthState();
      
      Zotero.alert(null, 'Researchopia', '已成功登出');
      
      // 通知其他组件登出
      if (typeof Researchopia !== 'undefined' && Researchopia.eventBus) {
        Researchopia.eventBus.emit('auth:logout');
      }
      
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.handleError(error, 'SimpleAuthManager.logout');
      }
    }
  }

  /**
   * 获取认证状态
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.currentUser,
      hasToken: !!this.authToken
    };
  }

  /**
   * 获取认证头
   */
  getAuthHeaders() {
    if (this.authToken) {
      return {
        'Authorization': 'Bearer ' + this.authToken,
        'X-Researchopia-Client': 'zotero-plugin-v0.1.92'
      };
    }
    return {};
  }

  /**
   * 关闭管理器
   */
  async shutdown() {
    try {
      await this.saveAuthState();
      this.initialized = false;
      
      if (typeof Researchopia !== 'undefined') {
        Researchopia.log('SimpleAuthManager shutdown completed');
      }
    } catch (error) {
      if (typeof Researchopia !== 'undefined') {
        Researchopia.handleError(error, 'SimpleAuthManager.shutdown');
      }
    }
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleAuthManager;
} else {
  // 浏览器/Zotero环境
  if (typeof window !== 'undefined') {
    window.SimpleAuthManager = SimpleAuthManager;
  } else {
    globalThis.SimpleAuthManager = SimpleAuthManager;
  }
}

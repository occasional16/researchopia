/**
 * 认证桥接脚本 - Auth Bridge Script
 * 用于在Zotero插件和研学港网站之间建立认证通信桥梁
 */

(function() {
  'use strict';

  // 检查是否在认证页面
  if (!window.location.href.includes('/plugin/auth')) {
    return;
  }

  console.log('Researchopia Auth Bridge loaded');

  // 认证桥接对象
  const AuthBridge = {
    initialized: false,
    messageHandlers: new Map(),
    
    /**
     * 初始化认证桥接
     */
    init() {
      if (this.initialized) return;
      
      this.initialized = true;
      this.setupMessageHandlers();
      this.setupAuthStateMonitoring();
      
      console.log('Auth Bridge initialized');
    },

    /**
     * 设置消息处理器
     */
    setupMessageHandlers() {
      // 监听来自插件的消息
      window.addEventListener('message', (event) => {
        try {
          // 验证消息来源
          if (!this.isValidOrigin(event.origin)) {
            return;
          }

          const { type, source, data } = event.data;
          
          if (source === 'zotero-plugin') {
            this.handlePluginMessage(type, data, event);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // 注册消息处理器
      this.messageHandlers.set('REQUEST_AUTH_STATUS', this.handleAuthStatusRequest.bind(this));
      this.messageHandlers.set('PING', this.handlePing.bind(this));
    },

    /**
     * 设置认证状态监控
     */
    setupAuthStateMonitoring() {
      // 监控认证状态变化
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'attributes') {
            this.checkAuthStateChange();
          }
        });
      });

      // 观察整个文档的变化
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-authenticated']
      });

      // 定期检查认证状态
      setInterval(() => {
        this.checkAuthStateChange();
      }, 2000);
    },

    /**
     * 检查认证状态变化
     */
    checkAuthStateChange() {
      try {
        const authStatus = this.getCurrentAuthStatus();
        
        // 如果状态发生变化，通知插件
        if (this.lastAuthStatus !== authStatus.authenticated) {
          this.lastAuthStatus = authStatus.authenticated;
          this.sendAuthStatusToPlugin(authStatus);
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
      }
    },

    /**
     * 获取当前认证状态
     */
    getCurrentAuthStatus() {
      try {
        // 尝试从页面元素获取认证状态
        const authIndicator = document.querySelector('[data-authenticated]');
        if (authIndicator) {
          const isAuthenticated = authIndicator.dataset.authenticated === 'true';
          const userInfo = this.extractUserInfo();
          
          return {
            authenticated: isAuthenticated,
            user: userInfo,
            timestamp: Date.now()
          };
        }

        // 尝试从全局变量获取
        if (window.authStatus) {
          return window.authStatus;
        }

        // 尝试从localStorage获取
        const storedAuth = localStorage.getItem('auth-status');
        if (storedAuth) {
          return JSON.parse(storedAuth);
        }

        // 默认未认证状态
        return {
          authenticated: false,
          user: null,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Error getting auth status:', error);
        return {
          authenticated: false,
          user: null,
          timestamp: Date.now()
        };
      }
    },

    /**
     * 提取用户信息
     */
    extractUserInfo() {
      try {
        // 尝试从页面元素提取用户信息
        const userNameElement = document.querySelector('.user-name, [data-user-name]');
        const userEmailElement = document.querySelector('.user-email, [data-user-email]');
        const userIdElement = document.querySelector('[data-user-id]');

        if (userNameElement || userEmailElement || userIdElement) {
          return {
            id: userIdElement?.dataset.userId || userIdElement?.textContent || 'unknown',
            name: userNameElement?.textContent || userNameElement?.dataset.userName || 'Unknown User',
            email: userEmailElement?.textContent || userEmailElement?.dataset.userEmail || '',
            username: userNameElement?.textContent?.toLowerCase().replace(/\s+/g, '') || 'user'
          };
        }

        // 尝试从全局变量获取
        if (window.currentUser) {
          return window.currentUser;
        }

        return null;
      } catch (error) {
        console.error('Error extracting user info:', error);
        return null;
      }
    },

    /**
     * 处理插件消息
     */
    handlePluginMessage(type, data, event) {
      const handler = this.messageHandlers.get(type);
      if (handler) {
        handler(data, event);
      } else {
        console.warn('Unknown message type:', type);
      }
    },

    /**
     * 处理认证状态请求
     */
    handleAuthStatusRequest(data, event) {
      const authStatus = this.getCurrentAuthStatus();
      this.sendAuthStatusToPlugin(authStatus, event.source);
    },

    /**
     * 处理Ping消息
     */
    handlePing(data, event) {
      this.sendMessageToPlugin('PONG', { timestamp: Date.now() }, event.source);
    },

    /**
     * 发送认证状态到插件
     */
    sendAuthStatusToPlugin(authStatus, targetWindow = window.parent) {
      try {
        const message = {
          type: 'AUTH_STATUS_RESPONSE',
          source: 'researchopia-auth',
          authenticated: authStatus.authenticated,
          user: authStatus.user,
          token: authStatus.authenticated ? 'supabase-token' : null,
          timestamp: authStatus.timestamp
        };

        targetWindow.postMessage(message, '*');
        console.log('Auth status sent to plugin:', message);
      } catch (error) {
        console.error('Error sending auth status:', error);
      }
    },

    /**
     * 发送消息到插件
     */
    sendMessageToPlugin(type, data, targetWindow = window.parent) {
      try {
        const message = {
          type: type,
          source: 'researchopia-auth',
          data: data,
          timestamp: Date.now()
        };

        targetWindow.postMessage(message, '*');
        console.log('Message sent to plugin:', message);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },

    /**
     * 验证消息来源
     */
    isValidOrigin(origin) {
      // 允许的来源列表
      const allowedOrigins = [
        'moz-extension://',
        'chrome-extension://',
        'resource://',
        'about:',
        'file://',
        'http://localhost',
        'https://www.researchopia.com'
      ];

      return allowedOrigins.some(allowed => origin.startsWith(allowed));
    }
  };

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      AuthBridge.init();
    });
  } else {
    AuthBridge.init();
  }

  // 导出到全局作用域（用于调试）
  window.ResearchopiaAuthBridge = AuthBridge;

  // 立即发送初始认证状态
  setTimeout(() => {
    const initialAuthStatus = AuthBridge.getCurrentAuthStatus();
    AuthBridge.sendAuthStatusToPlugin(initialAuthStatus);
  }, 1000);

})();

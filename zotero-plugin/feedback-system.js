/**
 * Researchopia Feedback System
 * 用户反馈和通知系统
 */

const FeedbackSystem = {
  // 反馈类型
  FeedbackTypes: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
    LOADING: 'loading'
  },

  // 通知持续时间（毫秒）
  NotificationDuration: {
    SHORT: 3000,
    MEDIUM: 5000,
    LONG: 8000,
    PERSISTENT: 0 // 不自动消失
  },

  // 活动通知
  activeNotifications: new Map(),

  /**
   * 初始化反馈系统
   */
  init() {
    this.log("Initializing Feedback System");
    this.createNotificationContainer();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Feedback [${level.toUpperCase()}]: ${message}`;

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
   * 创建通知容器
   */
  createNotificationContainer() {
    try {
      // 在Zotero环境中，我们需要为每个窗口创建通知容器
      if (typeof Services !== 'undefined' && Services.wm) {
        const windows = Services.wm.getEnumerator('navigator:browser');
        while (windows.hasMoreElements()) {
          const win = windows.getNext();
          this.createContainerForWindow(win);
        }
      }
    } catch (error) {
      this.log(`Error creating notification container: ${error.message}`, 'error');
    }
  },

  /**
   * 为特定窗口创建通知容器
   */
  createContainerForWindow(win) {
    try {
      if (!win || !win.document) return;

      const doc = win.document;
      let container = doc.getElementById('researchopia-notifications');
      
      if (!container) {
        container = doc.createElement('div');
        container.id = 'researchopia-notifications';
        container.className = 'researchopia-notification-container';
        
        // 添加到body
        if (doc.body) {
          doc.body.appendChild(container);
        }
      }

      return container;
    } catch (error) {
      this.log(`Error creating container for window: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 显示通知
   */
  showNotification(message, type = 'info', options = {}) {
    try {
      const notificationId = this.generateNotificationId();
      const duration = options.duration || this.getDefaultDuration(type);
      const actions = options.actions || [];
      
      const notification = {
        id: notificationId,
        message,
        type,
        timestamp: Date.now(),
        duration,
        actions,
        persistent: duration === 0
      };

      // 创建通知元素
      const element = this.createNotificationElement(notification);
      
      // 显示通知
      this.displayNotification(element, notification);
      
      // 记录活动通知
      this.activeNotifications.set(notificationId, notification);
      
      // 设置自动消失
      if (duration > 0) {
        setTimeout(() => {
          this.hideNotification(notificationId);
        }, duration);
      }

      this.log(`Notification shown: ${type} - ${message}`);
      return notificationId;
      
    } catch (error) {
      this.log(`Error showing notification: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 生成通知ID
   */
  generateNotificationId() {
    return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * 获取默认持续时间
   */
  getDefaultDuration(type) {
    switch (type) {
      case this.FeedbackTypes.SUCCESS:
        return this.NotificationDuration.SHORT;
      case this.FeedbackTypes.ERROR:
        return this.NotificationDuration.LONG;
      case this.FeedbackTypes.WARNING:
        return this.NotificationDuration.MEDIUM;
      case this.FeedbackTypes.INFO:
        return this.NotificationDuration.MEDIUM;
      case this.FeedbackTypes.LOADING:
        return this.NotificationDuration.PERSISTENT;
      default:
        return this.NotificationDuration.MEDIUM;
    }
  },

  /**
   * 创建通知元素
   */
  createNotificationElement(notification) {
    try {
      const doc = this.getCurrentDocument();
      if (!doc) return null;

      const element = doc.createElement('div');
      element.className = `researchopia-notification notification-${notification.type}`;
      element.id = notification.id;
      
      // 通知图标
      const icon = this.getNotificationIcon(notification.type);
      
      // 构建HTML
      element.innerHTML = `
        <div class="notification-content">
          <div class="notification-icon">${icon}</div>
          <div class="notification-message">${this.escapeHtml(notification.message)}</div>
          <div class="notification-actions">
            ${notification.actions.map(action => 
              `<button class="notification-action" data-action="${action.id}">${action.label}</button>`
            ).join('')}
            <button class="notification-close" data-action="close">×</button>
          </div>
        </div>
        ${notification.type === this.FeedbackTypes.LOADING ? '<div class="notification-progress"></div>' : ''}
      `;

      // 添加事件监听器
      this.setupNotificationEvents(element, notification);

      return element;
    } catch (error) {
      this.log(`Error creating notification element: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 获取通知图标
   */
  getNotificationIcon(type) {
    switch (type) {
      case this.FeedbackTypes.SUCCESS:
        return '✅';
      case this.FeedbackTypes.ERROR:
        return '❌';
      case this.FeedbackTypes.WARNING:
        return '⚠️';
      case this.FeedbackTypes.INFO:
        return 'ℹ️';
      case this.FeedbackTypes.LOADING:
        return '⏳';
      default:
        return '📢';
    }
  },

  /**
   * 转义HTML
   */
  escapeHtml(text) {
    try {
      const doc = this.getCurrentDocument();
      if (doc) {
        const div = doc.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      } else {
        // 回退到简单的字符串替换
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    } catch (error) {
      return text;
    }
  },

  /**
   * 设置通知事件
   */
  setupNotificationEvents(element, notification) {
    try {
      // 关闭按钮
      const closeBtn = element.querySelector('.notification-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.hideNotification(notification.id);
        });
      }

      // 动作按钮
      const actionBtns = element.querySelectorAll('.notification-action');
      actionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const actionId = e.target.dataset.action;
          const action = notification.actions.find(a => a.id === actionId);
          if (action && action.callback) {
            action.callback(notification);
          }
          
          // 如果动作指定自动关闭，则关闭通知
          if (action && action.autoClose !== false) {
            this.hideNotification(notification.id);
          }
        });
      });

      // 点击通知本身（如果有回调）
      if (notification.onClick) {
        element.addEventListener('click', (e) => {
          if (!e.target.classList.contains('notification-action') && 
              !e.target.classList.contains('notification-close')) {
            notification.onClick(notification);
          }
        });
      }

    } catch (error) {
      this.log(`Error setting up notification events: ${error.message}`, 'error');
    }
  },

  /**
   * 显示通知
   */
  displayNotification(element, notification) {
    try {
      const container = this.getNotificationContainer();
      if (!container || !element) return;

      // 添加到容器
      container.appendChild(element);
      
      // 触发动画
      setTimeout(() => {
        element.classList.add('notification-show');
      }, 10);

    } catch (error) {
      this.log(`Error displaying notification: ${error.message}`, 'error');
    }
  },

  /**
   * 隐藏通知
   */
  hideNotification(notificationId) {
    try {
      const doc = this.getCurrentDocument();
      if (!doc) return;

      const element = doc.getElementById(notificationId);
      if (element) {
        element.classList.add('notification-hide');
        
        setTimeout(() => {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
          }
        }, 300);
      }

      // 从活动通知中移除
      this.activeNotifications.delete(notificationId);
      
    } catch (error) {
      this.log(`Error hiding notification: ${error.message}`, 'error');
    }
  },

  /**
   * 获取当前文档
   */
  getCurrentDocument() {
    try {
      if (typeof Services !== 'undefined' && Services.wm) {
        const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                   Services.wm.getMostRecentWindow('mail:3pane') ||
                   Services.wm.getMostRecentWindow(null);
        return win ? win.document : null;
      }
      return typeof document !== 'undefined' ? document : null;
    } catch (error) {
      return null;
    }
  },

  /**
   * 获取通知容器
   */
  getNotificationContainer() {
    try {
      const doc = this.getCurrentDocument();
      if (!doc) return null;

      let container = doc.getElementById('researchopia-notifications');
      if (!container) {
        container = this.createContainerForWindow(doc.defaultView);
      }

      return container;
    } catch (error) {
      this.log(`Error getting notification container: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 显示成功消息
   */
  showSuccess(message, options = {}) {
    return this.showNotification(message, this.FeedbackTypes.SUCCESS, options);
  },

  /**
   * 显示错误消息
   */
  showError(message, options = {}) {
    return this.showNotification(message, this.FeedbackTypes.ERROR, options);
  },

  /**
   * 显示警告消息
   */
  showWarning(message, options = {}) {
    return this.showNotification(message, this.FeedbackTypes.WARNING, options);
  },

  /**
   * 显示信息消息
   */
  showInfo(message, options = {}) {
    return this.showNotification(message, this.FeedbackTypes.INFO, options);
  },

  /**
   * 显示加载消息
   */
  showLoading(message, options = {}) {
    return this.showNotification(message, this.FeedbackTypes.LOADING, options);
  },

  /**
   * 更新加载消息
   */
  updateLoading(notificationId, message) {
    try {
      const doc = this.getCurrentDocument();
      if (!doc) return;

      const element = doc.getElementById(notificationId);
      if (element) {
        const messageEl = element.querySelector('.notification-message');
        if (messageEl) {
          messageEl.textContent = message;
        }
      }
    } catch (error) {
      this.log(`Error updating loading message: ${error.message}`, 'error');
    }
  },

  /**
   * 显示进度通知
   */
  showProgress(message, progress = 0, options = {}) {
    const notificationId = this.showLoading(message, {
      ...options,
      duration: this.NotificationDuration.PERSISTENT
    });

    this.updateProgress(notificationId, progress);
    return notificationId;
  },

  /**
   * 更新进度
   */
  updateProgress(notificationId, progress, message = null) {
    try {
      const doc = this.getCurrentDocument();
      if (!doc) return;

      const element = doc.getElementById(notificationId);
      if (!element) return;

      // 更新消息
      if (message) {
        const messageEl = element.querySelector('.notification-message');
        if (messageEl) {
          messageEl.textContent = message;
        }
      }

      // 更新进度条
      const progressEl = element.querySelector('.notification-progress');
      if (progressEl) {
        progressEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }

    } catch (error) {
      this.log(`Error updating progress: ${error.message}`, 'error');
    }
  },

  /**
   * 显示确认对话框
   */
  showConfirm(message, options = {}) {
    return new Promise((resolve) => {
      const actions = [
        {
          id: 'confirm',
          label: options.confirmLabel || '确定',
          callback: () => resolve(true)
        },
        {
          id: 'cancel',
          label: options.cancelLabel || '取消',
          callback: () => resolve(false)
        }
      ];

      this.showNotification(message, this.FeedbackTypes.INFO, {
        duration: this.NotificationDuration.PERSISTENT,
        actions: actions
      });
    });
  },

  /**
   * 显示操作结果
   */
  showActionResult(action, success, message = null, options = {}) {
    const defaultMessages = {
      share: {
        success: '标注分享成功！',
        error: '标注分享失败'
      },
      sync: {
        success: '同步完成',
        error: '同步失败'
      },
      login: {
        success: '登录成功',
        error: '登录失败'
      },
      save: {
        success: '保存成功',
        error: '保存失败'
      }
    };

    const finalMessage = message ||
      (defaultMessages[action] ? defaultMessages[action][success ? 'success' : 'error'] :
       (success ? '操作成功' : '操作失败'));

    const type = success ? this.FeedbackTypes.SUCCESS : this.FeedbackTypes.ERROR;

    return this.showNotification(finalMessage, type, options);
  },

  /**
   * 清除所有通知
   */
  clearAllNotifications() {
    try {
      this.activeNotifications.forEach((notification, id) => {
        this.hideNotification(id);
      });
      this.activeNotifications.clear();
    } catch (error) {
      this.log(`Error clearing all notifications: ${error.message}`, 'error');
    }
  },

  /**
   * 获取活动通知数量
   */
  getActiveNotificationCount() {
    return this.activeNotifications.size;
  },

  /**
   * 显示调试信息
   */
  showDebugInfo(info, options = {}) {
    if (this.isDebugMode()) {
      const debugMessage = typeof info === 'object' ? JSON.stringify(info, null, 2) : String(info);
      return this.showInfo(`[DEBUG] ${debugMessage}`, {
        duration: this.NotificationDuration.LONG,
        ...options
      });
    }
  },

  /**
   * 检查是否为调试模式
   */
  isDebugMode() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        return Zotero.Prefs.get('extensions.researchopia.debug', false);
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  /**
   * 显示网络状态
   */
  showNetworkStatus(isOnline, options = {}) {
    const message = isOnline ? '网络连接已恢复' : '网络连接已断开';
    const type = isOnline ? this.FeedbackTypes.SUCCESS : this.FeedbackTypes.WARNING;

    return this.showNotification(message, type, {
      duration: isOnline ? this.NotificationDuration.SHORT : this.NotificationDuration.PERSISTENT,
      ...options
    });
  },

  /**
   * 显示同步状态
   */
  showSyncStatus(status, details = null, options = {}) {
    const messages = {
      syncing: '正在同步...',
      success: '同步完成',
      error: '同步失败',
      offline: '离线模式'
    };

    const types = {
      syncing: this.FeedbackTypes.LOADING,
      success: this.FeedbackTypes.SUCCESS,
      error: this.FeedbackTypes.ERROR,
      offline: this.FeedbackTypes.WARNING
    };

    let message = messages[status] || status;
    if (details) {
      message += ` - ${details}`;
    }

    return this.showNotification(message, types[status] || this.FeedbackTypes.INFO, options);
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackSystem;
}

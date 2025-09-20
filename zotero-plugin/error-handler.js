/**
 * Researchopia Error Handler
 * 统一的错误处理和用户反馈系统
 */

const ErrorHandler = {
  // 错误类型定义
  ErrorTypes: {
    NETWORK: 'network',
    AUTH: 'auth',
    ANNOTATION: 'annotation',
    SYNC: 'sync',
    UI: 'ui',
    CONFIG: 'config',
    UNKNOWN: 'unknown'
  },

  // 错误级别定义
  ErrorLevels: {
    CRITICAL: 'critical',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  },

  // 错误统计
  errorStats: {
    total: 0,
    byType: {},
    byLevel: {},
    recent: []
  },

  /**
   * 初始化错误处理器
   */
  init() {
    this.log("Initializing Error Handler");
    this.setupGlobalErrorHandlers();
    this.loadErrorStats();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-ErrorHandler [${level.toUpperCase()}]: ${message}`;

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
   * 设置全局错误处理器
   */
  setupGlobalErrorHandlers() {
    try {
      // 捕获未处理的Promise拒绝
      if (typeof window !== 'undefined') {
        window.addEventListener('unhandledrejection', (event) => {
          this.handleError(event.reason, {
            type: this.ErrorTypes.UNKNOWN,
            level: this.ErrorLevels.ERROR,
            context: 'unhandledrejection',
            showToUser: false
          });
        });

        // 捕获全局错误
        window.addEventListener('error', (event) => {
          this.handleError(event.error, {
            type: this.ErrorTypes.UNKNOWN,
            level: this.ErrorLevels.ERROR,
            context: 'global',
            showToUser: false
          });
        });
      }

      this.log("Global error handlers set up");
    } catch (error) {
      this.log(`Error setting up global handlers: ${error.message}`, 'error');
    }
  },

  /**
   * 统一错误处理方法
   */
  handleError(error, options = {}) {
    try {
      const errorInfo = this.parseError(error, options);
      
      // 记录错误统计
      this.recordError(errorInfo);
      
      // 记录日志
      this.log(`${errorInfo.type.toUpperCase()} Error: ${errorInfo.message}`, errorInfo.level);
      
      // 显示用户反馈
      if (options.showToUser !== false) {
        this.showUserFeedback(errorInfo, options);
      }
      
      // 发送错误报告（如果启用）
      if (this.shouldReportError(errorInfo)) {
        this.reportError(errorInfo);
      }
      
      return errorInfo;
    } catch (handlerError) {
      this.log(`Error in error handler: ${handlerError.message}`, 'error');
    }
  },

  /**
   * 解析错误信息
   */
  parseError(error, options = {}) {
    const errorInfo = {
      message: '',
      type: options.type || this.ErrorTypes.UNKNOWN,
      level: options.level || this.ErrorLevels.ERROR,
      context: options.context || 'unknown',
      timestamp: new Date().toISOString(),
      stack: null,
      userMessage: null,
      suggestions: []
    };

    // 解析错误消息
    if (error instanceof Error) {
      errorInfo.message = error.message;
      errorInfo.stack = error.stack;
    } else if (typeof error === 'string') {
      errorInfo.message = error;
    } else {
      errorInfo.message = JSON.stringify(error);
    }

    // 根据错误内容自动分类
    errorInfo.type = this.classifyError(errorInfo.message, options.type);
    
    // 生成用户友好的消息和建议
    const userInfo = this.generateUserMessage(errorInfo);
    errorInfo.userMessage = userInfo.message;
    errorInfo.suggestions = userInfo.suggestions;

    return errorInfo;
  },

  /**
   * 自动分类错误
   */
  classifyError(message, providedType) {
    if (providedType && providedType !== this.ErrorTypes.UNKNOWN) {
      return providedType;
    }

    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || 
        lowerMessage.includes('connection') || lowerMessage.includes('timeout')) {
      return this.ErrorTypes.NETWORK;
    }
    
    if (lowerMessage.includes('auth') || lowerMessage.includes('login') || 
        lowerMessage.includes('token') || lowerMessage.includes('permission')) {
      return this.ErrorTypes.AUTH;
    }
    
    if (lowerMessage.includes('annotation') || lowerMessage.includes('标注')) {
      return this.ErrorTypes.ANNOTATION;
    }
    
    if (lowerMessage.includes('sync') || lowerMessage.includes('同步')) {
      return this.ErrorTypes.SYNC;
    }
    
    if (lowerMessage.includes('ui') || lowerMessage.includes('interface') || 
        lowerMessage.includes('界面')) {
      return this.ErrorTypes.UI;
    }
    
    if (lowerMessage.includes('config') || lowerMessage.includes('setting') || 
        lowerMessage.includes('配置')) {
      return this.ErrorTypes.CONFIG;
    }
    
    return this.ErrorTypes.UNKNOWN;
  },

  /**
   * 生成用户友好的错误消息和建议
   */
  generateUserMessage(errorInfo) {
    const suggestions = [];
    let userMessage = '';

    switch (errorInfo.type) {
      case this.ErrorTypes.NETWORK:
        userMessage = '网络连接出现问题';
        suggestions.push('检查网络连接是否正常');
        suggestions.push('确认研学港服务器是否可访问');
        suggestions.push('稍后重试操作');
        break;

      case this.ErrorTypes.AUTH:
        userMessage = '身份验证失败';
        suggestions.push('检查登录状态');
        suggestions.push('重新登录研学港账户');
        suggestions.push('确认账户权限设置');
        break;

      case this.ErrorTypes.ANNOTATION:
        userMessage = '标注处理出现问题';
        suggestions.push('确认PDF文档包含标注');
        suggestions.push('重新打开文档并检查标注');
        suggestions.push('尝试刷新标注检测');
        break;

      case this.ErrorTypes.SYNC:
        userMessage = '同步功能出现问题';
        suggestions.push('检查网络连接');
        suggestions.push('确认同步设置是否正确');
        suggestions.push('尝试手动同步');
        break;

      case this.ErrorTypes.UI:
        userMessage = '界面操作出现问题';
        suggestions.push('刷新Zotero界面');
        suggestions.push('重启Zotero应用');
        suggestions.push('检查插件是否正常加载');
        break;

      case this.ErrorTypes.CONFIG:
        userMessage = '配置设置出现问题';
        suggestions.push('检查插件配置');
        suggestions.push('重置为默认设置');
        suggestions.push('重新安装插件');
        break;

      default:
        userMessage = '操作过程中出现未知问题';
        suggestions.push('重试当前操作');
        suggestions.push('重启Zotero应用');
        suggestions.push('联系技术支持');
        break;
    }

    return { message: userMessage, suggestions };
  },

  /**
   * 显示用户反馈
   */
  showUserFeedback(errorInfo, options = {}) {
    try {
      const feedbackType = this.getFeedbackType(errorInfo.level);
      
      // 构建反馈消息
      let message = `${this.getErrorIcon(errorInfo.level)} ${errorInfo.userMessage}`;
      
      if (errorInfo.suggestions.length > 0 && options.showSuggestions !== false) {
        message += '\n\n建议解决方案：\n';
        errorInfo.suggestions.forEach((suggestion, index) => {
          message += `${index + 1}. ${suggestion}\n`;
        });
      }

      // 显示反馈
      this.displayFeedback(message, feedbackType, options);
      
    } catch (error) {
      this.log(`Error showing user feedback: ${error.message}`, 'error');
    }
  },

  /**
   * 获取反馈类型
   */
  getFeedbackType(level) {
    switch (level) {
      case this.ErrorLevels.CRITICAL:
        return 'error';
      case this.ErrorLevels.ERROR:
        return 'error';
      case this.ErrorLevels.WARNING:
        return 'warning';
      case this.ErrorLevels.INFO:
        return 'info';
      default:
        return 'info';
    }
  },

  /**
   * 获取错误图标
   */
  getErrorIcon(level) {
    switch (level) {
      case this.ErrorLevels.CRITICAL:
        return '🚨';
      case this.ErrorLevels.ERROR:
        return '❌';
      case this.ErrorLevels.WARNING:
        return '⚠️';
      case this.ErrorLevels.INFO:
        return 'ℹ️';
      default:
        return '❓';
    }
  },

  /**
   * 显示反馈消息
   */
  displayFeedback(message, type, options = {}) {
    try {
      // 优先使用Zotero的通知系统
      if (typeof Zotero !== 'undefined' && Zotero.alert) {
        Zotero.alert(null, 'Researchopia', message);
        return;
      }

      // 尝试使用系统通知
      if (typeof Components !== 'undefined') {
        try {
          Components.classes["@mozilla.org/alerts-service;1"]
            .getService(Components.interfaces.nsIAlertsService)
            .showAlertNotification(null, "Researchopia", message, false, "", null);
          return;
        } catch (e) {
          // 继续尝试其他方法
        }
      }

      // 回退到console输出
      console.log(`Researchopia ${type.toUpperCase()}: ${message}`);

    } catch (error) {
      this.log(`Error displaying feedback: ${error.message}`, 'error');
    }
  },

  /**
   * 记录错误统计
   */
  recordError(errorInfo) {
    try {
      this.errorStats.total++;

      // 按类型统计
      if (!this.errorStats.byType[errorInfo.type]) {
        this.errorStats.byType[errorInfo.type] = 0;
      }
      this.errorStats.byType[errorInfo.type]++;

      // 按级别统计
      if (!this.errorStats.byLevel[errorInfo.level]) {
        this.errorStats.byLevel[errorInfo.level] = 0;
      }
      this.errorStats.byLevel[errorInfo.level]++;

      // 记录最近错误（保留最近50个）
      this.errorStats.recent.unshift({
        timestamp: errorInfo.timestamp,
        type: errorInfo.type,
        level: errorInfo.level,
        message: errorInfo.message.substring(0, 100)
      });

      if (this.errorStats.recent.length > 50) {
        this.errorStats.recent = this.errorStats.recent.slice(0, 50);
      }

      // 保存统计数据
      this.saveErrorStats();

    } catch (error) {
      this.log(`Error recording error stats: ${error.message}`, 'error');
    }
  },

  /**
   * 判断是否应该报告错误
   */
  shouldReportError(errorInfo) {
    // 只报告严重错误
    if (errorInfo.level === this.ErrorLevels.CRITICAL) {
      return true;
    }

    // 频繁出现的错误也需要报告
    const recentSimilarErrors = this.errorStats.recent.filter(e =>
      e.type === errorInfo.type &&
      Date.now() - new Date(e.timestamp).getTime() < 300000 // 5分钟内
    );

    return recentSimilarErrors.length >= 3;
  },

  /**
   * 报告错误到服务器
   */
  async reportError(errorInfo) {
    try {
      // 检查是否启用错误报告
      const reportingEnabled = this.getConfig('errorReporting', false);
      if (!reportingEnabled) {
        return;
      }

      const reportData = {
        timestamp: errorInfo.timestamp,
        type: errorInfo.type,
        level: errorInfo.level,
        message: errorInfo.message,
        context: errorInfo.context,
        userAgent: navigator.userAgent,
        zoteroVersion: typeof Zotero !== 'undefined' ? Zotero.version : 'unknown',
        pluginVersion: this.getPluginVersion()
      };

      // 发送错误报告
      await this.sendErrorReport(reportData);

    } catch (error) {
      this.log(`Error reporting error: ${error.message}`, 'error');
    }
  },

  /**
   * 发送错误报告
   */
  async sendErrorReport(reportData) {
    try {
      const apiUrl = this.getApiBase() + '/errors/report';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
        timeout: 5000
      });

      if (response.ok) {
        this.log('Error report sent successfully');
      } else {
        this.log(`Failed to send error report: ${response.status}`, 'warn');
      }

    } catch (error) {
      this.log(`Error sending error report: ${error.message}`, 'error');
    }
  },

  /**
   * 加载错误统计
   */
  loadErrorStats() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const statsJson = Zotero.Prefs.get('extensions.researchopia.errorStats', '{}');
        const stats = JSON.parse(statsJson);

        this.errorStats = {
          total: stats.total || 0,
          byType: stats.byType || {},
          byLevel: stats.byLevel || {},
          recent: stats.recent || []
        };
      }
    } catch (error) {
      this.log(`Error loading error stats: ${error.message}`, 'error');
    }
  },

  /**
   * 保存错误统计
   */
  saveErrorStats() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        const statsJson = JSON.stringify(this.errorStats);
        Zotero.Prefs.set('extensions.researchopia.errorStats', statsJson);
      }
    } catch (error) {
      this.log(`Error saving error stats: ${error.message}`, 'error');
    }
  },

  /**
   * 获取配置值
   */
  getConfig(key, defaultValue) {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        return Zotero.Prefs.get(`extensions.researchopia.${key}`, defaultValue);
      }
      return defaultValue;
    } catch (error) {
      return defaultValue;
    }
  },

  /**
   * 获取插件版本
   */
  getPluginVersion() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia) {
        return Zotero.Researchopia.version || 'unknown';
      }
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  },

  /**
   * 获取API基础URL
   */
  getApiBase() {
    try {
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia && Zotero.Researchopia.AnnotationSharing) {
        return Zotero.Researchopia.AnnotationSharing.getApiBase();
      }
      return 'http://localhost:3000/api/v1';
    } catch (error) {
      return 'http://localhost:3000/api/v1';
    }
  },

  /**
   * 获取错误统计报告
   */
  getErrorReport() {
    return {
      summary: {
        total: this.errorStats.total,
        byType: { ...this.errorStats.byType },
        byLevel: { ...this.errorStats.byLevel }
      },
      recent: [...this.errorStats.recent.slice(0, 10)],
      timestamp: new Date().toISOString()
    };
  },

  /**
   * 清除错误统计
   */
  clearErrorStats() {
    this.errorStats = {
      total: 0,
      byType: {},
      byLevel: {},
      recent: []
    };
    this.saveErrorStats();
    this.log('Error statistics cleared');
  },

  /**
   * 创建错误处理包装器
   */
  createWrapper(fn, context = {}) {
    return async (...args) => {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        this.handleError(error, {
          type: context.type || this.ErrorTypes.UNKNOWN,
          level: context.level || this.ErrorLevels.ERROR,
          context: context.name || 'wrapped_function',
          showToUser: context.showToUser !== false
        });

        // 重新抛出错误，除非明确要求抑制
        if (context.suppressError !== true) {
          throw error;
        }
      }
    };
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}

/**
 * Researchopia Diagnostic Tool
 * 诊断工具，用于检查插件状态和生成调试报告
 */

const DiagnosticTool = {
  /**
   * 初始化诊断工具
   */
  init() {
    this.log("Diagnostic Tool initialized");
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Diagnostic [${level.toUpperCase()}]: ${message}`;

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
   * 运行完整诊断
   */
  async runFullDiagnostic() {
    try {
      this.log("Starting full diagnostic");
      
      const report = {
        timestamp: new Date().toISOString(),
        environment: this.checkEnvironment(),
        modules: this.checkModules(),
        configuration: this.checkConfiguration(),
        permissions: this.checkPermissions(),
        network: await this.checkNetwork(),
        annotations: await this.checkAnnotations(),
        errors: this.getErrorReport(),
        recommendations: []
      };

      // 生成建议
      report.recommendations = this.generateRecommendations(report);

      this.log("Full diagnostic completed");
      return report;
    } catch (error) {
      this.log(`Error running full diagnostic: ${error.message}`, 'error');
      return {
        timestamp: new Date().toISOString(),
        error: error.message,
        partial: true
      };
    }
  },

  /**
   * 检查环境
   */
  checkEnvironment() {
    const env = {
      zotero: {
        available: typeof Zotero !== 'undefined',
        version: null,
        platform: null
      },
      browser: {
        userAgent: null,
        language: null
      },
      system: {
        os: null,
        timestamp: new Date().toISOString()
      }
    };

    try {
      if (typeof Zotero !== 'undefined') {
        env.zotero.version = Zotero.version || 'unknown';
        env.zotero.platform = Zotero.platform || 'unknown';
      }

      if (typeof navigator !== 'undefined') {
        env.browser.userAgent = navigator.userAgent;
        env.browser.language = navigator.language;
      }

      // 检测操作系统
      if (typeof Services !== 'undefined' && Services.appinfo) {
        env.system.os = Services.appinfo.OS;
      }
    } catch (error) {
      env.error = error.message;
    }

    return env;
  },

  /**
   * 检查模块状态
   */
  checkModules() {
    const modules = {
      core: {
        researchopia: typeof Zotero !== 'undefined' && !!Zotero.Researchopia,
        errorHandler: typeof ErrorHandler !== 'undefined',
        feedbackSystem: typeof FeedbackSystem !== 'undefined'
      },
      features: {
        annotationSharing: typeof Zotero !== 'undefined' && !!Zotero.Researchopia?.AnnotationSharing,
        annotationSelector: typeof AnnotationSelector !== 'undefined',
        authManager: typeof AuthManager !== 'undefined',
        userInterface: typeof UserInterface !== 'undefined',
        socialFeatures: typeof SocialFeatures !== 'undefined',
        privacyManager: typeof PrivacyManager !== 'undefined',
        collaborationManager: typeof CollaborationManager !== 'undefined',
        annotationBrowser: typeof AnnotationBrowser !== 'undefined'
      },
      utilities: {
        config: typeof Config !== 'undefined',
        services: typeof Services !== 'undefined'
      }
    };

    // 计算加载状态
    const coreLoaded = Object.values(modules.core).filter(Boolean).length;
    const featuresLoaded = Object.values(modules.features).filter(Boolean).length;
    const utilitiesLoaded = Object.values(modules.utilities).filter(Boolean).length;

    modules.summary = {
      coreLoaded: `${coreLoaded}/${Object.keys(modules.core).length}`,
      featuresLoaded: `${featuresLoaded}/${Object.keys(modules.features).length}`,
      utilitiesLoaded: `${utilitiesLoaded}/${Object.keys(modules.utilities).length}`,
      totalLoaded: coreLoaded + featuresLoaded + utilitiesLoaded,
      totalModules: Object.keys(modules.core).length + Object.keys(modules.features).length + Object.keys(modules.utilities).length
    };

    return modules;
  },

  /**
   * 检查配置
   */
  checkConfiguration() {
    const config = {
      preferences: {},
      apiSettings: {},
      userSettings: {}
    };

    try {
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        // 检查关键配置项
        const keyPrefs = [
          'extensions.researchopia.apiUrl',
          'extensions.researchopia.debug',
          'extensions.researchopia.errorReporting',
          'extensions.researchopia.syncEnabled',
          'extensions.researchopia.privacyLevel'
        ];

        keyPrefs.forEach(pref => {
          try {
            config.preferences[pref] = Zotero.Prefs.get(pref, 'not_set');
          } catch (e) {
            config.preferences[pref] = 'error';
          }
        });
      }

      // 检查API设置
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia?.AnnotationSharing) {
        config.apiSettings.baseUrl = Zotero.Researchopia.AnnotationSharing.getApiBase?.() || 'unknown';
        config.apiSettings.timeout = Zotero.Researchopia.AnnotationSharing.config?.timeout || 'unknown';
      }

      // 检查用户设置
      if (typeof AuthManager !== 'undefined') {
        config.userSettings.authenticated = AuthManager.isAuthenticated?.() || false;
        config.userSettings.currentUser = AuthManager.getCurrentUser?.()?.email || 'not_logged_in';
      }

    } catch (error) {
      config.error = error.message;
    }

    return config;
  },

  /**
   * 检查权限
   */
  checkPermissions() {
    const permissions = {
      fileSystem: false,
      network: false,
      preferences: false,
      notifications: false
    };

    try {
      // 检查文件系统权限
      if (typeof Services !== 'undefined' && Services.dirsvc) {
        permissions.fileSystem = true;
      }

      // 检查网络权限
      if (typeof fetch !== 'undefined' || (typeof Services !== 'undefined' && Services.io)) {
        permissions.network = true;
      }

      // 检查首选项权限
      if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
        permissions.preferences = true;
      }

      // 检查通知权限
      if (typeof Components !== 'undefined') {
        try {
          Components.classes["@mozilla.org/alerts-service;1"];
          permissions.notifications = true;
        } catch (e) {
          // 通知服务不可用
        }
      }

    } catch (error) {
      permissions.error = error.message;
    }

    return permissions;
  },

  /**
   * 检查网络连接
   */
  async checkNetwork() {
    const network = {
      online: false,
      apiReachable: false,
      latency: null,
      error: null
    };

    try {
      // 检查基本网络状态
      if (typeof navigator !== 'undefined') {
        network.online = navigator.onLine;
      }

      // 检查API可达性
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia?.AnnotationSharing) {
        const startTime = Date.now();
        try {
          const apiUrl = Zotero.Researchopia.AnnotationSharing.getApiBase();
          const response = await fetch(`${apiUrl}/health`, { 
            method: 'GET',
            timeout: 5000 
          });
          
          network.latency = Date.now() - startTime;
          network.apiReachable = response.ok;
        } catch (e) {
          network.error = e.message;
        }
      }

    } catch (error) {
      network.error = error.message;
    }

    return network;
  },

  /**
   * 检查标注功能
   */
  async checkAnnotations() {
    const annotations = {
      detectionWorking: false,
      sampleCount: 0,
      lastError: null
    };

    try {
      if (typeof Zotero !== 'undefined' && Zotero.Researchopia) {
        // 尝试检测当前选中项目的标注
        const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
        
        if (selectedItems.length > 0) {
          const item = selectedItems[0];
          const detectedAnnotations = await Zotero.Researchopia.getItemAnnotations(item);
          
          annotations.detectionWorking = true;
          annotations.sampleCount = detectedAnnotations.length;
        } else {
          annotations.note = 'No items selected for testing';
        }
      }

    } catch (error) {
      annotations.lastError = error.message;
    }

    return annotations;
  },

  /**
   * 获取错误报告
   */
  getErrorReport() {
    try {
      if (typeof ErrorHandler !== 'undefined') {
        return ErrorHandler.getErrorReport();
      }
      return { note: 'ErrorHandler not available' };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * 生成建议
   */
  generateRecommendations(report) {
    const recommendations = [];

    try {
      // 检查模块加载
      if (report.modules?.summary?.totalLoaded < report.modules?.summary?.totalModules) {
        recommendations.push({
          type: 'warning',
          title: '模块加载不完整',
          description: '部分插件模块未能正确加载，可能影响功能使用',
          action: '重启Zotero或重新安装插件'
        });
      }

      // 检查网络连接
      if (report.network?.online === false) {
        recommendations.push({
          type: 'error',
          title: '网络连接问题',
          description: '检测到网络连接异常，无法使用在线功能',
          action: '检查网络连接设置'
        });
      }

      // 检查API连接
      if (report.network?.apiReachable === false) {
        recommendations.push({
          type: 'warning',
          title: 'API服务器不可达',
          description: '无法连接到研学港服务器，在线功能可能受限',
          action: '检查服务器状态或稍后重试'
        });
      }

      // 检查认证状态
      if (report.configuration?.userSettings?.authenticated === false) {
        recommendations.push({
          type: 'info',
          title: '未登录账户',
          description: '当前未登录研学港账户，无法使用个人功能',
          action: '点击登录按钮进行身份验证'
        });
      }

      // 检查错误统计
      if (report.errors?.summary?.total > 10) {
        recommendations.push({
          type: 'warning',
          title: '错误频率较高',
          description: '检测到较多错误记录，可能存在稳定性问题',
          action: '查看错误详情或联系技术支持'
        });
      }

    } catch (error) {
      recommendations.push({
        type: 'error',
        title: '诊断异常',
        description: `生成建议时出现错误: ${error.message}`,
        action: '重新运行诊断'
      });
    }

    return recommendations;
  },

  /**
   * 显示诊断报告
   */
  async showDiagnosticReport() {
    try {
      const report = await this.runFullDiagnostic();
      const reportText = this.formatReportForDisplay(report);
      
      // 显示报告
      if (typeof FeedbackSystem !== 'undefined') {
        FeedbackSystem.showInfo('诊断报告已生成', {
          actions: [
            {
              id: 'copy',
              label: '复制报告',
              callback: () => this.copyReportToClipboard(reportText)
            }
          ]
        });
      }

      // 同时在控制台输出
      console.log('=== Researchopia 诊断报告 ===');
      console.log(reportText);
      
      return report;
    } catch (error) {
      this.log(`Error showing diagnostic report: ${error.message}`, 'error');
    }
  },

  /**
   * 格式化报告用于显示
   */
  formatReportForDisplay(report) {
    let text = `研学港 Researchopia 诊断报告\n`;
    text += `生成时间: ${report.timestamp}\n\n`;

    // 环境信息
    text += `=== 环境信息 ===\n`;
    text += `Zotero版本: ${report.environment?.zotero?.version || 'unknown'}\n`;
    text += `操作系统: ${report.environment?.system?.os || 'unknown'}\n\n`;

    // 模块状态
    text += `=== 模块状态 ===\n`;
    text += `已加载: ${report.modules?.summary?.totalLoaded}/${report.modules?.summary?.totalModules}\n`;
    text += `核心模块: ${report.modules?.summary?.coreLoaded}\n`;
    text += `功能模块: ${report.modules?.summary?.featuresLoaded}\n\n`;

    // 网络状态
    text += `=== 网络状态 ===\n`;
    text += `在线状态: ${report.network?.online ? '是' : '否'}\n`;
    text += `API可达: ${report.network?.apiReachable ? '是' : '否'}\n`;
    if (report.network?.latency) {
      text += `延迟: ${report.network.latency}ms\n`;
    }
    text += `\n`;

    // 建议
    if (report.recommendations?.length > 0) {
      text += `=== 建议 ===\n`;
      report.recommendations.forEach((rec, index) => {
        text += `${index + 1}. [${rec.type.toUpperCase()}] ${rec.title}\n`;
        text += `   ${rec.description}\n`;
        text += `   建议: ${rec.action}\n\n`;
      });
    }

    return text;
  },

  /**
   * 复制报告到剪贴板
   */
  copyReportToClipboard(reportText) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(reportText);
        this.log("Report copied to clipboard");
      } else {
        // 回退方法
        this.log("Clipboard API not available");
      }
    } catch (error) {
      this.log(`Error copying to clipboard: ${error.message}`, 'error');
    }
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DiagnosticTool;
}

// 全局函数，方便在控制台调用
if (typeof window !== 'undefined') {
  window.runResearchopiaDiagnostic = () => DiagnosticTool.showDiagnosticReport();
}

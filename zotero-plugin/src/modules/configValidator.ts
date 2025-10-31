/**
 * 配置验证模块
 * 负责系统配置验证、兼容性检查、诊断等功能
 */

export class ConfigValidator {
  private static instance: ConfigValidator | null = null;
  
  public static getInstance(): ConfigValidator {
    if (!ConfigValidator.instance) {
      ConfigValidator.instance = new ConfigValidator();
    }
    return ConfigValidator.instance;
  }

  public static async validateSystem(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      console.log("[ConfigValidator] Starting system validation...");
      
      // 验证Zotero版本
      const zoteroValidation = ConfigValidator.validateZoteroVersion();
      if (!zoteroValidation.isValid) {
        errors.push(...zoteroValidation.errors);
      }
      warnings.push(...zoteroValidation.warnings);
      info.zotero = zoteroValidation.info;

      // 验证插件依赖
      const depsValidation = ConfigValidator.validateDependencies();
      if (!depsValidation.isValid) {
        errors.push(...depsValidation.errors);
      }
      warnings.push(...depsValidation.warnings);
      info.dependencies = depsValidation.info;

      // 验证网络连接
      const networkValidation = await ConfigValidator.validateNetworkConnection();
      if (!networkValidation.isValid) {
        warnings.push(...networkValidation.errors); // 网络问题作为警告而非错误
      }
      info.network = networkValidation.info;

      // 验证权限
      const permissionsValidation = ConfigValidator.validatePermissions();
      if (!permissionsValidation.isValid) {
        errors.push(...permissionsValidation.errors);
      }
      warnings.push(...permissionsValidation.warnings);
      info.permissions = permissionsValidation.info;

      // 验证存储空间
      const storageValidation = ConfigValidator.validateStorage();
      if (!storageValidation.isValid) {
        warnings.push(...storageValidation.errors);
      }
      info.storage = storageValidation.info;

      console.log("[ConfigValidator] System validation completed", {
        errors: errors.length,
        warnings: warnings.length
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info
      };

    } catch (error) {
      console.error("[ConfigValidator] System validation error:", error);
      return {
        isValid: false,
        errors: [`系统验证过程中发生错误: ${error}`],
        warnings: [],
        info: {}
      };
    }
  }

  public static validateZoteroVersion(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      // 获取Zotero版本信息
      const zoteroVersion = (Zotero as any).version || 'unknown';
      info.version = zoteroVersion;
      info.platform = (Zotero as any).platform || 'unknown';
      info.locale = Zotero.locale || 'unknown';

      // 检查版本兼容性
      if (zoteroVersion === 'unknown') {
        warnings.push('无法获取Zotero版本信息');
      } else {
        const versionParts = zoteroVersion.split('.');
        const majorVersion = parseInt(versionParts[0]);
        const minorVersion = parseInt(versionParts[1]);

        if (majorVersion < 7) {
          errors.push(`Zotero版本过低 (${zoteroVersion})，需要7.0或更高版本`);
        } else if (majorVersion === 7 && minorVersion < 0) {
          warnings.push(`Zotero版本 (${zoteroVersion}) 可能存在兼容性问题`);
        }
      }

      // 检查必需的API
      const requiredAPIs = [
        'Zotero.Items',
        'Zotero.Prefs',
        'Zotero.getMainWindows'
      ];

      for (const api of requiredAPIs) {
        const apiPath = api.split('.');
        let current = window as any;
        for (const part of apiPath) {
          current = current?.[part];
        }
        
        if (!current) {
          errors.push(`缺少必需的API: ${api}`);
        }
      }

      info.availableAPIs = {
        ItemPaneManager: !!(Zotero as any).ItemPaneManager,
        ReaderManager: !!(Zotero as any).Reader,
        CollectionTreeView: !!(Zotero as any).CollectionTreeView
      };

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Zotero版本验证失败: ${error}`],
        warnings: [],
        info: {}
      };
    }
  }

  public static validateDependencies(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      // 检查zotero-plugin-toolkit
      info.ztoolkit = typeof ztoolkit !== 'undefined';
      if (!info.ztoolkit) {
        errors.push('zotero-plugin-toolkit未正确加载');
      }

      // 检查addon实例
      info.addonInstance = typeof addon !== 'undefined';
      if (!info.addonInstance) {
        errors.push('插件实例未正确初始化');
      }

      // 检查全局对象
      info.globalObjects = {
        Zotero: typeof Zotero !== 'undefined',
        Components: typeof (globalThis as any).Components !== 'undefined',
        Services: typeof (globalThis as any).Services !== 'undefined'
      };

      for (const [name, available] of Object.entries(info.globalObjects)) {
        if (!available) {
          warnings.push(`全局对象 ${name} 不可用`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`依赖验证失败: ${error}`],
        warnings: [],
        info: {}
      };
    }
  }

  public static async validateNetworkConnection(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      info.onlineStatus = navigator.onLine;
      
      if (!navigator.onLine) {
        errors.push('设备当前离线，无法使用在线功能');
        return {
          isValid: false,
          errors,
          warnings,
          info
        };
      }

      // 测试基本网络连接
      try {
        const testUrl = 'https://www.google.com/favicon.ico';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(testUrl, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors'
        });
        
        clearTimeout(timeoutId);
        info.basicConnectivity = true;
      } catch (networkError) {
        info.basicConnectivity = false;
        warnings.push('网络连接测试失败，可能影响在线功能');
      }

      // TODO: 测试Researchopia API连接
      info.apiConnectivity = 'untested';
      
      return {
        isValid: true, // 网络问题不应阻止插件运行
        errors,
        warnings,
        info
      };

    } catch (error) {
      return {
        isValid: true,
        errors: [],
        warnings: [`网络验证过程中发生错误: ${error}`],
        info: {}
      };
    }
  }

  public static validatePermissions(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      // 检查首选项读写权限
      try {
        const testKey = 'extensions.zotero.researchopia.test';
        Zotero.Prefs.set(testKey, 'test', true);
        const testValue = Zotero.Prefs.get(testKey, true);
        Zotero.Prefs.clear(testKey, true);
        
        info.prefsAccess = testValue === 'test';
      } catch (prefsError) {
        info.prefsAccess = false;
        errors.push('无法访问Zotero首选项存储');
      }

      // 检查文件系统权限（如果需要）
      info.fileSystemAccess = true; // 大多数情况下Zotero插件有足够权限

      // 检查DOM访问权限
      try {
        const mainWindow = Zotero.getMainWindow();
        info.domAccess = !!(mainWindow && mainWindow.document);
      } catch (domError) {
        info.domAccess = false;
        warnings.push('DOM访问受限，可能影响UI功能');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        info
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`权限验证失败: ${error}`],
        warnings: [],
        info: {}
      };
    }
  }

  public static validateStorage(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    info: any;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: any = {};

    try {
      // 检查localStorage可用性
      try {
        const testKey = 'researchopia_storage_test';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        info.localStorage = true;
      } catch (storageError) {
        info.localStorage = false;
        warnings.push('localStorage不可用，将使用替代存储方式');
      }

      // 检查Zotero数据目录权限
      try {
        const dataDir = (Zotero as any).DataDirectory?.dir;
        info.dataDirectory = !!dataDir;
        info.dataDirectoryPath = dataDir?.path || 'unknown';
      } catch (dataDirError) {
        info.dataDirectory = false;
        warnings.push('无法访问Zotero数据目录信息');
      }

      // 估算可用存储空间
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        navigator.storage.estimate().then(estimate => {
          info.storageEstimate = {
            quota: estimate.quota,
            usage: estimate.usage,
            available: estimate.quota ? estimate.quota - (estimate.usage || 0) : 'unknown'
          };
        }).catch(estimateError => {
          info.storageEstimate = 'unavailable';
        });
      } else {
        info.storageEstimate = 'unsupported';
      }

      return {
        isValid: true, // 存储问题通常不应阻止插件运行
        errors,
        warnings,
        info
      };

    } catch (error) {
      return {
        isValid: true,
        errors: [],
        warnings: [`存储验证过程中发生错误: ${error}`],
        info: {}
      };
    }
  }

  public static async showDiagnosticDialog(): Promise<void> {
    try {
      console.log("[ConfigValidator] Showing diagnostic dialog...");
      
      const validation = await ConfigValidator.validateSystem();
      const mainWindow = Zotero.getMainWindow();
      
      if (!mainWindow) {
        console.error("[ConfigValidator] No main window available for dialog");
        return;
      }

      // 创建诊断对话框
      const dialog = mainWindow.document.createElement('div');
      dialog.className = 'researchopia-diagnostic-dialog';
      dialog.innerHTML = ConfigValidator.generateDiagnosticHTML(validation);
      
      // 添加关闭事件
      const closeBtn = dialog.querySelector('.diagnostic-close') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.onclick = () => {
          dialog.remove();
        };
      }

      // 添加导出功能
      const exportBtn = dialog.querySelector('.diagnostic-export') as HTMLButtonElement;
      if (exportBtn) {
        exportBtn.onclick = () => {
          ConfigValidator.exportDiagnosticReport(validation);
        };
      }

      mainWindow.document.body.appendChild(dialog);
      
    } catch (error) {
      console.error("[ConfigValidator] Error showing diagnostic dialog:", error);
    }
  }

  private static generateDiagnosticHTML(validation: any): string {
    const errorsHTML = validation.errors.map((error: string) => 
      `<li class="error">❌ ${error}</li>`
    ).join('');
    
    const warningsHTML = validation.warnings.map((warning: string) => 
      `<li class="warning">⚠️ ${warning}</li>`
    ).join('');

    return `
      <div class="diagnostic-content">
        <h2>Researchopia 系统诊断</h2>
        
        <div class="diagnostic-summary ${validation.isValid ? 'valid' : 'invalid'}">
          <h3>总体状态: ${validation.isValid ? '✅ 正常' : '❌ 需要注意'}</h3>
        </div>

        ${validation.errors.length > 0 ? `
        <div class="diagnostic-section">
          <h4>错误 (${validation.errors.length})</h4>
          <ul>${errorsHTML}</ul>
        </div>
        ` : ''}

        ${validation.warnings.length > 0 ? `
        <div class="diagnostic-section">
          <h4>警告 (${validation.warnings.length})</h4>
          <ul>${warningsHTML}</ul>
        </div>
        ` : ''}

        <div class="diagnostic-section">
          <h4>系统信息</h4>
          <pre>${JSON.stringify(validation.info, null, 2)}</pre>
        </div>

        <div class="diagnostic-buttons">
          <button class="diagnostic-export">导出诊断报告</button>
          <button class="diagnostic-close primary">关闭</button>
        </div>
      </div>
    `;
  }

  private static exportDiagnosticReport(validation: any): void {
    try {
      const addon = (globalThis as any).Zotero?.Researchopia;
      const report = {
        timestamp: new Date().toISOString(),
        pluginVersion: (addon?.data.config as any)?.buildVersion || '0.2.0',
        validation
      };

      const reportText = JSON.stringify(report, null, 2);
      
      // 复制到剪贴板
      if (navigator.clipboard) {
        navigator.clipboard.writeText(reportText);
        console.log("[ConfigValidator] Diagnostic report copied to clipboard");
      } else {
        console.log("[ConfigValidator] Diagnostic report:", reportText);
      }
      
    } catch (error) {
      console.error("[ConfigValidator] Error exporting diagnostic report:", error);
    }
  }

  public static cleanup(): void {
    // 清理工作（如果有的话）
    ConfigValidator.instance = null;
    console.log("[ConfigValidator] Cleanup completed");
  }
}
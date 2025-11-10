/**
 * 版本检测器
 * 负责检查插件版本、显示升级提示、禁用旧版本功能
 */

import { logger } from "../utils/logger";
import { version as packageVersion } from "../../package.json";
import { APIClient } from "../utils/apiClient";

interface VersionConfig {
  min_version: string;
  latest_version: string;
  download_url?: string;
  force_update?: boolean;
  message?: string;
  disabled_features?: string[];
  is_beta?: boolean; // 标记是否为测试版本
  beta_message?: string; // 灰度测试邀请信息（展示在/updates页面）
  beta_confirm_message?: string; // Zotero确认框信息
}

export type FeatureName = 
  | 'reading-session'      // 文献共读
  | 'paper-evaluation'     // 论文评价
  | 'quick-search';        // 快捷搜索

export class VersionChecker {
  private static instance: VersionChecker;
  private currentVersion: string;
  private apiClient = APIClient.getInstance();
  private disabledFeatures: Set<FeatureName> = new Set();
  private versionConfig: VersionConfig | null = null;

  private constructor() {
    this.currentVersion = this.getCurrentVersion();
  }

  public static getInstance(): VersionChecker {
    if (!VersionChecker.instance) {
      VersionChecker.instance = new VersionChecker();
    }
    return VersionChecker.instance;
  }

  /**
   * 获取当前插件版本号
   */
  private getCurrentVersion(): string {
    try {
      // 从插件配置中获取版本号
      const addon = (Zotero as any).Researchopia;
      const version = (addon?.data.config as any)?.buildVersion || packageVersion;
      logger.log('[VersionChecker] Current version:', version);
      return version;
    } catch (error) {
      logger.error('[VersionChecker] Failed to get current version:', error);
      return packageVersion;
    }
  }

  /**
   * 比较版本号
   * @returns 1: v1 > v2, 0: v1 = v2, -1: v1 < v2
   */
  private compareVersions(v1: string, v2: string): number {
    const clean = (v: string) => v.replace(/[^0-9.]/g, ''); // 移除非数字和点
    const parts1 = clean(v1).split('.').map(Number);
    const parts2 = clean(v2).split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }

  /**
   * 检查版本并处理（插件启动时调用）
   * @returns true: 允许运行, false: 禁止运行
   */
  public async checkAndEnforce(): Promise<boolean> {
    try {
      logger.log('[VersionChecker] 🔍 Checking version...');
      logger.log('[VersionChecker] Current version:', this.currentVersion);
      
      // 从服务器获取版本配置
      const config = await this.fetchVersionConfig();
      
      if (!config) {
        logger.log('[VersionChecker] ⚠️ Failed to fetch version config, allowing plugin to run');
        return true; // 获取失败时不阻止插件运行
      }
      
      this.versionConfig = config;
      
      // 只在有新版本时显示简化的服务器配置(不含message)
      const initialComparison = this.compareVersions(this.currentVersion, config.latest_version);
      if (initialComparison < 0) {
        const { message, ...configWithoutMessage } = config;
        logger.log('[VersionChecker] 📦 Server config:', configWithoutMessage);
      }
      
      // 处理功能禁用（内测用户不受限制；普通用户仅当版本低于最新版本时受限）
      if (config.disabled_features && config.disabled_features.length > 0) {
        if (config.is_beta) {
          // 内测用户可以使用所有功能
          logger.log('[VersionChecker] ✅ Beta tester: all features enabled');
        } else {
          const comparison = this.compareVersions(this.currentVersion, config.latest_version);
          if (comparison < 0) {
            // 当前版本低于最新版本，应用功能限制
            config.disabled_features.forEach(feature => {
              this.disabledFeatures.add(feature as FeatureName);
            });
            logger.log('[VersionChecker] 🚫 Disabled features (version too old):', Array.from(this.disabledFeatures));
          } else {
            logger.log('[VersionChecker] ✅ Version is up-to-date or newer, no features disabled');
          }
        }
      }
      
      // 比较版本
      const comparison = this.compareVersions(this.currentVersion, config.min_version);
      
      // 获取主窗口以设置全局标志
      const win = (Zotero as any).getMainWindow();
      
      if (comparison < 0) {
        // 当前版本低于最低支持版本
        logger.log('[VersionChecker] ❌ Version too old, critical update required');
        // 设置全局标志
        if (win) {
          win.__researchopia_update_available__ = true;
          win.__researchopia_update_critical__ = true;
        }
        
        if (config.force_update) {
          return false; // 强制升级时禁止运行
        }
      }
      
      // 检查是否有新版本可用
      const versionComparison = this.compareVersions(this.currentVersion, config.latest_version);
      if (versionComparison < 0) {
        logger.log('[VersionChecker] 🆕 New version available');
        // 设置全局标志
        if (win) {
          win.__researchopia_update_available__ = true;
          if (!win.__researchopia_update_critical__) {
            win.__researchopia_update_critical__ = false;
          }
        }
        // 显示通知 (注意: await确保异常能被正确捕获)
        await this.showUpdateNotification(config);
      } else if (versionComparison === 0) {
        logger.log('[VersionChecker] ✅ Version is up to date');
      } else {
        logger.log('[VersionChecker] ℹ️ Current version is newer than latest release (development version)');
      }
      
      return true;
      
    } catch (error) {
      logger.error('[VersionChecker] ❌ Error checking version:', error);
      return true; // 出错时不阻止插件运行
    }
  }

  /**
   * 检查功能是否被禁用
   */
  public isFeatureDisabled(feature: FeatureName): boolean {
    return this.disabledFeatures.has(feature);
  }

  /**
   * 获取所有禁用的功能集合
   */
  public getDisabledFeatures(): Set<string> {
    return this.disabledFeatures;
  }

  /**
   * 获取版本配置信息
   */
  public getVersionConfig(): VersionConfig | null {
    return this.versionConfig;
  }

  /**
   * 从服务器获取版本配置（支持灰度测试）
   */
  private async fetchVersionConfig(): Promise<VersionConfig | null> {
    try {
      // 获取当前登录用户邮箱
      const { AuthManager } = await import('./auth');
      const instance = AuthManager.getInstance();
      const user = instance.getUser();
      let userEmail = user?.email || '';
      
      logger.log('[VersionChecker] User check:', { 
        hasUser: !!user, 
        email: userEmail 
      });
      
      // 如果user没有email,尝试从prefs直接读取
      if (!userEmail) {
        try {
          const prefs = (Zotero as any).Prefs;
          const prefEmail = prefs.get('extensions.researchopia.userEmail');
          if (prefEmail) {
            userEmail = prefEmail;
            logger.log('[VersionChecker] Got email from prefs:', userEmail);
          }
        } catch (e) {
          logger.log('[VersionChecker] Could not read email from prefs:', e);
        }
      }
      
      // 构建请求URL，如果有邮箱则传递
      let url = '/api/config/version?plugin=researchopia-zotero';
      if (userEmail) {
        url += `&email=${encodeURIComponent(userEmail)}`;
        logger.log('[VersionChecker] Checking version for user:', userEmail);
      } else {
        logger.log('[VersionChecker] No user email available, checking general version');
      }
      
      const response = await this.apiClient.request('GET', url);
      // 只在调试模式下记录API响应细节
      // logger.warn('[VersionChecker] API response:', response);
      return response as VersionConfig;
    } catch (error) {
      logger.error('[VersionChecker] Failed to fetch version config:', error);
      return null;
    }
  }



  /**
   * 显示升级通知
   * - 灰度测试用户: 显示确认框邀请体验测试功能
   * - 普通用户: 使用ProgressWindow简单通知
   */
  private async showUpdateNotification(config: VersionConfig): Promise<void> {
    try {
      logger.log('[VersionChecker] 📢 Showing update notification...');
      
      // 提前导入envConfig以避免在用户操作后才导入
      const { envConfig } = await import('../config/env');
      const baseUrl = envConfig.apiBaseUrl;
      
      // 检查是否已经对当前版本提示过"不再提示"
      const prefs = (Zotero as any).Prefs;
      const doNotShowKey = 'extensions.researchopia.betaPromptDoNotShow';
      const lastPromptedVersionKey = 'extensions.researchopia.lastBetaVersionPrompted';
      
      if (config.is_beta && (config.beta_confirm_message || config.beta_message)) {
        // 灰度测试用户: 显示确认框
        const lastPromptedVersion = prefs.get(lastPromptedVersionKey, '');
        const userClickedDoNotShow = prefs.get(doNotShowKey, false);
        
        // 只有当用户点击了"不再提示"且版本号未变化时才跳过
        if (userClickedDoNotShow && lastPromptedVersion === config.latest_version) {
          logger.log('[VersionChecker] User chose "Do not show again" for version', config.latest_version, ', skipping beta prompt');
          return;
        }
        
        // 如果是新版本,清除"不再提示"标记
        if (lastPromptedVersion !== config.latest_version) {
          prefs.set(doNotShowKey, false);
          logger.log('[VersionChecker] New beta version detected, resetting do-not-show flag');
        }
        
        const title = '🧪 Researchopia 测试版邀请';
        // 使用确认框信息，如果没有则使用邀请信息
        let message = config.beta_confirm_message || config.beta_message || '';
        // 替换占位符
        message = message.replace(/{version}/g, config.latest_version);
        
        // 如果消息太短，添加默认提示
        if (message.length < 20) {
          message = `发现测试版本 v${config.latest_version}，是否查看详情？\n\n当前版本: v${this.currentVersion}`;
        }
        
        logger.log('[VersionChecker] Preparing to show confirm dialog');
        
        //使用简化的confirm调用，只传必需参数
        // 参考Zotero源码，confirm方法签名为:
        // confirm(parent, dialogTitle, text, button0Title, button1Title, button2Title, checkLabel, checkValue)
        logger.log('[VersionChecker] Calling Services.prompt.confirmEx...');
        
        const Services = (Zotero as any).getMainWindow().Services;
        const buttonFlags = Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0 +
                           Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1;
        
        const result = Services.prompt.confirmEx(
          null,  // parent window
          title,  // dialog title
          message,  // message text
          buttonFlags,  // button flags
          '查看详情',  // button 0 label
          '不再提示',  // button 1 label
          null,  // button 2 label (not used)
          null,  // checkbox label (not used)
          {}  // checkbox state object
        );
        
        logger.log('[VersionChecker] Confirm result:', result);
        
        if (result === 0) {
          // 用户点击"查看详情" - 打开updates页面
          // 页面会自动从session获取当前登录用户,无需传递email参数
          (Zotero as any).launchURL(`${baseUrl}/updates`);
          logger.log('[VersionChecker] User clicked "View Details", opening updates page');
        } else if (result === 1) {
          // 用户点击"不再提示" - 保存偏好设置和当前版本号
          prefs.set(doNotShowKey, true);
          prefs.set(lastPromptedVersionKey, config.latest_version);
          logger.log('[VersionChecker] User chose "Do not show again" for version:', config.latest_version);
        }
        
      } else {
        // 普通用户: 使用ProgressWindow
        const ZoteroAny = Zotero as any;
        const progressWindow = new ZoteroAny.ProgressWindow({ closeOnClick: true });
        
        progressWindow.changeHeadline('🆕 Researchopia 新版本可用', 'chrome://zotero/skin/tick.png');
        progressWindow.addDescription(`当前: v${this.currentVersion} → 最新: v${config.latest_version}`);
        progressWindow.addDescription('点击插件面板中的"更新"按钮查看详情');
        progressWindow.show();
        progressWindow.startCloseTimer(8000);
      }
      
      logger.log('[VersionChecker] ✅ Notification displayed successfully');
    } catch (error) {
      logger.error('[VersionChecker] ⚠️ Could not show notification:', error);
      logger.error('[VersionChecker] Error stack:', error instanceof Error ? error.stack : 'No stack');
      logger.error('[VersionChecker] Error message:', error instanceof Error ? error.message : String(error));
    }
  }
}

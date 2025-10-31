/**
 * 模块导入适配器
 * 统一处理Zotero 7/8的模块导入差异
 */

import { ZoteroVersionDetector } from '../utils/version-detector';

export class ModuleAdapter {
  /**
   * 导入Services模块
   * Zotero 8: Services.sys.mjs
   * Zotero 7: Services.jsm
   */
  static importServices(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      // Zotero 8 使用ESM
      // @ts-ignore - ChromeUtils is available at runtime
      return ChromeUtils.importESModule('resource://gre/modules/Services.sys.mjs').Services;
    } else {
      // Zotero 7 使用CommonJS
      // @ts-ignore - ChromeUtils is available at runtime
      const { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
      return Services;
    }
  }

  /**
   * 导入Console模块
   */
  static importConsole(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      // @ts-ignore
      return ChromeUtils.importESModule('resource://gre/modules/Console.sys.mjs').console;
    } else {
      // @ts-ignore
      const { console } = ChromeUtils.import('resource://gre/modules/Console.jsm');
      return console;
    }
  }

  /**
   * 导入AddonManager模块
   */
  static importAddonManager(): any {
    if (ZoteroVersionDetector.isZotero8()) {
      // @ts-ignore
      return ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs').AddonManager;
    } else {
      // @ts-ignore
      const { AddonManager } = ChromeUtils.import('resource://gre/modules/AddonManager.jsm');
      return AddonManager;
    }
  }
}

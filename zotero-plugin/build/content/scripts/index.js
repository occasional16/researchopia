/**
 * Researchopia Main Script
 * 主入口脚本，按照官方模板结构
 */

// 导入模块
const AnnotationManager = require('./modules/annotation-manager');
const UIManager = require('./modules/ui-manager');
const SyncManager = require('./modules/sync-manager');

class ResearchopiaPlugin {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.57';
    this.initialized = false;
    
    // 初始化管理器
    this.annotationManager = new AnnotationManager();
    this.uiManager = new UIManager();
    this.syncManager = new SyncManager();
  }

  async init() {
    try {
      Zotero.debug("🚀 Researchopia: Initializing plugin...");
      
      // 初始化各个管理器
      await this.annotationManager.init();
      await this.uiManager.init();
      await this.syncManager.init();
      
      this.initialized = true;
      Zotero.debug("✅ Researchopia: Plugin initialized successfully");
      
      // 显示成功消息
      setTimeout(() => {
        try {
          Zotero.alert(null, 'Researchopia v0.1.57', '🎉 插件加载成功！\n✨ Plugin loaded successfully!\n\n🔥 开发环境运行中');
        } catch (e) {
          Zotero.debug("Alert failed: " + e.message);
        }
      }, 1000);
      
    } catch (error) {
      Zotero.debug("❌ Researchopia: Initialization failed: " + error.message);
      throw error;
    }
  }

  async shutdown() {
    try {
      Zotero.debug("🔄 Researchopia: Shutting down plugin...");
      
      // 清理各个管理器
      if (this.syncManager) await this.syncManager.shutdown();
      if (this.uiManager) await this.uiManager.shutdown();
      if (this.annotationManager) await this.annotationManager.shutdown();
      
      this.initialized = false;
      Zotero.debug("✅ Researchopia: Plugin shutdown completed");
      
    } catch (error) {
      Zotero.debug("❌ Researchopia: Shutdown failed: " + error.message);
    }
  }
}

// 导出插件类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ResearchopiaPlugin;
} else {
  // 浏览器环境
  window.ResearchopiaPlugin = ResearchopiaPlugin;
}

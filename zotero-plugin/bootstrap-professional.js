/**
 * Researchopia Zotero Plugin Bootstrap - Professional Architecture
 * 研学港 Zotero 插件启动文件 - 专业架构版本
 */

// 全局变量
var Zotero;
var rootURI;
var ResearchopiaPlugin;

// 日志函数
function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("🔥 Researchopia: " + message);
  }
}

/**
 * 主插件类 - 整合专业架构
 */
class ResearchopiaPluginProfessional {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.92';
    this.initialized = false;
    
    // 核心组件
    this.researchopiaCore = null;
    this.itemPaneManager = null;
    this.annotationManager = null;
    this.syncManager = null;
    this.uiManager = null;
  }

  /**
   * 初始化插件
   */
  async init() {
    try {
      log("🚀 Initializing Researchopia Plugin Professional v" + this.version);
      
      // 加载专业架构模块
      await this.loadProfessionalModules();
      
      // 初始化核心组件
      await this.initializeCoreComponents();
      
      // 注册Item Pane
      await this.registerItemPane();
      
      this.initialized = true;
      log("✅ Plugin initialized successfully with professional architecture");
      
      // 显示启动消息
      this.showStartupMessage();
      
    } catch (error) {
      log("❌ Initialization failed: " + error.message);
      log("❌ Error stack: " + error.stack);
      throw error;
    }
  }

  /**
   * 加载专业架构模块
   */
  async loadProfessionalModules() {
    try {
      log("Loading professional modules from /content/scripts/");
      
      // 加载主脚本
      const mainScriptURI = rootURI + 'content/scripts/index.js';
      log("Loading main script: " + mainScriptURI);
      
      // 使用Services.scriptloader加载脚本
      const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
      Services.scriptloader.loadSubScript(mainScriptURI, this);
      
      // 检查是否成功加载
      if (typeof ResearchopiaPlugin !== 'undefined') {
        this.researchopiaCore = new ResearchopiaPlugin();
        log("✅ Professional core module loaded");
      } else {
        throw new Error("ResearchopiaPlugin class not found after loading");
      }
      
      // 加载Item Pane Manager
      const itemPaneScriptURI = rootURI + 'content/scripts/item-pane-manager.js';
      log("Loading Item Pane Manager: " + itemPaneScriptURI);
      Services.scriptloader.loadSubScript(itemPaneScriptURI, this);
      
      if (typeof ItemPaneManager !== 'undefined') {
        this.itemPaneManager = new ItemPaneManager();
        log("✅ Item Pane Manager loaded");
      }
      
    } catch (error) {
      log("❌ Failed to load professional modules: " + error.message);
      throw error;
    }
  }

  /**
   * 初始化核心组件
   */
  async initializeCoreComponents() {
    try {
      // 初始化核心插件
      if (this.researchopiaCore) {
        await this.researchopiaCore.init();
        log("✅ Core plugin initialized");
        
        // 获取管理器引用
        this.annotationManager = this.researchopiaCore.annotationManager;
        this.syncManager = this.researchopiaCore.syncManager;
        this.uiManager = this.researchopiaCore.uiManager;
      }
      
    } catch (error) {
      log("❌ Failed to initialize core components: " + error.message);
      throw error;
    }
  }

  /**
   * 注册Item Pane
   */
  async registerItemPane() {
    try {
      if (this.itemPaneManager) {
        await this.itemPaneManager.register();
        log("✅ Item Pane registered");
      } else {
        log("⚠️ Item Pane Manager not available, using fallback");
        await this.registerFallbackItemPane();
      }
    } catch (error) {
      log("❌ Failed to register Item Pane: " + error.message);
      // 使用fallback
      await this.registerFallbackItemPane();
    }
  }

  /**
   * 注册备用Item Pane
   */
  async registerFallbackItemPane() {
    try {
      log("Registering fallback Item Pane...");
      
      await Zotero.ItemPaneManager.registerSection({
        paneID: 'researchopia-fallback',
        pluginID: this.id,
        header: {
          l10nID: 'researchopia-annotations-header',
          l10nArgs: null
        },
        sizerID: 'researchopia-fallback-sizer',
        bodyXHTML: '<div id="researchopia-fallback-container"></div>',
        onRender: this.renderFallbackPane.bind(this),
        onItemChange: this.onItemChange.bind(this),
        onDestroy: this.onDestroy.bind(this)
      });
      
      log("✅ Fallback Item Pane registered");
    } catch (error) {
      log("❌ Failed to register fallback Item Pane: " + error.message);
      throw error;
    }
  }

  /**
   * 渲染备用面板
   */
  renderFallbackPane({ body, item }) {
    try {
      const doc = body.ownerDocument;
      body.innerHTML = '';
      
      if (!item || !item.getField('DOI')) {
        const noDataDiv = doc.createElement('div');
        noDataDiv.style.cssText = 'padding: 20px; text-align: center; color: #666;';
        noDataDiv.innerHTML = '<h3>研学港 Researchopia</h3><p>请选择一个有DOI的文献项目</p>';
        body.appendChild(noDataDiv);
        return;
      }

      const doi = item.getField('DOI');
      const title = item.getField('title') || 'Unknown Title';

      // 创建专业界面
      const container = doc.createElement('div');
      container.style.cssText = 'padding: 15px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
      
      // 标题
      const header = doc.createElement('h3');
      header.style.cssText = 'margin: 0 0 15px 0; color: #1f2937; font-size: 16px;';
      header.textContent = '研学港标注共享 - 专业版';
      
      // DOI信息
      const doiInfo = doc.createElement('div');
      doiInfo.style.cssText = 'color: #6b7280; font-size: 12px; margin-bottom: 15px;';
      doiInfo.textContent = 'DOI: ' + doi;
      
      // 状态信息
      const statusDiv = doc.createElement('div');
      statusDiv.style.cssText = 'padding: 15px; background: #f0f9ff; border-radius: 6px; border: 1px solid #0ea5e9; margin-bottom: 15px;';
      statusDiv.innerHTML = '<div style="color: #0369a1; font-size: 14px; font-weight: 500;">🚀 专业架构已激活</div><div style="color: #0284c7; font-size: 12px; margin-top: 5px;">正在连接研学港服务器...</div>';
      
      // 操作按钮
      const buttonDiv = doc.createElement('div');
      buttonDiv.style.cssText = 'display: flex; gap: 10px;';
      
      const loginBtn = doc.createElement('button');
      loginBtn.style.cssText = 'padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;';
      loginBtn.textContent = '登录研学港';
      loginBtn.onclick = () => this.handleLogin();
      
      const shareBtn = doc.createElement('button');
      shareBtn.style.cssText = 'padding: 10px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;';
      shareBtn.textContent = '分享标注';
      shareBtn.onclick = () => this.handleShareAnnotations(item);
      
      buttonDiv.appendChild(loginBtn);
      buttonDiv.appendChild(shareBtn);
      
      container.appendChild(header);
      container.appendChild(doiInfo);
      container.appendChild(statusDiv);
      container.appendChild(buttonDiv);
      
      body.appendChild(container);
      
    } catch (error) {
      log("❌ Error rendering fallback pane: " + error.message);
    }
  }

  /**
   * 处理登录
   */
  handleLogin() {
    try {
      log("Handling login request");
      Zotero.launchURL('https://www.researchopia.com/plugin/auth');
    } catch (error) {
      log("❌ Login failed: " + error.message);
    }
  }

  /**
   * 处理分享标注
   */
  async handleShareAnnotations(item) {
    try {
      log("Handling share annotations request");
      
      if (this.annotationManager) {
        // 使用专业标注管理器
        const annotations = await this.annotationManager.getItemAnnotations(item);
        log(`Found ${annotations.length} annotations to share`);
        
        if (annotations.length > 0) {
          Zotero.alert(null, 'Researchopia', `准备分享 ${annotations.length} 条标注\n功能开发中...`);
        } else {
          Zotero.alert(null, 'Researchopia', '该文献没有找到标注');
        }
      } else {
        Zotero.alert(null, 'Researchopia', '标注管理器未初始化');
      }
    } catch (error) {
      log("❌ Share annotations failed: " + error.message);
      Zotero.alert(null, 'Researchopia', '分享失败: ' + error.message);
    }
  }

  /**
   * 项目变更处理
   */
  onItemChange(item) {
    log("Item changed: " + (item ? item.id : 'null'));
  }

  /**
   * 销毁处理
   */
  onDestroy() {
    log("Item pane destroyed");
  }

  /**
   * 显示启动消息
   */
  showStartupMessage() {
    setTimeout(() => {
      try {
        Zotero.alert(
          null, 
          'Researchopia v' + this.version, 
          '🎉 研学港插件已启动！\n✨ Professional Architecture Activated!\n\n📋 请选择一个有DOI的文献项目\n🚀 标注共享功能已激活\n🔐 支持用户认证系统'
        );
      } catch (alertError) {
        log("Alert failed: " + alertError.message);
      }
    }, 1000);
  }

  /**
   * 插件关闭
   */
  async shutdown() {
    try {
      log("🔄 Shutting down plugin...");
      
      if (this.researchopiaCore) {
        await this.researchopiaCore.shutdown();
      }
      
      if (this.itemPaneManager) {
        await this.itemPaneManager.unregister();
      }
      
      this.initialized = false;
      log("✅ Plugin shutdown completed");
      
    } catch (error) {
      log("❌ Shutdown failed: " + error.message);
    }
  }
}

// 全局插件实例
let researchopiaPluginInstance = null;

/**
 * 插件启动函数
 */
async function startup({ id, version, resourceURI, rootURI: pluginRootURI }) {
  try {
    // 设置全局变量
    rootURI = pluginRootURI;
    
    // 创建插件实例
    researchopiaPluginInstance = new ResearchopiaPluginProfessional();
    
    // 初始化插件
    await researchopiaPluginInstance.init();
    
  } catch (error) {
    log("❌ Startup failed: " + error.message);
    throw error;
  }
}

/**
 * 插件关闭函数
 */
async function shutdown() {
  try {
    if (researchopiaPluginInstance) {
      await researchopiaPluginInstance.shutdown();
      researchopiaPluginInstance = null;
    }
  } catch (error) {
    log("❌ Shutdown failed: " + error.message);
  }
}

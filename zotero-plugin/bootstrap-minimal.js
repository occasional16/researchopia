/**
 * Researchopia Zotero Plugin Bootstrap - Minimal Version
 * 最小化版本，专门用于解决启动问题
 */

// 全局变量
var Zotero;
var rootURI;

// 日志函数 - 只使用Zotero.debug
function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("Researchopia: " + message);
  }
}

// 全局插件实例
let researchopiaPluginInstance = null;

/**
 * 最小化插件类
 */
class ResearchopiaMinimal {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.95';
    this.initialized = false;
  }

  /**
   * 初始化插件
   */
  async init() {
    try {
      log("Starting minimal plugin v" + this.version);
      
      // 等待Zotero完全加载
      await this.waitForZotero();
      
      // 注册Item Pane
      await this.registerItemPane();
      
      this.initialized = true;
      log("Minimal plugin initialized successfully");
      
      // 显示启动消息
      this.showStartupMessage();
      
    } catch (error) {
      log("Initialization failed: " + error.message);
      throw error;
    }
  }

  /**
   * 等待Zotero完全加载
   */
  async waitForZotero() {
    let attempts = 0;
    while (attempts < 50) {
      if (typeof Zotero !== 'undefined' && 
          Zotero.ItemPaneManager && 
          Zotero.ItemPaneManager.registerSection) {
        log("Zotero is ready");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error("Zotero not ready after 5 seconds");
  }

  /**
   * 注册Item Pane
   */
  async registerItemPane() {
    try {
      log("Registering Item Pane...");
      
      await Zotero.ItemPaneManager.registerSection({
        paneID: 'researchopia-minimal',
        pluginID: this.id,
        header: {
          l10nID: 'researchopia-section-header',
          l10nArgs: null
        },
        sizerID: 'researchopia-minimal-sizer',
        bodyXHTML: '<div id="researchopia-minimal-container" style="padding: 15px;"></div>',
        onRender: ({ body, item }) => {
          this.renderPane(body, item);
        },
        onItemChange: ({ body, item }) => {
          this.renderPane(body, item);
        },
        onDestroy: () => {
          log("Item Pane destroyed");
        }
      });
      
      log("Item Pane registered successfully");
    } catch (error) {
      log("Failed to register Item Pane: " + error.message);
      throw error;
    }
  }

  /**
   * 渲染面板
   */
  renderPane(body, item) {
    try {
      const doc = body.ownerDocument;
      body.innerHTML = '';
      
      // 创建标题
      const title = doc.createElement('h3');
      title.style.margin = '0 0 15px 0';
      title.style.color = '#1f2937';
      title.style.fontSize = '16px';
      title.textContent = '研学港插件 - 最小版';
      
      // 创建内容
      const content = doc.createElement('div');
      content.style.padding = '15px';
      content.style.background = '#f0f9ff';
      content.style.borderRadius = '6px';
      content.style.border = '1px solid #0ea5e9';
      
      if (!item) {
        content.textContent = '请选择一个文献项目';
      } else {
        const doi = item.getField('DOI');
        const title_text = item.getField('title') || 'Unknown Title';
        
        content.innerHTML = 
          '<div style="color: #0369a1; font-size: 14px; font-weight: 500;">✅ 插件工作正常！</div>' +
          '<div style="color: #0284c7; font-size: 12px; margin-top: 8px;">' +
          '<strong>DOI:</strong> ' + (doi || '无') + '<br/>' +
          '<strong>标题:</strong> ' + title_text.substring(0, 50) + (title_text.length > 50 ? '...' : '') +
          '</div>';
      }
      
      // 创建测试按钮
      const button = doc.createElement('button');
      button.style.padding = '10px 16px';
      button.style.background = '#3b82f6';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '6px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';
      button.style.marginTop = '15px';
      button.textContent = '测试按钮';
      button.onclick = () => {
        Zotero.alert(null, 'Researchopia', 'Item Pane 工作正常！');
      };
      
      // 组装界面
      body.appendChild(title);
      body.appendChild(content);
      body.appendChild(button);
      
      log("Pane rendered successfully");
      
    } catch (error) {
      log("Error rendering pane: " + error.message);
      body.innerHTML = '<div style="color: red;">渲染错误: ' + error.message + '</div>';
    }
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
          '研学港插件最小版已启动！\n\n请选择一个文献项目测试Item Pane。'
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
      log("Shutting down minimal plugin...");
      this.initialized = false;
      log("Minimal plugin shutdown completed");
    } catch (error) {
      log("Shutdown failed: " + error.message);
    }
  }
}

/**
 * 插件启动函数
 */
async function startup({ id, version, resourceURI, rootURI: pluginRootURI }) {
  try {
    // 设置全局变量
    rootURI = pluginRootURI;
    
    log("Starting up minimal plugin...");
    log("Plugin ID: " + id);
    log("Plugin Version: " + version);
    
    // 创建插件实例
    researchopiaPluginInstance = new ResearchopiaMinimal();
    
    // 初始化插件
    await researchopiaPluginInstance.init();
    
  } catch (error) {
    log("Startup failed: " + error.message);
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
    log("Shutdown failed: " + error.message);
  }
}

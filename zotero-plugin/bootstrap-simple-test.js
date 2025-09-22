/**
 * Researchopia Zotero Plugin Bootstrap - Simple Test Version
 * 简化测试版本，专门用于调试Item Pane显示问题
 */

// 全局变量
var Zotero;
var rootURI;

// 日志函数
function log(message) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("🔥 Researchopia: " + message);
  }
  console.log("🔥 Researchopia: " + message);
}

// 全局插件实例
let researchopiaPluginInstance = null;

/**
 * 简单插件类 - 专门用于测试Item Pane
 */
class ResearchopiaSimpleTest {
  constructor() {
    this.id = 'researchopia@zotero.plugin';
    this.version = '0.1.93';
    this.initialized = false;
  }

  /**
   * 初始化插件
   */
  async init() {
    try {
      log("🚀 Initializing Simple Test Plugin v" + this.version);
      
      // 直接注册Item Pane
      await this.registerSimpleItemPane();
      
      this.initialized = true;
      log("✅ Simple test plugin initialized successfully");
      
      // 显示启动消息
      this.showStartupMessage();
      
    } catch (error) {
      log("❌ Initialization failed: " + error.message);
      log("❌ Error stack: " + error.stack);
      throw error;
    }
  }

  /**
   * 注册简单Item Pane
   */
  async registerSimpleItemPane() {
    try {
      log("Registering simple Item Pane...");
      
      await Zotero.ItemPaneManager.registerSection({
        paneID: 'researchopia-simple-test',
        pluginID: this.id,
        header: {
          l10nID: 'researchopia-section-header',
          l10nArgs: null
        },
        sizerID: 'researchopia-simple-test-sizer',
        bodyXHTML: '<div id="researchopia-simple-test-container" style="padding: 15px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;"></div>',
        onRender: ({ body, item }) => {
          log("🎨 Rendering simple Item Pane");
          this.renderSimplePane(body, item);
        },
        onItemChange: ({ body, item }) => {
          log("🔄 Item changed, re-rendering");
          this.renderSimplePane(body, item);
        },
        onDestroy: () => {
          log("🗑️ Item Pane destroyed");
        }
      });
      
      log("✅ Simple Item Pane registered successfully");
    } catch (error) {
      log("❌ Failed to register simple Item Pane: " + error.message);
      log("❌ Error stack: " + error.stack);
      throw error;
    }
  }

  /**
   * 渲染简单面板
   */
  renderSimplePane(body, item) {
    try {
      log("Rendering simple pane for item: " + (item ? item.id : 'null'));
      
      const doc = body.ownerDocument;
      body.innerHTML = '';
      
      // 创建标题
      const title = doc.createElement('h3');
      title.style.cssText = 'margin: 0 0 15px 0; color: #1f2937; font-size: 16px;';
      title.textContent = '🎉 研学港插件测试版';
      
      // 创建状态信息
      const status = doc.createElement('div');
      status.style.cssText = 'padding: 15px; background: #f0f9ff; border-radius: 6px; border: 1px solid #0ea5e9; margin-bottom: 15px;';
      
      if (!item) {
        status.innerHTML = '<div style="color: #0369a1; font-size: 14px;">📋 请选择一个文献项目</div>';
      } else {
        const doi = item.getField('DOI');
        const title_text = item.getField('title') || 'Unknown Title';
        
        if (doi) {
          status.innerHTML = `
            <div style="color: #0369a1; font-size: 14px; font-weight: 500;">✅ Item Pane 显示正常！</div>
            <div style="color: #0284c7; font-size: 12px; margin-top: 8px;">
              <strong>DOI:</strong> ${doi}<br/>
              <strong>标题:</strong> ${title_text.substring(0, 80)}${title_text.length > 80 ? '...' : ''}
            </div>
          `;
        } else {
          status.innerHTML = `
            <div style="color: #d97706; font-size: 14px; font-weight: 500;">⚠️ 该文献没有DOI</div>
            <div style="color: #f59e0b; font-size: 12px; margin-top: 8px;">
              <strong>标题:</strong> ${title_text.substring(0, 80)}${title_text.length > 80 ? '...' : ''}
            </div>
          `;
        }
      }
      
      // 创建测试按钮
      const buttonDiv = doc.createElement('div');
      buttonDiv.style.cssText = 'display: flex; gap: 10px;';
      
      const testBtn = doc.createElement('button');
      testBtn.style.cssText = 'padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;';
      testBtn.textContent = '测试按钮';
      testBtn.onclick = () => {
        Zotero.alert(null, 'Researchopia', '🎉 Item Pane 工作正常！\n\n插件已成功显示在右侧面板中。');
      };
      
      const websiteBtn = doc.createElement('button');
      websiteBtn.style.cssText = 'padding: 10px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;';
      websiteBtn.textContent = '访问研学港';
      websiteBtn.onclick = () => {
        Zotero.launchURL('https://www.researchopia.com/');
      };
      
      buttonDiv.appendChild(testBtn);
      buttonDiv.appendChild(websiteBtn);
      
      // 组装界面
      body.appendChild(title);
      body.appendChild(status);
      body.appendChild(buttonDiv);
      
      log("✅ Simple pane rendered successfully");
      
    } catch (error) {
      log("❌ Error rendering simple pane: " + error.message);
      log("❌ Error stack: " + error.stack);
      
      // 显示错误信息
      body.innerHTML = `
        <div style="padding: 15px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px;">
          <div style="color: #dc2626; font-size: 14px; font-weight: 500;">❌ 渲染错误</div>
          <div style="color: #991b1b; font-size: 12px; margin-top: 5px;">${error.message}</div>
        </div>
      `;
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
          '🎉 研学港插件测试版已启动！\n✨ Simple Test Version Loaded!\n\n📋 请选择一个文献项目测试Item Pane\n🔧 专门用于调试显示问题'
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
      log("🔄 Shutting down simple test plugin...");
      this.initialized = false;
      log("✅ Simple test plugin shutdown completed");
    } catch (error) {
      log("❌ Shutdown failed: " + error.message);
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
    
    log("🚀 Starting up simple test plugin...");
    log("Plugin ID: " + id);
    log("Plugin Version: " + version);
    log("Root URI: " + pluginRootURI);
    
    // 创建插件实例
    researchopiaPluginInstance = new ResearchopiaSimpleTest();
    
    // 初始化插件
    await researchopiaPluginInstance.init();
    
  } catch (error) {
    log("❌ Startup failed: " + error.message);
    log("❌ Error stack: " + error.stack);
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

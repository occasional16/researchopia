/**
 * 简化版研学港 Zotero 插件 - 用于测试
 */

// 导入必要的服务
if (typeof Services === 'undefined') {
  try {
    var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
  } catch (e) {
    // 如果ChromeUtils不可用，尝试其他方式
    Components.utils.import('resource://gre/modules/Services.jsm');
  }
}

// 插件全局对象
var Researchopia = {
  id: 'researchopia-test@zotero.plugin',
  version: '1.0.0',
  initialized: false,
  
  log: function(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[Researchopia ${level.toUpperCase()}] ${timestamp}: ${message}`;
      
      if (this.config && this.config.debug) {
        console.log(logMessage);
      }
      
      // 也写入Zotero日志
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(logMessage);
      }
    } catch (error) {
      console.error('Logging error:', error);
    }
  },
  
  handleError: function(error, context = 'unknown') {
    this.log(`Error in ${context}: ${error.message}`, 'error');
    console.error(error);
  }
};

/**
 * 插件启动函数
 */
function startup(data) {
  try {
    Researchopia.log('Simple plugin startup initiated');
    
    // 处理不同版本的参数格式
    if (data && data.rootURI) {
      Researchopia.rootURI = data.rootURI;
    } else if (typeof data === 'string') {
      Researchopia.rootURI = data;
    }
    
    // 简单的初始化
    Researchopia.initialized = true;
    Researchopia.log('Simple plugin startup completed successfully');
    
    // 显示一个简单的通知
    if (typeof Zotero !== 'undefined' && Zotero.alert) {
      setTimeout(() => {
        Zotero.alert(null, 'Researchopia', 'Plugin loaded successfully!');
      }, 1000);
    }
    
  } catch (error) {
    Researchopia.handleError(error, 'startup');
  }
}

/**
 * 插件关闭函数
 */
function shutdown() {
  try {
    Researchopia.log('Simple plugin shutdown initiated');
    Researchopia.initialized = false;
    Researchopia.log('Simple plugin shutdown completed');
  } catch (error) {
    Researchopia.handleError(error, 'shutdown');
  }
}

/**
 * 安装函数
 */
function install() {
  Researchopia.log('Plugin installed');
}

/**
 * 卸载函数
 */
function uninstall() {
  Researchopia.log('Plugin uninstalled');
}

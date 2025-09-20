/*
 * 研学港 Zotero插件 - 简化版Bootstrap
 * Simple Bootstrap for Researchopia Zotero Plugin
 */

// 插件启动
function startup({ id, version, rootURI }) {
  try {
    Zotero.debug('Researchopia: Starting plugin initialization');
    
    // 加载主插件文件
    Services.scriptloader.loadSubScript(rootURI + 'researchopia-simple.js');
    
    // 等待一下确保文件加载完成
    setTimeout(() => {
      if (Zotero.Researchopia && Zotero.Researchopia.init) {
        Zotero.Researchopia.init({ id, version, rootURI });
        Zotero.debug('Researchopia: Plugin initialized successfully');
      } else {
        Zotero.debug('Researchopia: Failed to load main plugin file');
      }
    }, 100);
    
  } catch (error) {
    Zotero.debug('Researchopia: Error in startup: ' + error.message);
  }
}

// 插件关闭
function shutdown() {
  try {
    if (Zotero.Researchopia && Zotero.Researchopia.log) {
      Zotero.Researchopia.log('Plugin shutdown completed');
    } else {
      Zotero.debug('Researchopia: Plugin shutdown completed');
    }
  } catch (error) {
    Zotero.debug('Researchopia: Error during shutdown: ' + error.message);
  }
}

// 安装
function install() {
  try {
    Zotero.debug('Researchopia: Plugin installed');
  } catch (error) {
    Zotero.debug('Researchopia: Error in install: ' + error.message);
  }
}

// 卸载
function uninstall() {
  try {
    Zotero.debug('Researchopia: Plugin uninstalled');
  } catch (error) {
    Zotero.debug('Researchopia: Error in uninstall: ' + error.message);
  }
}

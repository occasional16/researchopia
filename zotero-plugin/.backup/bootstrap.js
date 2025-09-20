/*
 * 研学港 Zotero插件 - 修复版Bootstrap
 * Fixed Researchopia Zotero Plugin Bootstrap
 */

// 插件启动
function startup({ id, version, rootURI }) {
  try {
    // 加载主插件文件
    Services.scriptloader.loadSubScript(rootURI + 'researchopia.js');
    
    // 加载样式
    const styleSheet = rootURI + 'style.css';
    const styleSheetService = Components.classes['@mozilla.org/content/style-sheet-service;1']
      .getService(Components.interfaces.nsIStyleSheetService);
    const ioService = Components.classes['@mozilla.org/network/io-service;1']
      .getService(Components.interfaces.nsIIOService);
    const uri = ioService.newURI(styleSheet, null, null);
    styleSheetService.loadAndRegisterSheet(uri, styleSheetService.USER_SHEET);
    
    // 初始化插件
    if (Zotero.Researchopia && Zotero.Researchopia.init) {
      Zotero.Researchopia.init({ id, version, rootURI });
    } else {
      Zotero.debug('Researchopia: Failed to load main plugin file');
    }
  } catch (error) {
    Zotero.debug('Researchopia: Error in startup: ' + error.message);
  }
}

// 插件关闭
function shutdown() {
  try {
    if (Zotero.Researchopia && Zotero.Researchopia.log) {
      Zotero.Researchopia.log('Plugin shutdown completed');
    }
  } catch (error) {
    Zotero.debug('Researchopia: Error during shutdown: ' + error.message);
  }
}

// 安装
function install() {
  try {
    if (Zotero.Researchopia && Zotero.Researchopia.log) {
      Zotero.Researchopia.log('Plugin installed');
    } else {
      Zotero.debug('Researchopia: Plugin installed');
    }
  } catch (error) {
    Zotero.debug('Researchopia: Error in install: ' + error.message);
  }
}

// 卸载
function uninstall() {
  try {
    if (Zotero.Researchopia && Zotero.Researchopia.log) {
      Zotero.Researchopia.log('Plugin uninstalled');
    } else {
      Zotero.debug('Researchopia: Plugin uninstalled');
    }
  } catch (error) {
    Zotero.debug('Researchopia: Error in uninstall: ' + error.message);
  }
}

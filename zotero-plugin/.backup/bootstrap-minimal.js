/*
 * 研学港 Zotero插件 - 极简版Bootstrap
 * Minimal Bootstrap for Researchopia Zotero Plugin
 */

// 插件启动
function startup({ id, version, rootURI }) {
  try {
    Zotero.debug('研学港: 开始插件初始化');
    
    // 加载主插件文件
    Services.scriptloader.loadSubScript(rootURI + 'researchopia-minimal.js');
    
    // 等待一下确保文件加载完成
    setTimeout(() => {
      if (Zotero.Researchopia && Zotero.Researchopia.init) {
        Zotero.Researchopia.init({ id, version, rootURI });
        Zotero.debug('研学港: 插件初始化成功');
      } else {
        Zotero.debug('研学港: 加载主插件文件失败');
      }
    }, 100);
    
  } catch (error) {
    Zotero.debug('研学港: 启动错误: ' + error.message);
  }
}

// 插件关闭
function shutdown() {
  try {
    if (Zotero.Researchopia && Zotero.Researchopia.log) {
      Zotero.Researchopia.log('插件关闭完成');
    } else {
      Zotero.debug('研学港: 插件关闭完成');
    }
  } catch (error) {
    Zotero.debug('研学港: 关闭错误: ' + error.message);
  }
}

// 安装
function install() {
  try {
    Zotero.debug('研学港: 插件已安装');
  } catch (error) {
    Zotero.debug('研学港: 安装错误: ' + error.message);
  }
}

// 卸载
function uninstall() {
  try {
    Zotero.debug('研学港: 插件已卸载');
  } catch (error) {
    Zotero.debug('研学港: 卸载错误: ' + error.message);
  }
}

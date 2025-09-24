/**
 * Researchopia Zotero Plugin Bootstrap - Standard Architecture
 * Based on Windingwind's template and Zotero 7 best practices
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  // 等待Zotero初始化完成
  await Zotero.initializationPromise;

  // 注册Chrome资源
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "researchopia", rootURI + "chrome/content/"],
  ]);

  // 创建插件上下文
  const ctx = {
    rootURI,
    // 定义主窗口的document以创建假的浏览器环境
    document: Zotero.getMainWindow().document,
  };
  ctx._globalThis = ctx;

  // 加载主插件脚本
  Services.scriptloader.loadSubScript(
    `${rootURI}/chrome/content/scripts/researchopia.js`,
    ctx,
  );
  
  // 启动插件
  await Zotero.ResearchopiaPlugin.hooks.onStartup();
}

function onMainWindowLoad({ window: win }) {
  Zotero.ResearchopiaPlugin.hooks.onMainWindowLoad(win);
}

function onMainWindowUnload({ window: win }) {
  Zotero.ResearchopiaPlugin.hooks.onMainWindowUnload(win);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.ResearchopiaPlugin.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}

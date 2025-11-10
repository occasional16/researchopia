/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

function install(data, reason) {
  // 提示用户需要重启 Zotero
  // reason 可能的值: ADDON_INSTALL (新安装) 或 ADDON_UPGRADE (更新)
  if (typeof Zotero !== 'undefined') {
    const reasonText = reason === 'ADDON_INSTALL' ? '安装' : '更新';
    Zotero.debug(`[Researchopia] 插件${reasonText}完成，需要重启 Zotero 才能生效`);
    
    // 使用 Zotero 的通知系统（如果可用）
    if (Zotero.Notifier) {
      try {
        // 延迟显示提示，确保 UI 已准备好
        setTimeout(() => {
          if (Zotero.getMainWindow && Zotero.getMainWindow()) {
            const win = Zotero.getMainWindow();
            if (win && win.alert) {
              win.alert(
                `研学港 Researchopia 插件${reasonText}完成！\n\n` +
                `请重启 Zotero 以使插件生效：\n` +
                `1. 关闭所有 Zotero 窗口\n` +
                `2. 重新打开 Zotero\n` +
                `3. 验证插件功能是否正常`
              );
            }
          }
        }, 500);
      } catch (e) {
        Zotero.debug("[Researchopia] 无法显示重启提示: " + e);
      }
    }
  }
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  Zotero.debug("[Researchopia Bootstrap] 🚀 Starting up plugin...");
  Zotero.debug("[Researchopia Bootstrap] Plugin info: " + JSON.stringify({ id, version, rootURI, reason }));
  
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = { rootURI };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
    ctx,
  );
  
  Zotero.debug("[Researchopia Bootstrap] Script loaded, ctx keys: " + Object.keys(ctx).join(", "));
  
  // Wait for Zotero initialization and plugin to be ready
  await Zotero.initializationPromise;
  
  Zotero.debug("[Researchopia Bootstrap] Zotero initialized, checking addon instance...");
  Zotero.debug("[Researchopia Bootstrap] Zotero.Researchopia exists: " + !!Zotero.Researchopia);
  
  // Register preference pane for Zotero 8
  Zotero.debug("[Researchopia Bootstrap] 🔧 Registering preference pane...");
  Zotero.debug("[Researchopia Bootstrap] Available Zotero keys with Pref: " + Object.keys(Zotero).filter(k => k.toLowerCase().includes('pref')));
  
  try {
    if (typeof Zotero !== 'undefined' && Zotero.PreferencePanes) {
      Zotero.debug("[Researchopia Bootstrap] PreferencePanes API found, registering...");
      const paneConfig = {
        pluginID: "researchopia@zotero.plugin",
        id: "researchopia-preferences",  // 明确指定pane ID for navigation
        src: rootURI + "content/preferences.xhtml",
        // Load the preferences.js script which will call registerPrefsScripts
        scripts: [rootURI + "content/preferences.js"],
        stylesheets: [rootURI + "content/preferences.css"]
      };
      Zotero.debug("[Researchopia Bootstrap] Pane config: " + JSON.stringify(paneConfig));
      
      const result = Zotero.PreferencePanes.register(paneConfig);
      Zotero.debug("[Researchopia Bootstrap] ✅ Preference pane registered with ID: researchopia-preferences. Result: " + result);
    } else {
      Zotero.debug("[Researchopia Bootstrap] ❌ PreferencePanes API not available");
      Zotero.debug("[Researchopia Bootstrap] Zotero object keys: " + Object.keys(Zotero || {}).slice(0, 10));
    }
  } catch (error) {
    Zotero.debug("[Researchopia Bootstrap] ❌ Error registering preference pane: " + error);
    Zotero.debug("[Researchopia Bootstrap] Error stack: " + error.stack);
  }
  
    // Check if addon instance exists before calling hooks
  if (Zotero.Researchopia && Zotero.Researchopia.hooks && Zotero.Researchopia.hooks.onStartup) {
    Zotero.debug("[Researchopia Bootstrap] Calling onStartup...");
    await Zotero.Researchopia.hooks.onStartup();
    Zotero.debug("[Researchopia Bootstrap] onStartup completed");
  } else {
    Zotero.debug("[Researchopia Bootstrap] Plugin hooks not found! " + JSON.stringify({
      "Researchopia": !!Zotero.Researchopia,
      "hooks": !!(Zotero.Researchopia && Zotero.Researchopia.hooks),
      "onStartup": !!(Zotero.Researchopia && Zotero.Researchopia.hooks && Zotero.Researchopia.hooks.onStartup)
    }));
  }
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  await Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}

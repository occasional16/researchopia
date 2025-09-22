/**
 * 研学港 Zotero 插件 - Bootstrap 入口文件
 * Researchopia Zotero Plugin - Bootstrap Entry Point
 *
 * 基于官方make-it-red示例，适配Zotero 8
 */

var Researchopia;

function log(msg) {
  Zotero.debug("Researchopia: " + msg);
}

function install() {
  log("Installed 1.0.0");
}

async function startup({ id, version, rootURI }) {
  log("Starting 1.0.0");

  // 创建全局插件对象
  Researchopia = {
    id: id,
    version: version,
    rootURI: rootURI,
    initialized: false,

    init: function() {
      this.initialized = true;
      log("Plugin initialized successfully");
    },

    addToWindow: function(window) {
      // 添加到窗口的逻辑
      log("Added to window");
    },

    removeFromWindow: function(window) {
      // 从窗口移除的逻辑
      log("Removed from window");
    },

    addToAllWindows: function() {
      var windows = Zotero.getMainWindows();
      for (let win of windows) {
        this.addToWindow(win);
      }
    },

    removeFromAllWindows: function() {
      var windows = Zotero.getMainWindows();
      for (let win of windows) {
        this.removeFromWindow(win);
      }
    },

    main: async function() {
      // 主要功能逻辑
      log("Main function executed");

      // 显示成功消息
      setTimeout(() => {
        try {
          Zotero.alert(null, 'Researchopia', 'Plugin loaded successfully!');
        } catch (e) {
          log("Alert failed: " + e.message);
        }
      }, 1000);
    }
  };

  // 初始化插件
  Researchopia.init();
  Researchopia.addToAllWindows();
  await Researchopia.main();
}

function onMainWindowLoad({ window }) {
  if (Researchopia) {
    Researchopia.addToWindow(window);
  }
}

function onMainWindowUnload({ window }) {
  if (Researchopia) {
    Researchopia.removeFromWindow(window);
  }
}

function shutdown() {
  log("Shutting down 1.0.0");
  if (Researchopia) {
    Researchopia.removeFromAllWindows();
    Researchopia = undefined;
  }
}

function uninstall() {
  log("Uninstalled 1.0.0");
}

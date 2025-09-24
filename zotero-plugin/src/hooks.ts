import {
  BasicExampleFactory,
  HelperExampleFactory,
  KeyExampleFactory,
  PromptExampleFactory,
  UIExampleFactory,
} from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";


async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  BasicExampleFactory.registerPrefs();

  BasicExampleFactory.registerNotifier();

  KeyExampleFactory.registerShortcuts();

  UIExampleFactory.registerItemPaneSection();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  addon.data.initialized = true;

  ztoolkit.log("✅ Researchopia Plugin Started Successfully!");
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(1000);
  popupWin.changeLine({
    progress: 30,
    text: `[30%] ${getString("startup-begin")}`,
  });

  // Removed template UI examples - using only Researchopia functionality

  await Zotero.Promise.delay(1000);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(5000);

  addon.hooks.onDialogEvents("dialogExample");
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // Researchopia notification handling
  ztoolkit.log("notify", event, type, ids, extraData);
  // Add Researchopia-specific notification handling here if needed
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      ztoolkit.log("🔧 Preferences pane loaded - using external script");
      // 偏好设置逻辑现在在独立的JavaScript文件中处理
      // 确保ResearchopiaPreferences对象可用
      try {
        const window = data.window;
        if (window && window.ResearchopiaPreferences) {
          ztoolkit.log("✅ ResearchopiaPreferences found, initializing...");
          window.ResearchopiaPreferences.init();
        } else {
          ztoolkit.log("⚠️ ResearchopiaPreferences not found in window");
        }
      } catch (error) {
        ztoolkit.log(`❌ Error in preferences initialization: ${(error as Error).message}`);
      }
      break;
    default:
      return;
  }
}

// 偏好设置事件处理现在在独立的JavaScript文件中 (addon/content/scripts/preferences.js)

function onShortcuts(type: string) {
  // Researchopia shortcut handling
  ztoolkit.log("shortcut", type);
  // Add Researchopia-specific shortcuts here if needed
}

function onDialogEvents(type: string) {
  // Researchopia dialog event handling
  ztoolkit.log("dialog event", type);
  // Add Researchopia-specific dialog events here if needed
}

// Simplified hooks - using examples factory pattern



// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};

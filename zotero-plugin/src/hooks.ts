// Removed template examples - using only Researchopia functionality
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";


async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  ztoolkit.log("🚀 Researchopia Plugin Starting with Hot Reload!");

  // Initialize Supabase API
  try {
    await addon.api.supabase.initialize();
  } catch (error) {
    ztoolkit.log(`⚠️ Supabase initialization failed: ${(error as Error).message}`);
  }

  // Register preferences
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    scripts: [rootURI + "content/scripts/" + addon.data.config.addonRef + ".js"],
  });

  // Register Researchopia Item Pane
  registerResearchopiaItemPane();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
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
      registerPrefsScripts(data.window);
      // 不再调用PreferencesManager.init()，因为registerPrefsScripts中已经处理了
      break;
    default:
      return;
  }
}

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

// Researchopia specific functions
function registerResearchopiaItemPane() {
  try {
    ztoolkit.log("📋 Registering Researchopia Item Pane...");
    Zotero.ItemPaneManager.registerSection({
      paneID: "researchopia",
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: "researchopia-item-section-head-text",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      sidenav: {
        l10nID: "researchopia-item-section-sidenav-tooltip",
        icon: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
      },
      onRender: ({ body, item }) => {
        ztoolkit.log("🎨 Rendering Researchopia Item Pane for item:", item?.key);
        if (item) {
          addon.ui.renderPane(body, item);
        } else {
          // Render empty state when no item is selected
          const doc = body.ownerDocument;
          if (doc) {
            const emptyDiv = ztoolkit.UI.createElement(doc, "div", {
            styles: {
              padding: "20px",
              textAlign: "center",
              color: "#666",
              fontFamily: "system-ui, -apple-system, sans-serif"
            },
            properties: {
              textContent: "请选择一个文献项目"
            }
          });
          body.appendChild(emptyDiv);
          }
        }
      },
    });
    ztoolkit.log("✅ Researchopia Item Pane registered successfully");
  } catch (error) {
    ztoolkit.log(`❌ Failed to register Researchopia Item Pane: ${(error as Error).message}`);
  }
}

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

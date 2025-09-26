import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { AuthManager } from "./modules/auth";
import { AnnotationManager } from "./modules/annotations";
import { UIManager } from "./modules/ui";

async function onStartup() {
  try {
    ztoolkit.log("Researchopia: Starting up...");

    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    ztoolkit.log("Researchopia: Zotero ready, initializing locale...");
    initLocale();

    ztoolkit.log("Researchopia: Initializing modules...");
    // Initialize Researchopia modules
    AuthManager.initialize();
    AnnotationManager.initialize();
    UIManager.initialize();

    ztoolkit.log("Researchopia: Loading main windows...");
    await Promise.all(
      Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
    );

    // Mark initialized as true to confirm plugin loading status
    addon.data.initialized = true;
    ztoolkit.log("Researchopia: Startup completed successfully!");
  } catch (error) {
    ztoolkit.log("Researchopia: Startup error:", error);
    throw error;
  }
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  try {
    ztoolkit.log("Researchopia: Loading main window...");

    // Create ztoolkit for every window
    addon.data.ztoolkit = createZToolkit();

    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-mainWindow.ftl`,
    );

    // @ts-expect-error - ProgressWindow exists on ztoolkit
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

    ztoolkit.log("Researchopia: Registering UI components...");
    // Initialize UI components
    try {
      UIManager.registerItemPaneSection();
      UIManager.registerReaderUI();
    } catch (error) {
      ztoolkit.log("Error registering UI components:", error);
    }

    await Zotero.Promise.delay(1000);

    popupWin.changeLine({
      progress: 100,
      text: `[100%] ${getString("startup-finish")}`,
    });
    popupWin.startCloseTimer(5000);

    ztoolkit.log("Researchopia: Main window loaded successfully!");
  } catch (error) {
    ztoolkit.log("Researchopia: Main window load error:", error);
    throw error;
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  // @ts-expect-error - unregisterAll exists on ztoolkit
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  // @ts-expect-error - unregisterAll exists on ztoolkit
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  delete (Zotero as any)[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
  
  // Handle annotation changes
  if (type === "item" && event === "modify") {
    AnnotationManager.handleItemChange(ids, extraData);
  }
  
  // Handle item selection changes
  if (event === "select" && type === "item") {
    UIManager.handleItemSelection(ids);
  }
}

async function onPrefsEvent(type: string, data?: { [key: string]: any }): Promise<any> {
  switch (type) {
    case "load":
      if (data?.window) {
        registerPrefsScripts(data.window);
      }
      break;
    case "check-auth":
      return AuthManager.isLoggedIn();
    case "login":
      if (data?.email && data?.password) {
        try {
          const success = await AuthManager.signIn(data.email, data.password);
          return success;
        } catch (error) {
          ztoolkit.log("Login error:", error);
          throw error;
        }
      }
      return false;
    case "logout":
      try {
        await AuthManager.signOut();
        return true;
      } catch (error) {
        ztoolkit.log("Logout error:", error);
        throw error;
      }
    default:
      return undefined;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};

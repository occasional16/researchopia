import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { AuthManager } from "./modules/auth";
import { AnnotationManager } from "./modules/annotations";
import { UIManager } from "./modules/ui-enhanced";
import { logConfig } from "./config/env";

// Enable strict mode for Zotero 8 compatibility
"use strict";

async function onStartup() {
  try {
    ztoolkit.log("Researchopia: Starting up...");

    // Wait for Zotero to be fully ready (Critical for Zotero 8)
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    ztoolkit.log("Researchopia: Zotero ready, initializing locale...");
    initLocale();

    ztoolkit.log("Researchopia: Loading configuration...");
    logConfig();

    ztoolkit.log("Researchopia: Initializing modules...");
    // Initialize modules in dependency order
    await AuthManager.initialize();
    await AnnotationManager.initialize();
    await UIManager.initialize();

    ztoolkit.log("Researchopia: Loading main windows...");
    // Process existing windows
    const mainWindows = Zotero.getMainWindows();
    ztoolkit.log(`Researchopia: Found ${mainWindows.length} main windows`);

    // Process windows in parallel
    await Promise.all(
      mainWindows.map((win) => onMainWindowLoad(win)),
    );

    // Mark as initialized
    addon.data.initialized = true;
    ztoolkit.log("Researchopia: Startup completed successfully!");
    
    // Notify successful initialization
    Zotero.debug(`${addon.data.config.addonName} initialized successfully`);
    
  } catch (error) {
    ztoolkit.log("Researchopia: Startup error:", error);
    Zotero.debug(`${addon.data.config.addonName} startup failed: ${error}`);
    throw error;
  }
}

async function onMainWindowLoad(win: Window): Promise<void> {
  try {
    ztoolkit.log("Researchopia: Loading main window...");

    // Create ztoolkit for every window (Zotero 8 requirement)
    addon.data.ztoolkit = createZToolkit();

    // Insert localization files (Zotero 8 FTL approach)
    if (win.MozXULElement?.insertFTLIfNeeded) {
      win.MozXULElement.insertFTLIfNeeded(
        `${addon.data.config.addonRef}-mainWindow.ftl`,
      );
    }

    // Initialize UI in development mode
    if (addon.data.env === "development") {
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

      await new Promise(resolve => setTimeout(resolve, 300));
      popupWin.changeLine({
        progress: 30,
        text: `[30%] ${getString("startup-begin")}`,
      });

      // Register UI components with proper error handling
      try {
        // Register CSS styles first
        await UIManager.registerStyles();
        ztoolkit.log("Researchopia: CSS styles registered");

        // Register Item Pane section
        await UIManager.registerItemPaneSection();
        ztoolkit.log("Researchopia: Item Pane section registered");

        // Register Reader UI components
        if (UIManager.registerReaderUI) {
          await UIManager.registerReaderUI();
          ztoolkit.log("Researchopia: Reader UI registered");
        }
      } catch (error) {
        ztoolkit.log("Error registering UI components:", error);
        // Continue with initialization even if UI registration fails
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      popupWin.changeLine({
        progress: 100,
        text: `[100%] ${getString("startup-finish")}`,
      });
      // @ts-ignore - startCloseTimer may exist on ProgressWindow
      popupWin.startCloseTimer?.(2000);
    } else {
      // Production mode: register UI components without progress popup
      try {
        await UIManager.registerItemPaneSection();
        if (UIManager.registerReaderUI) {
          await UIManager.registerReaderUI();
        }
      } catch (error) {
        ztoolkit.log("Error registering UI components:", error);
      }
    }

    ztoolkit.log("Researchopia: Main window loaded successfully!");
  } catch (error) {
    ztoolkit.log("Researchopia: Main window load error:", error);
    Zotero.debug(`${addon.data.config.addonName} window load failed: ${error}`);
    // Don't throw here to prevent plugin from failing completely
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  try {
    ztoolkit.log("Researchopia: Unloading main window...");
    
    // @ts-ignore - unregisterAll may exist on ztoolkit  
    if (typeof ztoolkit.unregisterAll === 'function') {
      ztoolkit.unregisterAll();
    }
    
    // Close any open dialogs
    if (addon.data.dialog?.window) {
      addon.data.dialog.window.close();
    }
    
    ztoolkit.log("Researchopia: Main window unloaded successfully");
  } catch (error) {
    ztoolkit.log("Researchopia: Main window unload error:", error);
  }
}

function onShutdown(): void {
  try {
    ztoolkit.log("Researchopia: Shutting down...");
    
    // Unregister all components
    // @ts-ignore - unregisterAll may exist on ztoolkit
    if (typeof ztoolkit.unregisterAll === 'function') {
      ztoolkit.unregisterAll();
    }
    
    // Close dialogs
    addon.data.dialog?.window?.close();
    
    // Clean up modules (if cleanup methods exist)
    if (typeof (AuthManager as any).cleanup === 'function') {
      (AuthManager as any).cleanup();
    }
    if (typeof (AnnotationManager as any).cleanup === 'function') {
      (AnnotationManager as any).cleanup();
    }
    if (typeof (UIManager as any).cleanup === 'function') {
      (UIManager as any).cleanup();
    }
    
    // Mark as not alive
    addon.data.alive = false;
    
    // Remove addon object from Zotero
    delete (Zotero as any)[addon.data.config.addonInstance];
    
    ztoolkit.log("Researchopia: Shutdown completed");
  } catch (error) {
    ztoolkit.log("Researchopia: Shutdown error:", error);
  }
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  if (!addon.data.alive) return;
  
  try {
    ztoolkit.log("notify", event, type, ids, extraData);
    
    // Handle annotation changes
    if (type === "item" && event === "modify") {
      await AnnotationManager.handleItemChange(ids, extraData);
    }
    
    // Handle item selection changes for UI updates
    if (event === "select" && type === "item") {
      await UIManager.handleItemSelection(ids);
    }
    
    // Handle reader changes
    if (type === "reader" && event === "select") {
      if (typeof (UIManager as any).handleReaderSelection === 'function') {
        await (UIManager as any).handleReaderSelection(ids, extraData);
      }
    }
    
  } catch (error) {
    ztoolkit.log("Researchopia: Notify error:", error);
  }
}

async function onPrefsEvent(type: string, data?: { [key: string]: any }): Promise<any> {
  try {
    switch (type) {
      case "load":
        if (data?.window) {
          await registerPrefsScripts(data.window);
        }
        break;
        
      case "check-auth":
        return await AuthManager.isLoggedIn();
        
      case "login":
        if (data?.email && data?.password) {
          const success = await AuthManager.signIn(data.email, data.password);
          return success;
        }
        return false;
        
      case "logout":
        await AuthManager.signOut();
        return true;
        
      case "get-user":
        return AuthManager.getCurrentUser();
        
      case "share-annotations":
        if (data?.itemIds && typeof (AnnotationManager as any).shareAnnotations === 'function') {
          return await (AnnotationManager as any).shareAnnotations(data.itemIds);
        }
        return false;
        
      default:
        return undefined;
    }
  } catch (error) {
    ztoolkit.log(`Researchopia: Prefs event '${type}' error:`, error);
    throw error;
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

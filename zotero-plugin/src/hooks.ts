import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { AuthManager } from "./modules/auth";
import { UIManager } from "./modules/ui-manager";
import { logger } from "./utils/logger";

// Enable strict mode for Zotero 8 compatibility
"use strict";

async function onStartup() {
  logger.log("[Researchopia] 🚀 onStartup - Full initialization");
  
  try {
    // Wait for Zotero to be ready
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);
    
    logger.log("[Researchopia] Zotero initialization complete");
    
    // Initialize locale
    initLocale();
    logger.log("[Researchopia] Locale initialized");
    
    // Initialize modules
    logger.log("[Researchopia] Initializing modules...");
    
    // Initialize AuthManager (must be first to load session)
    await AuthManager.initialize();
    logger.log("[Researchopia] AuthManager initialized ✅");
    
    // Initialize AnnotationManager
    const { AnnotationManager } = await import("./modules/annotations");
    await AnnotationManager.initialize();
    logger.log("[Researchopia] AnnotationManager initialized ✅");
    
    // Initialize AnnotationSharingPopup (4-button sharing in text selection popup)
    const { AnnotationSharingPopup } = await import("./modules/annotationSharingPopup");
    const sharingPopup = AnnotationSharingPopup.getInstance(AnnotationManager.getInstance());
    sharingPopup.initialize();
    logger.log("[Researchopia] AnnotationSharingPopup initialized ✅");
    
    // Initialize UIManager (registers ItemPane)
    await UIManager.getInstance().initialize();
    logger.log("[Researchopia] UIManager initialized ✅");
    
    // Initialize PDFReaderManager
    try {
      logger.log("[Researchopia] 🔄 Importing PDFReaderManager...");
      const module = await import("./modules/pdf");
      logger.log("[Researchopia] 🔍 Module keys:", Object.keys(module));
      const { PDFReaderManager } = module;
      logger.log("[Researchopia] 🔍 PDFReaderManager type:", typeof PDFReaderManager);
      
      if (!PDFReaderManager) {
        throw new Error('PDFReaderManager is undefined after import');
      }
      
      const pdfReaderManager = PDFReaderManager.getInstance();
      await pdfReaderManager.initialize();
      // 保存到全局对象，供其他模块使用（避免动态导入问题）
      ((Zotero as any).Researchopia)._pdfReaderManager = pdfReaderManager;
      logger.log("[Researchopia] PDFReaderManager initialized ✅");
    } catch (error) {
      const details = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
      logger.error("[Researchopia] PDFReaderManager initialization failed:", details);
      // 不要阻止插件继续启动，但标记为未初始化状态
    }
    
    // Register Shared Annotations Tab (Phase 1)
    try {
      logger.log("[Researchopia] 🔄 Registering Shared Annotations Tab...");
      const { SidebarSharedView } = await import("./modules/ui/sidebarSharedView");
      SidebarSharedView.getInstance().register();
      logger.log("[Researchopia] Shared Annotations Tab registered ✅");
    } catch (error) {
      const details = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
      logger.error("[Researchopia] Shared Tab registration failed:", details);
    }
    
    // Process existing windows (WITHOUT FTL insertion to avoid breaking context menu)
    const mainWindows = Zotero.getMainWindows();
    logger.log(`[Researchopia] Found ${mainWindows.length} main windows`);
    
    await Promise.all(
      mainWindows.map((win) => onMainWindowLoad(win)),
    );
    logger.log("[Researchopia] Main windows loaded");
    
    // Mark as initialized
    const addon = (Zotero as any).Researchopia;
    if (addon) {
      addon.data.initialized = true;
      logger.log("[Researchopia] ✅ Full initialization complete");
    }
    
  } catch (error) {
    logger.error("[Researchopia] Startup error:", error);
    throw error;
  }
}

/**
 * Main window load hook - called for each Zotero main window
 * 
 * ⚠️ CRITICAL FIX: Do NOT call win.MozXULElement.insertFTLIfNeeded() here!
 * It breaks Zotero's context menu initialization (zoteroPane.js:3241 throws undefined error)
 * 
 * The FTL insertion modifies the window's Fluent localization context during menu build,
 * causing race conditions in Zotero's internal menu generation code.
 * 
 * Alternative localization approaches:
 * - Use addon.data.locale.strings directly (loaded by initLocale())
 * - Register FTL files in plugin manifest if needed
 * - Use Zotero.getString() for core Zotero strings
 * 
 * @param win - Zotero main window instance
 */
async function onMainWindowLoad(win: Window): Promise<void> {
  try {
    const addon = (Zotero as any).Researchopia;
    if (!addon) {
      logger.error("[Researchopia] Addon not found in Zotero namespace");
      return;
    }
    
    logger.log("[Researchopia] Loading main window");
    
    // Create ztoolkit instance for this window (required for Zotero 8)
    addon.data.ztoolkit = createZToolkit();
    
    // ⚠️ INTENTIONALLY SKIPPED: FTL insertion breaks context menu
    // Original code that caused the bug:
    // if (win.MozXULElement?.insertFTLIfNeeded) {
    //   win.MozXULElement.insertFTLIfNeeded(`${addon.data.config.addonRef}-mainWindow.ftl`);
    // }
    
    logger.log("[Researchopia] Main window loaded successfully");
  } catch (error) {
    logger.error("[Researchopia] Main window load error:", error);
  }
}

/**
 * Main window unload hook - cleanup before window closes
 * @param win - Zotero main window instance being closed
 */
async function onMainWindowUnload(win: Window): Promise<void> {
  try {
    const addon = (Zotero as any).Researchopia;
    const ztoolkit = addon?.data?.ztoolkit;
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Unloading main window...");
    
      // @ts-ignore - unregisterAll may exist on ztoolkit  
      if (typeof (ztoolkit as any).unregisterAll === 'function') {
        (ztoolkit as any).unregisterAll();
      }
    }
    
    // Clean up Reading Session before window closes
    try {
      const { ReadingSessionManager } = require("./modules/readingSessionManager");
      const { getCurrentUser, getToken } = require("./utils/auth");
      const sessionMgr = ReadingSessionManager.getInstance();
      
      if (sessionMgr.isInSession()) {
        const session = sessionMgr.getCurrentSession();
        const user = getCurrentUser();
        const token = getToken();
        
        if (session && user && token) {
          // 使用同步 XMLHttpRequest 删除标注
          try {
            const xhr = new XMLHttpRequest();
            const url = `https://***OLD_SUPABASE_PROJECT***.supabase.co/rest/v1/session_annotations?session_id=eq.${session.id}&user_id=eq.${user.id}`;
            xhr.open('DELETE', url, false); // false = 同步模式
            xhr.setRequestHeader('apikey', '***OLD_SUPABASE_ANON_KEY***');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send();
            
            if (xhr.status >= 200 && xhr.status < 300) {
              logger.log("[Researchopia] ✅ WindowUnload: 已同步删除用户标注");
            } else {
              logger.error("[Researchopia] ❌ WindowUnload: 删除标注失败:", xhr.status);
            }
          } catch (xhrError) {
            logger.error("[Researchopia] WindowUnload XMLHttpRequest错误:", xhrError);
          }
          
          // 异步清理其他资源
          sessionMgr.leaveSession().catch((error: any) => {
            logger.error("[Researchopia] WindowUnload leaveSession error:", error);
          });
        }
      }
    } catch (sessionError) {
      logger.error("[Researchopia] WindowUnload session cleanup error:", sessionError);
    }
    
    // Close any open dialogs
    if (addon?.data.dialog?.window) {
      addon.data.dialog.window.close();
    }
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Main window unloaded successfully");
    }
  } catch (error) {
    logger.error("[Researchopia] Main window unload error:", error);
  }
}

/**
 * Shutdown hook - cleanup when plugin is disabled/removed
 */
function onShutdown(): void {
  try {
    const addon = (Zotero as any).Researchopia;
    const ztoolkit = addon?.data?.ztoolkit;
    
    logger.log("[Researchopia] Shutting down...");
    
    // Unregister all components
    if (ztoolkit && typeof (ztoolkit as any).unregisterAll === 'function') {
      (ztoolkit as any).unregisterAll();
    }
    
    // Close dialogs
    if (addon) {
      addon.data.dialog?.window?.close();
    }
    
    // Clean up Reading Session Manager - 处理用户关闭软件
    try {
      // 同步导入
      const { ReadingSessionManager } = require("./modules/readingSessionManager");
      const { getCurrentUser, getToken } = require("./utils/auth");
      const sessionMgr = ReadingSessionManager.getInstance();
      
      if (sessionMgr.isInSession()) {
        const session = sessionMgr.getCurrentSession();
        const user = getCurrentUser();
        const token = getToken();
        
        if (session && user && token) {
          // 使用同步 XMLHttpRequest 删除标注
          try {
            const xhr = new XMLHttpRequest();
            const url = `https://***OLD_SUPABASE_PROJECT***.supabase.co/rest/v1/session_annotations?session_id=eq.${session.id}&user_id=eq.${user.id}`;
            xhr.open('DELETE', url, false); // false = 同步模式
            xhr.setRequestHeader('apikey', '***OLD_SUPABASE_ANON_KEY***');
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send();
            
            if (xhr.status >= 200 && xhr.status < 300) {
              logger.log("[Researchopia] ✅ 已同步删除用户标注");
            } else {
              logger.error("[Researchopia] ❌ 删除标注失败:", xhr.status, xhr.statusText);
            }
          } catch (xhrError) {
            logger.error("[Researchopia] XMLHttpRequest错误:", xhrError);
          }
          
          // 然后异步调用完整的leaveSession清理其他资源
          sessionMgr.leaveSession().catch((error: any) => {
            logger.error("[Researchopia] Error in leaveSession:", error);
          });
        }
      }
    } catch (error) {
      if (ztoolkit) {
        ztoolkit.log("Reading session cleanup error:", error);
      }
    }
    
    // Clean up UI Manager
    try {
      UIManager.getInstance().cleanup();
    } catch (error) {
      if (ztoolkit) {
        ztoolkit.log("UIManager cleanup error:", error);
      }
    }
    
    if (addon) {
      // Mark as not alive
      addon.data.alive = false;
      
      // Remove addon object from Zotero
      delete (Zotero as any)[addon.data.config.addonInstance];
    }
    
    logger.log("[Researchopia] ✅ Shutdown complete");
  } catch (e) {
    logger.error("[Researchopia] Shutdown error:", e);
  }
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
  if (!addon?.data.alive) return;
  
  try {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    
    if (ztoolkit) {
      ztoolkit.log("notify", event, type, ids, extraData);
      
      // Handle item selection changes for UI updates
      if (event === "select" && type === "item") {
        ztoolkit.log("Item selection changed:", ids);
      }
    }
    
    // Handle reader changes - UIManagerV2 handles this through ItemPaneManager
    if (type === "reader" && event === "select") {
      ztoolkit?.log("Reader selection changed - handled by ItemPaneManager");
    }
    
  } catch (error) {
    logger.error("[Researchopia] Notify error:", error);
  }
}

async function onPrefsEvent(type: string, data?: { [key: string]: any }): Promise<any> {
  try {
    logger.log("[Researchopia] 🔧 Preference event triggered:", type);
    
    switch (type) {
      case "load":
        logger.log("[Researchopia] 🔧 Preference pane load event, data:", !!data?.window);
        if (data?.window) {
          logger.log("[Researchopia] 🔧 Registering preference scripts...");
          await registerPrefsScripts(data.window);
          logger.log("[Researchopia] ✅ Preference scripts registered successfully");
        } else {
          logger.error("[Researchopia] ❌ No window data in load event");
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
        
      default:
        return undefined;
    }
  } catch (error) {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log(`Researchopia: Prefs event '${type}' error:`, error);
    }
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
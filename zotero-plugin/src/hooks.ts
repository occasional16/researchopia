import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import { AuthManager } from "./modules/auth";
import { UIManager } from "./modules/ui-manager";
import { logger } from "./utils/logger";

// Enable strict mode for Zotero 8 compatibility
"use strict";

async function onStartup() {
  // 立即记录，确保这个被看到
  (globalThis as any).logger?.log("[Researchopia] 🚀🚀 onStartup DEFINITELY CALLED 🚀🚀");
  logger.log("[Researchopia] ⭐ onStartup called - VERSION 2.0 ⭐");
  
  try {
    logger.log("[Researchopia] ⭐ HOOKS VERSION 2.0 - Starting up... ⭐");
    
    // Removed duplicate preference pane registration from hooks.ts
    
    // Access ztoolkit and addon safely by getting them from global
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log("Researchopia: ⭐ VERSION 2.0 - Starting up... ⭐");
    }

    // Wait for Zotero to be fully ready (Critical for Zotero 8)
    await Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]);

    logger.log("[Researchopia] Zotero ready, initializing locale...");
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Zotero ready, initializing locale...");
    }
    initLocale();

    logger.log("[Researchopia] Loading configuration...");
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Loading configuration...");
    }

    // 确保Zotero完全就绪
    logger.log("[Researchopia] Checking Zotero readiness...");
    logger.log("[Researchopia] ItemPaneManager available:", !!(Zotero as any).ItemPaneManager);
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Zotero fully ready, initializing core modules...");
    }
    
    // 等待一小段时间确保所有组件都已加载
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 按正确顺序初始化核心模块
    try {
      logger.log("[Researchopia] Initializing AuthManager...");
      await AuthManager.initialize();
      logger.log("[Researchopia] AuthManager initialized ✅");
      
      // 立即在 Zotero.Researchopia 上暴露 AuthManager 类本身(包含静态方法),供 preferences.js 使用
      const addon = (globalThis as any).Zotero?.Researchopia;
      if (addon) {
        addon.authManager = AuthManager;  // 暴露类本身,不是实例
        logger.log("[Researchopia] ✅ AuthManager class exposed on Zotero.Researchopia");
      } else {
        logger.error("[Researchopia] ⚠️ Zotero.Researchopia not found, cannot expose authManager");
      }
      
      logger.log("[Researchopia] Initializing AnnotationManager...");
      const { AnnotationManager } = await import("./modules/annotations");
      await AnnotationManager.initialize();
      logger.log("[Researchopia] AnnotationManager initialized ✅");
      
      logger.log("[Researchopia] Initializing UIManager...");
      await UIManager.getInstance().initialize();
      logger.log("[Researchopia] UIManager initialized ✅");
      
      logger.log("[Researchopia] Initializing PDFReaderManager...");
      const { PDFReaderManager } = await import("./modules/pdfReaderManager");
      await PDFReaderManager.getInstance().initialize();
      logger.log("[Researchopia] PDFReaderManager initialized ✅");
      
      if (ztoolkit) {
        ztoolkit.log("Researchopia: All core modules initialized successfully");
      }
    } catch (error) {
      logger.error("[Researchopia] ❌ Error initializing modules:", error);
      if (ztoolkit) {
        ztoolkit.log("Researchopia: Module initialization error:", error);
      }
      // 继续运行，不要阻止整个启动过程
    }

    if (ztoolkit) {
      ztoolkit.log("Researchopia: Loading main windows...");
    }
    // Process existing windows
    const mainWindows = Zotero.getMainWindows();
    if (ztoolkit) {
      ztoolkit.log(`Researchopia: Found ${mainWindows.length} main windows`);
    }

    // Process windows in parallel
    await Promise.all(
      mainWindows.map((win) => onMainWindowLoad(win)),
    );

    // Mark as initialized
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    if (addon) {
      addon.data.initialized = true;
    }
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Startup completed successfully!");
      
      // Notify successful initialization
      if (addon) {
        ztoolkit.log(`${addon.data.config.addonName} initialized successfully`);
      }
    }
    
  } catch (error) {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Startup error:", error);
      if (addon) {
        ztoolkit.log(`${addon.data.config.addonName} startup failed: ${error}`);
      }
    }
    throw error;
  }
}

async function onMainWindowLoad(win: Window): Promise<void> {
  try {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Loading main window...");
    }

    // Create ztoolkit for every window (Zotero 8 requirement)
    if (addon) {
      addon.data.ztoolkit = createZToolkit();

      // Insert localization files (Zotero 8 FTL approach)  
      // File name is researchopia-mainWindow.ftl
      if (win.MozXULElement?.insertFTLIfNeeded) {
        win.MozXULElement.insertFTLIfNeeded(
          `${addon.data.config.addonRef}-mainWindow.ftl`,
        );
      }
    }

    // UI components are already registered during initialize()
    if (ztoolkit) {
      ztoolkit.log("UI components registered during initialization");
    }

    if (ztoolkit) {
      ztoolkit.log("Researchopia: Main window loaded successfully!");
    }
  } catch (error) {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Main window load error:", error);
      if (addon) {
        ztoolkit.log(`${addon.data.config.addonName} window load failed: ${error}`);
      }
    }
    // Don't throw here to prevent plugin from failing completely
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  try {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
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
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Main window unload error:", error);
    }
  }
}

function onShutdown(): void {
  try {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    const addon = (globalThis as any).addon || (globalThis as any).Zotero?.Researchopia;
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Shutting down...");
    
      // Unregister all components
      // @ts-ignore - unregisterAll may exist on ztoolkit
      if (typeof (ztoolkit as any).unregisterAll === 'function') {
        (ztoolkit as any).unregisterAll();
      }
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
    
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Shutdown completed");
    }
  } catch (error) {
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Shutdown error:", error);
    }
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
    const ztoolkit = (globalThis as any).ztoolkit || (globalThis as any).Zotero?.Researchopia?.data?.ztoolkit;
    if (ztoolkit) {
      ztoolkit.log("Researchopia: Notify error:", error);
    }
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
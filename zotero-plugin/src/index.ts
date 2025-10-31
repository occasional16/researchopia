import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";
import { logger } from "./utils/logger";

// Import and initialize core modules to ensure they're included in build
// Note: Some modules are not yet implemented

const basicTool = new BasicTool();

// 设置全局logger，让其他模块也可以使用
(globalThis as any).logger = logger;

// 版本兼容性处理
import { ZoteroVersionDetector } from './utils/version-detector';

try {
  // 记录版本信息
  ZoteroVersionDetector.logVersionInfo();
  
  // 仅在Zotero 8中应用ChromeUtils.import shim (Zotero 7原生支持)
  if (ZoteroVersionDetector.isZotero8()) {
    const chromeUtils = (globalThis as any).ChromeUtils;
    if (chromeUtils && typeof chromeUtils.importESModule === "function") {
      const shimmedImport = chromeUtils.import;
      if (typeof shimmedImport !== "function" || !(shimmedImport as any).__usesESModuleShim) {
        chromeUtils.import = ((moduleUrl: string, options?: Record<string, unknown>) => {
          const finalOptions = options && Object.keys(options).length > 0
            ? options
            : { global: "contextual" };
          return chromeUtils.importESModule(moduleUrl, finalOptions);
        }) as typeof chromeUtils.importESModule;
        (chromeUtils.import as any).__usesESModuleShim = true;
        logger.log("[Index] Applied ChromeUtils.import ESModule shim for Zotero 8");
      }
    }
  } else {
    logger.log("[Index] Running on Zotero 7, using native ChromeUtils.import");
  }
} catch (error) {
  logger.warn("[Index] Version compatibility setup failed", error);
}

// Get correct context - in bootstrap environment, script runs in ctx where ctx._globalThis = ctx
// We need to check if the current global context has the _globalThis self-reference
const ctx = (() => {
  // In bootstrap context, the current execution context should have _globalThis property
  // that points to itself
  if ((globalThis as any)._globalThis === globalThis) {
    return globalThis;
  }
  
  // If not found on globalThis, but we're clearly in Zotero environment,
  // then we're still in the bootstrap context
  if (typeof Services !== 'undefined' && typeof Zotero !== 'undefined') {
    return globalThis;
  }
  
  return globalThis;
})();

logger.log("[Index] Script loading...");
logger.log("[Index] config.addonInstance:", config.addonInstance);
logger.log("[Index] basicTool.getGlobal(Zotero):", typeof basicTool.getGlobal("Zotero"));
logger.log("[Index] Checking existing instance:", !!basicTool.getGlobal("Zotero")[config.addonInstance]);

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  logger.log("[Index] Creating new addon instance...");
  
  // Create addon instance and store it directly
  const addonInstance = new Addon();
  ctx.addon = addonInstance;
  
  // Define global accessors with direct references to avoid recursion
  defineGlobal("ztoolkit", () => {
    return addonInstance.data.ztoolkit;
  });
  defineGlobal("addon", () => {
    return addonInstance;
  });
  
  logger.log("[Index] Setting Zotero[config.addonInstance]...");
  Zotero[config.addonInstance] = addonInstance;
  logger.log("[Index] Addon instance created and registered");
  
  // Preference panes are now registered only in bootstrap.js
} else {
  logger.log("[Index] Addon instance already exists");
}

function defineGlobal(name: Parameters<BasicTool["getGlobal"]>[0]): void;
function defineGlobal(name: string, getter: () => any): void;
function defineGlobal(name: string, getter?: () => any) {
  Object.defineProperty(ctx, name, {
    get() {
      return getter ? getter() : basicTool.getGlobal(name);
    },
  });
}

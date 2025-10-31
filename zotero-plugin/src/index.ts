import { BasicTool } from "zotero-plugin-toolkit";
import Addon from "./addon";
import { config } from "../package.json";
import { logger } from "./utils/logger";

// Import and initialize core modules to ensure they're included in build
// Note: Some modules are not yet implemented

const basicTool = new BasicTool();

// ⚠️ 不要污染globalThis - 可能与Zotero内部代码冲突
// 改为使用Zotero命名空间存储logger
// (globalThis as any).logger = logger;

// 版本兼容性处理
import { ZoteroVersionDetector } from './utils/version-detector';

try {
  // 记录版本信息
  ZoteroVersionDetector.logVersionInfo();
  
  // ⚠️ 移除ChromeUtils.import shim - zotero-plugin-toolkit已处理兼容性
  // 添加shim会导致Zotero 8抛出废弃警告,影响context menu等核心功能
  logger.log("[Index] ChromeUtils shim disabled - relying on toolkit compatibility layer");
} catch (error) {
  logger.warn("[Index] Version compatibility setup failed", error);
}

// ⚠️ 关键教训：无论如何尝试访问bootstrap的ctx沙盒，最终都会污染Zotero全局对象
// 因此完全不设置任何全局addon/ztoolkit变量，强制所有代码通过Zotero.Researchopia访问
// const ctx = ...;  // REMOVED - any attempt to set ctx.addon breaks context menu

logger.log("[Index] Script loading...");
logger.log("[Index] config.addonInstance:", config.addonInstance);
logger.log("[Index] basicTool.getGlobal(Zotero):", typeof basicTool.getGlobal("Zotero"));
logger.log("[Index] Checking existing instance:", !!basicTool.getGlobal("Zotero")[config.addonInstance]);

if (!basicTool.getGlobal("Zotero")[config.addonInstance]) {
  logger.log("[Index] Creating new addon instance...");
  
  // Create addon instance and register it
  const addonInstance = new Addon();
  
  // ⚠️ 终极修复：完全不设置ctx.addon，避免污染全局对象
  // 所有代码必须通过Zotero.Researchopia访问addon实例
  // ctx.addon = addonInstance; // REMOVED - causes context menu to break
  
  logger.log("[Index] Setting Zotero[config.addonInstance]...");
  Zotero[config.addonInstance] = addonInstance;
  logger.log("[Index] Addon instance created and registered");
  
  // Store logger in Zotero namespace
  Zotero[config.addonInstance].logger = logger;
  
  logger.log("[Index] ✅ Addon instance registered in Zotero namespace only - no global pollution");
  
  // Preference panes are now registered only in bootstrap.js
} else {
  logger.log("[Index] Addon instance already exists");
}

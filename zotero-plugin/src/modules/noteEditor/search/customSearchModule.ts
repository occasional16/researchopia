/**
 * CustomSearch 模块
 * 负责集成和管理自定义搜索功能
 */

import { logger } from "../../../utils/logger";
import { SearchManager } from "./manager";
import { getPref } from "../../../utils/prefs";

/**
 * CustomSearchModule 类
 * 管理自定义搜索功能的生命周期
 */
export class CustomSearchModule {
  private static instance: CustomSearchModule | null = null;
  private searchManager: SearchManager | null = null;
  private isEnabled = false;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private notifierID: string | null = null;

  private constructor() {
    logger.log("[CustomSearchModule] Module created");
  }

  public static getInstance(): CustomSearchModule {
    if (!CustomSearchModule.instance) {
      CustomSearchModule.instance = new CustomSearchModule();
    }
    return CustomSearchModule.instance;
  }

  /**
   * 初始化模块
   */
  public async initialize(): Promise<void> {
    logger.log("[CustomSearchModule] 🔍 Initializing...");

    // 检查用户偏好设置
    const enabled = getPref("customSearch") as boolean;
    logger.log("[CustomSearchModule] 🔍 customSearch pref:", enabled);
    
    if (enabled) {
      logger.log("[CustomSearchModule] 🔍 Enabling custom search...");
      await this.enable();
    } else {
      logger.log("[CustomSearchModule] ⚠️ Custom search is disabled in preferences");
    }

    logger.log("[CustomSearchModule] ✅ Initialized");
  }

  /**
   * 启用自定义搜索功能
   */
  public async enable(): Promise<void> {
    if (this.isEnabled) {
      logger.log("[CustomSearchModule] Already enabled");
      return;
    }

    logger.log("[CustomSearchModule] Enabling custom search...");

    // 创建 SearchManager 实例
    this.searchManager = SearchManager.getInstance();

    // 注册快捷键
    this.registerShortcut();

    // ⚠️ 编辑器监听器现在在 hooks.ts 中通过 Zotero.Notes.registerItemPaneHeaderEventListener 注册
    // 此处不再需要 MutationObserver 或 Notifier

    this.isEnabled = true;
    logger.log("[CustomSearchModule] Custom search enabled");
  }

  /**
   * 禁用自定义搜索功能
   */
  public async disable(): Promise<void> {
    if (!this.isEnabled) {
      logger.log("[CustomSearchModule] Already disabled");
      return;
    }

    logger.log("[CustomSearchModule] Disabling custom search...");

    try {
      // 注销快捷键
      this.unregisterShortcut();
      logger.log("[CustomSearchModule] Shortcut unregistered");
    } catch (error) {
      logger.error("[CustomSearchModule] Error unregistering shortcut:", error);
    }

    try {
      // 清理 SearchManager
      if (this.searchManager) {
        this.searchManager.cleanup();
        this.searchManager = null;
        logger.log("[CustomSearchModule] SearchManager cleaned up");
      }
    } catch {
      // 忽略清理错误，不影响功能
    }

    this.isEnabled = false;
    logger.log("[CustomSearchModule] Custom search disabled");
  }

  /**
   * 注册快捷键 (Ctrl+Shift+F)
   */
  private registerShortcut(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Ctrl+Shift+F 或 Cmd+Shift+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        this.handleShortcut();
      }
    };

    // 在主窗口注册
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.keydownHandler, true);
      logger.log("[CustomSearchModule] Shortcut registered (Ctrl+Shift+F)");
    }
  }

  /**
   * 注销快捷键
   */
  private unregisterShortcut(): void {
    if (this.keydownHandler && typeof window !== "undefined") {
      window.removeEventListener("keydown", this.keydownHandler, true);
      this.keydownHandler = null;
      logger.log("[CustomSearchModule] Shortcut unregistered");
    }
  }

  /**
   * 处理快捷键触发
   */
  private handleShortcut(): void {
    try {
      // 获取当前活动的编辑器
      const editor = this.getCurrentEditor();
      
      if (editor && this.searchManager) {
        logger.log("[CustomSearchModule] Toggling search for editor:", editor.instanceID);
        this.searchManager.toggle(editor);
      } else {
        logger.warn("[CustomSearchModule] No active editor found");
      }
    } catch (error) {
      logger.error("[CustomSearchModule] Error handling shortcut:", error);
    }
  }

  /**
   * 获取当前活动的编辑器
   */
  private getCurrentEditor(): any {
    try {
      // 方法 1: 从活动窗格获取
      const zoteroPane = Zotero.getActiveZoteroPane?.();
      if (zoteroPane) {
        // 尝试获取笔记编辑器
        const itemPane = zoteroPane.document.querySelector("#zotero-item-pane");
        if (itemPane) {
          const noteEditor = itemPane.querySelector("note-editor");
          if (noteEditor && (noteEditor as any)._editorInstance) {
            return (noteEditor as any)._editorInstance;
          }
        }
      }

      // 方法 2: 从独立窗口获取
      const windows = Zotero.getMainWindows();
      for (const win of windows) {
        const noteEditor = win.document.querySelector("note-editor");
        if (noteEditor && (noteEditor as any)._editorInstance) {
          // 检查是否是当前焦点窗口
          if (win.document.hasFocus()) {
            return (noteEditor as any)._editorInstance;
          }
        }
      }

      // 方法 3: 从 Reader 获取
      const reader = Zotero.Reader?.getByTabID?.(Zotero_Tabs?.selectedID);
      if (reader && typeof (reader as any).getEditorInstance === "function") {
        return (reader as any).getEditorInstance();
      }

      return null;
    } catch (error) {
      logger.error("[CustomSearchModule] Error getting current editor:", error);
      return null;
    }
  }

  // ⚠️ 已删除 observeWindow(), registerEditorListeners(), unregisterEditorListeners()
  // 现在通过 hooks.ts 中的 Zotero.Notes.registerItemPaneHeaderEventListener 统一管理

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    logger.log("[CustomSearchModule] Cleaning up...");
    await this.disable();
    logger.log("[CustomSearchModule] Cleanup complete");
  }
}

/**
 * ReaderEventSystem - Reader事件系统
 * 职责: 管理PDF Reader事件监听和分发
 * 从pdfReaderManager.ts重构提取
 */

import { logger } from "../../utils/logger";

// ========== 类型定义 ==========

export interface SharedAnnotation {
  id: string;
  type?: string;
  content: string;
  comment?: string;
  color: string;
  position: {
    pageIndex: number;
    rects: number[][];
  };
  username?: string;
  users?: { username: string; avatar_url: string | null };
  show_author_name?: boolean;
  visibility?: 'public' | 'anonymous' | 'private'; // 🔥 添加 visibility 字段
  quality_score?: number;
  created_at: string;
  user_id: string;
}

export type AnnotationClickCallback = (
  annotation: SharedAnnotation,
  element: HTMLElement,
  reader: any
) => void | Promise<void>;

// ========== 接口定义 ==========

export interface IReaderEventSystem {
  /**
   * 注册Reader（监听打开/关闭事件）
   */
  registerReader(reader: any): void;

  /**
   * 注销Reader
   */
  unregisterReader(reader: any): void;

  /**
   * 设置全局点击监听器（清除高亮、关闭弹窗）
   */
  setupGlobalClickListener(reader: any, doc: Document): void;

  /**
   * 注册标注点击回调
   */
  onAnnotationClick(callback: AnnotationClickCallback): void;

  /**
   * 触发标注点击事件
   */
  triggerAnnotationClick(
    annotation: SharedAnnotation,
    element: HTMLElement,
    reader: any
  ): Promise<void>;

  /**
   * 查找当前打开的PDF阅读器（根据DOI匹配）
   */
  findOpenReader(doi: string): Promise<any | null>;
}

// ========== 实现类 ==========

export class ReaderEventSystem implements IReaderEventSystem {
  private readerEventListeners = new Map<any, Function[]>();
  private globalClickListeners = new Map<any, Function>();
  private annotationClickCallbacks: AnnotationClickCallback[] = [];

  /**
   * 注册Reader事件监听
   * 注意: Zotero 7/8的Reader事件系统可能因版本而异
   */
  public registerReader(reader: any): void {
    try {
      logger.log("[ReaderEventSystem] 📝 Registering reader events");

      // Zotero.Reader API检查
      if (typeof Zotero !== 'undefined' && (Zotero as any).Reader) {
        logger.log("[ReaderEventSystem] Zotero.Reader API available");
        
        // 注意: 当前Zotero的Reader事件系统有限
        // 更好的方法是hook Zotero.Reader._readers
        // 或者通过定期检查打开的reader来获取实例
      } else {
        logger.warn("[ReaderEventSystem] Zotero.Reader API not available");
      }

      // 存储listener（供后续清理）
      const listeners: Function[] = [];
      this.readerEventListeners.set(reader, listeners);

      logger.log("[ReaderEventSystem] ✅ Reader events registered");
    } catch (error) {
      logger.error("[ReaderEventSystem] ❌ Error registering reader events:", error);
    }
  }

  /**
   * 注销Reader事件监听
   */
  public unregisterReader(reader: any): void {
    try {
      const listeners = this.readerEventListeners.get(reader);
      if (listeners) {
        // 清理所有监听器
        listeners.forEach(listener => {
          // 假设listener是一个移除函数
          if (typeof listener === 'function') {
            listener();
          }
        });
        this.readerEventListeners.delete(reader);
        logger.log("[ReaderEventSystem] ✅ Reader events unregistered");
      }

      // 清理全局点击监听器
      const clickListener = this.globalClickListeners.get(reader);
      if (clickListener) {
        this.globalClickListeners.delete(reader);
        logger.log("[ReaderEventSystem] ✅ Global click listener removed");
      }
    } catch (error) {
      logger.error("[ReaderEventSystem] ❌ Error unregistering reader:", error);
    }
  }

  /**
   * 设置全局点击监听器
   * 用于检测点击PDF空白区域（清除高亮、关闭弹窗）
   */
  public setupGlobalClickListener(reader: any, doc: Document): void {
    // 如果已经添加过监听器，不重复添加
    if (this.globalClickListeners.has(reader)) {
      logger.log("[ReaderEventSystem] Global click listener already exists");
      return;
    }

    const clickHandler = async (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;

        // 检查点击的是否是共享标注或其子元素
        const isAnnotationClick = target.closest('.researchopia-shared-annotation') ||
                                  target.closest('.researchopia-author-label') ||
                                  target.closest('.researchopia-annotation-popup') ||
                                  target.closest('.researchopia-annotation-bounding-box') ||
                                  target.closest('.researchopia-shared-annotation-overlay');

        if (!isAnnotationClick) {
          logger.log("[ReaderEventSystem] 🖱️ Clicked outside annotation");

          // 从iframe的window获取CustomEvent构造函数
          const iframeWin = doc.defaultView || (doc as any).ownerDocument?.defaultView || window;
          const CustomEventConstructor = (iframeWin as any).CustomEvent || CustomEvent;

          // 触发清除事件（由外部处理）
          const clearEvent = new CustomEventConstructor('researchopia-clear-highlights', {
            detail: { reader }
          });
          doc.dispatchEvent(clearEvent);

          // 触发关闭popup事件
          const closeEvent = new CustomEventConstructor('researchopia-close-popup', {
            detail: { reader }
          });
          doc.dispatchEvent(closeEvent);

          // 通知主窗口清除卡片高亮
          const mainWin = (Zotero as any).getMainWindow();
          if (mainWin) {
            const event = new mainWin.CustomEvent('researchopia-clear-card-highlight', {
              detail: {}
            });
            mainWin.dispatchEvent(event);
          }
        }
      } catch (error) {
        logger.error("[ReaderEventSystem] ❌ Error in global click handler:", error);
      }
    };

    // 添加监听器
    doc.addEventListener('click', clickHandler);
    this.globalClickListeners.set(reader, clickHandler);

    logger.log("[ReaderEventSystem] ✅ Global click listener setup complete");
  }

  /**
   * 注册标注点击回调
   */
  public onAnnotationClick(callback: AnnotationClickCallback): void {
    this.annotationClickCallbacks.push(callback);
    logger.log(`[ReaderEventSystem] Registered annotation click callback (total: ${this.annotationClickCallbacks.length})`);
  }

  /**
   * 触发标注点击事件
   */
  public async triggerAnnotationClick(
    annotation: SharedAnnotation,
    element: HTMLElement,
    reader: any
  ): Promise<void> {
    logger.log(`[ReaderEventSystem] 🖱️ Triggering annotation click: ${annotation.id}`);

    // 从element的document获取CustomEvent构造函数
    const doc = element.ownerDocument;
    const win = doc.defaultView || (doc as any).ownerDocument?.defaultView || window;
    const CustomEventConstructor = (win as any).CustomEvent || CustomEvent;

    // 触发自定义DOM事件（供外部监听）
    const clickEvent = new CustomEventConstructor('researchopia-annotation-click', {
      detail: { annotation, element, reader },
      bubbles: true
    });
    element.dispatchEvent(clickEvent);

    // 调用所有注册的回调
    for (const callback of this.annotationClickCallbacks) {
      try {
        await callback(annotation, element, reader);
      } catch (error) {
        logger.error("[ReaderEventSystem] ❌ Error in annotation click callback:", error);
      }
    }

    logger.log(`[ReaderEventSystem] ✅ Annotation click processed (${this.annotationClickCallbacks.length} callbacks)`);
  }

  /**
   * 查找当前打开的PDF阅读器（根据DOI匹配）
   * @param doi - 论文DOI
   * @returns Reader实例或null
   */
  public async findOpenReader(doi: string): Promise<any | null> {
    try {
      logger.log(`[ReaderEventSystem] 🔍 Finding open reader for DOI: ${doi}`);

      // 获取所有打开的reader实例
      let readers: any[] = [];
      
      // 方法1: 尝试Zotero.Reader.getAll()
      if ((Zotero as any).Reader && typeof (Zotero as any).Reader.getAll === 'function') {
        readers = (Zotero as any).Reader.getAll();
        logger.log(`[ReaderEventSystem] Got readers via Reader.getAll(): ${readers.length}`);
      }
      
      // 方法2: 遍历所有打开的窗口查找reader
      if (readers.length === 0) {
        logger.log("[ReaderEventSystem] Trying to find readers from windows...");
        const windows = Zotero.getMainWindows();
        
        for (const win of windows) {
          if ((win as any).Zotero_Tabs) {
            let tabs: any[] = [];
            
            // 尝试不同的方法获取tabs
            if (typeof (win as any).Zotero_Tabs.getState === 'function') {
              tabs = (win as any).Zotero_Tabs.getState() || [];
            } else if ((win as any).Zotero_Tabs._tabs) {
              tabs = Array.from((win as any).Zotero_Tabs._tabs.values());
            } else {
              const deck = (win as any).document?.getElementById?.('zotero-reader-deck');
              if (deck && deck.children) {
                tabs = Array.from(deck.children)
                  .map((child: any) => ({
                    type: 'reader',
                    data: { reader: (child as any)._reader }
                  }))
                  .filter((t: any) => t.data?.reader);
              }
            }
            
            for (const tab of tabs) {
              if (tab.type === 'reader' && tab.data?.itemID) {
                let reader: any = null;
                
                // 尝试Zotero.Reader.getByTabID
                if (typeof (Zotero as any).Reader?.getByTabID === 'function') {
                  reader = (Zotero as any).Reader.getByTabID((tab as any).id);
                }
                
                // Fallback: 遍历_readers
                if (!reader) {
                  const allReaders = (Zotero as any).Reader?._readers || [];
                  reader = allReaders.find((r: any) => r.itemID === tab.data.itemID);
                }
                
                if (reader) {
                  readers.push(reader);
                }
              }
            }
          }
        }
        logger.log(`[ReaderEventSystem] Found readers from windows: ${readers.length}`);
      }
      
      if (readers.length === 0) {
        logger.log("[ReaderEventSystem] No readers found");
        return null;
      }

      // 根据DOI匹配reader
      const normalizedDOI = this.normalizeDOI(doi);
      
      for (const reader of readers) {
        try {
          const itemID = reader.itemID;
          if (!itemID) continue;

          const item = Zotero.Items.get(itemID);
          if (!item) continue;

          const parentItem = item.parentItem;
          if (!parentItem) continue;

          const itemDOI = parentItem.getField('DOI');
          if (itemDOI && this.normalizeDOI(itemDOI) === normalizedDOI) {
            logger.log("[ReaderEventSystem] ✅ Found matching reader");
            return reader;
          }
        } catch (error) {
          logger.error("[ReaderEventSystem] Error checking reader:", error);
          continue;
        }
      }

      logger.log("[ReaderEventSystem] ⚠️ No matching reader found");
      return null;
    } catch (error) {
      logger.error("[ReaderEventSystem] ❌ Error finding open reader:", error);
      return null;
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 标准化DOI格式
   */
  private normalizeDOI(doi: string): string {
    if (!doi) return "";
    return doi
      .replace(/^doi:/i, "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .trim();
  }
}

/**
 * ResponsiveLayoutHandler - 响应式布局处理器
 * 职责: 监听页面尺寸变化，触发Overlay位置更新
 * 从pdfReaderManager.ts重构提取
 */

import { logger } from "../../utils/logger";

// ========== 类型定义 ==========

export type ResizeCallback = (container: HTMLElement) => void | Promise<void>;

export interface PageDimensions {
  width: number;
  height: number;
}

// ========== 接口定义 ==========

export interface IResponsiveLayoutHandler {
  /**
   * 监听容器尺寸变化
   */
  observeContainer(
    container: HTMLElement,
    doc: Document,
    onResize: ResizeCallback
  ): void;

  /**
   * 取消监听容器
   */
  unobserveContainer(container: HTMLElement): void;

  /**
   * 清理所有监听器
   */
  cleanup(): void;

  /**
   * 获取PDF页面真实尺寸
   */
  getPageDimensionsFromPDF(
    reader: any,
    pageIndex: number
  ): Promise<PageDimensions | null>;
}

// ========== 实现类 ==========

export class ResponsiveLayoutHandler implements IResponsiveLayoutHandler {
  private resizeObservers = new Map<HTMLElement, ResizeObserver>();
  private resizeDebounceTimers = new Map<HTMLElement, number>();
  private lastUpdateTime = new Map<HTMLElement, number>();

  /**
   * 监听容器尺寸变化（ResizeObserver + 防抖）
   */
  public observeContainer(
    container: HTMLElement,
    doc: Document,
    onResize: ResizeCallback
  ): void {
    // 如果已经监听，不重复添加
    if (this.resizeObservers.has(container)) {
      logger.log("[ResponsiveLayoutHandler] Container already observed");
      return;
    }

    try {
      // 从iframe的window获取ResizeObserver
      const win = doc.defaultView;
      if (!win || !(win as any).ResizeObserver) {
        logger.warn("[ResponsiveLayoutHandler] ⚠️ ResizeObserver not available");
        return;
      }

      const ResizeObserverClass = (win as any).ResizeObserver;
      const resizeObserver = new ResizeObserverClass(async (entries: any[]) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;

          // 立即隐藏overlay层，避免在缩放过程中显示错误的位置
          const overlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
          if (overlayLayer) {
            overlayLayer.style.opacity = '0';
          }

          // 清除之前的防抖定时器
          const existingTimer = this.resizeDebounceTimers.get(target);
          if (existingTimer) {
            win.clearTimeout(existingTimer);
          }

          // 设置新的防抖定时器，延迟500ms更新（缩放停止后才更新）
          const timer = win.setTimeout(async () => {
            logger.log("[ResponsiveLayoutHandler] 🔄 Debounced resize update", {
              width: target.offsetWidth,
              height: target.offsetHeight
            });

            // 检查overlay层是否还存在
            let currentOverlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
            if (!currentOverlayLayer) {
              logger.log("[ResponsiveLayoutHandler] ℹ️ Overlay layer removed during resize");
            }

            // 调用回调函数（由外部处理重建/更新）
            await onResize(target);

            // 恢复overlay层的可见性
            currentOverlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
            if (currentOverlayLayer) {
              currentOverlayLayer.style.opacity = '1';
            }

            this.resizeDebounceTimers.delete(target);
            this.lastUpdateTime.set(target, Date.now());
          }, 500);

          this.resizeDebounceTimers.set(target, timer);
        }
      });

      resizeObserver.observe(container);
      this.resizeObservers.set(container, resizeObserver);
      logger.log("[ResponsiveLayoutHandler] ✅ ResizeObserver attached");

      // 启动定期检查（每500ms）
      this.startPeriodicCheck(container, doc);
    } catch (error) {
      logger.error("[ResponsiveLayoutHandler] ❌ Error setting up observer:", error);
    }
  }

  /**
   * 取消监听容器
   */
  public unobserveContainer(container: HTMLElement): void {
    const observer = this.resizeObservers.get(container);
    if (observer) {
      observer.disconnect();
      this.resizeObservers.delete(container);
      logger.log("[ResponsiveLayoutHandler] ✅ ResizeObserver disconnected");
    }

    // 清理防抖定时器
    const timer = this.resizeDebounceTimers.get(container);
    if (timer) {
      clearTimeout(timer);
      this.resizeDebounceTimers.delete(container);
    }

    this.lastUpdateTime.delete(container);
  }

  /**
   * 清理所有监听器
   */
  public cleanup(): void {
    this.resizeObservers.forEach((observer) => observer.disconnect());
    this.resizeObservers.clear();

    this.resizeDebounceTimers.forEach((timer) => clearTimeout(timer));
    this.resizeDebounceTimers.clear();

    this.lastUpdateTime.clear();

    logger.log("[ResponsiveLayoutHandler] ✅ All observers cleaned up");
  }

  /**
   * 获取PDF页面真实尺寸（从PDFViewerApplication）
   * 支持Firefox的wrappedJSObject机制
   */
  public async getPageDimensionsFromPDF(
    reader: any,
    pageIndex: number
  ): Promise<PageDimensions | null> {
    try {
      // 尝试多种方式访问PDFViewerApplication
      let pdfViewerApp: any = null;

      // 方法1: reader._iframeWindow.wrappedJSObject.PDFViewerApplication (Firefox)
      if (reader._iframeWindow?.wrappedJSObject?.PDFViewerApplication) {
        pdfViewerApp = reader._iframeWindow.wrappedJSObject.PDFViewerApplication;
        logger.log(`[ResponsiveLayoutHandler] ✅ Found PDFViewerApplication via wrappedJSObject`);
      }
      // 方法2: reader._iframeWindow.PDFViewerApplication
      else if (reader._iframeWindow?.PDFViewerApplication) {
        pdfViewerApp = reader._iframeWindow.PDFViewerApplication;
        logger.log(`[ResponsiveLayoutHandler] ✅ Found PDFViewerApplication via _iframeWindow`);
      }
      // 方法3: reader._internalReader._primaryView._iframeWindow.PDFViewerApplication
      else if (reader._internalReader?._primaryView?._iframeWindow?.PDFViewerApplication) {
        pdfViewerApp = reader._internalReader._primaryView._iframeWindow.PDFViewerApplication;
        logger.log(`[ResponsiveLayoutHandler] ✅ Found PDFViewerApplication via _internalReader`);
      }
      // 方法4: reader._internalReader._primaryView._iframeWindow.wrappedJSObject (Firefox)
      else if (reader._internalReader?._primaryView?._iframeWindow?.wrappedJSObject?.PDFViewerApplication) {
        pdfViewerApp = reader._internalReader._primaryView._iframeWindow.wrappedJSObject.PDFViewerApplication;
        logger.log(`[ResponsiveLayoutHandler] ✅ Found PDFViewerApplication via _internalReader.wrappedJSObject`);
      }

      if (pdfViewerApp && pdfViewerApp.pdfDocument) {
        const pdfDocument = pdfViewerApp.pdfDocument;

        // 获取指定页面（PDF.js页码从1开始）
        let page = await pdfDocument.getPage(pageIndex + 1);

        // Firefox XPCNativeWrapper: 尝试通过wrappedJSObject访问
        if (page.wrappedJSObject) {
          page = page.wrappedJSObject;
        }

        // 方法A: 使用page.view（最准确）
        if (page && page.view && Array.isArray(page.view) && page.view.length >= 4) {
          // page.view格式: [x, y, width, height]
          const pdfWidth = page.view[2];
          const pdfHeight = page.view[3];

          logger.log(`[ResponsiveLayoutHandler] 📐 Got PDF dimensions from page.view: ${pdfWidth}x${pdfHeight}`);

          return {
            width: pdfWidth,
            height: pdfHeight
          };
        }

        // 方法B: 使用getViewport()
        if (typeof page.getViewport === 'function') {
          let viewport = page.getViewport({ scale: 1.0 }); // 获取原始尺寸
          
          // Firefox: unwrap viewport
          if (viewport.wrappedJSObject) {
            viewport = viewport.wrappedJSObject;
          }

          if (viewport && viewport.width && viewport.height) {
            logger.log(`[ResponsiveLayoutHandler] 📐 Got PDF dimensions from getViewport: ${viewport.width}x${viewport.height}`);

            return {
              width: viewport.width,
              height: viewport.height
            };
          }
        }
      }

      logger.warn("[ResponsiveLayoutHandler] ⚠️ PDFViewerApplication not available");
      return null;
    } catch (error) {
      logger.error("[ResponsiveLayoutHandler] ❌ Error getting page dimensions:", error);
      return null;
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 启动定期检查（检测overlay层是否被删除）
   */
  private startPeriodicCheck(container: HTMLElement, doc: Document): void {
    const checkInterval = setInterval(() => {
      // 检查页面容器是否还在DOM中
      if (!container.isConnected) {
        clearInterval(checkInterval);
        return;
      }

      // 仅记录日志，不自动重建（避免与ResizeObserver冲突）
      const overlayLayer = container.querySelector('.researchopia-overlay-layer');
      if (!overlayLayer) {
        logger.log("[ResponsiveLayoutHandler] ℹ️ Overlay layer removed (will be recreated by ResizeObserver)");
      }

      // 检查最后更新时间，避免频繁触发
      const lastUpdate = this.lastUpdateTime.get(container) || 0;
      const timeSinceUpdate = Date.now() - lastUpdate;
      if (timeSinceUpdate < 1000) {
        // 1秒内刚更新过，跳过
        return;
      }
    }, 500);

    logger.log("[ResponsiveLayoutHandler] 👁️ Periodic check started");
  }
}

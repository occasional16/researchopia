/**
 * PDFReaderCoordinator - PDF阅读器协调器（主控制器）
 * 职责: 协调HighlightRenderer、ReaderEventSystem、ResponsiveLayoutHandler
 * 提供统一的API接口，向后兼容原PDFReaderManager
 * 
 * 从pdfReaderManager.ts重构提取
 */

import { logger } from "../../utils/logger";
import { HighlightRenderer, type SharedAnnotation, type IHighlightRenderer } from "./HighlightRenderer";
import { ReaderEventSystem, type IReaderEventSystem } from "./ReaderEventSystem";
import { ResponsiveLayoutHandler, type IResponsiveLayoutHandler } from "./ResponsiveLayoutHandler";
import { CommentRenderer } from "../ui/utils/CommentRenderer";

// ========== 主控制器类 ==========

export class PDFReaderCoordinator {
  private static instance: PDFReaderCoordinator | null = null;
  private isInitialized = false;

  // 子模块实例
  private highlightRenderer: IHighlightRenderer;
  private eventSystem: IReaderEventSystem;
  private layoutHandler: IResponsiveLayoutHandler;

  // 存储overlay数据（用于更新位置）
  private overlayData = new Map<string, {
    annotation: SharedAnnotation;
    pageContainer: HTMLElement;
    reader: any;
    doc: Document;
    onClick?: (annotationId: string, annotation: SharedAnnotation) => void;
  }>();

  // 原生标注管理（保留原逻辑）
  private nativeAnnotationsHidden = new Map<any, boolean>();
  private annotationBackups = new Map<any, any[]>();
  
  // 标注点击事件处理器存储
  private annotationClickHandlers = new Map<string, { handler: (event: Event) => void; doc: Document }>();

  protected constructor() {
    // 初始化子模块（注意依赖关系：HighlightRenderer依赖layoutHandler）
    this.layoutHandler = new ResponsiveLayoutHandler();
    this.highlightRenderer = new HighlightRenderer(this.layoutHandler);
    this.eventSystem = new ReaderEventSystem();
  }

  public static getInstance(): PDFReaderCoordinator {
    if (!PDFReaderCoordinator.instance) {
      PDFReaderCoordinator.instance = new PDFReaderCoordinator();
    }
    return PDFReaderCoordinator.instance;
  }

  /**
   * 初始化PDF阅读器管理器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.log("[PDFReaderCoordinator] 🎨 Initializing...");

    try {
      // 注册Reader事件
      // 注意：Zotero的Reader事件系统有限，主要通过findOpenReader查找实例
      logger.log("[PDFReaderCoordinator] Event system ready");

      this.isInitialized = true;
      logger.log("[PDFReaderCoordinator] ✅ Initialized successfully");
    } catch (error) {
      logger.error("[PDFReaderCoordinator] ❌ Initialization error:", error);
      throw error;
    }
  }

  /**
   * 查找当前打开的PDF阅读器（根据DOI）
   */
  public async findOpenReader(doi: string): Promise<any | null> {
    return await this.eventSystem.findOpenReader(doi);
  }

  /**
   * 显示单个共享标注
   * @param reader - Zotero Reader实例
   * @param annotation - 标注数据
   * @param options - 显示选项
   */
  public async highlightAnnotation(
    reader: any,
    annotation: SharedAnnotation,
    options: {
      scrollToView?: boolean;
      showPopup?: boolean;
      onCardNavigation?: (annotationId: string, doc: Document) => void; // 🔥 反向导航回调
    } = {}
  ): Promise<boolean> {
    try {
      logger.log(`[PDFReaderCoordinator] 📍 Highlighting annotation: ${annotation.id}`);

      // 步骤1: 导航到标注页面
      if (options.scrollToView !== false) {
        await this.navigateToAnnotation(reader, annotation);
      }

      // 步骤2: 等待页面准备
      await this.waitForPageReady(reader, annotation.position.pageIndex);

      // 步骤3: 获取页面容器和文档
      const internalReader = reader._internalReader;
      if (!internalReader) {
        logger.error("[PDFReaderCoordinator] No _internalReader found");
        return false;
      }

      const primaryView = internalReader._primaryView;
      if (!primaryView || !primaryView._iframeWindow) {
        logger.error("[PDFReaderCoordinator] No primaryView or iframe");
        return false;
      }

      const doc = primaryView._iframeWindow.document;
      const pageIndex = annotation.position.pageIndex;

      // 查找页面容器
      const pageContainer = await this.findPageContainer(doc, pageIndex);
      if (!pageContainer) {
        logger.error("[PDFReaderCoordinator] Page container not found");
        return false;
      }

      // 步骤4: 设置全局点击监听器
      this.eventSystem.setupGlobalClickListener(reader, doc);

      // 步骤5: 渲染高亮,始终传递点击回调（无论是否立即显示弹窗）
      const onClickCallback = async (annotationId: string, ann: SharedAnnotation) => {
        logger.log(`[PDFReaderCoordinator] 📞 Click callback invoked for: ${annotationId}`);
        
        // 🔥 反向导航到卡片（如果提供了回调）
        if (options.onCardNavigation && doc) {
          logger.log(`[PDFReaderCoordinator] 🔄 Triggering reverse navigation to card`);
          options.onCardNavigation(annotationId, doc);
        }
        
        // 显示弹窗
        await this.showAnnotationPopup(ann, reader);
      };

      const count = await this.highlightRenderer.renderSingle(
        annotation,
        pageContainer,
        reader,
        doc,
        onClickCallback
      );

      if (count === 0) {
        logger.warn("[PDFReaderCoordinator] Failed to render highlight");
        return false;
      }

      // 步骤6: 存储overlay数据（包括onClick回调）
      this.overlayData.set(annotation.id, {
        annotation,
        pageContainer,
        reader,
        doc,
        onClick: onClickCallback // ✨ 存储回调以便重新渲染时使用
      });

      // 步骤7: 设置响应式布局监听
      this.layoutHandler.observeContainer(pageContainer, doc, async (container) => {
        await this.updateOverlaysForPage(container);
      });

      // 步骤8: 如果需要立即显示弹窗（插件面板点击卡片触发）
      if (options.showPopup) {
        logger.log(`[PDFReaderCoordinator] 🎬 showPopup=true, displaying popup immediately`);
        await this.showAnnotationPopup(annotation, reader);
      }

      logger.log(`[PDFReaderCoordinator] ✅ Annotation highlighted successfully`);
      return true;
    } catch (error) {
      logger.error("[PDFReaderCoordinator] ❌ Error highlighting annotation:", error);
      return false;
    }
  }

  /**
   * 批量显示共享标注（主入口方法）
   */
  public async displaySharedAnnotations(
    reader: any,
    annotations: SharedAnnotation[]
  ): Promise<{ success: number; failed: number }> {
    logger.log(`[PDFReaderCoordinator] 📝 Displaying ${annotations.length} annotations`);

    let success = 0;
    let failed = 0;

    for (const annotation of annotations) {
      const result = await this.highlightAnnotation(reader, annotation, {
        scrollToView: false // 批量模式不自动滚动
        // 注意: 所有标注都会传递onClick回调，支持用户点击后弹窗
      });

      if (result) {
        success++;
      } else {
        failed++;
      }

      // 小延迟避免UI阻塞
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    logger.log(`[PDFReaderCoordinator] ✅ Batch display completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * 清除单个高亮
   */
  public clearHighlight(annotationId: string): void {
    this.highlightRenderer.clear(annotationId);
    this.overlayData.delete(annotationId);
  }

  /**
   * 清除所有高亮
   */
  public clearAllHighlights(reader?: any): void {
    this.highlightRenderer.clearAll(reader);
    
    if (reader) {
      // 清除特定reader的overlay数据
      const toRemove: string[] = [];
      this.overlayData.forEach((data, id) => {
        if (data.reader === reader) {
          toRemove.push(id);
        }
      });
      toRemove.forEach(id => this.overlayData.delete(id));
    } else {
      this.overlayData.clear();
    }
  }

  /**
   * 切换原生标注的显示/隐藏（保留原逻辑，未拆分）
   */
  public toggleNativeAnnotations(reader: any, shouldHide?: boolean): boolean {
    try {
      const internalReader = reader._internalReader;
      if (!internalReader) {
        logger.error("[PDFReaderCoordinator] ❌ _internalReader not found");
        return false;
      }

      const annotationManager = internalReader._annotationManager;
      const primaryView = internalReader._primaryView;

      if (!annotationManager || !annotationManager._annotations) {
        logger.error("[PDFReaderCoordinator] ❌ annotationManager not found");
        return false;
      }

      if (!primaryView || !primaryView._annotations) {
        logger.error("[PDFReaderCoordinator] ❌ primaryView not found");
        return false;
      }

      // 判断当前状态和目标状态
      const hasBackup = this.annotationBackups.has(reader);
      const currentState = hasBackup;
      const newState = shouldHide !== undefined ? shouldHide : !currentState;

      logger.log(`[PDFReaderCoordinator] Current: ${currentState ? 'HIDDEN' : 'SHOWN'}, Target: ${newState ? 'HIDE' : 'SHOW'}`);

      if (newState) {
        // === 隐藏原生标注 ===
        if (hasBackup) {
          logger.warn("[PDFReaderCoordinator] ⚠️ Annotations already hidden");
          return true;
        }

        const annotations = Array.isArray(annotationManager._annotations)
          ? annotationManager._annotations
          : Array.from((annotationManager._annotations as Map<any, any>).values());

        const nativeAnnotationIDs = annotations
          .filter((ann: any) => ann && !ann._isSharedAnnotation)
          .map((ann: any) => ann.id);

        if (nativeAnnotationIDs.length === 0) {
          logger.warn("[PDFReaderCoordinator] ⚠️ No native annotations to hide");
          return false;
        }

        logger.log(`[PDFReaderCoordinator] Hiding ${nativeAnnotationIDs.length} native annotations`);

        // 从annotationManager移除并备份
        let removedFromManager: any[] = [];
        if (Array.isArray(annotationManager._annotations)) {
          removedFromManager = annotationManager._annotations.filter((ann: any) =>
            ann && !ann._isSharedAnnotation
          );
          annotationManager._annotations = annotationManager._annotations.filter((ann: any) =>
            !ann || ann._isSharedAnnotation
          );
        }

        // 从primaryView移除
        if (Array.isArray(primaryView._annotations)) {
          primaryView._annotations = primaryView._annotations.filter((ann: any) =>
            !ann || ann._isSharedAnnotation
          );
        }

        this.annotationBackups.set(reader, removedFromManager);

        // 触发重新渲染
        this.triggerRerender(annotationManager, primaryView);

        this.nativeAnnotationsHidden.set(reader, true);
        logger.log("[PDFReaderCoordinator] ✅ Native annotations hidden");
        return true;

      } else {
        // === 显示原生标注 ===
        if (!hasBackup) {
          logger.warn("[PDFReaderCoordinator] ⚠️ No backup found");
          return false;
        }

        const backup = this.annotationBackups.get(reader);
        if (!backup || backup.length === 0) {
          logger.warn("[PDFReaderCoordinator] ⚠️ Backup is empty");
          this.annotationBackups.delete(reader);
          return false;
        }

        logger.log(`[PDFReaderCoordinator] Restoring ${backup.length} annotations`);

        // 恢复到annotationManager
        if (Array.isArray(annotationManager._annotations)) {
          annotationManager._annotations.push(...backup);
        }

        // 恢复到primaryView
        if (Array.isArray(primaryView._annotations)) {
          primaryView._annotations.push(...backup);
        }

        this.annotationBackups.delete(reader);

        // 触发重新渲染
        this.triggerRerender(annotationManager, primaryView);

        this.nativeAnnotationsHidden.set(reader, false);
        logger.log("[PDFReaderCoordinator] ✅ Native annotations shown");
        return false;
      }
    } catch (error) {
      logger.error("[PDFReaderCoordinator] ❌ Error toggling native annotations:", error);
      return false;
    }
  }

  /**
   * 隐藏原生标注
   */
  public hideNativeAnnotations(reader: any): boolean {
    const currentState = this.nativeAnnotationsHidden.get(reader) || false;
    if (!currentState) {
      return this.toggleNativeAnnotations(reader, true);
    }
    return true;
  }

  /**
   * 显示原生标注
   */
  public showNativeAnnotations(reader: any): boolean {
    const currentState = this.nativeAnnotationsHidden.get(reader) || false;
    if (currentState) {
      return this.toggleNativeAnnotations(reader, false);
    }
    return false;
  }

  /**
   * 获取原生标注的隐藏状态
   */
  public getNativeAnnotationsState(reader: any): boolean {
    return this.nativeAnnotationsHidden.get(reader) || false;
  }

  /**
   * 设置标注点击事件处理器
   */
  private setupAnnotationClickHandler(reader: any, annotation: SharedAnnotation, iframeDoc: Document): void {
    try {
      logger.log(`[PDFReaderCoordinator] 🎯 Setting up click handler for annotation: ${annotation.id}`);
      logger.log(`[PDFReaderCoordinator] 📄 Binding to document: ${iframeDoc.URL || 'about:blank'}`);
      logger.log(`[PDFReaderCoordinator] 🔍 Target document has ${iframeDoc.querySelectorAll('*').length} elements`);

      // 监听简化版事件 'researchopia-annotation-click-simple'
      const handler = (event: CustomEvent) => {
        logger.log(`[PDFReaderCoordinator] 🎬 Handler fired for event!`);
        const annotationId = event.detail?.annotationId;
        logger.log(`[PDFReaderCoordinator] 🆔 Event annotationId: ${annotationId}, expected: ${annotation.id}`);
        
        if (!annotationId || annotationId !== annotation.id) {
          logger.log(`[PDFReaderCoordinator] ⏭️ ID mismatch, skipping...`);
          return;
        }

        logger.log(`[PDFReaderCoordinator] 📌 Annotation clicked, showing popup: ${annotation.id}`);
        this.showAnnotationPopup(annotation, reader);
      };

      // 绑定事件监听器到 iframe 的 document (事件源)
      logger.log(`[PDFReaderCoordinator] 📍 About to addEventListener...`);
      iframeDoc.addEventListener('researchopia-annotation-click-simple', handler as EventListener);

      // 存储handler引用以便清理
      this.annotationClickHandlers.set(annotation.id, { handler: handler as any, doc: iframeDoc });
      
      logger.log(`[PDFReaderCoordinator] ✅ Click handler registered successfully for annotation: ${annotation.id}`);
    } catch (error) {
      logger.error("[PDFReaderCoordinator] ❌ Error setting up click handler:", error);
    }
  }

  /**
   * 显示标注详情弹窗（在PDF页面下方显示，不是主窗口弹窗）
   */
  private async showAnnotationPopup(annotation: SharedAnnotation, reader: any): Promise<void> {
    try {
      logger.log(`[PDFReaderCoordinator] 🎬 showAnnotationPopup called for: ${annotation.id}`);
      
      // 1. 获取overlay数据，找到标注的位置
      const overlayData = this.overlayData.get(annotation.id);
      if (!overlayData) {
        logger.error("[PDFReaderCoordinator] ❌ No overlay data found for annotation");
        return;
      }

      const { pageContainer, doc } = overlayData;

      // 2. 关闭之前的popup
      const existingPopup = doc.querySelector('.researchopia-annotation-popup') as HTMLElement;
      if (existingPopup) {
        logger.log("[PDFReaderCoordinator] 🗑️ Removing existing popup");
        existingPopup.remove();
      }

      // 3. 找到标注的overlay元素，计算弹窗位置
      const overlayElements = Array.from(pageContainer.querySelectorAll(
        `[data-annotation-id="${annotation.id}"]`
      )) as HTMLElement[];

      if (overlayElements.length === 0) {
        logger.error("[PDFReaderCoordinator] ❌ No overlay elements found");
        return;
      }

      // 找到最下方的overlay
      let bottomOverlay = overlayElements[0];
      let maxBottom = parseFloat(bottomOverlay.style.top || '0');
      let maxHeight = parseFloat(bottomOverlay.style.height || '0');

      overlayElements.forEach(element => {
        const top = parseFloat(element.style.top || '0');
        const height = parseFloat(element.style.height || '0');
        const bottom = top + height;
        if (bottom > maxBottom + maxHeight) {
          maxBottom = top;
          maxHeight = height;
          bottomOverlay = element;
        }
      });

      // 4. 计算popup位置（在标注下方）
      const popupTop = maxBottom + maxHeight + 5;
      const popupLeft = parseFloat(bottomOverlay.style.left || '0');

      logger.log("[PDFReaderCoordinator] 🎨 Creating popup container...");
      // 5. 创建弹窗容器（使用PDF iframe的document）
      const popup = doc.createElement('div');
      popup.className = 'researchopia-annotation-popup';
      popup.style.cssText = `
        position: absolute;
        left: ${popupLeft}px;
        top: ${popupTop}px;
        min-width: 300px;
        max-width: 500px;
        max-height: 300px;
        background: white;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        padding: 12px;
        z-index: 10000;
        overflow-y: auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
      `;

      // 6. 作者信息
      const author = annotation.username || annotation.users?.username || '匿名用户';
      const authorDiv = doc.createElement('div');
      authorDiv.style.cssText = `
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid #e0e0e0;
        font-size: 11px;
      `;
      authorDiv.textContent = author;
      popup.appendChild(authorDiv);

      // 7. 标注内容（原文）
      if (annotation.content) {
        const contentDiv = doc.createElement('div');
        contentDiv.style.cssText = `
          font-size: 12px;
          color: #444;
          margin-bottom: 8px;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 3px;
          white-space: pre-wrap;
          word-wrap: break-word;
        `;
        contentDiv.textContent = annotation.content;
        popup.appendChild(contentDiv);
      }

      // 8. Comment内容
      if (annotation.comment) {
        const commentDiv = doc.createElement('div');
        commentDiv.style.cssText = `
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin-bottom: 12px;
          padding: 8px;
          background: #fffbea;
          border-radius: 3px;
        `;
        commentDiv.textContent = annotation.comment;
        popup.appendChild(commentDiv);
      }

      // 9. 获取并显示点赞和评论（异步加载）
      try {
        // 通过UIManager获取supabaseManager
        const { UIManager } = await import('../ui-manager');
        const uiManager = UIManager.getInstance();
        const supabaseManager = (uiManager as any).supabaseManager;

        if (supabaseManager) {
          // 添加分隔线
          const separator = doc.createElement('div');
          separator.style.cssText = `
            border-top: 1px solid #e0e0e0;
            margin: 12px 0 8px 0;
          `;
          popup.appendChild(separator);

          // 点赞数量显示
          const likes = await supabaseManager.getAnnotationLikes(annotation.id);
          const likesCount = likes?.length || 0;

          const likesDiv = doc.createElement('div');
          likesDiv.style.cssText = `
            color: #666;
            font-size: 11px;
            margin-bottom: 8px;
            font-weight: 600;
          `;
          likesDiv.textContent = `点赞 (${likesCount})`;
          popup.appendChild(likesDiv);

          // 用户评论
          const comments = await supabaseManager.getAnnotationCommentTree(annotation.id);
          logger.log("[PDFReaderCoordinator] 💬 Loaded comments:", comments?.length || 0);

          // 评论标题
          const commentsTitle = doc.createElement('div');
          commentsTitle.style.cssText = `
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 11px;
          `;

          if (comments && comments.length > 0) {
            // 计算总评论数（包括嵌套回复）
            const totalComments = CommentRenderer.countTotalComments(comments);

            commentsTitle.textContent = `用户评论 (${totalComments})`;
            popup.appendChild(commentsTitle);

            // 渲染评论列表
            CommentRenderer.renderCommentList(comments, popup, doc);
          } else {
            // 没有用户评论
            commentsTitle.textContent = `用户评论 (0)`;
            popup.appendChild(commentsTitle);

            const noCommentDiv = doc.createElement('div');
            noCommentDiv.style.cssText = `
              color: #999;
              font-style: italic;
              text-align: center;
              padding: 10px;
              font-size: 11px;
            `;
            noCommentDiv.textContent = "暂无评论";
            popup.appendChild(noCommentDiv);
          }
        }
      } catch (error) {
        logger.error("[PDFReaderCoordinator] Error loading comments:", error);
      }

      // 10. 添加到页面容器
      pageContainer.appendChild(popup);
      
      // 11. 点击popup外部关闭
      const closeOnClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        const clickedInPopup = popup.contains(target);
        const clickedInOverlay = overlayElements.some(el => el.contains(target));

        if (!clickedInPopup && !clickedInOverlay) {
          popup.remove();
          doc.removeEventListener('click', closeOnClickOutside);
        }
      };

      // 延迟添加事件监听器，避免立即触发
      setTimeout(() => {
        doc.addEventListener('click', closeOnClickOutside);
      }, 300);
      
      logger.log("[PDFReaderCoordinator] ✅ Popup displayed successfully!");
    } catch (error) {
      logger.error("[PDFReaderCoordinator] ❌ Error showing popup:", error);
      logger.error("[PDFReaderCoordinator] ❌ Error type:", typeof error);
      logger.error("[PDFReaderCoordinator] ❌ Error message:", error instanceof Error ? error.message : String(error));
      logger.error("[PDFReaderCoordinator] ❌ Error stack:", error instanceof Error ? error.stack : 'No stack');
    }
  }

  /**
   * 批量高亮多个标注（不滚动到视图）
   */
  public async highlightMultipleAnnotations(
    reader: any,
    annotations: SharedAnnotation[],
    options?: {
      onCardNavigation?: (annotationId: string, doc: Document) => void; // 🔥 反向导航回调
    }
  ): Promise<{ success: number; failed: number }> {
    try {
      logger.log(`[PDFReaderCoordinator] Highlighting multiple annotations: ${annotations.length}`);

      let success = 0;
      let failed = 0;

      for (const annotation of annotations) {
        const result = await this.highlightAnnotation(reader, annotation, {
          scrollToView: false, // 批量模式下不自动滚动
          onCardNavigation: options?.onCardNavigation // 🔥 传递反向导航回调
        });

        if (result) {
          success++;
        } else {
          failed++;
        }

        // 小延迟避免UI阻塞
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      logger.log(`[PDFReaderCoordinator] Batch highlighting completed: ${success} success, ${failed} failed`);
      return { success, failed };
    } catch (error) {
      logger.error("[PDFReaderCoordinator] Error in batch highlighting:", error);
      return { success: 0, failed: annotations.length };
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 导航到标注位置
   */
  private async navigateToAnnotation(reader: any, annotation: SharedAnnotation): Promise<void> {
    const position = {
      pageIndex: annotation.position.pageIndex,
      rects: annotation.position.rects
    };

    let navigated = false;

    // 方法1: reader.navigateToPosition (Zotero 8)
    if (typeof reader.navigateToPosition === 'function') {
      try {
        reader.navigateToPosition(position);
        navigated = true;
        logger.log("[PDFReaderCoordinator] Navigated via navigateToPosition");
      } catch (err) {
        logger.warn("[PDFReaderCoordinator] navigateToPosition failed:", err);
      }
    }

    // 方法2: reader.navigate (Zotero 7)
    if (!navigated && typeof reader.navigate === 'function') {
      try {
        reader.navigate({ position });
        navigated = true;
        logger.log("[PDFReaderCoordinator] Navigated via navigate");
      } catch (err) {
        logger.warn("[PDFReaderCoordinator] navigate failed:", err);
      }
    }

    // 方法3: _internalReader.setSelection
    if (!navigated && reader._internalReader?.setSelection) {
      try {
        reader._internalReader.setSelection([{ position }]);
        navigated = true;
        logger.log("[PDFReaderCoordinator] Navigated via setSelection");
      } catch (err) {
        logger.warn("[PDFReaderCoordinator] setSelection failed:", err);
      }
    }

    if (!navigated) {
      logger.error("[PDFReaderCoordinator] All navigation methods failed");
    }
  }

  /**
   * 等待页面准备就绪
   */
  private async waitForPageReady(reader: any, pageIndex: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        logger.log("[PDFReaderCoordinator] Page ready");
        resolve();
      }, 100);
    });
  }

  /**
   * 查找页面容器
   */
  private async findPageContainer(doc: Document, pageIndex: number): Promise<HTMLElement | null> {
    const selectors = [
      `#viewer .page[data-page-number="${pageIndex + 1}"]`,
      `.pdfViewer .page[data-page-number="${pageIndex + 1}"]`,
      `.page[data-page-number="${pageIndex + 1}"]:not(.thumbnail)`
    ];

    for (const selector of selectors) {
      const container = doc.querySelector(selector) as HTMLElement;
      if (container && container.offsetWidth > 0) {
        logger.log(`[PDFReaderCoordinator] Found page container: ${selector}`);
        return container;
      }
    }

    return null;
  }

  /**
   * 更新页面所有Overlay位置（响应缩放）
   */
  private async updateOverlaysForPage(pageContainer: HTMLElement): Promise<void> {
    logger.log("[PDFReaderCoordinator] 🔄 Updating overlays for page");

    // 重建该页面的所有overlay
    const pageNumber = pageContainer.getAttribute('data-page-number');
    let updated = 0;

    for (const [annotationId, data] of this.overlayData.entries()) {
      const dataPageNumber = data.pageContainer.getAttribute('data-page-number');
      if (dataPageNumber === pageNumber) {
        // 清除旧的
        this.highlightRenderer.clear(annotationId);

        // 重新渲染（传递onClick回调）
        await this.highlightRenderer.renderSingle(
          data.annotation,
          data.pageContainer,
          data.reader,
          data.doc,
          data.onClick // ✨ 传递存储的onClick回调
        );

        updated++;
      }
    }

    logger.log(`[PDFReaderCoordinator] ✅ Updated ${updated} overlays`);
  }

  /**
   * 触发Zotero的重新渲染
   */
  private triggerRerender(annotationManager: any, primaryView: any): void {
    try {
      if (typeof annotationManager.render === 'function') {
        annotationManager.render();
      }
      if (typeof primaryView.render === 'function') {
        primaryView.render();
      } else if (typeof primaryView._render === 'function') {
        primaryView._render();
      }
    } catch (err) {
      logger.warn("[PDFReaderCoordinator] Render error:", err);
    }
  }
}

// ⭐ 向后兼容：保留原类名作为别名
export class PDFReaderManager extends PDFReaderCoordinator {
  // 完全继承PDFReaderCoordinator，不添加额外方法
}

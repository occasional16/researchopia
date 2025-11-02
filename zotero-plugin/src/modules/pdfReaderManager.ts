/**
 * PDF阅读器管理模块
 * 负责监听PDF阅读器事件、管理标注高亮叠加层、处理位置映射
 */

import { logger } from "../utils/logger";

export interface AnnotationPosition {
  pageIndex: number;
  rects: number[][]; // [[x1, y1, x2, y2], ...]
}

export interface SharedAnnotation {
  id: string;
  type?: string; // 'highlight' | 'underline' | 'note'
  content: string;
  comment?: string;
  color: string;
  position: AnnotationPosition;
  username?: string; // 用户名（从users表获取）
  users?: { username: string; avatar_url: string | null }; // Supabase join的用户信息
  show_author_name?: boolean; // 是否显示作者名
  quality_score?: number;
  created_at: string;
  user_id: string;
}

export class PDFReaderManager {
  private static instance: PDFReaderManager | null = null;
  private isInitialized = false;
  private activeHighlights = new Map<string, {
    elements: (SVGElement | HTMLElement)[]; // 支持SVG和HTML元素
    reader: any;
  }>();
  private readerEventListeners = new Map<any, Function[]>();
  private nativeAnnotationsHidden = new Map<any, boolean>(); // 记录每个reader的原生标注隐藏状态
  private annotationBackups = new Map<any, any[]>(); // 备份被隐藏的标注数组

  // 存储overlay的原始PDF坐标，用于响应缩放
  private overlayData = new Map<string, {
    annotation: SharedAnnotation;
    pageContainer: HTMLElement;
    overlayElements: HTMLElement[];
    reader: any; // 存储reader对象，用于获取PDF真实尺寸
  }>();

  // ResizeObserver实例，用于监听页面容器尺寸变化
  private resizeObservers = new Map<HTMLElement, ResizeObserver>();

  // 跟踪已添加全局点击监听器的reader
  private globalClickListeners = new Map<any, Function>();

  // MutationObserver实例，用于监听DOM变化
  private mutationObservers = new Map<HTMLElement, MutationObserver>();

  // 防抖定时器，用于延迟更新overlay位置（避免缩放时闪烁）
  private resizeDebounceTimers = new Map<HTMLElement, number>();

  // 记录最后一次overlay更新的时间，用于避免定期检查与ResizeObserver冲突
  private lastOverlayUpdateTime = new Map<HTMLElement, number>();

  private constructor() {}

  public static getInstance(): PDFReaderManager {
    if (!PDFReaderManager.instance) {
      PDFReaderManager.instance = new PDFReaderManager();
    }
    return PDFReaderManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    logger.log("[PDFReaderManager] 🎨 Initializing PDF Reader Manager...");

    try {
      // 监听PDF阅读器打开事件
      this.registerReaderEvents();

      this.isInitialized = true;
      logger.log("[PDFReaderManager] ✅ PDF Reader Manager initialized successfully");
    } catch (error) {
      logger.error("[PDFReaderManager] ❌ Initialization error:", error);
      throw error;
    }
  }

  /**
   * 注册PDF阅读器事件监听
   */
  private registerReaderEvents(): void {
    try {
      // Zotero 7/8 中监听reader实例创建
      // 使用 Zotero.Reader API
      if (typeof Zotero !== 'undefined' && (Zotero as any).Reader) {
        logger.log("[PDFReaderManager] Registering reader event listeners");
        
        // 注意: Zotero.Reader的事件系统可能因版本而异
        // 我们通过定期检查打开的reader来获取实例
        // 更好的方法是hook Zotero.Reader._readers
      } else {
        logger.warn("[PDFReaderManager] Zotero.Reader API not available");
      }
    } catch (error) {
      logger.error("[PDFReaderManager] Error registering reader events:", error);
    }
  }

  /**
   * 查找当前打开的PDF阅读器
   * @param doi - 论文DOI,用于匹配对应的PDF
   */
  public async findOpenReader(doi: string): Promise<any | null> {
    try {
      logger.log("[PDFReaderManager] 🔍 Finding open reader for DOI:", doi);

      // 获取所有打开的reader实例
      // Zotero 7/8 中,Reader实例可能通过以下方式获取
      let readers: any[] = [];
      
      // 方法1: 尝试Zotero.Reader.getAll()
      if ((Zotero as any).Reader && typeof (Zotero as any).Reader.getAll === 'function') {
        readers = (Zotero as any).Reader.getAll();
        logger.log("[PDFReaderManager] Got readers via Reader.getAll():", readers.length);
      }
      
      // 方法2: 遍历所有打开的窗口查找reader
      if (readers.length === 0) {
        logger.log("[PDFReaderManager] Trying to find readers from windows...");
        const windows = Zotero.getMainWindows();
        logger.log("[PDFReaderManager] Main windows count:", windows.length);
        
        for (const win of windows) {
          logger.log("[PDFReaderManager] Checking window, has Zotero_Tabs?", !!(win as any).Zotero_Tabs);
          
          if ((win as any).Zotero_Tabs) {
            // 尝试不同的方法获取tabs
            let tabs: any[] = [];
            
            // 方法A: getState()
            if (typeof (win as any).Zotero_Tabs.getState === 'function') {
              tabs = (win as any).Zotero_Tabs.getState() || [];
              logger.log("[PDFReaderManager] Got tabs via getState():", tabs.length);
            }
            
            // 方法B: _tabs属性
            if (tabs.length === 0 && (win as any).Zotero_Tabs._tabs) {
              tabs = Array.from((win as any).Zotero_Tabs._tabs.values());
              logger.log("[PDFReaderManager] Got tabs via _tabs:", tabs.length);
            }
            
            // 方法C: deck children
            if (tabs.length === 0) {
              const deck = (win as any).document?.getElementById?.('zotero-reader-deck');
              if (deck && deck.children) {
                tabs = Array.from(deck.children).map((child: any) => ({
                  type: 'reader',
                  data: { reader: (child as any)._reader }
                })).filter((t: any) => t.data?.reader);
                logger.log("[PDFReaderManager] Got tabs via deck:", tabs.length);
              }
            }
            
            logger.log("[PDFReaderManager] Processing", tabs.length, "tabs");
            for (const tab of tabs) {
              if (tab.type === 'reader' && tab.data?.itemID) {
                // 在Zotero 8中,tab.data只包含itemID,需要通过Reader API获取实际的reader实例
                logger.log("[PDFReaderManager] Found reader tab, itemID:", tab.data.itemID);
                
                // 方法1: 使用Zotero.Reader.getByTabID
                let reader: any = null;
                if (typeof (Zotero as any).Reader?.getByTabID === 'function') {
                  reader = (Zotero as any).Reader.getByTabID((tab as any).id);
                  logger.log("[PDFReaderManager] Got reader via getByTabID:", !!reader);
                }
                
                // 方法2: 遍历所有打开的readers
                if (!reader) {
                  const allReaders = (Zotero as any).Reader?._readers || [];
                  reader = allReaders.find((r: any) => r.itemID === tab.data.itemID);
                  logger.log("[PDFReaderManager] Got reader via _readers search:", !!reader);
                }
                
                if (reader) {
                  readers.push(reader);
                  logger.log("[PDFReaderManager] Added reader, itemID:", reader.itemID);
                }
              }
            }
          }
        }
        logger.log("[PDFReaderManager] Found readers from windows:", readers.length);
      }
      
      if (readers.length === 0) {
        logger.log("[PDFReaderManager] No readers found");
        return null;
      }

      logger.log("[PDFReaderManager] Found total readers:", readers.length);

      for (const reader of readers) {
        try {
          // 获取reader关联的item
          const itemID = reader.itemID;
          if (!itemID) continue;

          const item = Zotero.Items.get(itemID);
          if (!item) continue;

          // 获取父item (PDF的父文献)
          const parentItem = item.parentItem;
          if (!parentItem) continue;

          // 检查DOI是否匹配
          const itemDOI = parentItem.getField('DOI');
          if (itemDOI && this.normalizeDOI(itemDOI) === this.normalizeDOI(doi)) {
            logger.log("[PDFReaderManager] ✅ Found matching reader");
            return reader;
          }
        } catch (error) {
          logger.error("[PDFReaderManager] Error checking reader:", error);
          continue;
        }
      }

      logger.log("[PDFReaderManager] ⚠️ No matching reader found");
      return null;
    } catch (error) {
      logger.error("[PDFReaderManager] Error finding open reader:", error);
      return null;
    }
  }

  /**
   * 标准化DOI格式
   */
  private normalizeDOI(doi: string): string {
    return doi.toLowerCase().trim().replace(/^doi:\s*/i, '');
  }

  /**
   * 在PDF页面高亮显示单个标注
   * @param reader - Zotero Reader实例
   * @param annotation - 标注数据
   * @param options - 选项
   */
  /**
   * 高亮指定的共享标注
   * 
   * 当前版本：仅导航到页面，不显示高亮效果
   * 原因：直接注入标注对象到_annotations会因跨域安全限制导致React崩溃
   *       错误信息："can't access property Symbol.iterator, annotation.tags is undefined"
   * 
   * 未来计划：通过自定义SVG overlay layer实现高亮显示
   */
  public async highlightAnnotation(
    reader: any,
    annotation: SharedAnnotation,
    options: {
      noDismissListener?: boolean;
      scrollToView?: boolean;
      showPopup?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      logger.log("[PDFReaderManager] 📍 Navigating to and highlighting annotation:", annotation.id);
      logger.log("[PDFReaderManager] 🎨 Annotation type:", annotation.type || 'highlight');
      logger.log("[PDFReaderManager] 🔍 Full annotation object:", JSON.stringify({
        id: annotation.id,
        show_author_name: annotation.show_author_name,
        users: annotation.users,
        username: annotation.username
      }));

      const position = {
        pageIndex: annotation.position.pageIndex,
        rects: annotation.position.rects
      };
      
      logger.log("[PDFReaderManager] 🧭 Target position:", JSON.stringify(position));
      
      // 步骤1: 导航到标注页面
      if (options.scrollToView !== false) {
        let navigated = false;
        
        // 方法1: reader.navigateToPosition (Zotero 8推荐API)
        if (typeof reader.navigateToPosition === 'function') {
          try {
            logger.log("[PDFReaderManager] 🔄 Trying reader.navigateToPosition");
            reader.navigateToPosition(position);
            navigated = true;
            logger.log("[PDFReaderManager] ✅ Navigated via reader.navigateToPosition");
          } catch (err) {
            logger.warn("[PDFReaderManager] reader.navigateToPosition failed:", err);
          }
        }
        
        // 方法2: reader.navigate (Zotero 7备用API)
        if (!navigated && typeof reader.navigate === 'function') {
          try {
            logger.log("[PDFReaderManager] 🔄 Trying reader.navigate");
            reader.navigate({ position });
            navigated = true;
            logger.log("[PDFReaderManager] ✅ Navigated via reader.navigate");
          } catch (err) {
            logger.warn("[PDFReaderManager] reader.navigate failed:", err);
          }
        }
        
        // 方法3: _internalReader.setSelection (低级API)
        if (!navigated && reader._internalReader && typeof reader._internalReader.setSelection === 'function') {
          try {
            logger.log("[PDFReaderManager] 🔄 Trying _internalReader.setSelection");
            reader._internalReader.setSelection([{ position }]);
            navigated = true;
            logger.log("[PDFReaderManager] ✅ Navigated via _internalReader.setSelection");
          } catch (err) {
            logger.warn("[PDFReaderManager] _internalReader.setSelection failed:", err);
          }
        }
        
        if (!navigated) {
          logger.error("[PDFReaderManager] ❌ All navigation methods failed");
          return false;
        }
      }
      
      // 步骤2: 等待页面渲染完成
      await this.waitForPageReady(reader, annotation.position.pageIndex);
      
      // 步骤3: 创建HTML overlay显示标注（不依赖canvas）
      const overlayCreated = await this.createHTMLAnnotationOverlay(reader, annotation);

      if (overlayCreated) {
        logger.log("[PDFReaderManager] ✅ Annotation overlay created successfully");

        // 步骤4: 突出显示标注（添加虚线外围）
        this.highlightSelectedAnnotation(annotation.id);

        // 步骤5: 如果需要，显示弹窗
        if (options.showPopup) {
          logger.log("[PDFReaderManager] 📝 Showing annotation popup");
          await this.showAnnotationComments(annotation, reader);
        }
      } else {
        logger.warn("[PDFReaderManager] ⚠️ Failed to create annotation overlay");
      }

      return true;
      
    } catch (error) {
      logger.error("[PDFReaderManager] ❌ Error highlighting annotation:", error);
      return false;
    }
  }

  /**
   * 等待PDF页面准备就绪
   */
  private async waitForPageReady(reader: any, pageIndex: number): Promise<void> {
    return new Promise((resolve) => {
      // 等待100ms让导航完成
      setTimeout(() => {
        logger.log("[PDFReaderManager] Page ready for overlay rendering");
        resolve();
      }, 100);
    });
  }

  /**
   * 创建HTML覆盖层显示共享标注
   * 
   * 使用HTML+CSS绝对定位，不依赖canvas坐标转换
   * 支持不同类型（高亮/下划线）和自定义颜色
   * 在标注左上角显示用户名
   */
  private async createHTMLAnnotationOverlay(reader: any, annotation: SharedAnnotation): Promise<boolean> {
    try {
      const internalReader = reader._internalReader;
      if (!internalReader) {
        logger.error("[PDFReaderManager] ❌ No internal reader found");
        return false;
      }

      const primaryView = internalReader._primaryView;
      if (!primaryView || !primaryView._iframeWindow) {
        logger.error("[PDFReaderManager] ❌ No primary view or iframe window");
        return false;
      }

      const doc = primaryView._iframeWindow.document;
      const pageIndex = annotation.position.pageIndex;

      logger.log("[PDFReaderManager] 🎨 Creating HTML overlay for page:", pageIndex);

      // 设置全局点击监听器（只添加一次）
      this.setupGlobalClickListener(reader, doc);

      // 查找页面容器 - 使用更精确的选择器避免匹配到缩略图
      // Zotero PDF阅读器的主页面容器通常在 #viewer 或 .pdfViewer 下
      let pageContainer: HTMLElement | null = null;

      // 尝试多个选择器，优先选择主视图中的页面
      const selectors = [
        `#viewer .page[data-page-number="${pageIndex + 1}"]`,
        `.pdfViewer .page[data-page-number="${pageIndex + 1}"]`,
        `.page[data-page-number="${pageIndex + 1}"]:not(.thumbnail)`,
        `[data-page-number="${pageIndex + 1}"].page`
      ];

      for (const selector of selectors) {
        pageContainer = doc.querySelector(selector) as HTMLElement;
        if (pageContainer && pageContainer.offsetWidth > 0) {
          logger.log(`[PDFReaderManager] ✅ Found page container with selector: ${selector}`);
          break;
        }
      }

      if (!pageContainer) {
        logger.error("[PDFReaderManager] ❌ Page container not found with any selector");
        return false;
      }

      if (pageContainer.offsetWidth === 0 || pageContainer.offsetHeight === 0) {
        logger.error("[PDFReaderManager] ❌ Page container has zero dimensions");
        return false;
      }

      // ⭐ 创建或获取自定义overlay层（不会被PDF.js清除）
      let overlayLayer = pageContainer.querySelector('.researchopia-overlay-layer') as HTMLElement;
      if (!overlayLayer) {
        overlayLayer = doc.createElement('div');
        overlayLayer.className = 'researchopia-overlay-layer';
        overlayLayer.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        `;
        pageContainer.appendChild(overlayLayer);
        logger.log("[PDFReaderManager] 📍 Created overlay layer");
      }

      // ⭐ 确保页面容器设置为relative定位(overlay的absolute定位需要参照)
      if (pageContainer.style.position !== 'relative' && pageContainer.style.position !== 'absolute') {
        pageContainer.style.position = 'relative';
        logger.log("[PDFReaderManager] 📍 Set pageContainer position to relative");
      }

      // 清除该标注之前创建的overlay(避免重复)
      if (this.activeHighlights.has(annotation.id)) {
        const oldHighlight = this.activeHighlights.get(annotation.id);
        if (oldHighlight && oldHighlight.elements) {
          oldHighlight.elements.forEach((el: SVGElement | HTMLElement) => {
            if (el && el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });
        }
        this.activeHighlights.delete(annotation.id);
        logger.log("[PDFReaderManager] 🗑️ Cleared old overlay for annotation:", annotation.id);
      }

      // 调试：查看页面容器的结构
      logger.log("[PDFReaderManager] 📄 Page container info:", {
        tagName: pageContainer.tagName,
        className: pageContainer.className,
        id: pageContainer.id,
        childrenCount: pageContainer.children.length,
        offsetWidth: pageContainer.offsetWidth,
        offsetHeight: pageContainer.offsetHeight
      });

      // 列出前5个子元素
      for (let i = 0; i < Math.min(5, pageContainer.children.length); i++) {
        const child = pageContainer.children[i] as HTMLElement;
        logger.log(`[PDFReaderManager] Child ${i}: tag=${child.tagName}, class=${child.className}, id=${child.id}`);
      }

      // 获取页面容器的实际渲染尺寸
      const canvas = pageContainer.querySelector('canvas');
      if (!canvas) {
        logger.warn("[PDFReaderManager] ⚠️ Canvas not found in page container (page may not be rendered yet)");
        logger.log("[PDFReaderManager] 🔍 Trying alternative selectors...");

        // 尝试其他可能的元素
        const canvasLayer = pageContainer.querySelector('.canvasWrapper canvas');
        const textLayer = pageContainer.querySelector('.textLayer');
        const annotationLayer = pageContainer.querySelector('.annotationLayer');

        logger.log("[PDFReaderManager] Alternative elements:", {
          canvasLayer: !!canvasLayer,
          textLayer: !!textLayer,
          annotationLayer: !!annotationLayer
        });

        // 如果找不到canvas，使用页面容器本身的尺寸
        if (!pageContainer.offsetWidth || !pageContainer.offsetHeight) {
          logger.error("[PDFReaderManager] ❌ Page container has no dimensions");
          return false;
        }

        logger.log("[PDFReaderManager] ⚠️ Using page container dimensions as fallback");
      }

      // ⭐ 方法1: 尝试从PDFViewerApplication获取真实PDF页面尺寸
      let pdfPageWidth: number;
      let pdfPageHeight: number;

      const realDimensions = await this.getPageDimensionsFromPDF(reader, annotation.position.pageIndex);

      if (realDimensions) {
        // 成功获取真实PDF尺寸
        pdfPageWidth = realDimensions.width;
        pdfPageHeight = realDimensions.height;
        logger.log(`[PDFReaderManager] ✅ Using real PDF dimensions: ${pdfPageWidth}x${pdfPageHeight}`);
      } else if (canvas) {
        // 方法2: 使用Canvas原始尺寸作为PDF尺寸
        pdfPageWidth = canvas.width;
        pdfPageHeight = canvas.height;
        logger.log(`[PDFReaderManager] ⚠️ Using Canvas dimensions as PDF size: ${pdfPageWidth}x${pdfPageHeight}`);
      } else {
        // 方法3: Fallback到硬编码(不推荐)
        pdfPageWidth = 612;
        pdfPageHeight = 792;
        logger.warn(`[PDFReaderManager] ⚠️ Using hardcoded dimensions: ${pdfPageWidth}x${pdfPageHeight}`);
      }

      // 获取页面的实际显示尺寸（考虑缩放）
      let displayWidth: number;
      let displayHeight: number;

      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        displayWidth = canvasRect.width || canvas.offsetWidth;
        displayHeight = canvasRect.height || canvas.offsetHeight;
      } else {
        // Fallback: 使用页面容器的尺寸
        displayWidth = pageContainer.offsetWidth;
        displayHeight = pageContainer.offsetHeight;
      }

      // 计算缩放比例: 显示尺寸 / PDF原始尺寸
      const scaleX = displayWidth / pdfPageWidth;
      const scaleY = displayHeight / pdfPageHeight;

      logger.log("[PDFReaderManager] 📏 Page dimensions:", {
        pdfWidth: pdfPageWidth,
        pdfHeight: pdfPageHeight,
        canvasWidth: canvas ? canvas.width : 'N/A',
        canvasHeight: canvas ? canvas.height : 'N/A',
        displayWidth: displayWidth,
        displayHeight: displayHeight,
        scaleX: scaleX.toFixed(3),
        scaleY: scaleY.toFixed(3),
        source: realDimensions ? 'PDFViewerApplication' : (canvas ? 'canvas' : 'fallback')
      });

      const annotationType = (annotation as any).type || 'highlight';
      const color = annotation.color || '#ffd400';
      let overlaysCreated = 0;

      // 为每个rect创建覆盖层
      for (let i = 0; i < annotation.position.rects.length; i++) {
        const rect = annotation.position.rects[i];
        const [x1, y1, x2, y2] = rect;

        // PDF坐标系：原点在左下角，Y轴向上
        // 转换为屏幕坐标（像素）
        const leftPx = x1 * scaleX;
        const topPx = (pdfPageHeight - y2) * scaleY; // Y轴翻转
        const widthPx = (x2 - x1) * scaleX;
        const heightPx = (y2 - y1) * scaleY;

        // 创建覆盖层div
        const overlay = doc.createElement('div');
        overlay.classList.add('researchopia-shared-annotation-overlay');
        overlay.setAttribute('data-annotation-id', annotation.id);
        overlay.setAttribute('data-annotation-type', annotationType);

        // 基础样式 - 使用像素值
        // ⚠️ 不使用transition，避免缩放时的平移动作
        overlay.style.cssText = `
          position: absolute;
          left: ${leftPx}px;
          top: ${topPx}px;
          width: ${widthPx}px;
          height: ${heightPx}px;
          pointer-events: auto;
          z-index: 3;
          box-sizing: border-box;
          transition: opacity 0.2s;
        `;

        // 根据类型设置样式
        if (annotationType === 'underline') {
          // 下划线：仅底部边框
          overlay.style.borderBottom = `2px solid ${color}`;
          overlay.style.opacity = '0.8';
        } else {
          // 高亮：半透明背景
          overlay.style.backgroundColor = color;
          overlay.style.opacity = '0.3';
          overlay.style.borderRadius = '2px';
        }

        // 添加悬停效果（仅改变透明度，不显示虚线外围）
        overlay.addEventListener('mouseenter', () => {
          overlay.style.opacity = annotationType === 'underline' ? '1' : '0.5';
          overlay.style.cursor = 'pointer';
        });

        overlay.addEventListener('mouseleave', () => {
          overlay.style.opacity = annotationType === 'underline' ? '0.8' : '0.3';
        });

        // 点击事件
        overlay.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          logger.log("[PDFReaderManager] 🖱️ Clicked shared annotation:", annotation.id);

          // 处理共享标注点击
          await this.handleSharedAnnotationClick(annotation, overlay, reader);
        });

        // 添加到overlay层（不会被PDF.js清除）
        overlayLayer.appendChild(overlay);
        overlaysCreated++;

        // 调试:记录overlay的实际样式
        logger.log(`[PDFReaderManager] 🎨 Overlay ${i+1} styles:`, {
          type: annotationType,
          color: color,
          position: `${leftPx.toFixed(2)}px, ${topPx.toFixed(2)}px`,
          size: `${widthPx.toFixed(2)}px x ${heightPx.toFixed(2)}px`,
          zIndex: overlay.style.zIndex,
          backgroundColor: overlay.style.backgroundColor,
          borderBottom: overlay.style.borderBottom,
          opacity: overlay.style.opacity
        });

        // 第一个rect添加用户名标签
        const displayName = this.getAnnotationDisplayName(annotation);
        if (i === 0 && displayName) {
          const authorLabel = this.createAuthorLabelHTML(doc, displayName, annotation.id);
          authorLabel.style.cssText = `
            position: absolute;
            left: ${leftPx}px;
            top: ${topPx - 20}px; /* 上移20px显示在标注上方 */
            z-index: 4;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `;

          overlayLayer.appendChild(authorLabel);
          overlaysCreated++;
        }
      }

      // 存储到activeHighlights以便后续清除
      this.activeHighlights.set(annotation.id, {
        elements: Array.from(pageContainer.querySelectorAll(
          `[data-annotation-id="${annotation.id}"], ` +
          `.researchopia-author-label[data-annotation-id="${annotation.id}"]`
        )) as any[],
        reader
      });

      logger.log(`[PDFReaderManager] ✅ Created ${overlaysCreated} HTML overlay elements`);

      // 调试:验证元素确实在DOM中
      try {
        const verifyElements = pageContainer.querySelectorAll(`[data-annotation-id="${annotation.id}"]`);
        logger.log(`[PDFReaderManager] 🔍 DOM verification: found ${verifyElements.length} elements with annotation-id`);
        verifyElements.forEach((el: Element, idx: number) => {
          const htmlEl = el as HTMLElement;
          try {
            const computedStyle = doc.defaultView?.getComputedStyle(htmlEl);
            logger.log(`[PDFReaderManager] 📊 Element ${idx+1}:`, {
              tagName: htmlEl.tagName,
              className: htmlEl.className,
              display: computedStyle?.display || 'N/A',
              visibility: computedStyle?.visibility || 'N/A',
              opacity: computedStyle?.opacity || 'N/A',
              position: computedStyle?.position || 'N/A',
              zIndex: computedStyle?.zIndex || 'N/A',
              width: htmlEl.offsetWidth,
              height: htmlEl.offsetHeight
            });
          } catch (styleError) {
            logger.warn(`[PDFReaderManager] Could not get computed style for element ${idx+1}:`, styleError);
          }
        });
      } catch (verifyError) {
        logger.warn("[PDFReaderManager] Could not verify DOM elements:", verifyError);
      }

      // 存储overlay数据，用于响应缩放
      const overlayElements = Array.from(pageContainer.querySelectorAll(`[data-annotation-id="${annotation.id}"]`)) as HTMLElement[];
      this.overlayData.set(annotation.id, {
        annotation,
        pageContainer,
        overlayElements,
        reader // 存储reader对象
      });

      // 设置ResizeObserver监听页面容器尺寸变化
      if (!this.resizeObservers.has(pageContainer)) {
        try {
          // 从iframe的window获取ResizeObserver
          const win = doc.defaultView;
          if (win && (win as any).ResizeObserver) {
            const ResizeObserverClass = (win as any).ResizeObserver;
            const resizeObserver = new ResizeObserverClass(async (entries: any[]) => {
              for (const entry of entries) {
                const target = entry.target as HTMLElement;

                // 立即隐藏overlay层，避免在缩放过程中显示错误的位置
                const currentOverlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
                if (currentOverlayLayer) {
                  currentOverlayLayer.style.opacity = '0';
                }

                // 清除之前的防抖定时器
                const existingTimer = this.resizeDebounceTimers.get(target);
                if (existingTimer) {
                  win.clearTimeout(existingTimer);
                }

                // 设置新的防抖定时器，延迟500ms更新（缩放停止后才更新）
                // 500ms是一个平衡点：既能确保Zotero完成大部分DOM重建，又能快速响应
                const timer = win.setTimeout(async () => {
                  logger.log("[PDFReaderManager] 🔄 Debounced resize update for page container:", {
                    width: target.offsetWidth,
                    height: target.offsetHeight
                  });

                  // 检查overlay层是否还存在
                  let overlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
                  if (!overlayLayer) {
                    logger.log("[PDFReaderManager] ℹ️ Overlay layer removed during resize, recreating all overlays...");
                    // overlay层被删除，需要重建所有overlay
                    const pageNumber = target.getAttribute('data-page-number');
                    for (const [annotationId, data] of this.overlayData.entries()) {
                      const dataPageNumber = data.pageContainer.getAttribute('data-page-number');
                      if (dataPageNumber === pageNumber && data.reader) {
                        await this.createHTMLAnnotationOverlay(data.reader, data.annotation);
                      }
                    }
                    // 重新获取overlay层
                    overlayLayer = target.querySelector('.researchopia-overlay-layer') as HTMLElement;
                  } else {
                    // overlay层存在，只需要更新位置
                    await this.updateOverlaysForPage(target);
                  }

                  // 恢复overlay层的可见性
                  if (overlayLayer) {
                    overlayLayer.style.opacity = '1';
                  }

                  this.resizeDebounceTimers.delete(target);
                  // 记录更新时间，避免定期检查立即触发
                  this.lastOverlayUpdateTime.set(target, Date.now());
                }, 500);

                this.resizeDebounceTimers.set(target, timer);
              }
            });
            resizeObserver.observe(pageContainer);
            this.resizeObservers.set(pageContainer, resizeObserver);
            logger.log("[PDFReaderManager] 👁️ ResizeObserver attached to page container");

            // 使用定期检查代替MutationObserver（避免安全限制）
            // 每500ms检查一次overlay层是否还存在
            const checkInterval = setInterval(async () => {
              // 检查页面容器是否还在DOM中
              if (!pageContainer.isConnected) {
                clearInterval(checkInterval);
                return;
              }

              // ⚠️ 完全禁用定期检查的自动重建功能
              // 原因：Zotero在缩放时会删除overlay层，但ResizeObserver会在缩放停止后自动重建
              // 定期检查的重建会与ResizeObserver冲突，导致闪烁
              // 如果用户需要手动重建，可以点击"定位"按钮

              // 仅记录日志，不自动重建
              const currentOverlayLayer = pageContainer.querySelector('.researchopia-overlay-layer');
              if (!currentOverlayLayer) {
                logger.log(`[PDFReaderManager] ℹ️ Overlay layer removed (will be recreated by ResizeObserver or user action)`);
                return;
              }

              // ⚠️ 不检查overlay元素是否存在，完全依赖ResizeObserver
              // 如果overlay被删除，ResizeObserver会在缩放停止后自动更新
              // 定期检查只用于检测overlay层是否存在，不做任何重建操作
            }, 500);

            logger.log("[PDFReaderManager] 👁️ Periodic check started for overlay persistence");
          } else {
            logger.warn("[PDFReaderManager] ⚠️ ResizeObserver not available, overlays won't respond to zoom");
          }
        } catch (error) {
          logger.error("[PDFReaderManager] Error setting up observers:", error);
          if (error instanceof Error) {
            logger.error("[PDFReaderManager] Error name:", error.name);
            logger.error("[PDFReaderManager] Error message:", error.message);
            logger.error("[PDFReaderManager] Error stack:", error.stack);
          }
        }
      }

      return overlaysCreated > 0;

    } catch (error) {
      logger.error("[PDFReaderManager] ❌ Error creating HTML overlay:", error);
      // 详细错误信息
      if (error instanceof Error) {
        logger.error("[PDFReaderManager] Error name:", error.name);
        logger.error("[PDFReaderManager] Error message:", error.message);
        logger.error("[PDFReaderManager] Error stack:", error.stack);
      }
      return false;
    }
  }

  /**
   * 重新创建overlay元素（当DOM被清除时）
   */
  private async recreateOverlayElements(doc: Document, pageContainer: HTMLElement, annotation: SharedAnnotation): Promise<void> {
    try {
      // 获取或创建overlay层
      let overlayLayer = pageContainer.querySelector('.researchopia-overlay-layer') as HTMLElement;
      if (!overlayLayer) {
        overlayLayer = doc.createElement('div');
        overlayLayer.className = 'researchopia-overlay-layer';
        overlayLayer.style.cssText = `
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        `;
        pageContainer.appendChild(overlayLayer);
      }

      // 获取页面尺寸
      const canvas = pageContainer.querySelector('canvas');
      let pageWidth: number;
      let pageHeight: number;

      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        pageWidth = canvasRect.width || canvas.offsetWidth;
        pageHeight = canvasRect.height || canvas.offsetHeight;
      } else {
        pageWidth = pageContainer.offsetWidth;
        pageHeight = pageContainer.offsetHeight;
      }

      const PDF_PAGE_WIDTH = 612;
      const PDF_PAGE_HEIGHT = 792;
      const scaleX = pageWidth / PDF_PAGE_WIDTH;
      const scaleY = pageHeight / PDF_PAGE_HEIGHT;

      const annotationType = (annotation as any).type || 'highlight';
      const color = annotation.color || '#ffd400';

      // 为每个rect创建覆盖层
      for (let i = 0; i < annotation.position.rects.length; i++) {
        const rect = annotation.position.rects[i];
        const [x1, y1, x2, y2] = rect;

        const leftPx = x1 * scaleX;
        const topPx = (PDF_PAGE_HEIGHT - y2) * scaleY;
        const widthPx = (x2 - x1) * scaleX;
        const heightPx = (y2 - y1) * scaleY;

        // 创建覆盖层div
        const overlay = doc.createElement('div');
        overlay.classList.add('researchopia-shared-annotation-overlay');
        overlay.setAttribute('data-annotation-id', annotation.id);
        overlay.setAttribute('data-annotation-type', annotationType);

        overlay.style.cssText = `
          position: absolute;
          left: ${leftPx}px;
          top: ${topPx}px;
          width: ${widthPx}px;
          height: ${heightPx}px;
          pointer-events: auto;
          z-index: 3;
          box-sizing: border-box;
          transition: opacity 0.2s;
        `;

        // 根据类型设置样式
        if (annotationType === 'underline') {
          overlay.style.borderBottom = `2px solid ${color}`;
          overlay.style.opacity = '0.8';
        } else {
          overlay.style.backgroundColor = color;
          overlay.style.opacity = '0.3';
        }

        overlayLayer.appendChild(overlay);

        // 第一个rect添加用户名标签
        const displayName = this.getAnnotationDisplayName(annotation);
        if (i === 0 && displayName) {
          const authorLabel = this.createAuthorLabelHTML(doc, displayName, annotation.id);
          authorLabel.style.cssText = `
            position: absolute;
            left: ${leftPx}px;
            top: ${topPx - 20}px;
            z-index: 4;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `;

          overlayLayer.appendChild(authorLabel);
        }
      }
    } catch (error) {
      logger.error("[PDFReaderManager] Error recreating overlay elements:", error);
    }
  }

  /**
   * 调度overlay更新（使用防抖避免频繁更新）
   */
  private scheduleOverlayUpdate(pageContainer: HTMLElement, win: Window): void {
    // 清除之前的防抖定时器
    const existingTimer = this.resizeDebounceTimers.get(pageContainer);
    if (existingTimer) {
      win.clearTimeout(existingTimer);
    }

    // 设置新的防抖定时器，延迟500ms更新（与ResizeObserver保持一致）
    const timer = win.setTimeout(async () => {
      await this.updateOverlaysForPage(pageContainer);
      this.resizeDebounceTimers.delete(pageContainer);
      // 记录更新时间，避免定期检查立即触发
      this.lastOverlayUpdateTime.set(pageContainer, Date.now());
    }, 500);

    this.resizeDebounceTimers.set(pageContainer, timer);
  }

  /**
   * 更新指定页面容器中的所有overlay位置（响应缩放）
   */
  private async updateOverlaysForPage(pageContainer: HTMLElement): Promise<void> {
    try {
      const pageNumber = pageContainer.getAttribute('data-page-number');
      logger.log("[PDFReaderManager] 🔄 Updating overlays for page:", pageNumber, "total overlays:", this.overlayData.size);

      // 遍历所有overlay数据，找到属于这个页面的
      let updatedCount = 0;
      for (const [annotationId, data] of this.overlayData.entries()) {
        const dataPageNumber = data.pageContainer.getAttribute('data-page-number');

        // 使用页码匹配，而不是对象引用比较
        if (dataPageNumber !== pageNumber) {
          continue;
        }

        updatedCount++;
        logger.log(`[PDFReaderManager] 🔄 Updating overlay ${updatedCount}: ${annotationId}`);

        const { annotation, reader } = data;

        // 从当前页面容器中重新查找overlay元素（因为缩放可能导致DOM重建）
        let overlayElements = Array.from(pageContainer.querySelectorAll(`[data-annotation-id="${annotationId}"]`)) as HTMLElement[];

        if (overlayElements.length === 0) {
          logger.warn(`[PDFReaderManager] ⚠️ No overlay elements found for annotation ${annotationId}, skipping update`);
          continue;
        }

        // 获取当前页面尺寸
        const canvas = pageContainer.querySelector('canvas');

        // ⭐ 获取PDF原始尺寸 - 使用与createHTMLAnnotationOverlay相同的逻辑
        let pdfPageWidth: number;
        let pdfPageHeight: number;

        // 尝试从PDFViewerApplication获取真实PDF页面尺寸
        const pageIndex = annotation.position.pageIndex;
        const realDimensions = reader ? await this.getPageDimensionsFromPDF(reader, pageIndex) : null;

        if (realDimensions) {
          // 成功获取真实PDF尺寸
          pdfPageWidth = realDimensions.width;
          pdfPageHeight = realDimensions.height;
          logger.log(`[PDFReaderManager] ✅ Using real PDF dimensions for update: ${pdfPageWidth}x${pdfPageHeight}`);
        } else if (canvas) {
          // 方法2: 使用Canvas原始尺寸作为PDF尺寸
          pdfPageWidth = canvas.width;
          pdfPageHeight = canvas.height;
          logger.log(`[PDFReaderManager] ⚠️ Using Canvas dimensions for update: ${pdfPageWidth}x${pdfPageHeight}`);
        } else {
          // 方法3: Fallback到硬编码(不推荐)
          pdfPageWidth = 612;
          pdfPageHeight = 792;
          logger.warn(`[PDFReaderManager] ⚠️ Using hardcoded dimensions for update: ${pdfPageWidth}x${pdfPageHeight}`);
        }

        // 获取显示尺寸
        let displayWidth: number;
        let displayHeight: number;

        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          displayWidth = canvasRect.width || canvas.offsetWidth;
          displayHeight = canvasRect.height || canvas.offsetHeight;
        } else {
          displayWidth = pageContainer.offsetWidth;
          displayHeight = pageContainer.offsetHeight;
        }

        logger.log(`[PDFReaderManager] 📏 New page dimensions: ${displayWidth}x${displayHeight}`);

        // 计算新的缩放比例
        const scaleX = displayWidth / pdfPageWidth;
        const scaleY = displayHeight / pdfPageHeight;

        // 更新每个overlay元素的位置
        const rects = annotation.position.rects;
        let elementIndex = 0;

        for (let i = 0; i < rects.length; i++) {
          const rect = rects[i];
          const [x1, y1, x2, y2] = rect;

          // 重新计算位置
          const leftPx = x1 * scaleX;
          const topPx = (pdfPageHeight - y2) * scaleY;
          const widthPx = (x2 - x1) * scaleX;
          const heightPx = (y2 - y1) * scaleY;

          // 更新overlay元素
          if (elementIndex < overlayElements.length) {
            const overlay = overlayElements[elementIndex];
            if (overlay.classList.contains('researchopia-shared-annotation-overlay')) {
              overlay.style.left = `${leftPx}px`;
              overlay.style.top = `${topPx}px`;
              overlay.style.width = `${widthPx}px`;
              overlay.style.height = `${heightPx}px`;
              elementIndex++;
              logger.log(`[PDFReaderManager] ✅ Updated overlay element ${elementIndex}`);
            }
          }

          // 更新用户名标签（只在第一个rect）
          if (i === 0 && elementIndex < overlayElements.length) {
            const authorLabel = overlayElements[elementIndex];
            if (authorLabel.classList.contains('researchopia-author-label')) {
              authorLabel.style.left = `${leftPx}px`;
              authorLabel.style.top = `${topPx - 20}px`;
              elementIndex++;
              logger.log(`[PDFReaderManager] ✅ Updated author label`);
            }
          }
        }
      }
    } catch (error) {
      logger.error("[PDFReaderManager] Error updating overlays for page:", error);
    }
  }

  /**
   * 创建用户名标签（HTML版本）
   */
  private createAuthorLabelHTML(doc: Document, authorName: string, annotationId: string): HTMLElement {
    const label = doc.createElement('div');
    label.classList.add('researchopia-author-label');
    label.setAttribute('data-annotation-id', annotationId);
    label.textContent = authorName;
    return label;
  }

  /**
   * 创建标注的SVG叠加层（旧方案，已弃用）
   */
  private async createAnnotationOverlay(reader: any, annotation: SharedAnnotation): Promise<boolean> {
    try {
      // 尝试从 _internalReader 获取页面容器
      const internalReader = reader._internalReader;
      if (!internalReader) {
        logger.error("[PDFReaderManager] ❌ No internal reader found");
        return false;
      }

      const primaryView = internalReader._primaryView;
      if (!primaryView) {
        logger.error("[PDFReaderManager] ❌ No primary view found");
        return false;
      }

      const pageIndex = annotation.position.pageIndex;
      logger.log("[PDFReaderManager] 🎨 Creating overlay for page:", pageIndex);
      
      // 尝试从 primaryView 获取页面
      logger.log("[PDFReaderManager] 🔍 Checking primaryView._iframeWindow...");
      const iframeWindow = primaryView._iframeWindow;
      if (!iframeWindow) {
        logger.error("[PDFReaderManager] ❌ No iframe window in primaryView");
        return false;
      }

      const doc = iframeWindow.document;
      logger.log("[PDFReaderManager] ✅ Got iframe document");
      
      // 调试：查看DOM结构
      logger.log("[PDFReaderManager] 📄 Document body:", doc.body ? 'exists' : 'null');
      if (doc.body) {
        logger.log("[PDFReaderManager] 📄 Body classes:", doc.body.className);
        logger.log("[PDFReaderManager] 📄 Body children:", doc.body.children.length);
        
        // 列出前5个子元素
        for (let i = 0; i < Math.min(5, doc.body.children.length); i++) {
          const child = doc.body.children[i] as HTMLElement;
          logger.log(`[PDFReaderManager] Child ${i}: tag=${child.tagName}, id=${child.id}, class=${child.className}`);
        }
      }
      
      // 尝试多种页面选择器
      const allPages = doc.querySelectorAll('.page, [data-page-number], .pdfViewer > div, #viewer > div');
      logger.log("[PDFReaderManager] 📄 Total page elements found:", allPages.length);
      
      if (allPages.length > 0) {
        // 显示前3个页面的属性
        const pagesToLog = Math.min(3, allPages.length);
        for (let i = 0; i < pagesToLog; i++) {
          const page = allPages[i] as HTMLElement;
          logger.log(`[PDFReaderManager] Page ${i}: data-page-number=${page.getAttribute('data-page-number')}, id=${page.id}, class=${page.className}`);
        }
      }
      
      // 尝试多种选择器
      let pageContainer: HTMLElement | null = null;
      const selectors = [
        `[data-page-number="${pageIndex + 1}"]`,
        `.page[data-page-number="${pageIndex + 1}"]`,
        `#page${pageIndex + 1}`,
        `.page:nth-child(${pageIndex + 1})`
      ];
      
      for (const selector of selectors) {
        pageContainer = doc.querySelector(selector) as HTMLElement;
        if (pageContainer) {
          logger.log(`[PDFReaderManager] ✅ Found page with selector: ${selector}`);
          break;
        }
      }
      
      if (!pageContainer && allPages.length > pageIndex) {
        // Fallback: 直接使用索引
        pageContainer = allPages[pageIndex] as HTMLElement;
        logger.log("[PDFReaderManager] ✅ Using page by index:", pageIndex);
      }
      
      if (!pageContainer) {
        logger.error("[PDFReaderManager] ❌ Page container not found for index:", pageIndex);
        return false;
      }

      logger.log("[PDFReaderManager] ✅ Found page container");

      // 为每个rect创建SVG元素
      const annotationType = (annotation as any).type || 'highlight';
      let overlaysCreated = 0;

      for (let i = 0; i < annotation.position.rects.length; i++) {
        const rect = annotation.position.rects[i];
        const svgElement = this.createSVGOverlay(
          doc,
          pageContainer,
          rect,
          annotation,
          annotationType,
          i === 0 // 只在第一个rect上显示用户名
        );

        if (svgElement) {
          pageContainer.appendChild(svgElement);
          overlaysCreated++;
          
          // 记录活动高亮
          const existingHighlight = this.activeHighlights.get(annotation.id);
          if (existingHighlight) {
            existingHighlight.elements.push(svgElement);
          } else {
            this.activeHighlights.set(annotation.id, {
              elements: [svgElement],
              reader: reader
            });
          }
        }
      }

      logger.log(`[PDFReaderManager] Created ${overlaysCreated} overlay elements for annotation ${annotation.id}`);
      return overlaysCreated > 0;

    } catch (error) {
      logger.error("[PDFReaderManager] Error creating annotation overlay:", error);
      return false;
    }
  }

  /**
   * 创建单个SVG叠加元素
   */
  private createSVGOverlay(
    doc: Document,
    pageContainer: HTMLElement,
    rect: number[],
    annotation: SharedAnnotation,
    type: string,
    showAuthor: boolean
  ): SVGElement | null {
    try {
      // PDF坐标系：原点在左下角，Y轴向上
      // 屏幕坐标系：原点在左上角，Y轴向下
      const [x1, y1, x2, y2] = rect;
      
      // 获取页面尺寸
      const canvas = pageContainer.querySelector('canvas');
      if (!canvas) {
        logger.warn("[PDFReaderManager] No canvas found in page container");
        return null;
      }

      const pageHeight = canvas.height;
      const pageWidth = canvas.width;
      const scale = canvas.offsetWidth / pageWidth; // 缩放比例

      // 坐标转换：PDF -> 屏幕
      const screenX = x1 * scale;
      const screenY = (pageHeight - y2) * scale; // Y轴翻转
      const width = (x2 - x1) * scale;
      const height = (y2 - y1) * scale;

      // 创建SVG容器
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('researchopia-shared-annotation-overlay');
      svg.setAttribute('data-annotation-id', annotation.id);
      svg.style.cssText = `
        position: absolute;
        left: ${screenX}px;
        top: ${screenY}px;
        width: ${width}px;
        height: ${height}px;
        pointer-events: auto;
        z-index: 5;
        overflow: visible;
      `;

      const color = annotation.color || '#ffd400';

      // 根据类型创建不同的SVG元素
      if (type === 'underline') {
        // 下划线：底部线条
        const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '100%');
        line.setAttribute('x2', '100%');
        line.setAttribute('y2', '100%');
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        line.style.opacity = '0.8';
        svg.appendChild(line);
      } else {
        // 高亮：半透明矩形
        const rectElement = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rectElement.setAttribute('width', '100%');
        rectElement.setAttribute('height', '100%');
        rectElement.setAttribute('fill', color);
        rectElement.setAttribute('rx', '2'); // 圆角
        rectElement.style.opacity = '0.3';
        svg.appendChild(rectElement);
      }

      // 添加用户名标签（仅第一个rect）
      const displayName = this.getAnnotationDisplayName(annotation);
      if (showAuthor && displayName) {
        const authorLabel = this.createAuthorLabel(doc, displayName);
        svg.appendChild(authorLabel);
      }

      // 添加悬停效果
      svg.addEventListener('mouseenter', () => {
        svg.style.opacity = '0.8';
        svg.style.cursor = 'pointer';
      });

      svg.addEventListener('mouseleave', () => {
        svg.style.opacity = '1';
      });

      // 点击事件：显示详情（可选）
      svg.addEventListener('click', (e) => {
        e.stopPropagation();
        logger.log("[PDFReaderManager] 🖱️ Clicked annotation:", annotation.id);
        // 未来可以在这里显示详情弹窗
      });

      return svg;

    } catch (error) {
      logger.error("[PDFReaderManager] Error creating SVG overlay:", error);
      return null;
    }
  }

  /**
   * 创建作者名标签
   */
  private createAuthorLabel(doc: Document, authorName: string): SVGElement {
    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('author-label');
    
    // 背景矩形
    const bg = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-5');
    bg.setAttribute('y', '-18');
    bg.setAttribute('width', `${authorName.length * 7 + 10}`);
    bg.setAttribute('height', '16');
    bg.setAttribute('fill', 'rgba(0, 0, 0, 0.75)');
    bg.setAttribute('rx', '3');
    group.appendChild(bg);
    
    // 文本
    const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '-6');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', '600');
    text.textContent = authorName;
    group.appendChild(text);
    
    return group;
  }

  /**
   * 等待PDF页面渲染完成
   */
  private async waitForPageRender(doc: Document, pageNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100; // 5秒超时
      
      const checkPage = () => {
        attempts++;
        
        // 尝试多种选择器
        const selectors = [
          `.page[data-page-number="${pageNumber}"]`,
          `.page[data-loaded="true"][data-page-number="${pageNumber}"]`,
          `#page${pageNumber}`,
          `.page:nth-child(${pageNumber})`
        ];
        
        let page: Element | null = null;
        for (const selector of selectors) {
          page = doc.querySelector(selector);
          if (page) {
            logger.log(`[PDFReaderManager] Found page with selector: ${selector}`);
            break;
          }
        }
        
        if (page) {
          // 额外等待一小段时间确保渲染完成
          setTimeout(() => resolve(), 100);
        } else if (attempts >= maxAttempts) {
          logger.warn(`[PDFReaderManager] Page ${pageNumber} not found after ${attempts} attempts, continuing anyway`);
          resolve(); // 不阻塞,继续执行
        } else {
          if (attempts % 10 === 0) {
            logger.log(`[PDFReaderManager] Still waiting for page ${pageNumber}, attempt ${attempts}`);
          }
          setTimeout(checkPage, 50);
        }
      };
      
      checkPage();
    });
  }

  /**
   * 创建高亮叠加层
   */
  private createHighlightOverlay(
    doc: Document,
    annotation: SharedAnnotation,
    scrollToView: boolean = true
  ): SVGElement[] {
    try {
      logger.log("[PDFReaderManager] createHighlightOverlay called for annotation:", annotation.id);
      const pageNumber = annotation.position.pageIndex + 1;
      logger.log("[PDFReaderManager] Looking for page:", pageNumber);
      
      // 尝试多种选择器
      logger.log("[PDFReaderManager] Document body structure:", doc.body?.childNodes.length, "top-level children");
      const allPages = doc.querySelectorAll('.page');
      logger.log("[PDFReaderManager] Total .page elements found:", allPages.length);
      
      // 列出前3个页面的属性
      allPages.forEach((p, idx) => {
        if (idx < 3) {
          const elem = p as HTMLElement;
          logger.log(`[PDFReaderManager] Page ${idx}: data-page-number=${elem.getAttribute('data-page-number')}, data-loaded=${elem.getAttribute('data-loaded')}, id=${elem.id}`);
        }
      });
      
      const page = doc.querySelector(`.page[data-page-number="${pageNumber}"]`) as HTMLElement;

      if (!page) {
        logger.error("[PDFReaderManager] Page element not found with selector:", `.page[data-page-number="${pageNumber}"]`);
        return [];
      }

      logger.log("[PDFReaderManager] Page element found");

      // 获取页面的text layer (用于定位)
      const textLayer = page.querySelector('.textLayer') as HTMLElement;
      const canvasWrapper = page.querySelector('.canvasWrapper') as HTMLElement;

      if (!textLayer || !canvasWrapper) {
        logger.error("[PDFReaderManager] Text layer or canvas wrapper not found");
        logger.log("[PDFReaderManager] Available page children:", page.children.length);
        return [];
      }
      
      logger.log("[PDFReaderManager] Canvas wrapper found, creating SVG rects...");

      const overlayElements: SVGElement[] = [];

      // 为每个rect创建高亮矩形
      annotation.position.rects.forEach((rect, index) => {
        const svg = this.createSVGRect(doc, rect, annotation, page);
        if (svg) {
          // 插入到canvasWrapper中
          canvasWrapper.appendChild(svg);
          overlayElements.push(svg);
        }
      });

      // 滚动到可视区域
      if (scrollToView && overlayElements.length > 0) {
        const firstRect = annotation.position.rects[0];
        this.scrollToRect(page, firstRect);
      }

      return overlayElements;
    } catch (error) {
      logger.error("[PDFReaderManager] Error creating overlay:", error);
      return [];
    }
  }

  /**
   * 创建SVG矩形元素
   */
  private createSVGRect(
    doc: Document,
    rect: number[],
    annotation: SharedAnnotation,
    page: HTMLElement
  ): SVGElement | null {
    try {
      // 创建SVG容器
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('researchopia-highlight-overlay');
      svg.setAttribute('data-annotation-id', annotation.id);
      
      // 获取页面尺寸和缩放
      const viewport = this.getPageViewport(page);
      
      // PDF坐标系转换为屏幕坐标系
      // PDF坐标: 原点在左下角, Y轴向上
      // 屏幕坐标: 原点在左上角, Y轴向下
      const [x1, y1, x2, y2] = rect;
      const pageHeight = viewport.height;
      
      const screenX = x1 * viewport.scale;
      const screenY = (pageHeight - y2) * viewport.scale; // Y轴翻转
      const width = (x2 - x1) * viewport.scale;
      const height = (y2 - y1) * viewport.scale;

      // 设置SVG位置和尺寸
      svg.style.cssText = `
        position: absolute;
        left: ${screenX}px;
        top: ${screenY}px;
        width: ${width}px;
        height: ${height}px;
        pointer-events: auto;
        z-index: 100;
        overflow: visible;
      `;

      // 创建矩形元素
      const rectElement = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rectElement.setAttribute('width', '100%');
      rectElement.setAttribute('height', '100%');
      rectElement.setAttribute('rx', '2'); // 圆角
      
      // 应用样式
      const color = annotation.color || '#ffff00';
      rectElement.style.fill = color;
      rectElement.style.opacity = '0.3';
      rectElement.style.stroke = '#007acc';
      rectElement.style.strokeWidth = '2';
      rectElement.style.strokeDasharray = '5,5'; // 虚线边框
      rectElement.classList.add('shared-annotation-highlight');

      svg.appendChild(rectElement);

      // 添加脉冲动画
      const animation = rectElement.animate([
        { opacity: '0' },
        { opacity: '0.3' },
        { opacity: '0.5' },
        { opacity: '0.3' }
      ], {
        duration: 2000,
        iterations: 2,
        easing: 'ease-in-out'
      });

      // 动画结束后保持稳定状态
      animation.onfinish = () => {
        rectElement.style.opacity = '0.3';
      };

      // 添加悬浮效果
      svg.addEventListener('mouseenter', () => {
        rectElement.style.opacity = '0.5';
        this.showAuthorTooltip(doc, svg, annotation);
      });

      svg.addEventListener('mouseleave', () => {
        rectElement.style.opacity = '0.3';
        this.hideAuthorTooltip(doc);
      });

      // 添加点击事件 - 显示标注详情
      svg.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showAnnotationDetails(annotation);
      });

      return svg;
    } catch (error) {
      logger.error("[PDFReaderManager] Error creating SVG rect:", error);
      return null;
    }
  }

  /**
   * 从Zotero Reader获取PDF页面的真实尺寸
   * 这是最准确的方法,支持任意尺寸的PDF
   */
  private async getPageDimensionsFromPDF(reader: any, pageIndex: number): Promise<{
    width: number;
    height: number;
  } | null> {
    try {
      // 调试信息
      logger.log(`[PDFReaderManager] 🔍 Checking reader structure:`);
      logger.log(`[PDFReaderManager]   - reader exists: ${!!reader}`);
      logger.log(`[PDFReaderManager]   - reader._iframeWindow exists: ${!!reader._iframeWindow}`);
      logger.log(`[PDFReaderManager]   - reader._internalReader exists: ${!!reader._internalReader}`);

      // 探索reader._iframeWindow的结构
      if (reader._iframeWindow) {
        const win = reader._iframeWindow;
        logger.log(`[PDFReaderManager]   - _iframeWindow keys: ${Object.keys(win).slice(0, 20).join(', ')}`);
        logger.log(`[PDFReaderManager]   - _iframeWindow.wrappedJSObject exists: ${!!win.wrappedJSObject}`);

        // 尝试通过wrappedJSObject访问(Firefox特有)
        if (win.wrappedJSObject?.PDFViewerApplication) {
          logger.log(`[PDFReaderManager]   - Found PDFViewerApplication via wrappedJSObject!`);
        }
      }

      // 尝试多种方式访问PDFViewerApplication
      let pdfViewerApp: any = null;

      // 方法1: reader._iframeWindow.wrappedJSObject.PDFViewerApplication (Firefox)
      if (reader._iframeWindow?.wrappedJSObject?.PDFViewerApplication) {
        pdfViewerApp = reader._iframeWindow.wrappedJSObject.PDFViewerApplication;
        logger.log(`[PDFReaderManager] ✅ Found PDFViewerApplication via wrappedJSObject`);
      }
      // 方法2: reader._iframeWindow.PDFViewerApplication
      else if (reader._iframeWindow?.PDFViewerApplication) {
        pdfViewerApp = reader._iframeWindow.PDFViewerApplication;
        logger.log(`[PDFReaderManager] ✅ Found PDFViewerApplication via _iframeWindow`);
      }
      // 方法3: reader._internalReader._iframeWindow.PDFViewerApplication
      else if (reader._internalReader?._iframeWindow?.PDFViewerApplication) {
        pdfViewerApp = reader._internalReader._iframeWindow.PDFViewerApplication;
        logger.log(`[PDFReaderManager] ✅ Found PDFViewerApplication via _internalReader._iframeWindow`);
      }
      // 方法4: 从iframe元素直接获取
      else if (reader._iframeWindow) {
        const iframe = reader._iframeWindow.document.querySelector('iframe');
        if (iframe?.contentWindow?.PDFViewerApplication) {
          pdfViewerApp = iframe.contentWindow.PDFViewerApplication;
          logger.log(`[PDFReaderManager] ✅ Found PDFViewerApplication via iframe.contentWindow`);
        }
      }

      if (pdfViewerApp?.pdfDocument) {
        logger.log(`[PDFReaderManager] 📄 pdfDocument exists, getting page ${pageIndex + 1}...`);

        const pdfDocument = pdfViewerApp.pdfDocument;
        logger.log(`[PDFReaderManager] 📄 pdfDocument numPages: ${pdfDocument.numPages}`);

        let page = await pdfDocument.getPage(pageIndex + 1); // PDF.js页码从1开始
        logger.log(`[PDFReaderManager] 📄 Got page object, type: ${typeof page}`);

        // 尝试通过wrappedJSObject访问(Firefox XPCNativeWrapper)
        if (page.wrappedJSObject) {
          logger.log(`[PDFReaderManager] 📄 Using page.wrappedJSObject`);
          page = page.wrappedJSObject;
        }

        // 检查getViewport方法
        logger.log(`[PDFReaderManager] 📄 page.getViewport exists: ${typeof page.getViewport}`);

        if (typeof page.getViewport !== 'function') {
          logger.error(`[PDFReaderManager] ❌ page.getViewport is not a function, page keys: ${Object.keys(page).slice(0, 20).join(', ')}`);
          throw new Error('page.getViewport is not available');
        }

        let viewport = page.getViewport({ scale: 1.0 }); // 获取原始尺寸(scale=1)
        logger.log(`[PDFReaderManager] 📄 viewport type: ${typeof viewport}, keys: ${Object.keys(viewport).slice(0, 20).join(', ')}`);

        // 尝试通过wrappedJSObject访问viewport
        if (viewport.wrappedJSObject) {
          logger.log(`[PDFReaderManager] 📄 Using viewport.wrappedJSObject`);
          viewport = viewport.wrappedJSObject;
        }

        logger.log(`[PDFReaderManager] 📐 viewport.width: ${viewport.width}, viewport.height: ${viewport.height}`);

        // 如果width/height为null或NaN,使用viewBox
        let pdfWidth = viewport.width;
        let pdfHeight = viewport.height;

        if (!pdfWidth || !pdfHeight || isNaN(pdfWidth) || isNaN(pdfHeight)) {
          if (viewport.viewBox && viewport.viewBox.length >= 4) {
            // viewBox格式: [x1, y1, x2, y2]
            // PDF尺寸 = x2 - x1, y2 - y1
            pdfWidth = viewport.viewBox[2] - viewport.viewBox[0];
            pdfHeight = viewport.viewBox[3] - viewport.viewBox[1];
            logger.log(`[PDFReaderManager] ✅ Using viewBox for dimensions: ${pdfWidth}x${pdfHeight}`);
          } else {
            logger.error(`[PDFReaderManager] ❌ viewport dimensions are invalid and viewBox not available`);
            throw new Error('viewport dimensions are invalid');
          }
        }

        logger.log(`[PDFReaderManager] 📐 Got PDF page dimensions from PDFViewerApplication: ${pdfWidth}x${pdfHeight}`);

        return {
          width: pdfWidth,
          height: pdfHeight
        };
      } else {
        logger.warn("[PDFReaderManager] ⚠️ pdfDocument not available in PDFViewerApplication");
        logger.log(`[PDFReaderManager]   - pdfViewerApp exists: ${!!pdfViewerApp}`);
        logger.log(`[PDFReaderManager]   - pdfViewerApp.pdfDocument exists: ${!!pdfViewerApp?.pdfDocument}`);
      }

      logger.warn("[PDFReaderManager] ⚠️ PDFViewerApplication not available");
      return null;
    } catch (error) {
      logger.error("[PDFReaderManager] Error getting page dimensions from PDF:", error);
      logger.error("[PDFReaderManager] Error details:", {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        name: (error as any)?.name
      });
      return null;
    }
  }

  /**
   * 获取页面视口信息
   * 优先使用Canvas原始尺寸,避免硬编码
   */
  private getPageViewport(page: HTMLElement): {
    width: number;
    height: number;
    scale: number;
  } {
    try {
      // 尝试从Canvas获取
      const canvas = page.querySelector('canvas');
      if (canvas) {
        // 使用Canvas的原始尺寸(canvas.width/height)作为PDF尺寸
        // 而不是硬编码的612x792
        const pdfWidth = canvas.width;
        const pdfHeight = canvas.height;

        // 计算缩放比例: 显示尺寸 / 原始尺寸
        const displayWidth = canvas.offsetWidth || parseFloat(canvas.style.width) || pdfWidth;
        const scale = displayWidth / pdfWidth;

        logger.log(`[PDFReaderManager] 📐 Canvas dimensions: ${pdfWidth}x${pdfHeight}, display: ${displayWidth}px, scale: ${scale.toFixed(3)}`);

        return {
          width: pdfWidth,
          height: pdfHeight,
          scale: scale
        };
      }

      // 默认值(仅作为fallback)
      logger.warn("[PDFReaderManager] ⚠️ Canvas not found, using default dimensions");
      return {
        width: 612, // 标准US Letter宽度 (points)
        height: 792, // 标准US Letter高度 (points)
        scale: 1
      };
    } catch (error) {
      logger.error("[PDFReaderManager] Error getting viewport:", error);
      return { width: 612, height: 792, scale: 1 };
    }
  }

  /**
   * 滚动到指定矩形区域
   */
  private scrollToRect(page: HTMLElement, rect: number[]): void {
    try {
      const [x1, y1] = rect;
      const viewport = this.getPageViewport(page);
      const pageHeight = viewport.height;
      
      const screenY = (pageHeight - y1) * viewport.scale;
      
      // 计算绝对位置
      const pageTop = page.offsetTop;
      const scrollTop = pageTop + screenY - 100; // 留出100px边距

      // 滚动到位置
      page.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      logger.error("[PDFReaderManager] Error scrolling to rect:", error);
    }
  }

  /**
   * 显示作者提示框
   */
  private showAuthorTooltip(doc: Document, element: SVGElement, annotation: SharedAnnotation): void {
    try {
      // 移除旧的tooltip
      this.hideAuthorTooltip(doc);

      const tooltip = doc.createElement('div');
      tooltip.id = 'researchopia-author-tooltip';
      tooltip.className = 'researchopia-author-tooltip';

      const authorName = this.getAnnotationDisplayName(annotation);
      const qualityBadge = annotation.quality_score 
        ? `⭐ ${annotation.quality_score.toFixed(1)}` 
        : '';
      
      tooltip.innerHTML = `
        <div style="font-weight: 600;">${authorName}</div>
        ${qualityBadge ? `<div style="font-size: 11px;">${qualityBadge}</div>` : ''}
        <div style="font-size: 11px; color: #ccc;">点击查看详情</div>
      `;

      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        max-width: 200px;
      `;

      // 定位tooltip
      const rect = element.getBoundingClientRect();
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.top - 60}px`;

      doc.body.appendChild(tooltip);
    } catch (error) {
      logger.error("[PDFReaderManager] Error showing tooltip:", error);
    }
  }

  /**
   * 隐藏作者提示框
   */
  private hideAuthorTooltip(doc: Document): void {
    const tooltip = doc.getElementById('researchopia-author-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  /**
   * 显示标注详情
   */
  private showAnnotationDetails(annotation: SharedAnnotation): void {
    try {
      logger.log("[PDFReaderManager] Showing annotation details:", annotation.id);
      
      // 创建详情对话框
      const ProgressWindow = (Zotero as any).ProgressWindow;
      if (!ProgressWindow) {
        logger.error("[PDFReaderManager] ProgressWindow not available");
        return;
      }
      
      const dialog = new ProgressWindow({ closeOnClick: false });
      dialog.changeHeadline(`标注详情`);

      const content = annotation.content || '';
      const comment = annotation.comment || '';
      const author = this.getAnnotationDisplayName(annotation);
      
      dialog.addDescription(`作者: ${author}`);
      if (content) {
        dialog.addDescription(`内容: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      }
      if (comment) {
        dialog.addDescription(`评论: ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`);
      }
      
      dialog.show();
      dialog.startCloseTimer(5000);
    } catch (error) {
      logger.error("[PDFReaderManager] Error showing details:", error);
    }
  }

  /**
   * 设置点击外部取消高亮的监听
   */
  private setupDismissListener(doc: Document, annotationId: string): void {
    const dismissHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 检查是否点击在高亮元素上
      if (!target.closest('.researchopia-highlight-overlay')) {
        // 点击在外部,清除该高亮
        this.clearHighlight(annotationId);
        
        // 移除监听器
        doc.removeEventListener('click', dismissHandler);
      }
    };

    // 延迟添加监听,避免立即触发
    setTimeout(() => {
      doc.addEventListener('click', dismissHandler);
    }, 100);
  }

  /**
   * 清除单个高亮
   */
  public clearHighlight(annotationId: string): void {
    try {
      const highlight = this.activeHighlights.get(annotationId);
      if (highlight) {
        // 移除所有SVG/HTML元素
        highlight.elements.forEach(el => {
          el.remove();
        });

        this.activeHighlights.delete(annotationId);
        logger.log("[PDFReaderManager] Cleared highlight:", annotationId);
      }

      // 清理overlay数据
      const overlayData = this.overlayData.get(annotationId);
      if (overlayData) {
        // 移除overlay元素
        overlayData.overlayElements.forEach(el => el.remove());
        this.overlayData.delete(annotationId);

        // 如果这个页面容器没有其他overlay了，移除ResizeObserver
        const hasOtherOverlays = Array.from(this.overlayData.values()).some(
          data => data.pageContainer === overlayData.pageContainer
        );
        if (!hasOtherOverlays) {
          const observer = this.resizeObservers.get(overlayData.pageContainer);
          if (observer) {
            observer.disconnect();
            this.resizeObservers.delete(overlayData.pageContainer);
            logger.log("[PDFReaderManager] ResizeObserver disconnected from page container");
          }
        }
      }
    } catch (error) {
      logger.error("[PDFReaderManager] Error clearing highlight:", error);
    }
  }

  /**
   * 清除所有高亮
   */
  public clearAllHighlights(reader?: any): void {
    try {
      logger.log("[PDFReaderManager] Clearing all highlights");

      if (reader) {
        // 只清除特定reader的高亮
        const toRemove: string[] = [];
        this.activeHighlights.forEach((highlight, id) => {
          if (highlight.reader === reader) {
            highlight.elements.forEach(el => el.remove());
            toRemove.push(id);
          }
        });
        toRemove.forEach(id => this.activeHighlights.delete(id));
      } else {
        // 清除所有高亮
        this.activeHighlights.forEach((highlight) => {
          highlight.elements.forEach(el => el.remove());
        });
        this.activeHighlights.clear();
      }

      logger.log("[PDFReaderManager] All highlights cleared");
    } catch (error) {
      logger.error("[PDFReaderManager] Error clearing all highlights:", error);
    }
  }

  /**
   * 批量高亮多个标注
   */
  public async highlightMultipleAnnotations(
    reader: any,
    annotations: SharedAnnotation[]
  ): Promise<{ success: number; failed: number }> {
    try {
      logger.log("[PDFReaderManager] Highlighting multiple annotations:", annotations.length);

      let success = 0;
      let failed = 0;

      for (const annotation of annotations) {
        const result = await this.highlightAnnotation(reader, annotation, {
          noDismissListener: true, // 批量模式下不添加单独的dismiss监听
          scrollToView: false // 不自动滚动
        });

        if (result) {
          success++;
        } else {
          failed++;
        }

        // 小延迟避免UI阻塞
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      logger.log("[PDFReaderManager] Batch highlighting completed:", { success, failed });
      return { success, failed };
    } catch (error) {
      logger.error("[PDFReaderManager] Error in batch highlighting:", error);
      return { success: 0, failed: annotations.length };
    }
  }



  /**
   * 切换原生标注的显示/隐藏
   * @param reader - Zotero Reader实例
   * @returns 当前状态 (true=已隐藏, false=已显示)
   */
  /**
   * 切换原生标注的显示/隐藏（通过操作_annotations数组）
   * @param reader PDF Reader实例
   * @param shouldHide 可选：明确指定隐藏(true)或显示(false)。不提供则自动切换
   * @returns 返回最终状态：true表示已隐藏，false表示已显示
   */
  public toggleNativeAnnotations(reader: any, shouldHide?: boolean): boolean {
    try {
      const internalReader = reader._internalReader;
      if (!internalReader) {
        logger.error("[PDFReaderManager] ❌ _internalReader not found");
        return false;
      }

      const annotationManager = internalReader._annotationManager;
      const primaryView = internalReader._primaryView;

      if (!annotationManager || !annotationManager._annotations) {
        logger.error("[PDFReaderManager] ❌ annotationManager or _annotations not found");
        return false;
      }

      if (!primaryView || !primaryView._annotations) {
        logger.error("[PDFReaderManager] ❌ primaryView or _annotations not found");
        return false;
      }

      // 判断当前状态和目标状态
      const hasBackup = this.annotationBackups.has(reader);
      const currentState = hasBackup; // 有备份说明当前是隐藏状态
      const newState = shouldHide !== undefined ? shouldHide : !currentState;

      logger.log(`[PDFReaderManager] Current state: ${currentState ? 'HIDDEN' : 'SHOWN'}, Target state: ${newState ? 'HIDE' : 'SHOW'}, hasBackup: ${hasBackup}`);

      if (newState) {
        // === 隐藏原生标注 ===
        if (hasBackup) {
          logger.warn("[PDFReaderManager] ⚠️ Annotations already hidden");
          return true;
        }

        // 1. 从annotationManager中提取原生标注ID
        const annotations = Array.isArray(annotationManager._annotations)
          ? annotationManager._annotations
          : Array.from((annotationManager._annotations as Map<any, any>).values());

        const nativeAnnotationIDs = annotations
          .filter((ann: any) => ann && !ann._isSharedAnnotation)
          .map((ann: any) => ann.id);

        if (nativeAnnotationIDs.length === 0) {
          logger.warn("[PDFReaderManager] ⚠️ No native annotations found to hide");
          return false;
        }

        logger.log(`[PDFReaderManager] Found ${nativeAnnotationIDs.length} native annotations to hide`);

        // 2. 从annotationManager._annotations中移除并备份
        let removedFromManager: any[] = [];
        if (Array.isArray(annotationManager._annotations)) {
          const before = annotationManager._annotations.length;
          removedFromManager = annotationManager._annotations.filter((ann: any) =>
            ann && !ann._isSharedAnnotation
          );
          annotationManager._annotations = annotationManager._annotations.filter((ann: any) =>
            !ann || ann._isSharedAnnotation
          );
          logger.log(`[PDFReaderManager] annotationManager: ${before} → ${annotationManager._annotations.length} (removed ${removedFromManager.length})`);
        }

        // 3. 从primaryView._annotations中移除
        if (Array.isArray(primaryView._annotations)) {
          const before = primaryView._annotations.length;
          primaryView._annotations = primaryView._annotations.filter((ann: any) =>
            !ann || ann._isSharedAnnotation
          );
          logger.log(`[PDFReaderManager] primaryView: ${before} → ${primaryView._annotations.length}`);
        }

        // 4. 备份移除的标注
        this.annotationBackups.set(reader, removedFromManager);

        // 5. 触发重新渲染
        try {
          if (typeof annotationManager.render === 'function') {
            annotationManager.render();
          }
          if (typeof primaryView.render === 'function') {
            primaryView.render();
          } else if (typeof primaryView._render === 'function') {
            primaryView._render();
          }
        } catch (renderErr) {
          logger.warn("[PDFReaderManager] ⚠️ Render error:", renderErr);
        }

        this.nativeAnnotationsHidden.set(reader, true);
        logger.log("[PDFReaderManager] ✅ Native annotations hidden successfully");
        return true;

      } else {
        // === 显示原生标注 ===
        if (!hasBackup) {
          logger.warn("[PDFReaderManager] ⚠️ No backup found, annotations already shown");
          return false;
        }

        const backup = this.annotationBackups.get(reader);
        if (!backup || backup.length === 0) {
          logger.warn("[PDFReaderManager] ⚠️ Backup is empty");
          this.annotationBackups.delete(reader);
          return false;
        }

        logger.log(`[PDFReaderManager] 📦 Restoring ${backup.length} annotations from backup`);

        // 1. 恢复到annotationManager._annotations
        if (Array.isArray(annotationManager._annotations)) {
          annotationManager._annotations.push(...backup);
          logger.log(`[PDFReaderManager] annotationManager: restored → ${annotationManager._annotations.length}`);
        }

        // 2. 恢复到primaryView._annotations
        if (Array.isArray(primaryView._annotations)) {
          primaryView._annotations.push(...backup);
          logger.log(`[PDFReaderManager] primaryView: restored → ${primaryView._annotations.length}`);
        }

        // 3. 删除备份
        this.annotationBackups.delete(reader);

        // 4. 触发重新渲染
        try {
          if (typeof annotationManager.render === 'function') {
            annotationManager.render();
          }
          if (typeof primaryView.render === 'function') {
            primaryView.render();
          } else if (typeof primaryView._render === 'function') {
            primaryView._render();
          }
        } catch (renderErr) {
          logger.warn("[PDFReaderManager] ⚠️ Render error:", renderErr);
        }

        this.nativeAnnotationsHidden.set(reader, false);
        logger.log("[PDFReaderManager] ✅ Native annotations shown successfully");
        return false;
      }

    } catch (error) {
      logger.error("[PDFReaderManager] ❌ Error toggling native annotations:", error);
      return false;
    }
  }

  /**
   * 隐藏原生标注
   */
  public hideNativeAnnotations(reader: any): boolean {
    const currentState = this.nativeAnnotationsHidden.get(reader) || false;
    if (!currentState) {
      return this.toggleNativeAnnotations(reader);
    }
    return true;
  }

  /**
   * 显示原生标注
   */
  public showNativeAnnotations(reader: any): boolean {
    const currentState = this.nativeAnnotationsHidden.get(reader) || false;
    if (currentState) {
      return this.toggleNativeAnnotations(reader);
    }
    return true;
  }

  /**
   * 获取原生标注的当前状态
   */
  public getNativeAnnotationsState(reader: any): boolean {
    return this.nativeAnnotationsHidden.get(reader) || false;
  }

  // 存储当前选中的标注ID
  private selectedAnnotationId: string | null = null;

  // 存储当前显示的popup元素
  private currentPopup: HTMLElement | null = null;

  /**
   * 处理共享标注点击事件
   */
  private async handleSharedAnnotationClick(
    annotation: SharedAnnotation,
    clickedElement: HTMLElement,
    reader: any
  ): Promise<void> {
    try {
      logger.log("[PDFReaderManager] 📌 Handling shared annotation click:", annotation.id);

      // 1. 突出显示被点击的标注
      this.highlightSelectedAnnotation(annotation.id);

      // 2. 在PDF下方或侧边显示comment和评论
      await this.showAnnotationComments(annotation, reader);

      // 3. 通知UI Manager定位到插件面板中的对应标注
      await this.notifyUIManagerToScroll(annotation.id);

    } catch (error) {
      logger.error("[PDFReaderManager] Error handling annotation click:", error);
    }
  }

  /**
   * 突出显示选中的标注（使用虚线外围）
   * 模仿Zotero原生标注：创建一个包围整个标注的大虚线框
   */
  private highlightSelectedAnnotation(annotationId: string): void {
    try {
      // 如果是同一个标注，不需要重新创建包围框
      if (this.selectedAnnotationId === annotationId) {
        logger.log("[PDFReaderManager] ✨ Annotation already highlighted:", annotationId);
        return;
      }

      // 清除之前选中标注的高亮
      if (this.selectedAnnotationId) {
        this.clearAnnotationHighlight(this.selectedAnnotationId);
      }

      // 为当前标注添加高亮效果
      const overlayData = this.overlayData.get(annotationId);
      if (!overlayData) {
        logger.warn("[PDFReaderManager] Overlay data not found for:", annotationId);
        return;
      }

      // 计算包围所有overlay元素的边界框（排除用户名标签）
      let minLeft = Infinity, minTop = Infinity;
      let maxRight = -Infinity, maxBottom = -Infinity;

      // 过滤掉用户名标签，只计算标注本体的边界框
      const annotationElements = overlayData.overlayElements.filter(
        el => !el.classList.contains('researchopia-author-label')
      );

      logger.log("[PDFReaderManager] 🔍 Calculating bounding box for", annotationElements.length, "annotation elements (excluding author labels)");

      annotationElements.forEach((element, index) => {
        // 使用offsetLeft/offsetTop获取相对于offsetParent的位置
        const left = element.offsetLeft;
        const top = element.offsetTop;
        const right = left + element.offsetWidth;
        const bottom = top + element.offsetHeight;

        logger.log(`[PDFReaderManager] Element ${index + 1}:`, {
          left, top, right, bottom,
          width: element.offsetWidth,
          height: element.offsetHeight
        });

        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, right);
        maxBottom = Math.max(maxBottom, bottom);
      });

      logger.log("[PDFReaderManager] 📦 Bounding box:", {
        left: minLeft,
        top: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop
      });

      // 创建包围框元素
      const doc = overlayData.pageContainer.ownerDocument;
      const boundingBox = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      boundingBox.className = 'researchopia-annotation-bounding-box';
      boundingBox.setAttribute('data-annotation-id', annotationId);

      // 设置包围框样式（模仿Zotero原生标注）
      boundingBox.style.cssText = `
        position: absolute;
        left: ${minLeft}px;
        top: ${minTop}px;
        width: ${maxRight - minLeft}px;
        height: ${maxBottom - minTop}px;
        outline: 2px dashed rgba(0, 123, 255, 0.8);
        outline-offset: 3px;
        pointer-events: none;
        z-index: 10;
        box-sizing: border-box;
      `;

      // 添加到overlay层
      const overlayLayer = overlayData.pageContainer.querySelector('.researchopia-overlay-layer');
      if (overlayLayer) {
        overlayLayer.appendChild(boundingBox);
      }

      this.selectedAnnotationId = annotationId;
      logger.log("[PDFReaderManager] ✨ Highlighted annotation with bounding box:", annotationId);

    } catch (error) {
      logger.error("[PDFReaderManager] Error highlighting annotation:", error);
    }
  }

  /**
   * 清除标注的高亮效果
   */
  private clearAnnotationHighlight(annotationId: string): void {
    try {
      const overlayData = this.overlayData.get(annotationId);
      if (!overlayData) return;

      // 移除包围框元素
      const boundingBox = overlayData.pageContainer.querySelector(
        `.researchopia-annotation-bounding-box[data-annotation-id="${annotationId}"]`
      );
      if (boundingBox) {
        boundingBox.remove();
      }

      logger.log("[PDFReaderManager] 🔄 Cleared highlight for:", annotationId);

    } catch (error) {
      logger.error("[PDFReaderManager] Error clearing highlight:", error);
    }
  }

  /**
   * 设置全局点击监听器
   * 当点击PDF页面的非标注区域时，清除所有高亮效果
   */
  private setupGlobalClickListener(reader: any, doc: Document): void {
    // 如果已经添加过监听器，不重复添加
    if (this.globalClickListeners.has(reader)) {
      return;
    }

    const clickHandler = async (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement;

        // 检查点击的是否是共享标注或其子元素
        const isAnnotationClick = target.closest('.researchopia-shared-annotation') ||
                                  target.closest('.researchopia-author-label') ||
                                  target.closest('.researchopia-annotation-popup') ||
                                  target.closest('.researchopia-annotation-bounding-box');

        // 如果点击的不是标注相关元素，清除所有高亮
        if (!isAnnotationClick) {
          logger.log("[PDFReaderManager] 🖱️ Clicked outside annotation, clearing highlights");

          // 清除PDF页面的包围框
          if (this.selectedAnnotationId) {
            this.clearAnnotationHighlight(this.selectedAnnotationId);
            this.selectedAnnotationId = null;
          }

          // 关闭popup
          this.closeAnnotationPopup(false);

          // 通知UI Manager清除插件面板的卡片高亮
          const win = (Zotero as any).getMainWindow();
          if (win) {
            const event = new win.CustomEvent('researchopia-clear-card-highlight', {
              detail: {}
            });
            win.dispatchEvent(event);
          }
        }
      } catch (error) {
        logger.error("[PDFReaderManager] Error in global click handler:", error);
      }
    };

    // 添加监听器
    doc.addEventListener('click', clickHandler);
    this.globalClickListeners.set(reader, clickHandler);

    logger.log("[PDFReaderManager] ✅ Global click listener setup complete");
  }

  /**
   * 在PDF下方显示comment和评论（不显示原文）
   */
  private async showAnnotationComments(
    annotation: SharedAnnotation,
    reader: any
  ): Promise<void> {
    try {
      logger.log("[PDFReaderManager] 💬 Showing comments for:", annotation.id);

      // 关闭之前的popup（但不清除高亮效果，因为可能是同一个标注）
      this.closeAnnotationPopup(false);

      // 获取标注的overlay元素
      const overlayData = this.overlayData.get(annotation.id);
      if (!overlayData || overlayData.overlayElements.length === 0) {
        logger.warn("[PDFReaderManager] Overlay not found for annotation:", annotation.id);
        return;
      }

      // 找到最下方的overlay元素
      let bottomOverlay = overlayData.overlayElements[0];
      let maxBottom = parseFloat(bottomOverlay.style.top || '0');
      let maxHeight = parseFloat(bottomOverlay.style.height || '0');

      overlayData.overlayElements.forEach(element => {
        const top = parseFloat(element.style.top || '0');
        const height = parseFloat(element.style.height || '0');
        const bottom = top + height;
        if (bottom > maxBottom + maxHeight) {
          maxBottom = top;
          maxHeight = height;
          bottomOverlay = element;
        }
      });

      // 计算popup位置（相对于页面容器）
      const popupTop = maxBottom + maxHeight + 5; // 在标注下方5px
      const popupLeft = parseFloat(bottomOverlay.style.left || '0');

      // 创建popup容器
      const doc = bottomOverlay.ownerDocument;
      const popup = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      popup.className = "researchopia-annotation-popup";

      // 设置popup样式（使用absolute定位，相对于页面容器）
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

      const author = this.getAnnotationDisplayName(annotation);
      const comment = annotation.comment || '';

      // 作者信息
      const authorDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
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

      // Comment内容
      if (comment) {
        const commentDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        commentDiv.style.cssText = `
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin-bottom: 12px;
        `;
        commentDiv.textContent = comment;
        popup.appendChild(commentDiv);
      }

      // 获取并显示点赞数量和用户评论
      try {
        // 通过UIManager获取supabaseManager
        const { UIManager } = await import('./ui-manager');
        const uiManager = UIManager.getInstance();
        const supabaseManager = (uiManager as any).supabaseManager;

        if (supabaseManager) {
          // 添加分隔线（在作者信息和comment内容之后）
          const separator = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          separator.style.cssText = `
            border-top: 1px solid #e0e0e0;
            margin: 12px 0 8px 0;
          `;
          popup.appendChild(separator);

          // 点赞数量显示
          const likes = await supabaseManager.getAnnotationLikes(annotation.id);
          const likesCount = likes?.length || 0;

          const likesDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
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
          logger.log("[PDFReaderManager] 💬 Loaded comments:", comments?.length || 0);

          // 评论标题（始终显示）
          const commentsTitle = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
          commentsTitle.style.cssText = `
            font-weight: 600;
            color: #666;
            margin-bottom: 8px;
            font-size: 11px;
          `;

          if (comments && comments.length > 0) {
            // 计算总评论数（包括所有嵌套回复）
            const countAllComments = (commentList: any[]): number => {
              return commentList.reduce((total, comment) => {
                return total + 1 + (comment.children ? countAllComments(comment.children) : 0);
              }, 0);
            };
            const totalComments = countAllComments(comments);

            commentsTitle.textContent = `用户评论 (${totalComments})`;
            popup.appendChild(commentsTitle);

            // 渲染评论列表
            this.renderCommentList(comments, popup, doc);
          } else {
            // 没有用户评论，显示"暂无评论"
            commentsTitle.textContent = `用户评论 (0)`;
            popup.appendChild(commentsTitle);

            const noCommentDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
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
        logger.error("[PDFReaderManager] Error loading comments:", error);
      }

      // 添加到页面容器（使用absolute定位，随页面滚动）
      const pageContainer = overlayData.pageContainer;
      pageContainer.appendChild(popup);
      this.currentPopup = popup;

      // 点击popup外部关闭
      const closeOnClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        // 检查点击是否在popup或overlay内
        const clickedInPopup = popup.contains(target);
        const clickedInOverlay = overlayData.overlayElements.some(el => el.contains(target));

        if (!clickedInPopup && !clickedInOverlay) {
          this.closeAnnotationPopup();
          doc.removeEventListener('click', closeOnClickOutside);
        }
      };

      // 延迟添加事件监听器，避免立即触发（增加延迟时间，确保当前点击事件完成）
      setTimeout(() => {
        doc.addEventListener('click', closeOnClickOutside);
      }, 300);

      logger.log("[PDFReaderManager] ✅ Popup displayed");

    } catch (error) {
      logger.error("[PDFReaderManager] Error showing comments:", error);
    }
  }

  /**
   * 获取标注的显示名称
   * 优先使用users.username，如果show_author_name为false则显示"匿名用户"
   */
  private getAnnotationDisplayName(annotation: SharedAnnotation): string {
    logger.log("[PDFReaderManager] 🔍 Getting display name for annotation:", {
      id: annotation.id,
      show_author_name: annotation.show_author_name,
      users: annotation.users,
      username: annotation.username
    });

    // 如果不显示作者名，返回"匿名用户"
    if (annotation.show_author_name === false) {
      logger.log("[PDFReaderManager] ➡️ Returning '匿名用户' (show_author_name is false)");
      return '匿名用户';
    }

    // 优先使用users.username（从Supabase join获取）
    if (annotation.users?.username) {
      logger.log("[PDFReaderManager] ➡️ Returning users.username:", annotation.users.username);
      return annotation.users.username;
    }

    // 其次使用username字段（可能已经被提取）
    if (annotation.username) {
      logger.log("[PDFReaderManager] ➡️ Returning username:", annotation.username);
      return annotation.username;
    }

    // 最后fallback到"匿名用户"
    logger.log("[PDFReaderManager] ➡️ Returning '匿名用户' (fallback)");
    return '匿名用户';
  }

  /**
   * 渲染评论列表（支持嵌套）
   */
  private renderCommentList(comments: any[], container: HTMLElement, doc: Document, depth: number = 0): void {
    try {
      comments.forEach(comment => {
        const commentDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        commentDiv.style.cssText = `
          margin-left: ${depth * 16}px;
          margin-bottom: 8px;
          padding: 8px;
          background: ${depth === 0 ? '#f8f9fa' : '#ffffff'};
          border-left: 2px solid ${depth === 0 ? '#007bff' : '#dee2e6'};
          border-radius: 4px;
        `;

        // 用户名和时间
        const headerDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        headerDiv.style.cssText = `
          font-size: 10px;
          color: #666;
          margin-bottom: 4px;
        `;
        // 根据is_anonymous标志决定显示用户名还是"匿名用户"
        const username = comment.is_anonymous ? '匿名用户' : (comment.username || 'Unknown');
        const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : '';
        headerDiv.textContent = `${username} · ${createdAt}`;
        commentDiv.appendChild(headerDiv);

        // 评论内容
        const contentDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        contentDiv.style.cssText = `
          font-size: 11px;
          color: #333;
          white-space: pre-wrap;
          word-wrap: break-word;
        `;
        contentDiv.textContent = comment.content || '';
        commentDiv.appendChild(contentDiv);

        container.appendChild(commentDiv);

        // 递归渲染子评论（支持replies或children字段）
        const childComments = comment.replies || comment.children || [];
        if (childComments.length > 0) {
          this.renderCommentList(childComments, container, doc, depth + 1);
        }
      });
    } catch (error) {
      logger.error("[PDFReaderManager] Error rendering comment list:", error);
    }
  }

  /**
   * 关闭标注popup
   * @param clearHighlight 是否同时清除高亮效果（默认true）
   */
  private closeAnnotationPopup(clearHighlight: boolean = true): void {
    try {
      if (this.currentPopup) {
        this.currentPopup.remove();
        this.currentPopup = null;
        logger.log("[PDFReaderManager] 🔄 Popup closed");
      }

      // 同时清除高亮效果（如果需要）
      if (clearHighlight && this.selectedAnnotationId) {
        this.clearAnnotationHighlight(this.selectedAnnotationId);
        this.selectedAnnotationId = null;
      }
    } catch (error) {
      logger.error("[PDFReaderManager] Error closing popup:", error);
    }
  }

  /**
   * 通知UI Manager滚动到对应的标注卡片
   */
  private async notifyUIManagerToScroll(annotationId: string): Promise<void> {
    try {
      logger.log("[PDFReaderManager] 📍 Notifying UI Manager to scroll to:", annotationId);

      // 使用Zotero的主窗口触发自定义事件
      const win = (Zotero as any).getMainWindow();
      if (win) {
        const event = new win.CustomEvent('researchopia-scroll-to-annotation', {
          detail: { annotationId }
        });
        win.dispatchEvent(event);
        logger.log("[PDFReaderManager] ✅ Event dispatched");
      } else {
        logger.warn("[PDFReaderManager] ⚠️ Main window not available");
      }

    } catch (error) {
      logger.error("[PDFReaderManager] Error notifying UI Manager:", error);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[PDFReaderManager] Cleaning up...");

    this.clearAllHighlights();
    this.readerEventListeners.clear();
    this.nativeAnnotationsHidden.clear();
    this.selectedAnnotationId = null;
    this.isInitialized = false;

    logger.log("[PDFReaderManager] Cleanup completed");
  }
}

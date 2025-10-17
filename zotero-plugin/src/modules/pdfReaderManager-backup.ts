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
  content: string;
  comment?: string;
  color: string;
  position: AnnotationPosition;
  author_name?: string;
  quality_score?: number;
  created_at: string;
  user_id: string;
}

export class PDFReaderManager {
  private static instance: PDFReaderManager | null = null;
  private isInitialized = false;
  private activeHighlights = new Map<string, {
    elements: SVGElement[];
    reader: any;
  }>();
  private readerEventListeners = new Map<any, Function[]>();
  private nativeAnnotationsHidden = new Map<any, boolean>(); // 记录每个reader的原生标注隐藏状态
  private annotationBackups = new Map<any, any[]>(); // 备份被隐藏的标注数组

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
    } = {}
  ): Promise<boolean> {
    try {
      logger.log("[PDFReaderManager] 📍 Navigating to annotation:", annotation.id);
      logger.warn("[PDFReaderManager] ⚠️ Highlight display temporarily disabled due to cross-origin restrictions");
      
      const position = {
        pageIndex: annotation.position.pageIndex,
        rects: annotation.position.rects
      };
      
      logger.log("[PDFReaderManager] 🧭 Target position:", JSON.stringify(position));
      logger.log("[PDFReaderManager] 🔍 Available reader methods:", Object.keys(reader).filter(k => typeof reader[k] === 'function').slice(0, 20));
      
      // 使用旧版本的导航策略：在顶层 reader 对象上尝试多个API
      
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
        } else {
          logger.log("[PDFReaderManager] ⚠️ reader.navigateToPosition not available");
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
        } else if (!navigated) {
          logger.log("[PDFReaderManager] ⚠️ reader.navigate not available");
        }
        
        // 方法3: _internalReader.setSelection (低级API，显示选中效果)
        if (!navigated && reader._internalReader && typeof reader._internalReader.setSelection === 'function') {
          try {
            logger.log("[PDFReaderManager] 🔄 Trying _internalReader.setSelection");
            reader._internalReader.setSelection([{ position }]);
            navigated = true;
            logger.log("[PDFReaderManager] ✅ Navigated via _internalReader.setSelection");
          } catch (err) {
            logger.warn("[PDFReaderManager] _internalReader.setSelection failed:", err);
          }
        } else if (!navigated) {
          logger.log("[PDFReaderManager] ⚠️ _internalReader.setSelection not available");
        }
        
        // ✨ 额外尝试：如果导航成功，尝试使用setSelection显示高亮选中效果
        if (navigated && reader._internalReader && typeof reader._internalReader.setSelection === 'function') {
          try {
            logger.log("[PDFReaderManager] 💡 Attempting to show selection highlight with setSelection");
            reader._internalReader.setSelection([{ position }]);
            logger.log("[PDFReaderManager] ✅ Selection highlight applied");
          } catch (err) {
            logger.warn("[PDFReaderManager] ⚠️ Could not apply selection highlight:", err);
          }
        }
        
        if (!navigated) {
          logger.error("[PDFReaderManager] ❌ All navigation methods failed");
          return false;
        }
      } else {
        logger.log("[PDFReaderManager] Skipping navigation (scrollToView=false)");
      }
      
      logger.log("[PDFReaderManager] ✅ Navigation completed");
      return true;
      
    } catch (error) {
      logger.error("[PDFReaderManager] ❌ Error navigating to annotation:", error);
      return false;
    }
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
   * 获取页面视口信息
   */
  private getPageViewport(page: HTMLElement): {
    width: number;
    height: number;
    scale: number;
  } {
    try {
      // 尝试从data属性获取
      const canvas = page.querySelector('canvas');
      if (canvas) {
        const scale = parseFloat(canvas.style.width) / canvas.width || 1;
        return {
          width: canvas.width,
          height: canvas.height,
          scale: scale
        };
      }

      // 默认值
      return {
        width: 612, // 标准A4宽度 (points)
        height: 792, // 标准A4高度 (points)
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
      
      const authorName = annotation.author_name || '匿名用户';
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
      const author = annotation.author_name || '匿名用户';
      
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
        // 移除所有SVG元素
        highlight.elements.forEach(el => {
          el.remove();
        });
        
        this.activeHighlights.delete(annotationId);
        logger.log("[PDFReaderManager] Cleared highlight:", annotationId);
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

      // 添加全局清除按钮
      this.showGlobalClearButton(reader);

      logger.log("[PDFReaderManager] Batch highlighting completed:", { success, failed });
      return { success, failed };
    } catch (error) {
      logger.error("[PDFReaderManager] Error in batch highlighting:", error);
      return { success: 0, failed: annotations.length };
    }
  }

  /**
   * 显示全局清除按钮
   */
  private showGlobalClearButton(reader: any): void {
    try {
      const iframeDocument = reader._iframeWindow?.document;
      if (!iframeDocument) return;

      // 检查是否已存在
      if (iframeDocument.getElementById('researchopia-clear-all-btn')) {
        return;
      }

      const button = iframeDocument.createElement('button');
      button.id = 'researchopia-clear-all-btn';
      button.textContent = '清除所有共享标注';
      button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #d9534f;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.background = '#c9302c';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.background = '#d9534f';
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      });

      button.addEventListener('click', () => {
        this.clearAllHighlights(reader);
        button.remove();
      });

      iframeDocument.body.appendChild(button);
    } catch (error) {
      logger.error("[PDFReaderManager] Error showing clear button:", error);
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

  /**
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[PDFReaderManager] Cleaning up...");
    
    this.clearAllHighlights();
    this.readerEventListeners.clear();
    this.nativeAnnotationsHidden.clear();
    this.isInitialized = false;
    
    logger.log("[PDFReaderManager] Cleanup completed");
  }
}

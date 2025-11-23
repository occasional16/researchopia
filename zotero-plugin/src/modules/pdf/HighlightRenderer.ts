/**
 * HighlightRenderer - 高亮渲染器
 * 职责: 在PDF页面上渲染标注高亮（HTML Overlay）
 * 从pdfReaderManager.ts重构提取
 */

import { logger } from "../../utils/logger";
import type { IResponsiveLayoutHandler } from "./ResponsiveLayoutHandler";

// ========== 类型定义 ==========

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
  username?: string;
  users?: { username: string; avatar_url: string | null };
  show_author_name?: boolean;
  visibility?: 'public' | 'anonymous' | 'private'; // 🔥 添加 visibility 字段
  quality_score?: number;
  created_at: string;
  user_id: string;
}

interface HighlightData {
  elements: (SVGElement | HTMLElement)[];
  reader: any;
}

// ========== 接口定义 ==========

export interface IHighlightRenderer {
  /**
   * 渲染单个标注高亮
   */
  renderSingle(
    annotation: SharedAnnotation,
    pageContainer: HTMLElement,
    reader: any,
    doc: Document,
    onClick?: (annotationId: string, annotation: SharedAnnotation) => void
  ): Promise<number>;

  /**
   * 批量渲染多个标注
   */
  renderBatch(
    annotations: SharedAnnotation[],
    pageContainer: HTMLElement,
    reader: any,
    doc: Document
  ): Promise<{ success: number; failed: number }>;

  /**
   * 清除指定标注的高亮
   */
  clear(annotationId: string): void;

  /**
   * 清除所有高亮
   */
  clearAll(reader?: any): void;

  /**
   * 获取当前活动高亮数量
   */
  getActiveCount(): number;
}

// ========== 实现类 ==========

export class HighlightRenderer implements IHighlightRenderer {
  private activeHighlights = new Map<string, HighlightData>();
  private layoutHandler: IResponsiveLayoutHandler | null = null;

  constructor(layoutHandler?: IResponsiveLayoutHandler) {
    this.layoutHandler = layoutHandler || null;
  }

  /**
   * 渲染单个标注高亮
   * @returns 创建的元素数量
   */
  public async renderSingle(
    annotation: SharedAnnotation,
    pageContainer: HTMLElement,
    reader: any,
    doc: Document,
    onClick?: (annotationId: string, annotation: SharedAnnotation) => void
  ): Promise<number> {
    try {
      logger.log(`[HighlightRenderer] 🎨 Rendering annotation: ${annotation.id}`);

      // 1. 验证页面容器
      if (!pageContainer || pageContainer.offsetWidth === 0 || pageContainer.offsetHeight === 0) {
        logger.error("[HighlightRenderer] ❌ Invalid page container");
        return 0;
      }

      // 2. 创建或获取overlay层（不会被PDF.js清除）
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
        logger.log("[HighlightRenderer] 📍 Created overlay layer");
      }

      // 3. 确保页面容器设置为relative定位
      if (pageContainer.style.position !== 'relative' && pageContainer.style.position !== 'absolute') {
        pageContainer.style.position = 'relative';
        logger.log("[HighlightRenderer] 📍 Set pageContainer position to relative");
      }

      // 4. 清除之前的高亮（避免重复）
      if (this.activeHighlights.has(annotation.id)) {
        this.clear(annotation.id);
        logger.log("[HighlightRenderer] 🗑️ Cleared old highlight");
      }

      // 5. 获取页面尺寸和缩放比例
      const dimensions = await this.getPageDimensions(
        pageContainer,
        reader,
        annotation.position.pageIndex
      );
      if (!dimensions) {
        logger.error("[HighlightRenderer] ❌ Failed to get page dimensions");
        return 0;
      }

      const { pdfWidth, pdfHeight, displayWidth, displayHeight, scaleX, scaleY } = dimensions;

      logger.log("[HighlightRenderer] 📏 Page dimensions:", {
        pdfWidth,
        pdfHeight,
        displayWidth,
        displayHeight,
        scaleX: scaleX.toFixed(3),
        scaleY: scaleY.toFixed(3)
      });

      // 6. 渲染每个矩形高亮
      const annotationType = annotation.type || 'highlight';
      const color = annotation.color || '#ffd400';
      let overlaysCreated = 0;

      for (let i = 0; i < annotation.position.rects.length; i++) {
        const rect = annotation.position.rects[i];
        const [x1, y1, x2, y2] = rect;

        // PDF坐标系：原点在左下角，Y轴向上
        // 转换为屏幕坐标（像素）
        const leftPx = x1 * scaleX;
        const topPx = (pdfHeight - y2) * scaleY; // Y轴翻转
        const widthPx = (x2 - x1) * scaleX;
        const heightPx = (y2 - y1) * scaleY;

        // 创建覆盖层div
        const overlay = doc.createElement('div');
        overlay.classList.add('researchopia-shared-annotation-overlay');
        overlay.setAttribute('data-annotation-id', annotation.id);
        overlay.setAttribute('data-annotation-type', annotationType);

        // 基础样式
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
          overlay.style.borderRadius = '2px';
        }

        // 添加悬停效果
        overlay.addEventListener('mouseenter', () => {
          overlay.style.opacity = annotationType === 'underline' ? '1' : '0.5';
          overlay.style.cursor = 'pointer';
        });

        overlay.addEventListener('mouseleave', () => {
          overlay.style.opacity = annotationType === 'underline' ? '0.8' : '0.3';
        });

        // 点击事件 - 直接调用回调函数
        overlay.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          logger.log(`[HighlightRenderer] 🖱️ Clicked annotation: ${annotation.id}`);
          
          if (onClick) {
            logger.log(`[HighlightRenderer] 📞 Calling onClick callback...`);
            onClick(annotation.id, annotation);
          } else {
            logger.log(`[HighlightRenderer] ⚠️ No onClick callback provided`);
          }
        });

        overlayLayer.appendChild(overlay);
        overlaysCreated++;

        // 第一个rect添加用户名标签
        if (i === 0 && this.shouldShowAuthorLabel(annotation)) {
          const displayName = this.getAnnotationDisplayName(annotation);
          const authorLabel = this.createAuthorLabel(doc, displayName, annotation.id);
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
          overlaysCreated++;
        }
      }

      // 7. 存储到activeHighlights
      const allElements = Array.from(pageContainer.querySelectorAll(
        `[data-annotation-id="${annotation.id}"]`
      )) as HTMLElement[];

      this.activeHighlights.set(annotation.id, {
        elements: allElements,
        reader
      });

      logger.log(`[HighlightRenderer] ✅ Created ${overlaysCreated} elements for annotation ${annotation.id}`);

      return overlaysCreated;
    } catch (error) {
      logger.error("[HighlightRenderer] ❌ Error rendering annotation:", error);
      return 0;
    }
  }

  /**
   * 批量渲染多个标注
   */
  public async renderBatch(
    annotations: SharedAnnotation[],
    pageContainer: HTMLElement,
    reader: any,
    doc: Document
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const annotation of annotations) {
      const count = await this.renderSingle(annotation, pageContainer, reader, doc);
      if (count > 0) {
        success++;
      } else {
        failed++;
      }

      // 小延迟避免UI阻塞
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    logger.log(`[HighlightRenderer] Batch rendering completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  /**
   * 清除指定标注的高亮
   */
  public clear(annotationId: string): void {
    try {
      const highlight = this.activeHighlights.get(annotationId);
      if (highlight) {
        highlight.elements.forEach(el => {
          el.remove();
        });
        this.activeHighlights.delete(annotationId);
        logger.log(`[HighlightRenderer] Cleared highlight: ${annotationId}`);
      }
    } catch (error) {
      logger.error("[HighlightRenderer] Error clearing highlight:", error);
    }
  }

  /**
   * 清除所有高亮
   */
  public clearAll(reader?: any): void {
    try {
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
        logger.log(`[HighlightRenderer] Cleared highlights for specific reader: ${toRemove.length}`);
      } else {
        // 清除所有高亮
        this.activeHighlights.forEach((highlight) => {
          highlight.elements.forEach(el => el.remove());
        });
        this.activeHighlights.clear();
        logger.log("[HighlightRenderer] Cleared all highlights");
      }
    } catch (error) {
      logger.error("[HighlightRenderer] Error clearing all highlights:", error);
    }
  }

  /**
   * 获取当前活动高亮数量
   */
  public getActiveCount(): number {
    return this.activeHighlights.size;
  }

  // ========== 私有辅助方法 ==========

  /**
   * 获取页面尺寸和缩放比例
   * @param pageContainer 页面容器元素
   * @param reader Zotero Reader实例（用于获取PDF逻辑尺寸）
   * @param pageIndex 页面索引（从0开始）
   */
  private async getPageDimensions(
    pageContainer: HTMLElement,
    reader?: any,
    pageIndex?: number
  ): Promise<{
    pdfWidth: number;
    pdfHeight: number;
    displayWidth: number;
    displayHeight: number;
    scaleX: number;
    scaleY: number;
  } | null> {
    try {
      const canvas = pageContainer.querySelector('canvas');

      // 1. 获取PDF逻辑尺寸（优先从PDFViewerApplication获取）
      let pdfWidth: number;
      let pdfHeight: number;

      if (this.layoutHandler && reader && pageIndex !== undefined) {
        const pdfDimensions = await this.layoutHandler.getPageDimensionsFromPDF(reader, pageIndex);
        if (pdfDimensions) {
          pdfWidth = pdfDimensions.width;
          pdfHeight = pdfDimensions.height;
          logger.log(`[HighlightRenderer] ✅ Using PDF logical dimensions: ${pdfWidth}x${pdfHeight}`);
        } else {
          logger.warn("[HighlightRenderer] ⚠️ Failed to get PDF dimensions from PDFViewerApplication, using fallback");
          pdfWidth = 612;
          pdfHeight = 792;
        }
      } else if (canvas) {
        // Fallback: 从Canvas获取（可能不准确）
        logger.warn("[HighlightRenderer] ⚠️ Using canvas dimensions as fallback (may be inaccurate)");
        pdfWidth = canvas.width;
        pdfHeight = canvas.height;
      } else {
        // 最终Fallback: 标准US Letter尺寸
        logger.warn("[HighlightRenderer] ⚠️ Canvas not found, using default US Letter dimensions");
        pdfWidth = 612;
        pdfHeight = 792;
      }

      // 2. 获取Canvas实际显示尺寸
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

      // 3. 计算缩放比例
      const scaleX = displayWidth / pdfWidth;
      const scaleY = displayHeight / pdfHeight;

      logger.log(`[HighlightRenderer] 📏 Page dimensions: PDF(${pdfWidth}x${pdfHeight}) Display(${displayWidth}x${displayHeight}) Scale(${scaleX.toFixed(3)}x${scaleY.toFixed(3)})`);

      return {
        pdfWidth,
        pdfHeight,
        displayWidth,
        displayHeight,
        scaleX,
        scaleY
      };
    } catch (error) {
      logger.error("[HighlightRenderer] ❌ Error getting page dimensions:", error);
      return null;
    }
  }

  /**
   * 是否显示作者标签
   */
  private shouldShowAuthorLabel(annotation: SharedAnnotation): boolean {
    // 如果标注明确设置了show_author_name，使用该设置
    if (annotation.show_author_name !== undefined) {
      return annotation.show_author_name;
    }

    // 否则，如果有用户名则显示
    return !!(annotation.username || annotation.users?.username);
  }

  /**
   * 获取标注显示名称
   */
  private getAnnotationDisplayName(annotation: SharedAnnotation): string {
    // 🔥 关键修复：根据 visibility 字段决定显示内容
    // 如果没有 visibility 字段，回退到旧的 show_author_name 逻辑
    const visibility = annotation.visibility || 
      ((annotation as any).show_author_name === false ? 'anonymous' : 'public');
    
    // 私密标注显示"私密"
    if (visibility === 'private') {
      return '私密';
    }
    
    // 匿名标注显示"匿名用户"
    if (visibility === 'anonymous') {
      return '匿名用户';
    }
    
    // 公开标注显示真实用户名
    // 优先使用username字段
    if (annotation.username) {
      return annotation.username;
    }

    // 其次使用users.username (Supabase join的结果)
    if (annotation.users && annotation.users.username) {
      return annotation.users.username;
    }

    // 默认显示"未知用户"
    return "未知用户";
  }

  /**
   * 创建作者标签HTML元素
   */
  private createAuthorLabel(
    doc: Document,
    authorName: string,
    annotationId: string
  ): HTMLElement {
    const label = doc.createElement('div');
    label.className = 'researchopia-author-label';
    label.setAttribute('data-annotation-id', annotationId);
    label.textContent = authorName;
    return label;
  }
}

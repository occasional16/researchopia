/**
 * 标注工具函数
 * 供sharedAnnotationsView和readingSessionView共享使用
 */

import { logger } from "../../utils/logger";

/**
 * 标注去重
 * 优先使用zotero_key作为唯一标识,因为这是Zotero中真正的唯一键
 * 如果zotero_key不存在,则使用original_id或id
 */
export function deduplicateAnnotations<T extends { id: string }>(annotations: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const annotation of annotations) {
    // 优先使用zotero_key(从annotation_data中获取)
    const zoteroKey = (annotation as any).annotation_data?.zotero_key;
    const key = zoteroKey || (annotation as any).original_id || annotation.id;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(annotation);
    }
  }

  return unique;
}

/**
 * 批量显示筛选器类型
 */
export type BatchDisplayFilter = 'all' | 'following' | 'toggle-native' | 'clear';

/**
 * 批量显示工具栏配置
 */
export interface BatchDisplayButton {
  id: string;
  text: string;
  icon: string;
  filter: BatchDisplayFilter;
  style?: 'danger' | 'special';
}

/**
 * 创建批量显示工具栏
 */
export function createBatchDisplayToolbar(
  doc: Document,
  onFilterChange: (filter: BatchDisplayFilter) => void,
  options?: {
    showFollowingButton?: boolean;
    followingButtonText?: string;  // 自定义"关注用户"按钮文本
    toggleNativeText?: string;
  }
): HTMLElement {
  const toolbar = doc.createElement("div");
  toolbar.id = "batch-display-toolbar";
  toolbar.style.cssText = `
    padding: 14px 16px;
    background: #ffffff;
    border-radius: 10px;
    margin: 0 0 16px 0;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid #e5e7eb;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  `;

  const label = doc.createElement("span");
  label.textContent = "📍 批量显示:";
  label.style.cssText = `
    color: #1f2937;
    font-weight: 700;
    font-size: 14px;
    margin-right: 6px;
    line-height: 1;
    display: flex;
    align-items: center;
  `;

  const buttons: BatchDisplayButton[] = [
    {
      id: "show-all",
      text: "全部显示",
      icon: "🌐",
      filter: "all"
    }
  ];

  // 可选的关注用户/选中成员按钮
  if (options?.showFollowingButton !== false) {
    buttons.push({
      id: "show-following",
      text: options?.followingButtonText || "关注用户",
      icon: "👥",
      filter: "following"
    });
  }

  buttons.push(
    {
      id: "toggle-native",
      text: options?.toggleNativeText || "隐藏我的标注",
      icon: "👁️",
      filter: "toggle-native",
      style: "special"
    },
    {
      id: "clear-all",
      text: "清除显示",
      icon: "🚫",
      filter: "clear",
      style: "danger"
    }
  );

  toolbar.appendChild(label);

  buttons.forEach((btn) => {
    const button = doc.createElement("button");
    button.id = btn.id;
    button.innerHTML = `${btn.icon} ${btn.text}`;
    button.setAttribute("data-filter", btn.filter);

    const isDanger = btn.style === "danger";
    const isSpecial = btn.style === "special";
    const btnColor = isDanger ? "#ef4444" : isSpecial ? "#0891b2" : "#3b82f6";

    button.style.cssText = `
      padding: 8px 16px;
      background: #ffffff;
      color: ${btnColor};
      border: 2px solid ${btnColor};
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 38px;
      flex: 0 0 auto;
    `;

    button.addEventListener("mouseenter", () => {
      button.style.background = btnColor;
      button.style.color = "#ffffff";
      button.style.transform = "translateY(-2px)";
      button.style.boxShadow = `0 4px 12px ${btnColor}40`;
    });

    button.addEventListener("mouseleave", () => {
      button.style.background = "#ffffff";
      button.style.color = btnColor;
      button.style.transform = "translateY(0)";
      button.style.boxShadow = "none";
    });

    button.addEventListener("click", () => {
      onFilterChange(btn.filter);
    });

    toolbar.appendChild(button);
  });

  return toolbar;
}

/**
 * 定位标注到PDF
 */
export async function locateAnnotationInPDF(
  annotation: any,
  context: { getCurrentItem: () => any; showMessage: (msg: string, type: 'info' | 'warning' | 'error') => void }
): Promise<boolean> {
  try {
    const item = context.getCurrentItem();
    if (!item) {
      context.showMessage("请先选择一个PDF文档", "warning");
      return false;
    }

    // 检查是否有附件
    const attachments = item.getAttachments ? item.getAttachments() : [];
    if (attachments.length === 0) {
      context.showMessage("当前文献没有PDF附件", "warning");
      return false;
    }

    // 获取页码
    const pageNumber = annotation.page_number || annotation.pageNumber;
    if (!pageNumber) {
      context.showMessage("标注没有页码信息", "warning");
      return false;
    }

    // 打开PDF阅读器
    const success = await openPDFReader(item, pageNumber);
    if (success) {
      context.showMessage(`已定位到第 ${pageNumber} 页`, "info");
      return true;
    } else {
      context.showMessage("打开PDF失败", "error");
      return false;
    }
  } catch (error) {
    logger.error("[AnnotationUtils] Error locating annotation:", error);
    context.showMessage("定位标注失败", "error");
    return false;
  }
}

/**
 * 打开PDF阅读器并定位到指定页
 */
export async function openPDFReader(item: any, pageNumber?: number): Promise<boolean> {
  try {
    const Zotero = (globalThis as any).Zotero;
    if (!Zotero) {
      logger.error("[AnnotationUtils] Zotero global not found");
      return false;
    }

    // 获取附件
    const attachments = item.getAttachments ? item.getAttachments() : [];
    if (attachments.length === 0) {
      logger.warn("[AnnotationUtils] No attachments found");
      return false;
    }

    // 找到PDF附件
    let pdfAttachment = null;
    for (const attachmentID of attachments) {
      const attachment = await Zotero.Items.getAsync(attachmentID);
      if (attachment && attachment.isPDFAttachment && attachment.isPDFAttachment()) {
        pdfAttachment = attachment;
        break;
      }
    }

    if (!pdfAttachment) {
      logger.warn("[AnnotationUtils] No PDF attachment found");
      return false;
    }

    // 打开PDF阅读器
    if (Zotero.Reader && Zotero.Reader.open) {
      const attachmentId = (pdfAttachment as any).id;
      await Zotero.Reader.open(attachmentId, {
        ...(pageNumber && { location: { pageIndex: pageNumber - 1 } })
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error("[AnnotationUtils] Error opening PDF reader:", error);
    return false;
  }
}

/**
 * 高亮标注卡片
 */
export function highlightAnnotationCard(annotationId: string, duration: number = 2000): void {
  const card = document.getElementById(`annotation-card-${annotationId}`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.style.background = "#fef3c7";
    card.style.border = "2px solid #f59e0b";
    setTimeout(() => {
      card.style.background = "";
      card.style.border = "";
    }, duration);
  }
}

/**
 * 获取筛选标签文本
 */
export function getFilterLabel(filterType: BatchDisplayFilter): string {
  switch (filterType) {
    case "all":
      return "全部标注";
    case "following":
      return "关注用户的标注";
    case "clear":
      return "清除";
    default:
      return "";
  }
}

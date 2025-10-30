/**
 * 文献共读中心视图(二级页面)
 * 管理"文献共读"主按钮下的4个二级页面:
 * - 会话广场(默认)
 * - 创建会话
 * - 加入私密会话
 * - 会话管理
 */

import { logger } from "../../utils/logger";
import type { BaseViewContext } from "./types";
import { ReadingSessionView } from "./readingSessionView";
import { containerPadding } from "./styles";

export class ReadingSessionHubView {
  private readingSessionView: ReadingSessionView;

  constructor(private readonly context: BaseViewContext) {
    logger.log("[ReadingSessionHubView] 📋 Initializing...");
    this.readingSessionView = new ReadingSessionView(context);
  }

  /**
   * 渲染二级页面(直接使用ReadingSessionView的renderInContainer)
   */
  public async render(): Promise<void> {
    try {
      logger.log("[ReadingSessionHubView] 🎨 Rendering hub view...");
      
      const panels = this.context.getPanelsForCurrentItem();
      if (!panels || panels.length === 0) {
        logger.warn("[ReadingSessionHubView] No panels found");
        return;
      }
      
      for (const panel of panels) {
        if (!panel.contentSection) continue;
        
        const doc = panel.contentSection.ownerDocument;
        panel.contentSection.innerHTML = '';
        
        // 创建容器
        const container = doc.createElement('div');
        container.style.cssText = `
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: auto;
          overflow-y: auto;
        `;
        panel.contentSection.appendChild(container);
        
        // 调用ReadingSessionView渲染二级页面
        await this.readingSessionView.renderInContainer(container);
      }
    } catch (error) {
      logger.error("[ReadingSessionHubView] Error rendering:", error);
      this.context.showMessage('渲染失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[ReadingSessionHubView] 🧹 Cleaning up...");
    this.readingSessionView.cleanup();
  }
}

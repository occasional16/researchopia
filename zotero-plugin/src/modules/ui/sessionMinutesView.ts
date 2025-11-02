/**
 * 会话纪要视图Hub
 * 管理两个子视图:会话纪要(默认)和实时聊天
 */

import { logger } from "../../utils/logger";
import type { BaseViewContext } from "./types";
import { ReadingSessionManager } from "../readingSessionManager";
import { SessionLogManager } from "../sessionLogManager";
import { formatDate } from "./helpers";
import { ChatView } from "./chatView";
import { containerPadding } from "./styles";

type SubViewMode = 'minutes' | 'chat';

export class SessionMinutesView {
  private sessionManager = ReadingSessionManager.getInstance();
  private logManager = SessionLogManager.getInstance();
  private chatView: ChatView;
  private currentSubView: SubViewMode = 'minutes';

  constructor(private readonly context: BaseViewContext) {
    logger.log("[SessionMinutesView] 📋 Initializing...");
    this.chatView = new ChatView(context);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.chatView.cleanup();
  }

  /**
   * 渲染会话纪要Hub(两个子按钮:会话纪要、实时聊天)
   */
  public async render(container: HTMLElement): Promise<void> {
    try {
      logger.log("[SessionMinutesView] 🎨 Rendering session minutes hub...");
      
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        container.innerHTML = '<div style="padding: 32px; text-align: center; color: #666;">未找到当前会话</div>';
        return;
      }

      const doc = container.ownerDocument;
      container.innerHTML = '';
      
      // 设置container样式(优化窄窗口)
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: ${containerPadding.view};
        width: 100%;
        max-width: 100%;
        min-width: 0;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
      `;

      // 两个子按钮
      const subButtonsContainer = doc.createElement('div');
      subButtonsContainer.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        flex-shrink: 0;
      `;
      
      // 会话纪要按钮
      const minutesButton = this.createSubButton(
        doc,
        '会话纪要',
        '📋',
        '#10b981',
        '#059669',
        this.currentSubView === 'minutes',
        () => this.switchToSubView('minutes', container, doc)
      );
      
      // 实时聊天按钮
      const chatButton = this.createSubButton(
        doc,
        '实时聊天',
        '💬',
        '#667eea',
        '#5568d3',
        this.currentSubView === 'chat',
        () => this.switchToSubView('chat', container, doc)
      );
      
      subButtonsContainer.appendChild(minutesButton);
      subButtonsContainer.appendChild(chatButton);
      container.appendChild(subButtonsContainer);
      
      // 内容区域
      const contentArea = doc.createElement('div');
      contentArea.id = 'minutes-hub-content';
      contentArea.style.cssText = `
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
        overflow-y: auto;
        width: 100%;
        box-sizing: border-box;
      `;
      container.appendChild(contentArea);
      
      // 渲染当前选中的子视图
      await this.renderSubView(this.currentSubView, contentArea, session.id, doc);
      
      logger.log("[SessionMinutesView] ✅ Hub rendered");
    } catch (error) {
      logger.error("[SessionMinutesView] Error rendering:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 创建子按钮
   */
  private createSubButton(
    doc: Document,
    text: string,
    icon: string,
    color: string,
    hoverColor: string,
    isActive: boolean,
    onClick: () => void
  ): HTMLButtonElement {
    const button = doc.createElement('button');
    button.innerHTML = `
      <span style="font-size: 16px; margin-right: 5px; flex-shrink: 0;">${icon}</span>
      <span style="word-break: break-word; text-align: center; line-height: 1.2;">${text}</span>
    `;
    
    const bgColor = isActive ? color : '#ffffff';
    const textColor = isActive ? '#ffffff' : color;
    
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      background: ${bgColor};
      color: ${textColor};
      border: 2px solid ${color};
      border-radius: 7px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      min-height: 42px;
      box-sizing: border-box;
      overflow: hidden;
    `;
    
    button.addEventListener('mouseenter', () => {
      if (!isActive) {
        button.style.background = color;
        button.style.color = '#ffffff';
      }
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
    });
    
    button.addEventListener('mouseleave', () => {
      if (!isActive) {
        button.style.background = '#ffffff';
        button.style.color = color;
      }
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    });
    
    button.addEventListener('click', onClick);
    
    return button;
  }

  /**
   * 切换子视图
   */
  private async switchToSubView(mode: SubViewMode, container: HTMLElement, doc: Document): Promise<void> {
    if (this.currentSubView === mode) {
      return;
    }
    
    this.currentSubView = mode;
    await this.render(container);
  }

  /**
   * 渲染子视图内容
   */
  private async renderSubView(mode: SubViewMode, contentArea: HTMLElement, sessionId: string, doc: Document): Promise<void> {
    contentArea.innerHTML = '';
    
    try {
      // Get session details to pass to sub-views
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        throw new Error("Current session not found when rendering sub-view.");
      }

      switch (mode) {
        case 'minutes':
          logger.log("[SessionMinutesView] Rendering minutes content");
          await this.renderLogContent(contentArea, doc, session); // Pass the full session object
          break;
          
        case 'chat':
          logger.log("[SessionMinutesView] Rendering chat content");
          await this.chatView.render(contentArea);
          break;
      }
    } catch (error) {
      logger.error("[SessionMinutesView] Error rendering sub view:", error);
      contentArea.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 渲染会话纪要内容(事件日志部分)
   */
  private async renderLogContent(
    container: HTMLElement,
    doc: Document,
    session: any // Receive the full session object
  ) {
    logger.log('[SessionMinutesView] Rendering minutes content');
    try {
      // Corrected method name from fetchLogs to getSessionLogs
      const logs = await this.logManager.getSessionLogs(session.id, 1, 100);
      const messages = await this.logManager.getChatMessages(session.id, {
        page: 1,
        limit: 1000,
      });
      
      // 设置container样式
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
      `;

      // 标题栏
      const headerDiv = doc.createElement('div');
      headerDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        flex-shrink: 0;
      `;

      const title = doc.createElement('h3');
      title.textContent = '📋 会话纪要';
      title.style.cssText = `
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      `;
      headerDiv.appendChild(title);

      // 导出按钮
      const exportButton = doc.createElement('button');
      exportButton.textContent = '📥 导出';
      exportButton.style.cssText = `
        padding: 6px 12px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: opacity 0.2s;
      `;
      exportButton.addEventListener('mouseenter', () => {
        exportButton.style.opacity = '0.85';
      });
      exportButton.addEventListener('mouseleave', () => {
        exportButton.style.opacity = '1';
      });
      exportButton.addEventListener('click', async () => {
        await this.handleExportMinutes(session.id);
      });
      headerDiv.appendChild(exportButton);

      container.appendChild(headerDiv);

      // 会话信息摘要
      const summaryCard = doc.createElement('div');
      summaryCard.style.cssText = `
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 8px;
        flex-shrink: 0;
      `;
      summaryCard.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px; word-break: break-word; overflow-wrap: break-word;">📄 ${this.escapeHtml(session.paper_title)}</div>
        <div style="font-size: 13px; color: #666; word-break: break-all; overflow-wrap: break-word;">DOI: ${this.escapeHtml(session.paper_doi)}</div>
        <div style="font-size: 13px; color: #666;">创建时间: ${formatDate(session.created_at)}</div>
      `;
      container.appendChild(summaryCard);

      // 先添加加载占位符
      const logsPlaceholder = doc.createElement('div');
      logsPlaceholder.id = 'logs-placeholder';
      logsPlaceholder.style.cssText = `
        padding: 40px;
        text-align: center;
        color: #6b7280;
        border: 2px dashed #d1d5db;
        border-radius: 8px;
      `;
      logsPlaceholder.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
        <div style="font-size: 14px;">加载事件日志中...</div>
      `;
      container.appendChild(logsPlaceholder);

      // 异步加载事件日志
      this.loadEventLogs(session.id, container, doc).catch(error => {
        logger.error("[SessionMinutesView] Error loading event logs:", error);
      });
    } catch (error) {
      logger.error("[SessionMinutesView] Error rendering minutes content:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 异步加载事件日志
   */
  private async loadEventLogs(sessionId: string, container: HTMLElement, doc: Document): Promise<void> {
    try {
      const logs = await this.logManager.getSessionLogs(sessionId, 1, 100);
      
      const placeholder = doc.getElementById('logs-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
      
      if (logs.length === 0) {
        const emptyPlaceholder = doc.createElement('div');
        emptyPlaceholder.style.cssText = `
          padding: 40px;
          text-align: center;
          color: #6b7280;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
        `;
        emptyPlaceholder.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
          <div style="font-size: 14px;">暂无会话记录</div>
        `;
        container.appendChild(emptyPlaceholder);
      } else {
        const timelineTitle = doc.createElement('h4');
        timelineTitle.textContent = '⏱️ 事件时间轴';
        timelineTitle.style.cssText = `
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        `;
        container.appendChild(timelineTitle);

        const timeline = doc.createElement('div');
        timeline.style.cssText = `
          position: relative;
          padding-left: 30px;
        `;

        logs.forEach((log: any) => {
          const item = doc.createElement('div');
          item.style.cssText = `
            position: relative;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-left: 2px solid #e9ecef;
          `;

          const dot = doc.createElement('div');
          const dotColor = this.getEventColor(log.action || log.event_type);
          dot.style.cssText = `
            position: absolute;
            left: -31px;
            top: 4px;
            width: 12px;
            height: 12px;
            background: ${dotColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 2px #e9ecef;
          `;
          item.appendChild(dot);

          const content = doc.createElement('div');
          content.style.cssText = 'padding-left: 16px;';
          content.innerHTML = `
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${formatDate(log.created_at)}</div>
            <div style="font-size: 14px; color: #333; line-height: 1.5; word-break: break-word; overflow-wrap: break-word;">${this.formatLogAction(log)}</div>
          `;
          item.appendChild(content);

          timeline.appendChild(item);
        });

        container.appendChild(timeline);
      }
    } catch (error) {
      logger.warn("[SessionMinutesView] Failed to load event logs:", error);
      const placeholder = doc.getElementById('logs-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <div style="font-size: 14px;">加载失败</div>
        `;
      }
    }
  }

  /**
   * 获取事件颜色
   */
  private getEventColor(action: string): string {
    const colorMap: { [key: string]: string } = {
      'join_session': '#28a745',
      'leave_session': '#6c757d',
      'create_annotation': '#ffc107',
      'update_annotation': '#0d6efd',
      'delete_annotation': '#dc3545',
      'send_message': '#17a2b8',
    };
    return colorMap[action] || '#6c757d';
  }

  /**
   * 格式化日志动作
   */
  private formatLogAction(log: any): string {
    const userName = this.escapeHtml(log.user_name || '用户');
    const metadata = log.metadata || {};
    
    switch (log.action || log.event_type) {
      case 'create_annotation':
        const page = metadata.page_number || '?';
        const content = metadata.content || '';
        return `👤 ${userName} 在第${page}页创建了标注${content ? `: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"` : ''}`;
      case 'update_annotation':
        return `📝 ${userName} 更新了第${metadata.page_number || '?'}页的标注`;
      case 'delete_annotation':
        return `🗑️ ${userName} 删除了第${metadata.page_number || '?'}页的标注`;
      case 'join_session':
        return `✅ ${userName} 加入了会话`;
      case 'leave_session':
        return `👋 ${userName} 离开了会话`;
      case 'send_message':
        return `💬 ${userName}: ${this.escapeHtml(metadata.message || '')}`;
      default:
        return `📌 ${userName}: ${log.action || log.event_type}`;
    }
  }

  /**
   * 处理导出纪要
   */
  private async handleExportMinutes(sessionId: string): Promise<void> {
    try {
      logger.log('[SessionMinutesView] 📥 Exporting minutes...');
      
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        this.context.showMessage('未找到当前会话', 'error');
        return;
      }
      
      const logs = await this.logManager.getSessionLogs(sessionId, 1, 1000);
      const messages = await this.logManager.getChatMessages(sessionId, {
        page: 1,
        limit: 1000, // Fetch all messages for export
      });
      
      let markdown = `# 会话纪要\n\n`;
      markdown += `## 会话信息\n\n`;
      markdown += `- **文献标题**: ${session.paper_title}\n`;
      markdown += `- **DOI**: ${session.paper_doi}\n`;
      markdown += `- **创建时间**: ${formatDate(session.created_at)}\n`;
      markdown += `- **邀请码**: ${session.invite_code}\n\n`;
      
      markdown += `## 事件时间轴\n\n`;
      if (logs.length === 0) {
        markdown += `暂无事件记录\n\n`;
      } else {
        for (const log of logs) {
          markdown += `- [${formatDate(log.created_at)}] ${this.formatLogAction(log)}\n`;
        }
        markdown += `\n`;
      }
      
      markdown += `## 聊天记录\n\n`;
      if (messages.length === 0) {
        markdown += `暂无聊天记录\n\n`;
      } else {
        for (const msg of messages) {
          markdown += `**${msg.user_name || '未知用户'}** (${formatDate(msg.created_at)})\n\n`;
          markdown += `${msg.message}\n\n`;
          markdown += `---\n\n`;
        }
      }
      
      const Services = (globalThis as any).Services || (Zotero as any).getMainWindow().Services;
      const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService(Components.interfaces.nsIClipboardHelper);
      clipboardHelper.copyString(markdown);
      
      this.context.showMessage('会话纪要已复制到剪贴板', 'info');
      logger.log('[SessionMinutesView] ✅ Minutes exported to clipboard');
    } catch (error) {
      logger.error('[SessionMinutesView] Error exporting minutes:', error);
      this.context.showMessage('导出失败', 'error');
    }
  }

  /**
   * HTML转义
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

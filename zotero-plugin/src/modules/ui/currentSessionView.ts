/**
 * 当前会话预览视图
 * 显示当前选中论文的公共会话预览卡片,引导用户加入或创建公共会话
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager, ReadingSession } from '../readingSessionManager';
import type { BaseViewContext } from "./types";
import { createLoadingState, createEmptyState } from './uiHelpers';
import { createSessionCard } from './sessionCard';
import { colors, spacing, fontSize, borderRadius } from './styles';
import { escapeHtml } from "./helpers";

export class CurrentSessionView {
  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext,
    private onSessionCreated: () => Promise<void>
  ) {}

  /**
   * 渲染当前会话视图
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[CurrentSessionView] 🎨 Rendering current session preview card...");
      
      container.innerHTML = '';
      
      // 获取当前选中的文献
      const item = this.context.getCurrentItem();
      
      if (!item) {
        const empty = createEmptyState(
          doc,
          '📄',
          '请选择一篇文献',
          '选择一篇有DOI的文献以查看或创建公共会话'
        );
        container.appendChild(empty);
        return;
      }

      // 获取DOI
      const doi = item.getField('DOI');
      const title = item.getField('title');

      if (!doi) {
        const empty = createEmptyState(
          doc,
          '⚠️',
          '当前文献没有DOI',
          '公共会话需要文献具有DOI标识'
        );
        container.appendChild(empty);
        return;
      }

      // 先根据DOI查询是否已存在公共会话
      await this.renderSessionCard(container, doc, doi, title);
      
    } catch (error) {
      logger.error("[CurrentSessionView] Error rendering:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 渲染失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 渲染会话卡片(先查询是否已存在,如果不存在则显示预览卡片)
   */
  private async renderSessionCard(
    container: HTMLElement,
    doc: Document,
    doi: string,
    title: string
  ): Promise<void> {
    try {
      // 根据DOI查询是否已存在公共会话
      logger.log("[CurrentSessionView] Checking if public session exists for DOI:", doi);
      const existingSession = await this.queryPublicSessionByDOI(doi);

      if (existingSession) {
        // 已存在公共会话,显示真实会话卡片
        logger.log("[CurrentSessionView] Public session exists:", existingSession.id);
        await this.renderRealSessionCard(container, doc, existingSession);
      } else {
        // 不存在公共会话,显示预览卡片
        logger.log("[CurrentSessionView] No public session found, showing preview card");
        await this.renderPreviewCard(container, doc, doi, title);
      }
    } catch (error) {
      logger.error("[CurrentSessionView] Error rendering session card:", error);
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
   * 根据DOI查询公共会话
   */
  private async queryPublicSessionByDOI(doi: string): Promise<ReadingSession | null> {
    try {
      // 获取所有公共会话
      const publicSessions = await this.sessionManager.getPublicSessions();
      
      // 查找匹配的DOI
      const session = publicSessions.find(s => s.paper_doi === doi);
      
      return session || null;
    } catch (error) {
      logger.error("[CurrentSessionView] Error querying public session:", error);
      return null;
    }
  }

  /**
   * 渲染真实的公共会话卡片
   */
  private async renderRealSessionCard(
    container: HTMLElement,
    doc: Document,
    session: ReadingSession
  ): Promise<void> {
    // 提示信息
    const hint = doc.createElement('div');
    hint.style.cssText = `
      padding: 12px;
      background: #d1fae5;
      border: 1px solid #6ee7b7;
      border-radius: 6px;
      margin-bottom: ${spacing.md};
      font-size: 13px;
      color: #065f46;
      line-height: 1.6;
    `;
    hint.innerHTML = `
      <strong>✅ 提示:</strong> 该论文的公共会话已存在,点击下方卡片即可加入。
    `;
    container.appendChild(hint);

    // 使用sessionCard创建真实会话卡片
    const card = createSessionCard(doc, session, {
      showInviteCode: false, // 不显示邀请码
      showCreator: false,    // 不显示创建者
      showMemberCount: true,  // 显示真实的成员数和在线人数
      onClick: async () => {
        await this.handleJoinSession(session);
      }
    });

    container.appendChild(card);
  }

  /**
   * 渲染预览卡片(会话还不存在)
   */
  private async renderPreviewCard(
    container: HTMLElement,
    doc: Document,
    doi: string,
    title: string
  ): Promise<void> {
    // 提示信息
    const hint = doc.createElement('div');
    hint.style.cssText = `
      padding: 12px;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      margin-bottom: ${spacing.md};
      font-size: 13px;
      color: #92400e;
      line-height: 1.6;
    `;
    hint.innerHTML = `
      <strong>💡 提示:</strong> 该论文还没有公共会话,点击下方卡片将创建并加入。
      公共会话对所有人开放,无需邀请码。
    `;
    container.appendChild(hint);

    // 创建预览会话对象(用于渲染卡片)
    const previewSession: ReadingSession = {
      id: '', // 预览会话没有ID
      paper_doi: doi,
      paper_title: title,
      session_type: 'public',
      creator_id: '', // 不记录创建者
      invite_code: '', // 不设邀请码
      is_active: true,
      created_at: '', // 不显示创建时间
      max_participants: 0, // 不限制人数
      settings: {}
    };

    // 为预览会话添加member_count字段(预览时为0)
    (previewSession as any).member_count = 0;
    
    const card = createSessionCard(doc, previewSession, {
      showInviteCode: false, // 不显示邀请码
      showCreator: false,    // 不显示创建者
      showMemberCount: true,  // 显示成员数(预览卡片显示为0)
      onlineCount: 0, // 预览卡片在线人数为0
      onClick: async () => {
        await this.handleCreateAndJoinSession(doi, title);
      }
    });

    container.appendChild(card);
  }

  /**
   * 处理加入已存在的会话
   */
  private async handleJoinSession(session: ReadingSession): Promise<void> {
    try {
      logger.log("[CurrentSessionView] Joining existing public session:", session.id);
      
      this.context.showMessage('正在加入公共会话...', 'info');

      // 公共会话通过session_id加入,私密会话通过invite_code加入
      if (session.session_type === 'public') {
        await this.sessionManager.joinSessionById(session.id);
      } else {
        await this.sessionManager.joinSessionByInviteCode(session.invite_code || '');
      }

      logger.log("[CurrentSessionView] Successfully joined session:", session.id);
      
      this.context.showMessage('已加入公共会话！', 'info');

      // 通知父组件会话已加入
      await this.onSessionCreated();

    } catch (error) {
      logger.error("[CurrentSessionView] Error joining session:", error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.context.showMessage(`加入会话失败: ${errorMsg}`, 'error');
    }
  }

  /**
   * 处理创建并加入会话(第一个用户点击预览卡片时)
   */
  private async handleCreateAndJoinSession(doi: string, title: string): Promise<void> {
    try {
      logger.log("[CurrentSessionView] First user clicking, creating public session...");
      
      // 显示"正在加入公共会话"而不是"正在创建"
      this.context.showMessage('正在加入公共会话...', 'info');

      // 创建公共会话
      const result = await this.sessionManager.createSession(
        doi,
        title,
        'public', // 公共会话
        10 // 默认最大参与者数
      );

      logger.log("[CurrentSessionView] Public session created and joined:", result.session.id);
      
      this.context.showMessage('已加入公共会话！', 'info');

      // 通知父组件会话已创建并加入
      await this.onSessionCreated();

    } catch (error) {
      logger.error("[CurrentSessionView] Error creating/joining session:", error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.context.showMessage(`加入会话失败: ${errorMsg}`, 'error');
    }
  }
}

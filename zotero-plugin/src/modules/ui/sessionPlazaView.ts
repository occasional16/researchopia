/**
 * 会话广场视图
 * 显示公开的会话列表，支持筛选和搜索
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager, ReadingSession } from '../readingSessionManager';
import { createBackButton, createLoadingState, createEmptyState, createErrorState, createSelect } from './uiHelpers';
import { createSessionCard } from './sessionCard';
import { colors, spacing, containerPadding } from './styles';

export class SessionPlazaView {
  constructor(
    private sessionManager: ReadingSessionManager,
    private onBack: () => void,
    private onSessionJoin: (session: ReadingSession) => Promise<void>
  ) {}

  /**
   * 渲染会话广场
   */
  public async render(container: HTMLElement, doc: Document, showBackButton: boolean = true): Promise<void> {
    container.innerHTML = '';
    container.style.cssText = `
      position: relative;
      padding: ${containerPadding.view};
      width: 100%;
      box-sizing: border-box;
    `;

    // 返回按钮（可选）
    if (showBackButton) {
      const backButton = createBackButton(doc, this.onBack);
      container.appendChild(backButton);
    }

    // 内容容器
    const content = doc.createElement('div');
    content.style.cssText = `
      padding-top: ${showBackButton ? spacing.xxl : '0'};
      width: 100%;
      box-sizing: border-box;
    `;
    container.appendChild(content);

    // 标题
    const title = doc.createElement('h2');
    title.textContent = '🌐 会话广场';
    title.style.cssText = `
      font-size: 20px;
      font-weight: 700;
      color: ${colors.dark};
      margin-bottom: ${spacing.lg};
      text-align: center;
    `;
    content.appendChild(title);

    // 工具栏（筛选器）
    const toolbar = this.createToolbar(doc, content);
    content.appendChild(toolbar);

    // 会话列表容器
    const sessionsList = doc.createElement('div');
    sessionsList.id = 'plaza-sessions-list';
    sessionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${spacing.md};
      margin-top: ${spacing.md};
    `;
    content.appendChild(sessionsList);

    // 加载公开会话
    await this.loadPublicSessions(sessionsList, doc, 'latest');
  }

  /**
   * 创建工具栏
   */
  private createToolbar(doc: Document, container: HTMLElement): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      margin-bottom: ${spacing.md};
    `;

    const label = doc.createElement('span');
    label.textContent = '筛选:';
    label.style.cssText = `
      font-weight: 600;
      font-size: 13px;
      color: ${colors.dark};
    `;
    toolbar.appendChild(label);

    const filterSelect = createSelect(doc, [
      { value: 'latest', label: '🆕 最新创建' },
      { value: 'most-members', label: '👥 人数最多' },
      { value: 'followed-users', label: '⭐ 关注的用户' },
    ], 'latest');

    filterSelect.addEventListener('change', async () => {
      const sessionsList = doc.getElementById('plaza-sessions-list');
      if (sessionsList) {
        await this.loadPublicSessions(sessionsList, doc, filterSelect.value);
      }
    });

    toolbar.appendChild(filterSelect);

    return toolbar;
  }

  /**
   * 加载公开会话
   */
  private async loadPublicSessions(
    container: HTMLElement,
    doc: Document,
    filterType: string
  ): Promise<void> {
    container.innerHTML = '';
    const loading = createLoadingState(doc, '加载会话广场...');
    container.appendChild(loading);

    try {
      logger.log('[SessionPlazaView] 📨 Fetching public sessions...');
      let sessions = await this.sessionManager.getPublicSessions();
      logger.log(`[SessionPlazaView] 📊 Got ${sessions.length} public sessions`);

      // 根据筛选类型排序
      sessions = this.applySorting(sessions, filterType);

      container.innerHTML = '';

      if (sessions.length === 0) {
        const empty = createEmptyState(
          doc,
          '🌐',
          '暂无公开会话',
          '成为第一个创建公开会话的人吧！'
        );
        container.appendChild(empty);
        return;
      }

      for (const session of sessions) {
        const card = createSessionCard(doc, session, {
          showInviteCode: true,
          showCreator: true,
          showMemberCount: true,
          onClick: async () => {
            try {
              await this.onSessionJoin(session);
            } catch (error) {
              logger.error('[SessionPlazaView] Error joining session:', error);
            }
          },
        });
        container.appendChild(card);
      }
    } catch (error) {
      logger.error('[SessionPlazaView] Error loading public sessions:', error);
      container.innerHTML = '';
      const errorState = createErrorState(doc, '加载失败，请重试');
      container.appendChild(errorState);
    }
  }

  /**
   * 应用排序
   */
  private applySorting(sessions: ReadingSession[], filterType: string): ReadingSession[] {
    switch (filterType) {
      case 'latest':
        // 默认已按创建时间降序排序
        return sessions;
      
      case 'most-members':
        // 按成员数量降序排序
        return sessions.sort((a, b) => {
          const aCount = (a as any).member_count || 0;
          const bCount = (b as any).member_count || 0;
          return bCount - aCount;
        });
      
      case 'followed-users':
        // TODO: 需要实现关注用户列表功能后才能过滤
        // 暂时返回全部会话
        return sessions;
      
      default:
        return sessions;
    }
  }
}

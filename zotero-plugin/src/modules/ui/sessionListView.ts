/**
 * 会话列表视图
 * 显示用户的会话列表（我的会话、创建的会话等）
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager, ReadingSession } from '../readingSessionManager';
import { createButton, createBackButton, createLoadingState, createEmptyState, createErrorState } from './uiHelpers';
import { createSessionCard } from './sessionCard';
import { colors, spacing, containerPadding } from './styles';
import { ServicesAdapter } from '../../adapters';

export class SessionListView {
  constructor(
    private sessionManager: ReadingSessionManager,
    private onBack: () => void,
    private onSessionClick: (session: ReadingSession) => void
  ) {}

  /**
   * 渲染会话列表
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    container.style.cssText = `
      position: relative;
      padding: ${containerPadding.view};
      width: 100%;
      box-sizing: border-box;
    `;

    // 返回按钮
    const backButton = createBackButton(doc, this.onBack);
    container.appendChild(backButton);

    // 内容容器
    const content = doc.createElement('div');
    content.style.cssText = `
      padding-top: ${spacing.xxl};
      width: 100%;
      box-sizing: border-box;
    `;
    container.appendChild(content);

    // 标题
    const title = doc.createElement('h2');
    title.textContent = '📚 会话管理';
    title.style.cssText = `
      font-size: 20px;
      font-weight: 700;
      color: ${colors.dark};
      margin-bottom: ${spacing.lg};
      text-align: center;
    `;
    content.appendChild(title);

    // 标签页
    const tabs = this.createTabs(doc, content);
    content.appendChild(tabs.container);

    // 默认显示"我创建的"
    await this.showCreatedSessionsTab(tabs.contentArea, doc);
  }

  /**
   * 创建标签页
   */
  private createTabs(doc: Document, container: HTMLElement): {
    container: HTMLElement;
    contentArea: HTMLElement;
  } {
    const tabContainer = doc.createElement('div');
    tabContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${spacing.sm};
    `;

    // 标签按钮容器(改用grid布局,类似共享标注)
    const tabButtons = doc.createElement('div');
    tabButtons.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${spacing.sm};
    `;

    // 内容区域
    const contentArea = doc.createElement('div');
    contentArea.style.cssText = `
      min-height: 200px;
    `;

    // 创建标签按钮(每个按钮有不同的主题颜色)
    const tabs = [
      { id: 'created', label: '我创建的会话', icon: '✨', color: '#8b5cf6', hoverColor: '#7c3aed' }, // 紫色
      { id: 'joined', label: '我加入的会话', icon: '🤝', color: '#3b82f6', hoverColor: '#2563eb' },  // 蓝色
    ];

    tabs.forEach((tab, index) => {
      const isActive = index === 0;
      const button = doc.createElement('button');
      
      // 使用类似annotationsHubView的按钮样式,每个按钮有独立颜色
      button.innerHTML = `
        <span style="font-size: 16px; margin-right: 5px; flex-shrink: 0;">${tab.icon}</span>
        <span style="word-break: break-word; text-align: center; line-height: 1.2;">${tab.label}</span>
      `;
      
      const bgColor = isActive ? tab.color : '#ffffff';
      const textColor = isActive ? '#ffffff' : tab.color;
      
      button.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        background: ${bgColor};
        color: ${textColor};
        border: 2px solid ${tab.color};
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
      
      // 保存初始状态和颜色
      (button as any)._isActive = isActive;
      (button as any)._tabColor = tab.color;
      (button as any)._tabIndex = index;
      
      // Hover效果
      button.addEventListener('mouseenter', () => {
        const currentActive = (button as any)._isActive;
        if (!currentActive) {
          button.style.background = tab.color;
          button.style.color = '#ffffff';
        }
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      });
      
      button.addEventListener('mouseleave', () => {
        const currentActive = (button as any)._isActive;
        if (!currentActive) {
          button.style.background = '#ffffff';
          button.style.color = tab.color;
        }
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)';
      });

      button.addEventListener('click', async () => {
        // 更新所有按钮样式
        Array.from(tabButtons.children).forEach((btn, btnIndex) => {
          const btnColor = (btn as any)._tabColor;
          (btn as HTMLElement).style.background = '#ffffff';
          (btn as HTMLElement).style.color = btnColor;
          (btn as any)._isActive = false;
        });

        // 高亮当前按钮
        button.style.background = tab.color;
        button.style.color = '#ffffff';
        (button as any)._isActive = true;

        // 加载对应内容
        switch (tab.id) {
          case 'created':
            await this.showCreatedSessionsTab(contentArea, doc);
            break;
          case 'joined':
            await this.showJoinedSessionsTab(contentArea, doc);
            break;
        }
      });

      tabButtons.appendChild(button);
    });

    tabContainer.appendChild(tabButtons);
    tabContainer.appendChild(contentArea);

    return { container: tabContainer, contentArea };
  }

  /**
   * 显示"我的会话"标签内容
   */
  private async showMySessionsTab(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    const loading = createLoadingState(doc, '加载会话列表...');
    container.appendChild(loading);

    try {
      const sessions = await this.sessionManager.getMySessions();

      container.innerHTML = '';

      if (sessions.length === 0) {
        const empty = createEmptyState(
          doc,
          '📭',
          '还没有加入任何会话',
          '快去会话广场看看吧！'
        );
        container.appendChild(empty);
        return;
      }

      const list = doc.createElement('div');
      list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: ${spacing.sm};
      `;

      for (const session of sessions) {
        const card = createSessionCard(doc, session, {
          showInviteCode: true,
          showCreator: true,
          onClick: () => this.onSessionClick(session),
        });
        list.appendChild(card);
      }

      container.appendChild(list);
    } catch (error) {
      logger.error('[SessionListView] Error loading my sessions:', error);
      container.innerHTML = '';
      const errorState = createErrorState(doc, '加载失败，请重试');
      container.appendChild(errorState);
    }
  }

  /**
   * 显示"我创建的"标签内容
   */
  private async showCreatedSessionsTab(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    const loading = createLoadingState(doc, '加载创建的会话...');
    container.appendChild(loading);

    try {
      const sessions = await this.sessionManager.getMyCreatedSessions();

      container.innerHTML = '';

      if (sessions.length === 0) {
        const empty = createEmptyState(
          doc,
          '✨',
          '还没有创建过会话',
          '创建一个新会话开始吧！'
        );
        container.appendChild(empty);
        return;
      }

      const list = doc.createElement('div');
      list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: ${spacing.sm};
      `;

      for (const session of sessions) {
        const card = createSessionCard(doc, session, {
          showInviteCode: true,
          showMemberCount: true,
          showDeleteButton: true,
          onClick: () => this.onSessionClick(session),
          onDeleteClick: async () => {
            try {
              await this.sessionManager.deleteSession(session.id);
            } catch (error) {
              logger.error('[SessionListView] Error deleting session:', error);
              // 如果是404错误(会话不存在),当作成功处理
              const errorMsg = error instanceof Error ? error.message : String(error);
              if (!errorMsg.includes('404') && !errorMsg.includes('不存在')) {
                ServicesAdapter.alert('删除失败', errorMsg);
              }
            } finally {
              // 无论成功还是失败,都重新加载列表以更新UI
              await this.showCreatedSessionsTab(container, doc);
            }
          },
        });
        list.appendChild(card);
      }

      container.appendChild(list);
    } catch (error) {
      logger.error('[SessionListView] Error loading created sessions:', error);
      container.innerHTML = '';
      const errorState = createErrorState(doc, '加载失败，请重试');
      container.appendChild(errorState);
    }
  }

  /**
   * 显示"我加入的"标签内容
   */
  private async showJoinedSessionsTab(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    const loading = createLoadingState(doc, '加载加入的会话...');
    container.appendChild(loading);

    try {
      const sessions = await this.sessionManager.getMyJoinedSessions();

      container.innerHTML = '';

      if (sessions.length === 0) {
        const empty = createEmptyState(
          doc,
          '🤝',
          '还没有加入其他人的会话',
          '通过邀请码或会话广场加入吧！'
        );
        container.appendChild(empty);
        return;
      }

      const list = doc.createElement('div');
      list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: ${spacing.sm};
      `;

      for (const session of sessions) {
        const card = createSessionCard(doc, session, {
          showInviteCode: true,
          showMemberCount: true,
          showCreator: true,
          onClick: () => this.onSessionClick(session),
        });
        list.appendChild(card);
      }

      container.appendChild(list);
    } catch (error) {
      logger.error('[SessionListView] Error loading joined sessions:', error);
      container.innerHTML = '';
      const errorState = createErrorState(doc, '加载失败，请重试');
      container.appendChild(errorState);
    }
  }
}

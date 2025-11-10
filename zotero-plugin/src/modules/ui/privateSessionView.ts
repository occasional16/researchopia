/**
 * 私密会话视图
 * 管理两个三级按钮/页面:
 * 1. 创建私密会话
 * 2. 加入私密会话
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager } from '../readingSessionManager';
import type { BaseViewContext } from "./types";
import { createBackButton } from './uiHelpers';
import { colors, spacing, containerPadding } from './styles';
import { SessionCreateFormView } from './sessionCreateFormView';
import { SessionJoinPrivateView } from './sessionJoinPrivateView';

type SubViewMode = 'create' | 'join';

export class PrivateSessionView {
  private currentSubView: SubViewMode | null = null; // 初始不显示子视图,只显示按钮

  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext,
    private onBack: () => Promise<void>,
    private onSessionCreated: (sessionType: 'public' | 'private') => Promise<void>,
    private onSessionJoined: () => Promise<void>
  ) {
    logger.log("[PrivateSessionView] 🔒 Initializing...");
  }

  /**
   * 渲染私密会话视图
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[PrivateSessionView] 🎨 Rendering private session view...");
      
      container.innerHTML = '';
      
      // 主容器
      const mainContainer = doc.createElement('div');
      mainContainer.style.cssText = `
        position: relative;
        display: flex;
        flex-direction: column;
        gap: ${spacing.md};
        padding: 44px 8px 16px 8px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
      `;
      
      // 返回按钮
      const backButton = this.createCustomBackButton(doc);
      mainContainer.appendChild(backButton);
      
      // 标题
      const title = doc.createElement('h3');
      title.textContent = '私密会话';
      title.style.cssText = `
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      `;
      mainContainer.appendChild(title);
      
      // 内容区域
      const contentArea = doc.createElement('div');
      contentArea.id = 'private-session-content';
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
      mainContainer.appendChild(contentArea);
      
      container.appendChild(mainContainer);
      
      // 根据当前子视图渲染内容
      if (this.currentSubView === null) {
        // 显示两个操作按钮
        await this.renderActionButtons(contentArea, doc);
      } else {
        // 显示对应的子视图
        await this.renderSubView(this.currentSubView, contentArea, doc);
      }
      
      logger.log("[PrivateSessionView] ✅ Private session view rendered");
    } catch (error) {
      logger.error("[PrivateSessionView] Error rendering:", error);
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
   * 创建自定义返回按钮
   */
  private createCustomBackButton(doc: Document): HTMLButtonElement {
    const button = doc.createElement('button');
    button.innerHTML = '← 返回';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      left: 12px;
      padding: 6px 12px;
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      z-index: 100;
      pointer-events: auto;
    `;
    
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e5e7eb';
      button.style.borderColor = '#9ca3af';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.background = '#f3f4f6';
      button.style.borderColor = '#d1d5db';
    });
    
    button.addEventListener('click', async () => {
      logger.log('[PrivateSessionView] 🔙 Back button clicked');
      
      // 如果在子视图中,返回到按钮选择页面
      if (this.currentSubView !== null) {
        this.currentSubView = null;
        await this.render(
          button.ownerDocument.getElementById('private-session-content')?.parentElement?.parentElement as HTMLElement,
          button.ownerDocument
        );
      } else {
        // 否则返回到主页面
        await this.onBack();
      }
    });
    
    return button;
  }

  /**
   * 渲染操作按钮
   */
  private async renderActionButtons(container: HTMLElement, doc: Document): Promise<void> {
    // 提示文字
    const hint = doc.createElement('p');
    hint.textContent = '选择操作:';
    hint.style.cssText = `
      margin: 0 0 ${spacing.md} 0;
      font-size: 14px;
      color: ${colors.gray};
      text-align: center;
    `;
    container.appendChild(hint);

    // 按钮容器
    const buttonsContainer = doc.createElement('div');
    buttonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${spacing.md};
    `;

    // 创建私密会话按钮
    const createButton = this.createActionButton(
      doc,
      '✨ 创建私密会话',
      '创建需要邀请码才能加入的会话',
      '#198754',
      async () => await this.handleCreatePrivateSession(doc)
    );

    // 加入私密会话按钮
    const joinButton = this.createActionButton(
      doc,
      '🔑 加入私密会话',
      '使用邀请码加入私密会话',
      '#fd7e14',
      () => this.switchToSubView('join')
    );

    buttonsContainer.appendChild(createButton);
    buttonsContainer.appendChild(joinButton);
    container.appendChild(buttonsContainer);
  }

  /**
   * 创建操作按钮
   */
  private createActionButton(
    doc: Document,
    title: string,
    description: string,
    color: string,
    onClick: () => void | Promise<void>
  ): HTMLElement {
    const button = doc.createElement('div');
    button.style.cssText = `
      padding: 20px;
      background: white;
      border: 2px solid ${color};
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    const titleEl = doc.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `
      font-size: 15px;
      font-weight: 600;
      color: ${color};
      margin-bottom: 8px;
    `;

    const descEl = doc.createElement('div');
    descEl.textContent = description;
    descEl.style.cssText = `
      font-size: 12px;
      color: ${colors.gray};
      line-height: 1.4;
    `;

    button.appendChild(titleEl);
    button.appendChild(descEl);

    button.addEventListener('mouseenter', () => {
      button.style.background = color;
      button.style.transform = 'translateY(-4px)';
      button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
      titleEl.style.color = 'white';
      descEl.style.color = 'rgba(255,255,255,0.9)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'white';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      titleEl.style.color = color;
      descEl.style.color = colors.gray;
    });

    button.addEventListener('click', onClick);

    return button;
  }

  /**
   * 切换子视图
   */
  private async switchToSubView(mode: SubViewMode): Promise<void> {
    this.currentSubView = mode;
    
    // 重新渲染整个视图
    const panels = this.context.getPanelsForCurrentItem();
    if (panels && panels.length > 0 && panels[0].contentSection) {
      const container = panels[0].contentSection.firstElementChild as HTMLElement;
      if (container) {
        await this.render(container, container.ownerDocument);
      }
    }
  }

  /**
   * 渲染子视图内容
   */
  private async renderSubView(mode: SubViewMode, contentArea: HTMLElement, doc: Document): Promise<void> {
    contentArea.innerHTML = '';
    
    try {
      switch (mode) {
        case 'create':
          logger.log("[PrivateSessionView] Rendering create session form");
          const createFormView = new SessionCreateFormView(
            this.sessionManager,
            this.context,
            async () => {
              // 返回到按钮选择页面
              this.currentSubView = null;
              await this.render(contentArea.parentElement as HTMLElement, doc);
            },
            async (sessionType: 'public' | 'private') => {
              // 会话创建成功,通知父组件
              await this.onSessionCreated(sessionType);
            }
          );
          // 不需要返回按钮,因为PrivateSessionView已经有了
          // 直接渲染表单内容,但需要修改SessionCreateFormView以支持只渲染私密会话选项
          await this.renderPrivateCreateForm(contentArea, doc);
          break;
          
        case 'join':
          logger.log("[PrivateSessionView] Rendering join private session");
          const joinPrivateView = new SessionJoinPrivateView(
            this.sessionManager,
            async () => {
              // 返回到按钮选择页面
              this.currentSubView = null;
              await this.render(contentArea.parentElement as HTMLElement, doc);
            },
            this.onSessionJoined,
            (msg, type) => this.context.showMessage(msg, type)
          );
          // 不需要返回按钮,直接渲染内容
          await this.renderJoinPrivateContent(contentArea, doc, joinPrivateView);
          break;
      }
    } catch (error) {
      logger.error("[PrivateSessionView] Error rendering sub view:", error);
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
   * 渲染私密会话创建表单(只显示私密会话选项)
   */
  private async renderPrivateCreateForm(container: HTMLElement, doc: Document): Promise<void> {
    const createFormView = new SessionCreateFormView(
      this.sessionManager,
      this.context,
      async () => {
        // 这个返回不会被调用,因为我们使用PrivateSessionView的返回按钮
      },
      async (sessionType: 'public' | 'private') => {
        await this.onSessionCreated(sessionType);
      }
    );

    // 创建一个临时容器来渲染SessionCreateFormView
    const tempContainer = doc.createElement('div');
    await createFormView.render(tempContainer, doc);

    // 提取内容(跳过返回按钮和标题)
    // SessionCreateFormView的结构: 返回按钮 -> 标题 -> 私密会话选项
    // 我们只需要私密会话的部分
    container.innerHTML = `
      <div style="padding: ${spacing.lg};">
        <p style="margin: 0 0 ${spacing.lg} 0; font-size: 14px; color: ${colors.gray}; text-align: center;">
          填写会话信息以创建私密会话
        </p>
      </div>
    `;

    // 创建私密会话按钮
    const createButton = doc.createElement('button');
    createButton.innerHTML = '🔒 创建私密会话';
    createButton.style.cssText = `
      width: 100%;
      padding: 16px;
      background: #198754;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(25, 135, 84, 0.3);
    `;

    createButton.addEventListener('mouseenter', () => {
      createButton.style.transform = 'translateY(-2px)';
      createButton.style.boxShadow = '0 4px 12px rgba(25, 135, 84, 0.4)';
    });

    createButton.addEventListener('mouseleave', () => {
      createButton.style.transform = 'translateY(0)';
      createButton.style.boxShadow = '0 2px 8px rgba(25, 135, 84, 0.3)';
    });

    createButton.addEventListener('click', async () => {
      try {
        const item = this.context.getCurrentItem();
        if (!item) {
          this.context.showMessage('请先选择一篇文献', 'warning');
          return;
        }

        const doi = item.getField('DOI');
        const title = item.getField('title');

        if (!doi) {
          this.context.showMessage('当前文献没有DOI，无法创建共读会话', 'warning');
          return;
        }

        const session = await this.sessionManager.createSession(doi, title, 'private', 10);
        this.context.showMessage(
          `私密会话已创建！邀请码: ${session.inviteCode}`,
          'info'
        );
        await this.onSessionCreated('private');
      } catch (error) {
        logger.error('[PrivateSessionView] Error creating session:', error);
        this.context.showMessage(
          `创建失败: ${error instanceof Error ? error.message : '未知错误'}`,
          'error'
        );
      }
    });

    container.appendChild(createButton);
  }

  /**
   * 渲染加入私密会话内容
   */
  private async renderJoinPrivateContent(
    container: HTMLElement,
    doc: Document,
    joinPrivateView: SessionJoinPrivateView
  ): Promise<void> {
    // 创建一个临时容器
    const tempContainer = doc.createElement('div');
    await joinPrivateView.render(tempContainer, doc);

    // 提取内容(跳过返回按钮)
    // SessionJoinPrivateView的结构: 返回按钮 -> 标题 -> 内容
    // 我们跳过返回按钮和标题,只保留内容
    const content = tempContainer.querySelector('[style*="max-width: 400px"]');
    if (content) {
      container.appendChild(content);
    } else {
      // 如果结构不匹配,直接添加整个内容
      container.appendChild(tempContainer);
    }
  }

  /**
   * 处理创建私密会话
   */
  private async handleCreatePrivateSession(doc: Document): Promise<void> {
    try {
      logger.log('[PrivateSessionView] 📝 Handling create private session...');
      
      // 获取当前选中的论文
      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        this.context.showMessage('请先选择一篇论文', 'error');
        return;
      }

      const doi = currentItem.getField('DOI') as string;
      const title = currentItem.getField('title') as string;

      if (!doi) {
        this.context.showMessage('当前论文没有DOI,无法创建会话', 'error');
        return;
      }

      // 使用ServicesAdapter确认对话框
      const { ServicesAdapter } = await import('../../adapters');
      const confirmed = ServicesAdapter.confirm(
        '创建私密会话',
        `确定为论文"${title}"创建私密会话吗?\n\n⚠️ 注意:\n• 创建后将生成邀请码,只有持有邀请码的用户才能加入\n• 私密会话将在2天后自动失效并删除`
      );

      if (!confirmed) {
        return;
      }

      this.context.showMessage('正在创建私密会话...', 'info');

      // 创建私密会话
      const result = await this.sessionManager.createSession(
        doi,
        title,
        'private',
        10
      );

      logger.log('[PrivateSessionView] ✅ Private session created:', result.session.id);
      this.context.showMessage(`私密会话创建成功!\n邀请码: ${result.inviteCode}`, 'info');

      // 调用onSessionCreated回调(会自动跳转到会话管理)
      await this.onSessionCreated('private');

    } catch (error) {
      logger.error('[PrivateSessionView] Error creating private session:', error);
      this.context.showMessage('创建私密会话失败,请重试', 'error');
    }
  }
}

/**
 * 公共会话视图
 * 管理两个三级页面:
 * 1. 当前会话(默认) - 显示当前选中论文的公共会话卡片
 * 2. 会话广场 - 显示所有公共真实会话
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager, ReadingSession } from '../readingSessionManager';
import type { BaseViewContext } from "./types";
import { createBackButton } from './uiHelpers';
import { colors, spacing, containerPadding } from './styles';
import { CurrentSessionView } from './currentSessionView';
import { SessionPlazaView } from './sessionPlazaView';

type SubViewMode = 'current' | 'plaza';

export class PublicSessionView {
  private currentSubView: SubViewMode = 'current'; // 默认显示当前会话
  private currentSessionView: CurrentSessionView;
  private sessionPlazaView: SessionPlazaView;

  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext,
    private onBack: () => Promise<void>,
    private onSessionJoin: (session: ReadingSession) => Promise<void>
  ) {
    logger.log("[PublicSessionView] 📚 Initializing...");
    
    // 初始化子视图
    this.currentSessionView = new CurrentSessionView(
      sessionManager,
      context,
      async () => {
        // 会话创建后的回调
        await this.onSessionJoin(this.sessionManager.getCurrentSession()!);
      }
    );

    this.sessionPlazaView = new SessionPlazaView(
      sessionManager,
      async () => {
        // 会话广场的返回按钮不应该触发,因为它是子页面
        // 这里留空或者切换回当前会话
        await this.switchToSubView('current');
      },
      this.onSessionJoin
    );
  }

  /**
   * 渲染公共会话视图
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[PublicSessionView] 🎨 Rendering public session view...");
      
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
      title.textContent = '公共会话';
      title.style.cssText = `
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      `;
      mainContainer.appendChild(title);
      
      // 两个三级按钮
      const subButtonsContainer = doc.createElement('div');
      subButtonsContainer.style.cssText = `
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      `;
      
      // 当前会话按钮
      const currentButton = this.createSubButton(
        doc,
        '当前会话',
        '📖',
        '#667eea',
        '#5a67d8',
        this.currentSubView === 'current',
        () => this.switchToSubView('current')
      );
      
      // 会话广场按钮
      const plazaButton = this.createSubButton(
        doc,
        '会话广场',
        '🌐',
        '#0d6efd',
        '#0b5ed7',
        this.currentSubView === 'plaza',
        () => this.switchToSubView('plaza')
      );
      
      subButtonsContainer.appendChild(currentButton);
      subButtonsContainer.appendChild(plazaButton);
      mainContainer.appendChild(subButtonsContainer);
      
      // 内容区域
      const contentArea = doc.createElement('div');
      contentArea.id = 'public-session-content';
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
      
      // 渲染当前选中的子视图
      await this.renderSubView(this.currentSubView, contentArea, doc);
      
      logger.log("[PublicSessionView] ✅ Public session view rendered");
    } catch (error) {
      logger.error("[PublicSessionView] Error rendering:", error);
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
      logger.log('[PublicSessionView] 🔙 Back button clicked');
      await this.onBack();
    });
    
    return button;
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
  private async switchToSubView(mode: SubViewMode): Promise<void> {
    if (this.currentSubView === mode) {
      return;
    }
    
    this.currentSubView = mode;
    
    // 重新渲染整个视图以更新按钮状态
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
        case 'current':
          logger.log("[PublicSessionView] Rendering current session");
          await this.currentSessionView.render(contentArea, doc);
          break;
          
        case 'plaza':
          logger.log("[PublicSessionView] Rendering session plaza");
          // 会话广场不显示返回按钮,因为它是公共会话视图的子页面
          await this.sessionPlazaView.render(contentArea, doc, false);
          break;
      }
    } catch (error) {
      logger.error("[PublicSessionView] Error rendering sub view:", error);
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
}

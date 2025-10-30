/**
 * 当前会话中心视图(三级页面)
 * 在进入某个会话后,管理两个三级页面:
 * - 当前会话(默认)
 * - 会话纪要
 */

import { logger } from "../../utils/logger";
import type { BaseViewContext } from "./types";
import { SessionMinutesView } from "./sessionMinutesView";
import { containerPadding } from "./styles";

type SubViewMode = 'current' | 'minutes';

export class CurrentSessionHubView {
  private currentSubView: SubViewMode = 'current'; // 默认显示当前会话
  private sessionMinutesView: SessionMinutesView;
  
  // 用于存储当前会话的渲染函数
  private renderCurrentSessionFn: ((container: HTMLElement) => Promise<void>) | null = null;
  // 用于存储返回函数
  private onBackFn: (() => Promise<void>) | null = null;

  constructor(private readonly context: BaseViewContext) {
    logger.log("[CurrentSessionHubView] 📋 Initializing...");
    this.sessionMinutesView = new SessionMinutesView(context);
  }

  /**
   * 设置当前会话的渲染函数和返回函数
   */
  public setRenderFunctions(
    renderCurrentSession: (container: HTMLElement) => Promise<void>,
    onBack: () => Promise<void>
  ): void {
    this.renderCurrentSessionFn = renderCurrentSession;
    this.onBackFn = onBack;
  }

  /**
   * 渲染三级页面(显示两个按钮:当前会话、会话纪要)
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[CurrentSessionHubView] 🎨 Rendering hub view...");
      
      container.innerHTML = '';
      
      // 创建主容器(8px左右padding优化窄窗口,44px顶部留给返回按钮)
      const mainContainer = doc.createElement('div');
      mainContainer.style.cssText = `
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 44px 8px 16px 8px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
        overflow-y: auto;
      `;
      
      // 返回按钮(左上角)
      const backButton = this.createBackButton(doc);
      mainContainer.appendChild(backButton);
      logger.log('[CurrentSessionHubView] ✅ Back button added to mainContainer');
      
      // 标题
      const title = doc.createElement('h3');
      title.textContent = '当前会话';
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
        '#f59e0b',
        '#d97706',
        this.currentSubView === 'current',
        () => this.switchToSubView('current', container, doc)
      );
      
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
      
      subButtonsContainer.appendChild(currentButton);
      subButtonsContainer.appendChild(minutesButton);
      mainContainer.appendChild(subButtonsContainer);
      
      // 内容区域
      const contentArea = doc.createElement('div');
      contentArea.id = 'current-session-hub-content';
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
      await this.renderSubView(this.currentSubView, contentArea);
      
      logger.log("[CurrentSessionHubView] ✅ Hub rendered");
      logger.log("[CurrentSessionHubView] onBackFn is set:", !!this.onBackFn);
    } catch (error) {
      logger.error("[CurrentSessionHubView] Error rendering:", error);
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
   * 创建返回按钮
   */
  private createBackButton(doc: Document): HTMLButtonElement {
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
      logger.log('[CurrentSessionHubView] 🔙 Back button clicked');
      if (this.onBackFn) {
        logger.log('[CurrentSessionHubView] Executing onBackFn...');
        try {
          await this.onBackFn();
          logger.log('[CurrentSessionHubView] ✅ onBackFn executed successfully');
        } catch (error) {
          logger.error('[CurrentSessionHubView] ❌ onBackFn failed:', error);
        }
      } else {
        logger.warn('[CurrentSessionHubView] ⚠️ onBackFn is not set!');
      }
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
  private async switchToSubView(mode: SubViewMode, container: HTMLElement, doc: Document): Promise<void> {
    if (this.currentSubView === mode) {
      return;
    }
    
    this.currentSubView = mode;
    await this.render(container, doc);
  }

  /**
   * 渲染子视图内容
   */
  private async renderSubView(mode: SubViewMode, contentArea: HTMLElement): Promise<void> {
    contentArea.innerHTML = '';
    
    try {
      switch (mode) {
        case 'current':
          logger.log("[CurrentSessionHubView] Rendering current session content");
          if (this.renderCurrentSessionFn) {
            await this.renderCurrentSessionFn(contentArea);
          } else {
            contentArea.innerHTML = '<div style="padding: 20px; color: #666;">未设置渲染函数</div>';
          }
          break;
          
        case 'minutes':
          logger.log("[CurrentSessionHubView] Rendering session minutes");
          await this.sessionMinutesView.render(contentArea);
          break;
      }
    } catch (error) {
      logger.error("[CurrentSessionHubView] Error rendering sub view:", error);
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

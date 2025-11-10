/**
 * 文献共读会话视图 - 重构版
 * 职责：作为主控制器，协调各个子视图的渲染和导航
 */

import { logger } from "../../utils/logger";
import { ReadingSessionManager } from "../readingSessionManager";
import type { BaseViewContext } from "./types";
import { containerPadding } from "./styles";
import { CurrentSessionHubView } from "./currentSessionHubView";
import { CurrentSessionView } from "./currentSessionView";
import { PublicSessionView } from "./publicSessionView";
import { PrivateSessionView } from "./privateSessionView";
import { SessionListView } from "./sessionListView";

export class ReadingSessionView {
  private sessionManager = ReadingSessionManager.getInstance();
  private currentSessionHubView: CurrentSessionHubView;
  private currentViewLevel: 'list' | 'hub' = 'list';

  constructor(private readonly context: BaseViewContext) {
    logger.log("[ReadingSessionView] 📚 Initializing...");
    this.currentSessionHubView = new CurrentSessionHubView(context);
  }

  /**
   * 初始化视图
   */
  public async initialize(): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🔄 Initializing view...");
      await this.render();
    } catch (error) {
      logger.error("[ReadingSessionView] Error initializing:", error);
    }
  }

  /**
   * 渲染主界面
   */
  public async render(): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎨 Rendering view...");
      
      // 检查功能是否被禁用
      const { VersionChecker } = await import('../versionChecker');
      const versionChecker = VersionChecker.getInstance();
      
      if (versionChecker.isFeatureDisabled('reading-session')) {
        logger.warn("[ReadingSessionView] ⚠️ Feature disabled by version control");
        this.renderFeatureDisabled('reading-session');
        return;
      }
      
      const panels = this.context.getPanelsForCurrentItem();
      if (!panels || panels.length === 0) {
        logger.warn("[ReadingSessionView] No panels found");
        return;
      }
      
      for (const panel of panels) {
        if (!panel.contentSection) continue;
        
        const doc = panel.contentSection.ownerDocument;
        panel.contentSection.innerHTML = '';
        
        logger.log('[ReadingSessionView] In session:', this.sessionManager.isInSession(), 'View level:', this.currentViewLevel);
        
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
        
        // 根据是否在会话中以及视图层级显示不同内容
        if (this.sessionManager.isInSession() && this.currentViewLevel === 'hub') {
          logger.log('[ReadingSessionView] Rendering current session hub');
          await this.renderCurrentSessionHub(container, doc);
        } else {
          logger.log('[ReadingSessionView] Rendering session list');
          await this.renderSessionList(container, doc);
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error rendering:", error);
      this.context.showMessage('渲染失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  /**
   * 渲染功能禁用提示
   */
  private renderFeatureDisabled(featureName: 'reading-session'): void {
    const panels = this.context.getPanelsForCurrentItem();
    if (!panels || panels.length === 0) return;

    for (const panel of panels) {
      if (!panel.contentSection) continue;

      const doc = panel.contentSection.ownerDocument;
      const { VersionChecker } = require('../versionChecker');
      const versionChecker = VersionChecker.getInstance();
      const message = versionChecker.getDisabledFeatureMessage(featureName);

      panel.contentSection.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: #6b7280;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
          <div style="font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">
            功能不可用
          </div>
          <div style="font-size: 14px; line-height: 1.6; white-space: pre-line; color: #4b5563;">
            ${message}
          </div>
        </div>
      `;
    }
  }

  /**
   * 在指定容器中渲染内容
   */
  public async renderInContainer(container: HTMLElement): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎨 Rendering in container...");
      
      const doc = container.ownerDocument;
      container.innerHTML = '';
      
      const contentContainer = doc.createElement('div');
      contentContainer.style.cssText = `
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
      container.appendChild(contentContainer);
      
      if (this.sessionManager.isInSession() && this.currentViewLevel === 'hub') {
        await this.renderCurrentSessionHub(contentContainer, doc);
      } else {
        await this.renderSessionList(contentContainer, doc);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error rendering in container:", error);
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
   * 渲染当前会话Hub（三级页面）
   */
  private async renderCurrentSessionHub(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎨 Rendering current session hub...");
      
      // 设置返回按钮和内容渲染函数
      this.currentSessionHubView.setRenderFunctions(
        // 渲染当前会话内容 - 委托给CurrentSessionTabView
        async (contentContainer) => {
          const { CurrentSessionTabView } = await import('./currentSessionTabView');
          const tabView = new CurrentSessionTabView(this.sessionManager, this.context);
          await tabView.render(contentContainer, doc);
        },
        // 返回按钮处理
        async () => {
          logger.log('[ReadingSessionView] 🔙 Back button clicked');
          this.currentViewLevel = 'list';
          await this.render();
        }
      );
      
      await this.currentSessionHubView.render(container, doc);
      logger.log("[ReadingSessionView] ✅ Current session hub rendered");
    } catch (error) {
      logger.error("[ReadingSessionView] Error rendering current session hub:", error);
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
   * 渲染会话列表（二级页面）
   * 包含3个主按钮：公共会话、私密会话、会话管理
   */
  private async renderSessionList(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    container.style.padding = containerPadding.view;

    // 标题
    const title = doc.createElement('h2');
    title.textContent = '文献共读';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    `;
    container.appendChild(title);

    // 主按钮组（3个按钮，2列布局）
    const mainButtonsContainer = doc.createElement('div');
    mainButtonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    `;

    // 公共会话按钮
    const publicButton = this.createMainButton(doc, '公共会话', '#667eea');
    publicButton.addEventListener('click', () => {
      this.showPublicSessionView(container, doc);
    });

    // 私密会话按钮
    const privateButton = this.createMainButton(doc, '私密会话', '#198754');
    privateButton.addEventListener('click', () => {
      this.showPrivateSessionView(container, doc);
    });

    // 会话管理按钮（占满一行）
    const manageButton = this.createMainButton(doc, '会话管理', '#6c757d');
    manageButton.style.gridColumn = '1 / -1';
    manageButton.addEventListener('click', () => {
      this.showSessionManagement(container, doc);
    });

    mainButtonsContainer.appendChild(publicButton);
    mainButtonsContainer.appendChild(privateButton);
    mainButtonsContainer.appendChild(manageButton);
    container.appendChild(mainButtonsContainer);

    // 默认预览：显示"公共会话-当前会话"页面
    const previewContainer = doc.createElement('div');
    previewContainer.id = 'default-preview-content';
    previewContainer.style.cssText = 'margin-top: 16px;';
    container.appendChild(previewContainer);
    
    const currentSessionView = new CurrentSessionView(
      this.sessionManager,
      this.context,
      async () => {
        // 会话创建后，进入会话hub
        this.currentViewLevel = 'hub';
        await this.render();
      }
    );
    await currentSessionView.render(previewContainer, doc);
  }

  /**
   * 创建主按钮
   */
  private createMainButton(doc: Document, text: string, bgColor: string): HTMLButtonElement {
    const button = doc.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      flex: 1 1 auto;
      min-width: 0;
      padding: 14px 8px;
      background: ${bgColor};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: normal;
      word-break: keep-all;
      overflow-wrap: break-word;
      box-sizing: border-box;
      max-width: 100%;
      line-height: 1.3;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });
    return button;
  }

  /**
   * 显示公共会话视图
   */
  private async showPublicSessionView(container: HTMLElement, doc: Document): Promise<void> {
    const publicView = new PublicSessionView(
      this.sessionManager,
      this.context,
      async () => await this.render(),
      async (session) => {
        try {
          if (session.id) {
            await this.sessionManager.joinSessionByInviteCode(session.invite_code || '');
          }
          this.currentViewLevel = 'hub';
          this.context.showMessage('已加入会话', 'info');
          await this.render();
        } catch (error) {
          logger.error('[ReadingSessionView] Error joining session:', error);
          this.context.showMessage('加入会话失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
      }
    );
    await publicView.render(container, doc);
  }

  /**
   * 显示私密会话视图
   */
  private async showPrivateSessionView(container: HTMLElement, doc: Document): Promise<void> {
    const privateView = new PrivateSessionView(
      this.sessionManager,
      this.context,
      async () => await this.render(),
      async () => {
        // 会话创建后，进入会话hub
        this.currentViewLevel = 'hub';
        await this.render();
      },
      async () => {
        // 会话加入后，进入会话hub
        this.currentViewLevel = 'hub';
        await this.render();
      }
    );
    await privateView.render(container, doc);
  }

  /**
   * 显示会话管理视图
   */
  private async showSessionManagement(container: HTMLElement, doc: Document): Promise<void> {
    const sessionListView = new SessionListView(
      this.sessionManager,
      () => this.render(),
      (session) => {
        // 点击会话卡片后，加入并进入hub
        this.sessionManager.joinSessionByInviteCode(session.invite_code || '').then(() => {
          this.currentViewLevel = 'hub';
          this.render();
        }).catch(error => {
          logger.error('[ReadingSessionView] Error joining session:', error);
          this.context.showMessage('加入会话失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        });
      },
      async () => {
        // 会话删除后，刷新列表
        await this.render();
      }
    );
    await sessionListView.render(container, doc);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[ReadingSessionView] 🧹 Cleaning up...");
  }
}

/**
 * 标注中心视图
 * 管理"共享标注"主按钮下的次级页面:
 * - 共享标注(查看其他用户的标注)
 * - 管理标注(管理自己的标注)
 */

import { logger } from "../../utils/logger";
import type { BaseViewContext } from "./types";
import { SharedAnnotationsView } from "./sharedAnnotationsView";
import { MyAnnotationsView } from "./myAnnotationsView";
import { containerPadding } from "./styles";

type SubViewMode = 'shared' | 'manage';

export class AnnotationsHubView {
  private currentSubView: SubViewMode = 'shared'; // 默认显示共享标注
  private sharedAnnotationsView: SharedAnnotationsView;
  private myAnnotationsView: MyAnnotationsView;

  constructor(private readonly context: BaseViewContext) {
    logger.log("[AnnotationsHubView] 📋 Initializing...");
    this.sharedAnnotationsView = new SharedAnnotationsView(context);
    this.myAnnotationsView = new MyAnnotationsView(context);
  }

  /**
   * 渲染主界面(显示次级按钮选择)
   */
  public async render(): Promise<void> {
    try {
      logger.log("[AnnotationsHubView] 🎨 Rendering hub view...");
      
      const panels = this.context.getPanelsForCurrentItem();
      if (!panels || panels.length === 0) {
        logger.warn("[AnnotationsHubView] No panels found");
        return;
      }
      
      for (const panel of panels) {
        if (!panel.contentSection) continue;
        
        const doc = panel.contentSection.ownerDocument;
        panel.contentSection.innerHTML = '';
        
        // 创建容器
        const container = doc.createElement('div');
        container.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 16px;
        `;
        panel.contentSection.appendChild(container);
        
        // 创建标题
        const title = doc.createElement('h2');
        title.textContent = '标注中心';
        title.style.cssText = `
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
        `;
        container.appendChild(title);
        
        // 创建次级按钮区域
        const subButtonsContainer = doc.createElement('div');
        subButtonsContainer.style.cssText = `
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        `;
        
        // 共享标注按钮
        const sharedButton = this.createSubButton(
          doc,
          '共享标注',
          '👥',
          '#8b5cf6',
          '#7c3aed',
          this.currentSubView === 'shared',
          () => this.switchToSubView('shared', container, doc)
        );
        
        // 管理标注按钮
        const manageButton = this.createSubButton(
          doc,
          '管理标注',
          '🔖',
          '#3b82f6',
          '#2563eb',
          this.currentSubView === 'manage',
          () => this.switchToSubView('manage', container, doc)
        );
        
        subButtonsContainer.appendChild(sharedButton);
        subButtonsContainer.appendChild(manageButton);
        container.appendChild(subButtonsContainer);
        
        // 内容区域
        const contentArea = doc.createElement('div');
        contentArea.id = 'annotations-hub-content';
        contentArea.style.cssText = `
          flex: 1;
          display: flex;
          flex-direction: column;
        `;
        container.appendChild(contentArea);
        
        // 默认显示当前选中的视图
        await this.renderSubView(this.currentSubView, contentArea);
      }
    } catch (error) {
      logger.error("[AnnotationsHubView] Error rendering:", error);
      this.context.showMessage('渲染失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  /**
   * 创建次级按钮(比主按钮小)
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
   * 切换到指定的子视图
   */
  private async switchToSubView(mode: SubViewMode, container: HTMLElement, doc: Document): Promise<void> {
    if (this.currentSubView === mode) {
      return; // 已经是当前视图,不需要切换
    }
    
    this.currentSubView = mode;
    
    // 重新渲染整个hub视图以更新按钮状态
    await this.render();
  }

  /**
   * 渲染子视图内容
   */
  private async renderSubView(mode: SubViewMode, contentArea: HTMLElement): Promise<void> {
    contentArea.innerHTML = '';
    
    try {
      switch (mode) {
        case 'shared':
          logger.log("[AnnotationsHubView] Rendering shared annotations view");
          await this.sharedAnnotationsView.render(contentArea);
          break;
          
        case 'manage':
          logger.log("[AnnotationsHubView] Rendering manage annotations view");
          await this.myAnnotationsView.render(contentArea);
          break;
      }
    } catch (error) {
      logger.error("[AnnotationsHubView] Error rendering sub view:", error);
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
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[AnnotationsHubView] 🧹 Cleaning up...");
    this.sharedAnnotationsView.cleanup();
    // myAnnotationsView 不需要cleanup
  }
}

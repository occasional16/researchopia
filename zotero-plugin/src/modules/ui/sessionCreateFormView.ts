/**
 * 会话创建表单视图
 * 显示会话类型选择和创建表单
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager } from '../readingSessionManager';
import type { BaseViewContext } from "./types";
import { createBackButton } from './uiHelpers';
import { colors, spacing, containerPadding } from './styles';

export class SessionCreateFormView {
  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext,
    private onBack: () => void,
    private onCreated: (sessionType: 'public' | 'private') => Promise<void>
  ) {}

  /**
   * 渲染创建会话选项
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';
    container.style.cssText = `padding: ${containerPadding.view}; width: 100%; box-sizing: border-box;`;

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: ${spacing.xxl};
    `;

    // 返回按钮
    const backButton = createBackButton(doc, this.onBack);
    pageContainer.appendChild(backButton);

    // 标题
    const title = doc.createElement('h2');
    title.textContent = '创建会话';
    title.style.cssText = `
      margin: 0 0 ${spacing.lg} 0;
      font-size: 20px;
      font-weight: 700;
      color: ${colors.dark};
      text-align: center;
    `;
    pageContainer.appendChild(title);

    // 只保留私密会话选项(公共会话通过点击预览卡片自动创建)
    const optionsContainer = doc.createElement('div');
    optionsContainer.style.cssText = `
      display: flex;
      justify-content: center;
      width: 100%;
    `;

    // 创建私密会话选项(单个,居中显示)
    const privateOption = this.createSessionTypeOption(
      doc,
      '私密会话',
      '需要邀请码才能加入',
      '�',
      '#198754' // 使用绿色
    );
    privateOption.style.maxWidth = '400px'; // 限制最大宽度
    privateOption.addEventListener('click', async () => {
      await this.createSessionWithType('private');
    });

    optionsContainer.appendChild(privateOption);
    pageContainer.appendChild(optionsContainer);
    container.appendChild(pageContainer);
  }

  /**
   * 创建会话类型选项卡片
   */
  private createSessionTypeOption(
    doc: Document,
    title: string,
    description: string,
    icon: string,
    color: string
  ): HTMLElement {
    const card = doc.createElement('div');
    card.style.cssText = `
      background: white;
      border: 2px solid ${color};
      border-radius: 12px;
      padding: ${spacing.lg};
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
      min-height: 160px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;

    // 初始文本颜色
    const iconEl = doc.createElement('div');
    iconEl.textContent = icon;
    iconEl.style.cssText = `font-size: 48px; margin-bottom: ${spacing.md};`;

    const titleEl = doc.createElement('div');
    titleEl.textContent = title;
    titleEl.style.cssText = `font-weight: 600; font-size: 16px; margin-bottom: ${spacing.sm}; color: ${colors.dark};`;

    const descEl = doc.createElement('div');
    descEl.textContent = description;
    descEl.style.cssText = `font-size: 13px; color: ${colors.gray}; opacity: 0.8;`;

    card.appendChild(iconEl);
    card.appendChild(titleEl);
    card.appendChild(descEl);

    // Hover效果
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = `0 8px 16px rgba(0,0,0,0.15)`;
      card.style.background = color;
      titleEl.style.color = 'white';
      descEl.style.color = 'white';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.background = 'white';
      titleEl.style.color = colors.dark;
      descEl.style.color = colors.gray;
    });

    return card;
  }

  /**
   * 创建指定类型的会话
   */
  private async createSessionWithType(type: 'public' | 'private'): Promise<void> {
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

      const session = await this.sessionManager.createSession(doi, title, type, 10);
      this.context.showMessage(
        `私密会话已创建！邀请码: ${session.inviteCode}`,
        'info'
      );
      await this.onCreated(type);
    } catch (error) {
      logger.error("[SessionCreateFormView] Error creating session:", error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.context.showMessage(`创建会话失败: ${errorMsg}`, 'error');
    }
  }
}

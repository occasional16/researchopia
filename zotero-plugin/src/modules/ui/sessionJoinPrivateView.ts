/**
 * 加入私密会话视图
 * 通过邀请码加入私密会话
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager } from '../readingSessionManager';
import { createBackButton, createInput, createButton } from './uiHelpers';
import { colors, spacing, containerPadding } from './styles';

export class SessionJoinPrivateView {
  constructor(
    private sessionManager: ReadingSessionManager,
    private onBack: () => void,
    private onJoined: () => Promise<void>,
    private showMessage: (msg: string, type: 'info' | 'warning' | 'error') => void
  ) {}

  /**
   * 渲染加入私密会话页面
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

    // 页面标题
    const title = doc.createElement('h2');
    title.textContent = '加入私密会话';
    title.style.cssText = `
      margin: 0 0 ${spacing.lg} 0;
      font-size: 20px;
      font-weight: 700;
      color: ${colors.dark};
      text-align: center;
    `;
    pageContainer.appendChild(title);

    // 输入框容器
    const inputContainer = doc.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: ${spacing.lg};
      max-width: 400px;
      margin: 0 auto;
      padding: ${spacing.lg};
      background: ${colors.light};
      border-radius: 8px;
    `;

    // 提示文字
    const hint = doc.createElement('p');
    hint.textContent = '请输入邀请码以加入私密会话';
    hint.style.cssText = `
      margin: 0;
      font-size: 14px;
      color: ${colors.gray};
      text-align: center;
    `;
    inputContainer.appendChild(hint);

    // 邀请码输入框
    const input = createInput(doc, 'text', '请输入邀请码...');
    inputContainer.appendChild(input);

    // 加入按钮
    const joinButton = createButton(doc, '加入会话', 'primary');
    joinButton.addEventListener('click', async () => {
      const code = input.value.trim();
      if (!code) {
        this.showMessage('请输入邀请码', 'error');
        return;
      }

      try {
        await this.sessionManager.joinSessionByInviteCode(code);
        this.showMessage('已加入会话', 'info');
        await this.onJoined();
      } catch (error) {
        logger.error('[SessionJoinPrivateView] 加入会话失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        this.showMessage(`加入会话失败: ${errorMessage}`, 'error');
      }
    });
    inputContainer.appendChild(joinButton);

    pageContainer.appendChild(inputContainer);
    container.appendChild(pageContainer);
  }
}

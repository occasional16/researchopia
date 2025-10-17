import { AuthManager } from "../auth";
import type { ViewMode } from "./types";

/**
 * UI组件创建工具函数
 */

/**
 * 创建论文信息区域
 */
export function createPaperInfoSection(doc: Document): HTMLElement {
  const section = doc.createElement('div');
  section.id = 'researchopia-paper-info';
  section.setAttribute('data-researchopia-role', 'paper-info');
  section.style.cssText = `
    padding: 16px;
    background: #ffffff;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    margin-bottom: 16px;
  `;

  const infoHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div id="paper-title" data-researchopia-role="paper-title" style="font-weight: 700; font-size: 16px; color: #1f2937; line-height: 1.5;">
        请选择一篇文献
      </div>
      <div id="paper-metadata" data-researchopia-role="paper-metadata" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <div id="paper-authors" data-researchopia-role="paper-authors" style="display: none;">
          <span style="display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1e40af; border-radius: 6px; font-size: 12px; font-weight: 500;">
            👤 <span class="authors-text" data-researchopia-role="paper-authors-text"></span>
          </span>
        </div>
        <div id="paper-details" data-researchopia-role="paper-details" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <span id="paper-year" data-researchopia-role="paper-year" style="display: none; padding: 4px 10px; background: #f0fdf4; color: #15803d; border-radius: 6px; font-size: 12px; font-weight: 500;"></span>
          <span id="paper-journal" data-researchopia-role="paper-journal" style="display: none; padding: 4px 10px; background: #fef3c7; color: #92400e; border-radius: 6px; font-size: 12px; font-weight: 500;"></span>
          <span id="paper-doi" data-researchopia-role="paper-doi" style="display: none; padding: 4px 10px; background: #f3e8ff; color: #6b21a8; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; user-select: none;">
            <span class="doi-text"></span>
          </span>
        </div>
      </div>
    </div>
  `;

  section.innerHTML = infoHTML;

  // 添加DOI点击复制功能
  setTimeout(() => {
    const doiSpan = section.querySelector('#paper-doi') as HTMLElement;
    if (doiSpan) {
      doiSpan.addEventListener('click', () => {
        const doiText = doiSpan.querySelector('.doi-text')?.textContent || '';
        const doi = doiText.replace('DOI: ', '');

        if (!doi) return;

        try {
          // 使用Zotero的剪贴板API
          const clipboardHelper = (Components as any).classes["@mozilla.org/widget/clipboardhelper;1"]
            .getService((Components as any).interfaces.nsIClipboardHelper);
          clipboardHelper.copyString(doi);

          const originalBg = doiSpan.style.background;
          const originalText = doiSpan.innerHTML;

          // 显示复制成功提示
          doiSpan.style.background = '#10b981';
          doiSpan.style.color = '#ffffff';
          doiSpan.innerHTML = '✓ 已复制到剪贴板';

          setTimeout(() => {
            doiSpan.style.background = originalBg;
            doiSpan.style.color = '#6b21a8';
            doiSpan.innerHTML = originalText;
          }, 1500);
        } catch (error) {
          console.error('[Researchopia] Failed to copy DOI:', error);
          // 复制失败提示
          const originalBg = doiSpan.style.background;
          doiSpan.style.background = '#ef4444';
          doiSpan.style.color = '#ffffff';
          doiSpan.innerHTML = '✗ 复制失败';
          setTimeout(() => {
            doiSpan.style.background = originalBg;
            doiSpan.style.color = '#6b21a8';
            doiSpan.innerHTML = doiSpan.querySelector('.doi-text')?.textContent || '';
          }, 1500);
        }
      });

      doiSpan.addEventListener('mouseenter', () => {
        doiSpan.style.background = '#e9d5ff';
        doiSpan.style.transform = 'scale(1.05)';
      });
      doiSpan.addEventListener('mouseleave', () => {
        doiSpan.style.background = '#f3e8ff';
        doiSpan.style.transform = 'scale(1)';
      });
    }
  }, 100);

  return section;
}

/**
 * 创建功能按钮区域
 */
export function createButtonsSection(
  doc: Document,
  handleButtonClick: (mode: ViewMode, originElement?: HTMLElement) => void
): HTMLElement {
  const section = doc.createElement('div');
  section.id = 'researchopia-buttons';
  section.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  `;

  // 创建四个功能按钮，带图标和颜色
  const buttons = [
    {
      id: 'btn-quick-search',
      text: '快捷搜索',
      icon: '🔍',
      mode: 'quick-search' as ViewMode,
      disabled: false,
      color: '#10b981',
      hoverColor: '#059669'
    },
    {
      id: 'btn-my-annotations',
      text: '管理标注',
      icon: '🔖',
      mode: 'my-annotations' as ViewMode,
      disabled: false,
      color: '#3b82f6',
      hoverColor: '#2563eb'
    },
    {
      id: 'btn-shared-annotations',
      text: '共享标注',
      icon: '👥',
      mode: 'shared-annotations' as ViewMode,
      disabled: false,
      color: '#8b5cf6',
      hoverColor: '#7c3aed'
    },
    {
      id: 'btn-paper-evaluation',
      text: '论文评价',
      icon: '⭐',
      mode: 'paper-evaluation' as ViewMode,
      disabled: false,
      color: '#f97316',
      hoverColor: '#ea580c'
    }
  ];

  buttons.forEach(btn => {
    const button = doc.createElement('button');
    button.id = btn.id;
    button.disabled = btn.disabled || false;

    // 创建按钮内容（图标 + 文字）
    button.innerHTML = `
      <span style="font-size: 18px; margin-right: 6px; flex-shrink: 0;">${btn.icon}</span>
      <span style="word-break: break-word; text-align: center; line-height: 1.3;">${btn.text}</span>
    `;

    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      background: ${btn.disabled ? '#e5e7eb' : '#ffffff'};
      color: ${btn.disabled ? '#9ca3af' : btn.color};
      border: 2px solid ${btn.disabled ? '#d1d5db' : btn.color};
      border-radius: 8px;
      cursor: ${btn.disabled ? 'not-allowed' : 'pointer'};
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
      opacity: ${btn.disabled ? '0.5' : '1'};
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      min-height: 48px;
      box-sizing: border-box;
      overflow: hidden;
    `;

    if (!btn.disabled) {
      button.addEventListener('mouseenter', () => {
        button.style.background = btn.color;
        button.style.color = '#ffffff';
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = '#ffffff';
        button.style.color = btn.color;
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      });
      button.addEventListener('click', (event) => {
        const originElement = event.currentTarget as HTMLElement;
        handleButtonClick(btn.mode, originElement);
      });
    }

    section.appendChild(button);
  });

  return section;
}

/**
 * 创建内容展示区域
 */
export function createContentSection(doc: Document): HTMLElement {
  const section = doc.createElement('div');
  section.id = 'researchopia-content';
  section.setAttribute('data-researchopia-role', 'content');
  section.style.cssText = `
    flex: 1;
    min-height: 300px;
    display: flex;
    flex-direction: column;
    background: #f9fafb;
    border-radius: 10px;
    padding: 16px;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  `;

  // 初始显示空白或登录提示
  renderInitialContent(section);

  return section;
}

/**
 * 渲染初始内容（未登录提示或空白）
 */
async function renderInitialContent(container: HTMLElement): Promise<void> {
  const isLoggedIn = await AuthManager.isLoggedIn();
  const doc = container.ownerDocument;

  container.innerHTML = '';

  if (!isLoggedIn) {
    // 显示登录提示
    const loginPrompt = doc.createElement('div');
    loginPrompt.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 60px 20px;
      text-align: center;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    `;

    const iconDiv = doc.createElement('div');
    iconDiv.style.cssText = 'font-size: 64px;';
    iconDiv.textContent = '🔐';

    const titleDiv = doc.createElement('div');
    titleDiv.style.cssText = 'font-size: 16px; font-weight: 600; color: #1f2937;';
    titleDiv.textContent = '请先登录以使用完整功能';

    const hintDiv = doc.createElement('div');
    hintDiv.innerHTML = `
      <div style="padding: 8px 16px; background: #eff6ff; color: #1e40af; border-radius: 8px; font-size: 13px;">
        💡 工具 → Researchopia 设置 → 登录
      </div>
    `;

    loginPrompt.appendChild(iconDiv);
    loginPrompt.appendChild(titleDiv);
    loginPrompt.appendChild(hintDiv);

    container.appendChild(loginPrompt);
  } else {
    // 显示空白提示
    const emptyPrompt = doc.createElement('div');
    emptyPrompt.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 60px 20px;
      text-align: center;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    `;

    const iconDiv = doc.createElement('div');
    iconDiv.style.cssText = 'font-size: 64px;';
    iconDiv.textContent = '📚';

    const messageDiv = doc.createElement('div');
    messageDiv.style.cssText = 'font-size: 16px; font-weight: 600; color: #1f2937;';
    messageDiv.textContent = '选择一篇文献开始使用';

    const hintDiv = doc.createElement('div');
    hintDiv.style.cssText = 'font-size: 13px; color: #6b7280;';
    hintDiv.textContent = '点击上方按钮查看标注、评价或快捷搜索';

    emptyPrompt.appendChild(iconDiv);
    emptyPrompt.appendChild(messageDiv);
    emptyPrompt.appendChild(hintDiv);
    container.appendChild(emptyPrompt);
  }
}


import { AuthManager } from "../auth";
import { envConfig } from "../../config/env";
import type { ViewMode } from "./types";
import { containerPadding } from "./styles";
import { logger } from "../../utils/logger";

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
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    word-break: break-word;
  `;

  const infoHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 100%; box-sizing: border-box;">
      <div id="paper-title" data-researchopia-role="paper-title" style="font-weight: 700; font-size: 16px; color: #1f2937; line-height: 1.5; word-break: break-word; overflow-wrap: anywhere; width: 100%; max-width: 100%; box-sizing: border-box;">
        请选择一篇文献
      </div>
      <div id="paper-metadata" data-researchopia-role="paper-metadata" style="display: flex; flex-direction: column; gap: 8px; font-size: 13px; width: 100%; max-width: 100%; box-sizing: border-box;">
        <div id="paper-authors" data-researchopia-role="paper-authors" style="display: block; width: 100%; max-width: 100%; box-sizing: border-box;">
          <span style="display: inline-block; padding: 4px 10px; background: #eff6ff; color: #1e40af; border-radius: 6px; font-size: 12px; font-weight: 500; max-width: 100%; box-sizing: border-box; word-break: break-word;">
            👤 <span class="authors-text" data-researchopia-role="paper-authors-text" style="word-break: break-word;"></span>
          </span>
        </div>
        <div id="paper-details" data-researchopia-role="paper-details" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; width: 100%; max-width: 100%; box-sizing: border-box;">
          <span id="paper-year" data-researchopia-role="paper-year" style="display: inline; padding: 4px 10px; background: #f0fdf4; color: #15803d; border-radius: 6px; font-size: 12px; font-weight: 500; max-width: 100%; box-sizing: border-box;"></span>
          <span id="paper-journal" data-researchopia-role="paper-journal" style="display: inline; padding: 4px 10px; background: #fef3c7; color: #92400e; border-radius: 6px; font-size: 12px; font-weight: 500; max-width: 100%; box-sizing: border-box; word-break: break-word;"></span>
          <span id="paper-doi" data-researchopia-role="paper-doi" style="display: inline; padding: 4px 10px; background: #f3e8ff; color: #6b21a8; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: 0.2s; user-select: none; word-break: break-all; overflow-wrap: anywhere; max-width: 100%; box-sizing: border-box;">
            <span class="doi-text" style="word-break: break-all; overflow-wrap: anywhere;"></span>
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
 * 更新用户信息栏内容
 */
async function updateUserInfoBarContent(bar: HTMLElement, doc: Document): Promise<void> {
  // 清空现有内容
  bar.innerHTML = '';
  bar.style.cssText = `
    padding: 12px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 10px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  `;

  const isLoggedIn = await AuthManager.isLoggedIn();
  logger.log("[Components] 🔍 updateUserInfoBarContent: isLoggedIn=", isLoggedIn);

  if (isLoggedIn) {
    const currentUser = AuthManager.getCurrentUser();
    const username = currentUser?.username || '用户';

    // 创建用户信息区域（单行布局）
    const userInfoDiv = doc.createElement('div');
    userInfoDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    // 头像
    const avatarDiv = doc.createElement('div');
    avatarDiv.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #667eea; font-size: 14px; flex-shrink: 0;';
    avatarDiv.textContent = username.charAt(0).toUpperCase();

    // 用户名和状态
    const userTextDiv = doc.createElement('div');
    userTextDiv.style.cssText = 'flex: 1; min-width: 0;';

    const usernameDiv = doc.createElement('div');
    usernameDiv.style.cssText = 'color: white; font-weight: 600; font-size: 13px;';
    usernameDiv.textContent = `@${username}`;

    const statusDiv = doc.createElement('div');
    statusDiv.style.cssText = 'color: rgba(255, 255, 255, 0.8); font-size: 11px;';
    statusDiv.textContent = '已登录';

    userTextDiv.appendChild(usernameDiv);
    userTextDiv.appendChild(statusDiv);

    // 主页按钮
    const profileBtn = doc.createElement('button');
    profileBtn.id = 'btn-view-profile';
    profileBtn.style.cssText = 'padding: 6px 12px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;';
    profileBtn.textContent = '🏠 个人主页';

    // 主页按钮事件
    profileBtn.addEventListener('mouseenter', () => {
      profileBtn.style.background = 'rgba(255, 255, 255, 0.3)';
      profileBtn.style.transform = 'scale(1.05)';
    });
    profileBtn.addEventListener('mouseleave', () => {
      profileBtn.style.background = 'rgba(255, 255, 255, 0.2)';
      profileBtn.style.transform = 'scale(1)';
    });
    profileBtn.addEventListener('click', () => {
      const url = `${envConfig.apiBaseUrl}/profile/${username}`;
      (Zotero as any).launchURL(url);
    });

    // 组装布局
    userInfoDiv.appendChild(avatarDiv);
    userInfoDiv.appendChild(userTextDiv);
    userInfoDiv.appendChild(profileBtn);
    bar.appendChild(userInfoDiv);
  } else {
    bar.innerHTML = `
      <div style="color: white; font-size: 13px; font-weight: 500;">
        👋 请先登录以使用完整功能
      </div>
    `;
  }
}

/**
 * 创建用户信息栏
 */
export async function createUserInfoBar(doc: Document): Promise<HTMLElement> {
  const bar = doc.createElement('div');
  bar.id = 'researchopia-user-info';
  
  // 初始化内容
  await updateUserInfoBarContent(bar, doc);
  
  // 定义事件处理器
  const handleLogout = async () => {
    logger.log("[Components] 📢 Received logout event, updating user info bar");
    // 延迟一点以确保prefs已清除
    setTimeout(async () => {
      await updateUserInfoBarContent(bar, doc);
    }, 100);
  };
  
  const handleLogin = async () => {
    logger.log("[Components] 📢 Received login event, updating user info bar");
    // 延迟一点以确保session已保存
    setTimeout(async () => {
      await updateUserInfoBarContent(bar, doc);
    }, 100);
  };
  
  // 在当前document上监听事件(ItemPane所在的document)
  doc.addEventListener('researchopia:logout', handleLogout);
  doc.addEventListener('researchopia:login', handleLogin);
  
  // 同时也在主窗口上监听事件(兼容性)
  const win = (Zotero as any).getMainWindow();
  if (win && win.document !== doc) {
    win.document.addEventListener('researchopia:logout', handleLogout);
    win.document.addEventListener('researchopia:login', handleLogin);
    logger.log("[Components] ✅ Registered event listeners on both ItemPane document and main window");
  } else {
    logger.log("[Components] ✅ Registered event listeners on current document");
  }
  
  // 保存清理函数以便后续使用
  (bar as any)._logoutHandler = handleLogout;
  (bar as any)._loginHandler = handleLogin;
  
  return bar;
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
      id: 'btn-reading-session',
      text: '文献共读',
      icon: '📖',
      mode: 'reading-session' as ViewMode,
      disabled: false,
      color: '#ec4899',
      hoverColor: '#db2777'
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
    },        
    {
      id: 'btn-quick-search',
      text: '快捷搜索',
      icon: '🔍',
      mode: 'quick-search' as ViewMode,
      disabled: false,
      color: '#10b981',
      hoverColor: '#059669'
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
    padding: ${containerPadding.content};
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
    messageDiv.style.cssText = 'font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 8px;';
    messageDiv.textContent = '选择一篇文献开始使用';

    // 功能介绍区域
    const featuresDiv = doc.createElement('div');
    featuresDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 400px;
      text-align: left;
    `;

    const features = [
      { icon: '📖', color: '#ec4899', title: '文献共读', desc: '创建或加入共读会话,与他人协同阅读' },
      { icon: '👥', color: '#8b5cf6', title: '共享标注', desc: '浏览其他用户的标注,管理自己的标注' },
      { icon: '⭐', color: '#f97316', title: '论文评价', desc: '查看论文评分、评论及学术讨论' },
      { icon: '🔍', color: '#10b981', title: '快捷搜索', desc: '一键搜索相关论文和学术资源' }
    ];

    features.forEach(feature => {
      const featureItem = doc.createElement('div');
      featureItem.style.cssText = `
        display: flex;
        align-items: start;
        gap: 10px;
        padding: 10px;
        background: #f9fafb;
        border-radius: 8px;
        border-left: 3px solid ${feature.color};
      `;

      const iconSpan = doc.createElement('span');
      iconSpan.style.cssText = 'font-size: 20px; flex-shrink: 0;';
      iconSpan.textContent = feature.icon;

      const textDiv = doc.createElement('div');
      textDiv.style.cssText = 'flex: 1;';

      const titleSpan = doc.createElement('div');
      titleSpan.style.cssText = `font-weight: 600; color: ${feature.color}; font-size: 13px; margin-bottom: 2px;`;
      titleSpan.textContent = feature.title;

      const descSpan = doc.createElement('div');
      descSpan.style.cssText = 'font-size: 12px; color: #6b7280; line-height: 1.4;';
      descSpan.textContent = feature.desc;

      textDiv.appendChild(titleSpan);
      textDiv.appendChild(descSpan);

      featureItem.appendChild(iconSpan);
      featureItem.appendChild(textDiv);

      featuresDiv.appendChild(featureItem);
    });

    emptyPrompt.appendChild(iconDiv);
    emptyPrompt.appendChild(messageDiv);
    emptyPrompt.appendChild(featuresDiv);
    container.appendChild(emptyPrompt);
  }
}


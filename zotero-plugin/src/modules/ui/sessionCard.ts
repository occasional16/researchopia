/**
 * 会话卡片组件
 * 统一的会话卡片创建和样式管理
 */

import { colors, spacing, fontSize, borderRadius, cardStyle, getThemeColors } from './styles';
import type { ReadingSession } from '../readingSessionManager';
import { formatDate } from './helpers';
import { ServicesAdapter } from '../../adapters';

import { logger } from "../../utils/logger";
/**
 * 创建会话卡片（通用版本）
 */
export function createSessionCard(
  doc: Document,
  session: ReadingSession,
  options: {
    showInviteCode?: boolean;
    showCreator?: boolean;
    showMemberCount?: boolean;
    showDeleteButton?: boolean;
    onDeleteClick?: () => void;
    onClick?: () => void;
    onlineCount?: number; // 新增:从外部传入在线人数
  } = {}
): HTMLElement {
  const card = doc.createElement('div');
  card.style.cssText = `
    ${cardStyle}
    ${options.onClick ? 'cursor: pointer;' : ''}
  `;
  
  // 悬停效果
  if (options.onClick) {
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = `0 4px 12px ${colors.shadow}`;
      card.style.borderColor = colors.primary;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.borderColor = colors.border;
    });
    
    card.addEventListener('click', options.onClick);
  }
  
  // 标题(缩小字体以适应窄窗口)
  const titleDiv = doc.createElement('div');
  titleDiv.textContent = session.paper_title;
  titleDiv.style.cssText = `
    font-weight: 700;
    font-size: 14px;
    margin-bottom: ${spacing.md};
    color: ${colors.dark};
    word-break: break-word;
    line-height: 1.5;
  `;
  card.appendChild(titleDiv);
  
  // 元数据区域(与paper-info保持一致的设计)
  const metadataDiv = doc.createElement('div');
  metadataDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: ${spacing.sm};
    margin-bottom: ${spacing.md};
    font-size: 13px;
  `;
  
  // 作者信息(如果存在)
  if (session.authors) {
    const authorsDiv = doc.createElement('div');
    authorsDiv.style.cssText = `
      display: block;
      width: 100%;
      box-sizing: border-box;
    `;
    
    const authorsSpan = doc.createElement('span');
    authorsSpan.style.cssText = `
      display: inline-block;
      padding: 4px 10px;
      background: #3b82f633;
      color: #3b82f6;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      max-width: 100%;
      box-sizing: border-box;
      word-break: break-word;
    `;
    
    // 处理3个以上作者的情况
    const authorsArray = session.authors.split(',').map((a: string) => a.trim());
    const displayAuthors = authorsArray.length > 3
      ? authorsArray.slice(0, 3).join(', ') + ` 等 ${authorsArray.length} 人`
      : session.authors;
    
    authorsSpan.innerHTML = `👤 <span style="word-break: break-word;">${displayAuthors}</span>`;
    
    authorsDiv.appendChild(authorsSpan);
    metadataDiv.appendChild(authorsDiv);
  }
  
  // 年份、期刊、DOI详情行
  const detailsDiv = doc.createElement('div');
  detailsDiv.style.cssText = `
    display: flex;
    gap: ${spacing.sm};
    flex-wrap: wrap;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  `;
  
  // 年份(如果存在)
  if (session.year) {
    const yearSpan = doc.createElement('span');
    yearSpan.textContent = `📅 ${session.year}`;
    yearSpan.style.cssText = `
      display: inline;
      padding: 4px 10px;
      background: #10b98122;
      color: #10b981;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      max-width: 100%;
      box-sizing: border-box;
    `;
    detailsDiv.appendChild(yearSpan);
  }
  
  // 期刊(如果存在)
  if (session.journal) {
    const journalSpan = doc.createElement('span');
    journalSpan.textContent = `📰 ${session.journal}`;
    journalSpan.style.cssText = `
      display: inline;
      padding: 4px 10px;
      background: #f59e0b22;
      color: #f59e0b;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      max-width: 100%;
      box-sizing: border-box;
      word-break: break-word;
    `;
    detailsDiv.appendChild(journalSpan);
  }
  
  // DOI(点击复制,与paper-info保持一致)
  const themeColors = getThemeColors();
  const doiSpan = doc.createElement('span');
  doiSpan.style.cssText = `
    display: inline;
    padding: 4px 10px;
    background: ${themeColors.primary}22;
    color: ${themeColors.primary};
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
    word-break: break-all;
    overflow-wrap: anywhere;
    max-width: 100%;
    box-sizing: border-box;
  `;
  
  const doiText = doc.createElement('span');
  doiText.textContent = `DOI: ${session.paper_doi}`;
  doiText.style.cssText = 'word-break: break-all; overflow-wrap: anywhere;';
  doiSpan.appendChild(doiText);
  
  // DOI悬停和点击效果
  doiSpan.addEventListener('mouseenter', () => {
    doiSpan.style.background = `${themeColors.primary}44`;
    doiSpan.style.transform = 'scale(1.05)';
  });
  
  doiSpan.addEventListener('mouseleave', () => {
    doiSpan.style.background = `${themeColors.primary}22`;
    doiSpan.style.transform = 'scale(1)';
  });
  
  doiSpan.addEventListener('click', (e) => {
    e.stopPropagation();
    try {
      const clipboardHelper = (Components as any).classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService((Components as any).interfaces.nsIClipboardHelper);
      clipboardHelper.copyString(session.paper_doi);
      
      const originalBg = doiSpan.style.background;
      const originalColor = doiSpan.style.color;
      const originalText = doiSpan.innerHTML;
      
      doiSpan.style.background = themeColors.success;
      doiSpan.style.color = themeColors.textInverse;
      doiSpan.textContent = '✓ 已复制到剪贴板';
      
      setTimeout(() => {
        doiSpan.style.background = originalBg;
        doiSpan.style.color = originalColor;
        doiSpan.innerHTML = originalText;
      }, 1500);
    } catch (error) {
      logger.error('Copy DOI failed:', error);
      doiSpan.style.background = themeColors.danger;
      doiSpan.style.color = themeColors.textInverse;
      doiSpan.textContent = '✗ 复制失败';
      setTimeout(() => {
        doiSpan.style.background = `${themeColors.primary}22`;
        doiSpan.style.color = themeColors.primary;
        doiText.textContent = `DOI: ${session.paper_doi}`;
      }, 1500);
    }
  });
  
  detailsDiv.appendChild(doiSpan);
  metadataDiv.appendChild(detailsDiv);
  card.appendChild(metadataDiv);
  
  // 邀请码
  if (options.showInviteCode && session.invite_code) {
    const inviteCodeDiv = doc.createElement('div');
    inviteCodeDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${spacing.sm};
      margin-bottom: ${spacing.sm};
      flex-wrap: wrap;
    `;
    
    const inviteLabel = doc.createElement('span');
    inviteLabel.textContent = '🔑 邀请码:';
    inviteLabel.style.cssText = `
      font-size: ${fontSize.xs};
      color: ${colors.gray};
    `;
    inviteCodeDiv.appendChild(inviteLabel);
    
    const inviteCodeButton = doc.createElement('button');
    inviteCodeButton.textContent = session.invite_code;
    inviteCodeButton.style.cssText = `
      background: linear-gradient(135deg, ${colors.primary} 0%, #bca2dfc7 100%);
      color: white;
      padding: 4px 12px;
      border: none;
      border-radius: ${borderRadius.sm};
      font-weight: 600;
      font-size: ${fontSize.xs};
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    inviteCodeButton.addEventListener('mouseenter', () => {
      inviteCodeButton.style.transform = 'scale(1.05)';
      inviteCodeButton.style.boxShadow = `0 2px 8px ${colors.shadow}`;
    });
    
    inviteCodeButton.addEventListener('mouseleave', () => {
      inviteCodeButton.style.transform = 'scale(1)';
      inviteCodeButton.style.boxShadow = 'none';
    });
    
    inviteCodeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // 复制到剪贴板(使用Zotero的剪贴板API)
      try {
        const clipboardHelper = (Components as any).classes["@mozilla.org/widget/clipboardhelper;1"]
          .getService((Components as any).interfaces.nsIClipboardHelper);
        clipboardHelper.copyString(session.invite_code || '');
        
        const originalBg = inviteCodeButton.style.background;
        const originalText = inviteCodeButton.textContent;
        
        // 显示复制成功提示
        inviteCodeButton.style.background = '#10b981';
        inviteCodeButton.textContent = '✓ 已复制';
        
        setTimeout(() => {
          inviteCodeButton.style.background = originalBg;
          inviteCodeButton.textContent = originalText;
        }, 1500);
      } catch (error) {
        logger.error('Copy failed:', error);
      }
    });
    
    inviteCodeDiv.appendChild(inviteCodeButton);
    card.appendChild(inviteCodeDiv);
  }
  
  // 创建者信息
  if (options.showCreator) {
    const creatorDiv = doc.createElement('div');
    // 支持嵌套的creator对象和旧的creator_name字段
    const creatorName = (session as any).creator?.username || 
                       (session as any).creator?.email?.split('@')[0] || 
                       (session as any).creator_name || 
                       '未知用户';
    creatorDiv.textContent = `👤 主持人: ${creatorName}`;
    creatorDiv.style.cssText = `
      font-size: ${fontSize.sm};
      color: ${colors.gray};
      margin-bottom: ${spacing.sm};
    `;
    card.appendChild(creatorDiv);
  }
  
  // 底部信息行
  const footerDiv = doc.createElement('div');
  footerDiv.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: ${fontSize.xs};
    color: ${colors.gray};
    margin-top: ${spacing.sm};
  `;
  
  // 左侧信息容器
  const leftInfoDiv = doc.createElement('div');
  leftInfoDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: ${spacing.xs};
  `;
  
  // 创建时间(如果created_at为空则不显示)
  if (session.created_at) {
    const timeDiv = doc.createElement('span');
    timeDiv.textContent = `⏱️ ${formatDate(session.created_at)}`;
    leftInfoDiv.appendChild(timeDiv);
  }
  
  // 公共/私密属性
  const typeDiv = doc.createElement('span');
  const isPublic = session.session_type === 'public';
  typeDiv.textContent = isPublic ? '🌐 公共' : '🔒 私密';
  typeDiv.style.cssText = `
    background: ${isPublic ? '#dbeafe' : '#fef3c7'};
    color: ${isPublic ? '#1e40af' : '#92400e'};
    padding: 2px ${spacing.sm};
    border-radius: ${borderRadius.sm};
    font-weight: 600;
  `;
  leftInfoDiv.appendChild(typeDiv);
  
  footerDiv.appendChild(leftInfoDiv);
  
  // 右侧人数统计容器
  if (options.showMemberCount) {
    const memberCountDiv = doc.createElement('div');
    memberCountDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${spacing.xs};
    `;
    
    const totalCount = (session as any).member_count || 1;
    const onlineCount = options.onlineCount ?? 0; // 从参数获取,默认0
    
    // 总人数
    const themeColors = getThemeColors();
    const totalDiv = doc.createElement('span');
    totalDiv.textContent = `👥 ${totalCount}`;
    totalDiv.style.cssText = `
      background: ${themeColors.info}1A;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: ${themeColors.info};
      font-weight: 600;
    `;
    memberCountDiv.appendChild(totalDiv);
    
    // 在线人数(总是显示)
    const onlineDiv = doc.createElement('span');
    onlineDiv.textContent = `🟢 ${onlineCount}`;
    onlineDiv.style.cssText = `
      background: ${themeColors.success}1A;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: ${themeColors.success};
      font-weight: 600;
    `;
    memberCountDiv.appendChild(onlineDiv);
    
    footerDiv.appendChild(memberCountDiv);
  }
  
  card.appendChild(footerDiv);
  
  // 私密会话显示剩余时间(单独一行)
  if (session.session_type === 'private' && (session as any).expires_at) {
    const expiresAt = new Date((session as any).expires_at);
    const now = new Date();
    const remainingMs = expiresAt.getTime() - now.getTime();
    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
    
    const expiryRow = doc.createElement('div');
    expiryRow.style.cssText = `
      margin-top: ${spacing.sm};
      padding: ${spacing.xs} ${spacing.sm};
      background: ${remainingHours > 0 ? '#fef3c7' : '#fee2e2'};
      border-radius: ${borderRadius.sm};
      font-size: ${fontSize.xs};
      color: ${remainingHours > 0 ? '#92400e' : '#991b1b'};
      font-weight: 600;
      text-align: center;
    `;
    
    if (remainingHours > 0) {
      expiryRow.textContent = `⏰ 剩余 ${remainingHours} 小时后过期`;
    } else {
      expiryRow.textContent = '❌ 会话已过期';
    }
    
    card.appendChild(expiryRow);
  }
  
  // 删除按钮
  if (options.showDeleteButton && options.onDeleteClick) {
    const btnColors = getThemeColors();
    const deleteButton = doc.createElement('button');
    deleteButton.textContent = '🗑️ 删除会话';
    deleteButton.style.cssText = `
      width: 100%;
      margin-top: ${spacing.md};
      padding: ${spacing.sm} ${spacing.md};
      background: ${btnColors.danger};
      color: white;
      border: none;
      border-radius: ${borderRadius.md};
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    deleteButton.addEventListener('mouseenter', () => {
      const hoverColors = getThemeColors();
      deleteButton.style.background = hoverColors.danger;
      deleteButton.style.filter = 'brightness(0.9)';
    });
    
    deleteButton.addEventListener('mouseleave', () => {
      const leaveColors = getThemeColors();
      deleteButton.style.background = leaveColors.danger;
      deleteButton.style.filter = 'brightness(1)';
    });
    
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 使用Services适配器确认对话框
      const confirmed = ServicesAdapter.confirm(
        '⚠️ 确认删除',
        `确定要删除会话"${session.paper_title}"吗?\n\n此操作不可恢复!`
      );

      if (confirmed) {
        options.onDeleteClick!();
      }
    });
    
    card.appendChild(deleteButton);
  }
  
  return card;
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

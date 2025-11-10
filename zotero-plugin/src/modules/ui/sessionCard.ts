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
    font-weight: 600;
    font-size: ${fontSize.base};
    margin-bottom: ${spacing.sm};
    color: ${colors.dark};
    word-break: break-word;
  `;
  card.appendChild(titleDiv);
  
  // DOI(可点击复制,与邀请码样式一致)
  const doiDiv = doc.createElement('div');
  doiDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: ${spacing.sm};
    margin-bottom: ${spacing.sm};
    flex-wrap: wrap;
  `;
  
  const doiLabel = doc.createElement('span');
  doiLabel.textContent = '📄 DOI:';
  doiLabel.style.cssText = `
    font-size: ${fontSize.sm};
    color: ${colors.gray};
  `;
  doiDiv.appendChild(doiLabel);
  
  const doiButton = doc.createElement('button');
  doiButton.textContent = session.paper_doi;
  doiButton.style.cssText = `
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 4px 12px;
    border: none;
    border-radius: ${borderRadius.sm};
    font-weight: 600;
    font-size: ${fontSize.xs};
    cursor: pointer;
    transition: all 0.2s;
    word-break: break-all;
    text-align: left;
  `;
  
  doiButton.addEventListener('mouseenter', () => {
    doiButton.style.transform = 'scale(1.05)';
    doiButton.style.boxShadow = `0 2px 8px ${colors.shadow}`;
  });
  
  doiButton.addEventListener('mouseleave', () => {
    doiButton.style.transform = 'scale(1)';
    doiButton.style.boxShadow = 'none';
  });
  
  doiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    // 复制DOI到剪贴板
    try {
      const clipboardHelper = (Components as any).classes["@mozilla.org/widget/clipboardhelper;1"]
        .getService((Components as any).interfaces.nsIClipboardHelper);
      clipboardHelper.copyString(session.paper_doi);
      
      doiButton.textContent = '✓ 已复制';
      setTimeout(() => {
        doiButton.textContent = session.paper_doi;
      }, 2000);
    } catch (error) {
      logger.error('Copy DOI failed:', error);
    }
  });
  
  doiDiv.appendChild(doiButton);
  card.appendChild(doiDiv);
  
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
    const onlineCount = (session as any).online_count || 0;
    
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

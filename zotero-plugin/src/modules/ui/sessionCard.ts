/**
 * 会话卡片组件
 * 统一的会话卡片创建和样式管理
 */

import { colors, spacing, fontSize, borderRadius, cardStyle } from './styles';
import type { ReadingSession } from '../readingSessionManager';
import { formatDate } from './helpers';

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
    showJoinButton?: boolean;
    showDeleteButton?: boolean;
    onJoinClick?: () => void;
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
      console.error('Copy DOI failed:', error);
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
        console.error('Copy failed:', error);
      }
    });
    
    inviteCodeDiv.appendChild(inviteCodeButton);
    card.appendChild(inviteCodeDiv);
  }
  
  // 创建者信息
  if (options.showCreator) {
    const creatorDiv = doc.createElement('div');
    const creatorName = (session as any).creator_name || '未知用户';
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
  
  // 创建时间
  const timeDiv = doc.createElement('span');
  timeDiv.textContent = `⏱️ ${formatDate(session.created_at)}`;
  leftInfoDiv.appendChild(timeDiv);
  
  // 公开/私密属性
  const typeDiv = doc.createElement('span');
  const isPublic = session.session_type === 'public';
  typeDiv.textContent = isPublic ? '🌐 公开' : '🔒 私密';
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
    const totalDiv = doc.createElement('span');
    totalDiv.textContent = `👥 ${totalCount}`;
    totalDiv.style.cssText = `
      background: #e7f5ff;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: ${colors.primary};
      font-weight: 600;
    `;
    memberCountDiv.appendChild(totalDiv);
    
    // 在线人数(总是显示)
    const onlineDiv = doc.createElement('span');
    onlineDiv.textContent = `🟢 ${onlineCount}`;
    onlineDiv.style.cssText = `
      background: #d1fae5;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: #059669;
      font-weight: 600;
    `;
    memberCountDiv.appendChild(onlineDiv);
    
    footerDiv.appendChild(memberCountDiv);
  }
  
  card.appendChild(footerDiv);
  
  // 加入按钮
  if (options.showJoinButton && options.onJoinClick) {
    const joinButton = doc.createElement('button');
    joinButton.textContent = '🚀 加入会话';
    joinButton.style.cssText = `
      width: 100%;
      margin-top: ${spacing.md};
      padding: ${spacing.sm} ${spacing.md};
      background: ${colors.primary};
      color: white;
      border: none;
      border-radius: ${borderRadius.md};
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    joinButton.addEventListener('mouseenter', () => {
      joinButton.style.background = colors.primaryHover;
    });
    
    joinButton.addEventListener('mouseleave', () => {
      joinButton.style.background = colors.primary;
    });
    
    joinButton.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onJoinClick!();
    });
    
    card.appendChild(joinButton);
  }
  
  // 删除按钮
  if (options.showDeleteButton && options.onDeleteClick) {
    const deleteButton = doc.createElement('button');
    deleteButton.textContent = '🗑️ 删除会话';
    deleteButton.style.cssText = `
      width: 100%;
      margin-top: ${spacing.md};
      padding: ${spacing.sm} ${spacing.md};
      background: #dc3545;
      color: white;
      border: none;
      border-radius: ${borderRadius.md};
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    
    deleteButton.addEventListener('mouseenter', () => {
      deleteButton.style.background = '#c82333';
    });
    
    deleteButton.addEventListener('mouseleave', () => {
      deleteButton.style.background = '#dc3545';
    });
    
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 使用Zotero原生确认对话框
      const Services = (Zotero as any).getMainWindow().Services;
      const confirmed = Services.prompt.confirm(
        null,
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

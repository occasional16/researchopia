/**
 * 当前会话Tab视图
 * 用于已加入会话后的Tab管理界面:
 * - 会话标注 Tab
 * - 会话成员 Tab
 * - 会话设置 Tab
 */

import { logger } from "../../utils/logger";
import type { ReadingSessionManager, ReadingSession } from '../readingSessionManager';
import type { BaseViewContext } from "./types";
import { SessionAnnotationsView } from './sessionAnnotationsView';
import { colors, spacing, fontSize, borderRadius, getThemeColors } from './styles';
import { escapeHtml, formatDate } from "./helpers";

type TabMode = 'annotations' | 'members' | 'settings';

export class CurrentSessionTabView {
  private currentTab: TabMode = 'annotations'; // 默认显示标注Tab
  private sessionAnnotationsView: SessionAnnotationsView;

  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext
  ) {
    this.sessionAnnotationsView = new SessionAnnotationsView(
      sessionManager,
      context
    );
  }

  /**
   * 渲染当前会话Tab视图
   */
  public async render(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[CurrentSessionTabView] 🎨 Rendering tab view...");
      
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        const themeColors = getThemeColors();
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: ${themeColors.textMuted};">未加入任何会话</div>`;
        return;
      }
      
      container.innerHTML = '';
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
        box-sizing: border-box;
      `;

      // 会话头部(可选,显示会话基本信息)
      const header = await this.createSessionHeader(doc, session);
      container.appendChild(header);

      // Tab切换栏
      const tabBar = this.createTabBar(doc);
      container.appendChild(tabBar);

      // Tab内容区域
      const contentArea = doc.createElement('div');
      contentArea.style.cssText = `
        flex: 1;
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        background: white;
      `;
      container.appendChild(contentArea);

      // 渲染当前Tab的内容
      await this.renderTabContent(contentArea, doc);

    } catch (error) {
      logger.error("[CurrentSessionTabView] Error rendering:", error);
      const errorColors = getThemeColors();
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: ${errorColors.danger};">
          <div>❌ 加载会话失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 创建会话头部(使用会话卡片样式)
   */
  private async createSessionHeader(doc: Document, session: ReadingSession): Promise<HTMLElement> {
    const header = doc.createElement('div');
    header.style.cssText = `
      padding: ${spacing.sm};
      background: white;
      border: 1px solid ${colors.border};
      border-radius: ${borderRadius.md};
      box-shadow: 0 1px 3px ${colors.shadow};
      margin: ${spacing.xs};
      width: calc(100% - ${spacing.xs} * 2);
      box-sizing: border-box;
    `;
    
    // 标题
    const titleDiv = doc.createElement('div');
    titleDiv.textContent = session.paper_title;
    titleDiv.style.cssText = `
      font-weight: 600;
      font-size: ${fontSize.base};
      margin-bottom: ${spacing.sm};
      color: ${colors.dark};
      word-break: break-word;
    `;
    header.appendChild(titleDiv);
    
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
    header.appendChild(doiDiv);
    
    // 邀请码
    if (session.invite_code) {
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
        // 复制到剪贴板
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
      header.appendChild(inviteCodeDiv);
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
      flex-wrap: wrap;
    `;
    
    // 创建时间
    if (session.created_at) {
      const timeDiv = doc.createElement('span');
      const createdTime = new Date(session.created_at);
      const formattedTime = `${createdTime.getMonth() + 1}/${createdTime.getDate()} ${createdTime.getHours().toString().padStart(2, '0')}:${createdTime.getMinutes().toString().padStart(2, '0')}`;
      timeDiv.textContent = `⏱️ ${formattedTime}`;
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
    
    // 右侧人数统计容器(和会话卡片一样显示总人数和在线人数)
    const memberCountDiv = doc.createElement('div');
    memberCountDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: ${spacing.xs};
    `;
    
    // 从members获取总人数,从realtime presence获取在线人数
    let totalCount = 1;
    let onlineCount = 0;
    try {
      const membersResponse = await this.sessionManager.getSessionMembers(session.id);
      totalCount = membersResponse.length || 1;
      // 从realtime presence获取在线人数
      onlineCount = this.sessionManager.getCurrentSessionOnlineCount();
    } catch (e) {
      logger.warn('[CurrentSessionTabView] Failed to get member counts:', e);
      // Fallback to session object values if API fails
      totalCount = (session as any).member_count || 1;
      onlineCount = 0;
    }
    
    // 总人数
    const memberColors = getThemeColors();
    const totalDiv = doc.createElement('span');
    totalDiv.textContent = `👥 ${totalCount}`;
    totalDiv.style.cssText = `
      background: ${memberColors.info}1A;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: ${memberColors.info};
      font-weight: 600;
    `;
    memberCountDiv.appendChild(totalDiv);
    
    // 在线人数
    const onlineDiv = doc.createElement('span');
    onlineDiv.textContent = `🟢 ${onlineCount}`;
    onlineDiv.style.cssText = `
      background: ${memberColors.success}1A;
      padding: 2px ${spacing.sm};
      border-radius: ${borderRadius.sm};
      color: ${memberColors.success};
      font-weight: 600;
    `;
    memberCountDiv.appendChild(onlineDiv);
    
    footerDiv.appendChild(memberCountDiv);
    
    header.appendChild(footerDiv);
    
    // 私密会话显示剩余时间(如果有expires_at)
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
      
      header.appendChild(expiryRow);
    }

    return header;
  }

  /**
   * 创建Tab切换栏
   */
  private createTabBar(doc: Document): HTMLElement {
    const tabBar = doc.createElement('div');
    tabBar.style.cssText = `
      display: flex;
      background: white;
      border-bottom: 2px solid #e5e7eb;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const tabs = [
      { id: 'annotations' as TabMode, label: '📝 会话标注' },
      { id: 'members' as TabMode, label: '👥 会话成员' },
      { id: 'settings' as TabMode, label: '⚙️ 会话设置' },
    ];

    const allTabs: HTMLButtonElement[] = [];

    tabs.forEach(tab => {
      const tabButton = doc.createElement('button');
      tabButton.textContent = tab.label;
      
      const isActive = this.currentTab === tab.id;
      tabButton.style.cssText = `
        flex: 0 0 33.333%;
        padding: ${spacing.sm} ${spacing.xs};
        background: transparent;
        border: none;
        border-bottom: 2px solid ${isActive ? colors.primary : 'transparent'};
        color: ${isActive ? colors.primary : colors.gray};
        font-size: ${fontSize.sm};
        font-weight: ${isActive ? '600' : '500'};
        cursor: pointer;
        transition: all 0.2s;
        box-sizing: border-box;
      `;

      tabButton.addEventListener('mouseenter', () => {
        if (!isActive) {
          tabButton.style.color = colors.primary;
        }
      });

      tabButton.addEventListener('mouseleave', () => {
        if (!isActive) {
          tabButton.style.color = colors.gray;
        }
      });

      tabButton.addEventListener('click', async () => {
        if (this.currentTab !== tab.id) {
          this.currentTab = tab.id;
          
          // 重新渲染整个视图以更新Tab状态和内容
          const container = tabBar.parentElement;
          if (container) {
            await this.render(container, doc);
          }
        }
      });

      allTabs.push(tabButton);
      tabBar.appendChild(tabButton);
    });

    return tabBar;
  }

  /**
   * 渲染Tab内容
   */
  private async renderTabContent(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';

    switch (this.currentTab) {
      case 'annotations':
        await this.renderAnnotationsTab(container, doc);
        break;
      case 'members':
        await this.renderMembersTab(container, doc);
        break;
      case 'settings':
        await this.renderSettingsTab(container, doc);
        break;
    }
  }

  /**
   * 渲染会话标注Tab
   */
  private async renderAnnotationsTab(container: HTMLElement, doc: Document): Promise<void> {
    await this.sessionAnnotationsView.render(container, doc);
  }

  /**
   * 渲染成员Tab
   * 参考readingSessionView.renderMembersList()的完整设计
   */
  private async renderMembersTab(container: HTMLElement, doc: Document): Promise<void> {
    const tabColors = getThemeColors();
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: ${tabColors.textMuted};">会话信息不可用</div>`;
      return;
    }

    const membersSection = doc.createElement('div');
    membersSection.id = 'session-members-list';
    membersSection.style.cssText = `
      margin: 16px;
      width: calc(100% - 32px);
      max-width: calc(100% - 32px);
      box-sizing: border-box;
    `;

    try {
      const members = await this.sessionManager.getSessionMembers(session.id, false);
      logger.log(`[CurrentSessionTabView] 获取到${members.length}个成员:`, members);
      // 从realtime presence获取在线人数
      const onlineCount = this.sessionManager.getCurrentSessionOnlineCount();
      const totalCount = members.length;

      // 标题
      const membersTitle = doc.createElement('h3');
      membersTitle.textContent = `👥 会话成员 (在线: ${onlineCount} / 总数: ${totalCount})`;
      membersTitle.style.cssText = `
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: ${tabColors.textPrimary};
      `;
      membersSection.appendChild(membersTitle);

      if (members.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无成员';
        emptyText.style.cssText = `color: ${tabColors.textMuted}; font-size: 14px;`;
        membersSection.appendChild(emptyText);
      } else {
        const membersList = doc.createElement('div');
        membersList.style.cssText = `
          display: block;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        `;

        for (const m of members) {
          const memberItem = doc.createElement('div');
          memberItem.style.cssText = `
            padding: 8px 12px;
            background: ${m.is_online ? `${tabColors.info}1A` : tabColors.bgTertiary};
            border-radius: 6px;
            font-size: 13px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: hidden;
            margin-bottom: 8px;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 8px;
          `;

          // 复选框(用于"选中成员"功能)
          const checkbox = doc.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.setAttribute('data-member-checkbox', 'true');
          checkbox.value = m.user_id;
          checkbox.checked = true; // 默认选中
          checkbox.style.cssText = `
            cursor: pointer;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
          `;
          memberItem.appendChild(checkbox);

          // 状态圆点
          const statusDot = doc.createElement('span');
          statusDot.textContent = '●';
          statusDot.style.cssText = `
            color: ${m.is_online ? '#28a745' : '#999'};
            font-size: 10px;
            display: inline-block;
            flex-shrink: 0;
          `;
          memberItem.appendChild(statusDot);

          // 状态文字
          const statusText = doc.createElement('span');
          statusText.textContent = m.is_online ? '在线' : '离线';
          statusText.style.cssText = `
            font-size: 10px;
            color: ${m.is_online ? '#28a745' : '#999'};
            display: inline-block;
            flex-shrink: 0;
          `;
          memberItem.appendChild(statusText);

          // 用户名
          const nameSpan = doc.createElement('span');
          nameSpan.textContent = m.user_name || m.user_email || '未知用户';
          nameSpan.style.cssText = `
            display: inline-block;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            vertical-align: middle;
            flex-shrink: 1;
          `;
          memberItem.appendChild(nameSpan);

          // 角色标签
          const roleSpan = doc.createElement('span');
          roleSpan.textContent = m.role === 'host' ? '主持人' : '参与者';
          roleSpan.style.cssText = `
            padding: 2px 8px;
            background: ${m.role === 'host' ? tabColors.warning : tabColors.bgActive};
            border-radius: 4px;
            font-size: 11px;
            color: ${m.role === 'host' ? '#000' : tabColors.textPrimary};
            display: inline-block;
            flex-shrink: 0;
          `;
          memberItem.appendChild(roleSpan);

          // 页码
          const pageSpan = doc.createElement('span');
          pageSpan.textContent = `P${m.current_page}`;
          pageSpan.style.cssText = `
            color: ${tabColors.textSecondary};
            font-size: 11px;
            display: inline-block;
            flex-shrink: 0;
          `;
          memberItem.appendChild(pageSpan);

          membersList.appendChild(memberItem);
        }

        membersSection.appendChild(membersList);
      }
    } catch (error) {
      logger.error("[CurrentSessionTabView] Error loading members:", error);
      const errorText = doc.createElement('p');
      errorText.textContent = '加载成员列表失败';
      errorText.style.cssText = `color: ${tabColors.danger}; font-size: 14px;`;
      membersSection.appendChild(errorText);
    }

    container.appendChild(membersSection);

    // TODO: 如需要,注册成员更新监听器
    // 参考readingSessionView中的实现
  }

  /**
   * 渲染设置Tab(占位)
   */
  private async renderSettingsTab(container: HTMLElement, doc: Document): Promise<void> {
    const settingsColors = getThemeColors();
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: ${settingsColors.textMuted};">会话信息不可用</div>`;
      return;
    }

    const wrapper = doc.createElement('div');
    wrapper.style.cssText = `
      padding: ${spacing.md};
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    // 标题
    const title = doc.createElement('h3');
    title.textContent = '⚙️ 会话设置';
    title.style.cssText = `
      margin: 0 0 ${spacing.md} 0;
      font-size: ${fontSize.base};
      font-weight: 600;
      color: ${settingsColors.textPrimary};
    `;
    wrapper.appendChild(title);

    // 会话信息
    const infoCard = doc.createElement('div');
    infoCard.style.cssText = `
      background: ${settingsColors.bgSecondary};
      border-radius: ${borderRadius.md};
      padding: ${spacing.md};
      margin-bottom: ${spacing.md};
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const fields = [
      { label: 'DOI', value: session.paper_doi },
      { label: '邀请码', value: session.invite_code || '无' },
      { label: '创建时间', value: formatDate(session.created_at) },
      { label: '会话类型', value: session.session_type === 'public' ? '公共会话' : '私密会话' },
      // 已移除"最大参与人数"限制
    ];

    fields.forEach(field => {
      const row = doc.createElement('div');
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: ${spacing.xs} 0;
        font-size: ${fontSize.sm};
        border-bottom: 1px solid ${settingsColors.borderPrimary};
      `;

      const label = doc.createElement('span');
      label.textContent = field.label;
      label.style.cssText = `
        font-weight: 500;
        color: ${settingsColors.textSecondary};
      `;

      const value = doc.createElement('span');
      value.textContent = field.value;
      value.style.cssText = `
        color: ${settingsColors.textPrimary};
      `;

      row.appendChild(label);
      row.appendChild(value);
      infoCard.appendChild(row);
    });

    wrapper.appendChild(infoCard);

    // 占位提示
    const hint = doc.createElement('div');
    hint.textContent = '更多设置功能开发中...';
    hint.style.cssText = `
      text-align: center;
      color: ${colors.gray};
      font-size: ${fontSize.sm};
      padding: ${spacing.lg};
    `;
    wrapper.appendChild(hint);

    container.appendChild(wrapper);
  }
}

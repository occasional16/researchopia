/**
 * 文献共读会话视图
 * 负责渲染共读会话管理界面(二级页面)
 */

import { logger } from "../../utils/logger";
import { ReadingSessionManager, type ReadingSession, type SessionMember, type SessionAnnotation } from "../readingSessionManager";
import { SessionLogManager } from "../sessionLogManager";
import type { BaseViewContext } from "./types";
import { formatDate, escapeHtml } from "./helpers";
import { AuthManager } from "../auth";
import { containerPadding } from "./styles";
import { UserHoverCardManager } from "./userHoverCard";
import { CurrentSessionHubView } from "./currentSessionHubView";
import { SessionListView } from "./sessionListView";
import { SessionPlazaView } from "./sessionPlazaView";
import { SessionCreateFormView } from "./sessionCreateFormView";
import { SessionJoinPrivateView } from "./sessionJoinPrivateView";
import { createBackButton, createButton } from "./uiHelpers";
import { deduplicateAnnotations, createBatchDisplayToolbar, locateAnnotationInPDF, openPDFReader, type BatchDisplayFilter } from "./annotationUtils";

export class ReadingSessionView {
  private sessionManager = ReadingSessionManager.getInstance();
  private logManager = SessionLogManager.getInstance();
  private userHoverCardManager: UserHoverCardManager;
  private currentSessionHubView: CurrentSessionHubView;
  private currentSessions: ReadingSession[] = [];
  private membersListenerUnsubscribe: (() => void) | null = null;
  private annotationsListenerUnsubscribe: (() => void) | null = null;
  private lastViewBeforeSession: 'plaza' | 'create' | 'join' | 'manage' | null = null; // 记录进入会话前的视图
  private lastFilterType: string = 'others'; // 记录上次的筛选类型
  private selectedMemberIds: Set<string> = new Set(); // 选中的成员ID列表
  private currentViewLevel: 'list' | 'hub' = 'list'; // 记录当前视图层级(list=会话列表, hub=当前会话Hub)

  constructor(private readonly context: BaseViewContext) {
    logger.log("[ReadingSessionView] 📚 Initializing...");
    
    // 初始化UserHoverCardManager
    this.userHoverCardManager = new UserHoverCardManager(context);
    
    // 初始化CurrentSessionHubView
    this.currentSessionHubView = new CurrentSessionHubView(context);
    
    // 注册事件监听器
    this.registerEventListeners();
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
      
      const panels = this.context.getPanelsForCurrentItem();
      if (!panels || panels.length === 0) {
        logger.warn("[ReadingSessionView] No panels found");
        return;
      }
      
      for (const panel of panels) {
        if (!panel.contentSection) continue;
        
        const doc = panel.contentSection.ownerDocument;
        panel.contentSection.innerHTML = '';
        
        logger.log('[ReadingSessionView] Clearing contentSection, in session:', this.sessionManager.isInSession());
        
        // 不修改contentSection样式,保持Zotero原始样式
        
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
        
        // 根据是否在会话中以及用户想要的视图层级显示不同内容
        if (this.sessionManager.isInSession() && this.currentViewLevel === 'hub') {
          logger.log('[ReadingSessionView] Rendering current session hub (3rd level)...');
          // 使用CurrentSessionHubView渲染三级页面
          await this.renderCurrentSessionHub(container, doc);
        } else {
          logger.log('[ReadingSessionView] Rendering session list (2nd level)...');
          await this.renderSessionList(container, doc);
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error rendering:", error);
      this.context.showMessage('渲染失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }

  /**
   * 在指定容器中渲染内容(用于Hub视图)
   */
  public async renderInContainer(container: HTMLElement): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎨 Rendering in container...");
      
      const doc = container.ownerDocument;
      container.innerHTML = '';
      
      // 创建内容容器
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
      
      // 根据是否在会话中显示不同内容
      if (this.sessionManager.isInSession()) {
        logger.log('[ReadingSessionView] Rendering active session in container...');
        await this.renderActiveSession(contentContainer, doc);
      } else {
        logger.log('[ReadingSessionView] Rendering session list in container...');
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
   * 渲染当前会话Hub(三级页面,包含"当前会话"和"会话纪要"两个按钮)
   */
  private async renderCurrentSessionHub(container: HTMLElement, doc: Document): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎨 Rendering current session hub...");
      
      // 设置CurrentSessionHubView的渲染函数
      this.currentSessionHubView.setRenderFunctions(
        // 渲染当前会话内容的函数
        async (contentContainer) => {
          await this.renderActiveSessionContent(contentContainer, doc);
        },
        // 返回按钮的处理函数
        async () => {
          logger.log('[ReadingSessionView] 🔙 Back button clicked, returning to session list');
          // 设置视图层级为列表
          this.currentViewLevel = 'list';
          // 直接渲染会话列表
          await this.renderSessionList(container, doc);
        }
      );
      
      // 渲染Hub
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
   * 渲染当前会话的内容部分(不包含返回按钮和标题框架)
   */
  private async renderActiveSessionContent(container: HTMLElement, doc: Document): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    const member = this.sessionManager.getCurrentMember();
    
    if (!session || !member) {
      container.innerHTML = '<div style="padding: 32px; text-align: center; color: #666;">会话信息加载失败</div>';
      return;
    }

    // 清空容器
    container.innerHTML = '';
    
    logger.log('[ReadingSessionView] Container width:', container.offsetWidth, 'clientWidth:', container.clientWidth);

    // 直接使用传入的container,确保宽度正确
    container.style.cssText = `
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 8px;
      overflow-x: hidden;
      overflow-y: auto;
    `;

    // 会话信息卡片
    const sessionCard = doc.createElement('div');
    sessionCard.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // 论文标题
    const paperTitle = doc.createElement('div');
    paperTitle.innerHTML = `<strong style="font-size: 16px;">${escapeHtml(session.paper_title)}</strong>`;
    paperTitle.style.cssText = `
      margin-bottom: 8px;
      word-break: break-word;
      overflow-wrap: break-word;
    `;
    sessionCard.appendChild(paperTitle);

    // DOI
    const doiDiv = doc.createElement('div');
    doiDiv.textContent = `📄 DOI: ${session.paper_doi}`;
    doiDiv.style.cssText = `
      color: #666; 
      font-size: 13px; 
      margin-bottom: 8px;
      word-break: break-all;
      overflow-wrap: break-word;
    `;
    sessionCard.appendChild(doiDiv);

    // 邀请码
    const inviteCodeDiv = doc.createElement('div');
    inviteCodeDiv.textContent = `🔑 邀请码: ${session.invite_code}`;
    inviteCodeDiv.style.cssText = `
      color: #666; 
      font-size: 13px; 
      margin-bottom: 8px;
      word-break: break-all;
      overflow-wrap: break-word;
    `;
    sessionCard.appendChild(inviteCodeDiv);

    // 创建时间
    const timeDiv = doc.createElement('div');
    timeDiv.textContent = `⏱️ 创建时间: ${formatDate(session.created_at)}`;
    timeDiv.style.cssText = 'color: #666; font-size: 13px;';
    sessionCard.appendChild(timeDiv);

    container.appendChild(sessionCard);

    // 成员列表
    await this.renderMembersList(container, doc, session.id);

    // 标注列表
    await this.renderAnnotationsList(container, doc, session.id);

    // 离开会话按钮
    const leaveButton = doc.createElement('button');
    leaveButton.textContent = '离开会话';
    leaveButton.style.cssText = `
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 16px;
    `;
    leaveButton.addEventListener('click', async () => {
      try {
        await this.sessionManager.leaveSession();
        this.context.showMessage('已离开会话', 'info');
        await this.render();
      } catch (error) {
        logger.error("[ReadingSessionView] Error leaving session:", error);
        this.context.showMessage('离开会话失败', 'error');
      }
    });
    container.appendChild(leaveButton);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    logger.log("[ReadingSessionView] 🧹 Cleaning up...");
    
    // 取消成员监听
    if (this.membersListenerUnsubscribe) {
      this.membersListenerUnsubscribe();
      this.membersListenerUnsubscribe = null;
    }
    
    // 取消标注监听
    if (this.annotationsListenerUnsubscribe) {
      this.annotationsListenerUnsubscribe();
      this.annotationsListenerUnsubscribe = null;
    }
    
    // 清理userHoverCardManager
    if (this.userHoverCardManager) {
      this.userHoverCardManager.cleanup();
    }
  }

  /**
   * 渲染活跃会话界面
   */
  private async renderActiveSession(container: HTMLElement, doc: Document): Promise<void> {
    const session = this.sessionManager.getCurrentSession();
    const member = this.sessionManager.getCurrentMember();
    
    if (!session || !member) {
      container.innerHTML = '<div style="padding: 32px; text-align: center; color: #666;">会话信息加载失败</div>';
      return;
    }

    // 先清空容器
    container.innerHTML = '';
    
    logger.log('[ReadingSessionView] Container width:', container.offsetWidth, 'clientWidth:', container.clientWidth);

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.id = 'session-page-container'; // 先设置ID
    pageContainer.style.cssText = `
      position: relative;
      padding: 44px 12px 16px 12px;
      width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;
      overflow-y: visible;
    `;
    
    // 临时调试:给所有子元素添加边框
    const debugMode = false; // 设为true可看到每个元素边界
    if (debugMode) {
      pageContainer.style.border = '2px solid red';
    }

    // 返回按钮(返回到上一页面，不离开会话)
    const backButton = createBackButton(doc, async () => {
      // 返回到进入会话前的页面
      if (this.lastViewBeforeSession === 'plaza' || this.lastViewBeforeSession === 'manage') {
        await this.renderSessionList(container, doc);
      } else {
        // 默认返回会话列表
        await this.renderSessionList(container, doc);
      }
    });
    pageContainer.appendChild(backButton);

    // 标题
    const title = doc.createElement('h2');
    title.textContent = '文献共读 - 当前会话';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    `;
    pageContainer.appendChild(title);

    // 会话信息卡片
    const sessionCard = doc.createElement('div');
    sessionCard.style.cssText = `
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // 论文标题
    const paperTitle = doc.createElement('div');
    paperTitle.style.cssText = `
      margin-bottom: 8px;
      word-break: break-word;
      overflow-wrap: break-word;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
    const titleStrong = doc.createElement('strong');
    titleStrong.textContent = session.paper_title;
    titleStrong.style.cssText = `
      font-size: 16px;
      word-break: break-word;
      overflow-wrap: break-word;
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
    paperTitle.appendChild(titleStrong);
    sessionCard.appendChild(paperTitle);

    // DOI
    const doiDiv = doc.createElement('div');
    doiDiv.textContent = `📄 DOI: ${session.paper_doi}`;
    doiDiv.style.cssText = `
      color: #666;
      font-size: 13px;
      margin-bottom: 8px;
      word-break: break-all;
      overflow-wrap: break-word;
    `;
    sessionCard.appendChild(doiDiv);

    // 邀请码 - 突出显示并可点击复制
    const inviteCodeDiv = doc.createElement('div');
    inviteCodeDiv.style.cssText = `
      color: #666;
      font-size: 13px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    `;
    
    const inviteLabel = doc.createElement('span');
    inviteLabel.textContent = '🔑 邀请码:';
    inviteCodeDiv.appendChild(inviteLabel);

    const inviteCodeButton = doc.createElement('button');
    inviteCodeButton.textContent = session.invite_code;
    inviteCodeButton.title = '点击复制邀请码';
    inviteCodeButton.style.cssText = `
      font-family: 'Courier New', monospace;
      font-size: 15px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    inviteCodeButton.addEventListener('mouseenter', () => {
      inviteCodeButton.style.transform = 'translateY(-2px)';
      inviteCodeButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    });
    inviteCodeButton.addEventListener('mouseleave', () => {
      inviteCodeButton.style.transform = 'translateY(0)';
      inviteCodeButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });
    inviteCodeButton.addEventListener('click', () => {
      // 复制到剪贴板
      try {
        const Services = (globalThis as any).Services || (Zotero as any).getMainWindow().Services;
        const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
          .getService(Components.interfaces.nsIClipboardHelper);
        clipboardHelper.copyString(session.invite_code);
        
        // 显示复制成功提示
        this.context.showMessage('邀请码已复制到剪贴板', 'info');
        
        // 临时改变按钮文字
        const originalText = inviteCodeButton.textContent;
        inviteCodeButton.textContent = '✓ 已复制';
        inviteCodeButton.style.background = '#28a745';
        setTimeout(() => {
          inviteCodeButton.textContent = originalText;
          inviteCodeButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }, 1500);
      } catch (error) {
        logger.error('[ReadingSessionView] 复制邀请码失败:', error);
        this.context.showMessage('复制失败', 'error');
      }
    });
    inviteCodeDiv.appendChild(inviteCodeButton);
    sessionCard.appendChild(inviteCodeDiv);

    // 创建时间
    const timeDiv = doc.createElement('div');
    timeDiv.textContent = `⏱️ 创建时间: ${formatDate(session.created_at)}`;
    timeDiv.style.cssText = 'color: #666; font-size: 13px;';
    sessionCard.appendChild(timeDiv);

    pageContainer.appendChild(sessionCard);

    // 成员列表区域
    await this.renderMembersList(pageContainer, doc, session.id);

    // 标注列表区域
    await this.renderAnnotationsList(pageContainer, doc, session.id);

    // 会议纪要按钮容器
    const minutesContainer = doc.createElement('div');
    minutesContainer.style.cssText = 'position: relative; display: inline-block; margin-top: 16px; margin-right: 12px;';
    
    // 会议纪要按钮
    const minutesButton = doc.createElement('button');
    minutesButton.id = 'minutes-button';
    minutesButton.textContent = '📋 会议纪要';
    minutesButton.style.cssText = `
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
      max-width: 100%;
      box-sizing: border-box;
    `;
    minutesButton.addEventListener('mouseenter', () => {
      minutesButton.style.transform = 'translateY(-2px)';
      minutesButton.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.6)';
    });
    minutesButton.addEventListener('mouseleave', () => {
      minutesButton.style.transform = 'translateY(0)';
      minutesButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
    });
    minutesButton.addEventListener('click', async () => {
      // 标记为已读
      this.logManager.markAsRead(session.id);
      // 移除徽章
      const badge = doc.getElementById('unread-badge');
      if (badge) badge.remove();
      // TODO: 会话纪要功能开发中
      this.context.showMessage('会话纪要功能正在开发中', 'info');
    });
    
    // 未读消息徽章
    const unreadBadge = doc.createElement('span');
    unreadBadge.id = 'unread-badge';
    unreadBadge.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      background: #dc3545;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: none;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    minutesContainer.appendChild(minutesButton);
    minutesContainer.appendChild(unreadBadge);
    pageContainer.appendChild(minutesContainer);
    
    // 获取未读消息数
    this.updateUnreadBadge(session.id, doc);
    
    // 定时轮询更新未读数(每10秒)
    if (this.unreadPollingInterval) {
      clearInterval(this.unreadPollingInterval);
    }
    this.unreadPollingInterval = setInterval(async () => {
      await this.updateUnreadBadge(session.id, doc);
    }, 10000);

    // 离开会话按钮
    const leaveButton = doc.createElement('button');
    leaveButton.textContent = '离开会话';
    leaveButton.style.cssText = `
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      margin-top: 16px;
      max-width: 100%;
      box-sizing: border-box;
    `;
    leaveButton.addEventListener('click', async () => {
      try {
        await this.sessionManager.leaveSession();
        this.context.showMessage('已离开会话', 'info');
        await this.render();
      } catch (error) {
        logger.error("[ReadingSessionView] Error leaving session:", error);
        this.context.showMessage('离开会话失败', 'error');
      }
    });
    pageContainer.appendChild(leaveButton);

    container.appendChild(pageContainer);
  }

  /**
   * 渲染成员列表
   */
  private async renderMembersList(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    const membersSection = doc.createElement('div');
    membersSection.id = 'session-members-list';
    membersSection.style.cssText = `
      margin-bottom: 16px;
    `;

    try {
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineCount = members.filter(m => m.is_online).length;
      const totalCount = members.length;
      
      const membersTitle = doc.createElement('h3');
      membersTitle.textContent = `👥 会话成员 (在线: ${onlineCount} / 总数: ${totalCount})`;
      membersTitle.style.cssText = `
        margin: 0 0 12px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      `;
      membersSection.appendChild(membersTitle);
      
      if (members.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无成员';
        emptyText.style.cssText = 'color: #999; font-size: 14px;';
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
            background: ${m.is_online ? '#e7f5ff' : '#f1f3f5'};
            border-radius: 6px;
            font-size: 13px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: hidden;
            margin-bottom: 8px;
            white-space: nowrap;
          `;

          const statusDot = doc.createElement('span');
          statusDot.textContent = '●';
          statusDot.style.cssText = `
            color: ${m.is_online ? '#28a745' : '#999'};
            font-size: 10px;
            display: inline-block;
            margin-right: 4px;
          `;

          const statusText = doc.createElement('span');
          statusText.textContent = m.is_online ? '在线' : '离线';
          statusText.style.cssText = `
            font-size: 10px;
            color: ${m.is_online ? '#28a745' : '#999'};
            margin-right: 8px;
            display: inline-block;
          `;

          const nameSpan = doc.createElement('span');
          nameSpan.textContent = m.user_name || m.user_email || '未知用户';
          nameSpan.style.cssText = `
            margin-right: 8px;
            display: inline-block;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            vertical-align: middle;
          `;

          const roleSpan = doc.createElement('span');
          roleSpan.textContent = m.role === 'host' ? '主持人' : '参与者';
          roleSpan.style.cssText = `
            padding: 2px 8px;
            background: ${m.role === 'host' ? '#ffd43b' : '#adb5bd'};
            border-radius: 4px;
            font-size: 11px;
            color: #000;
            display: inline-block;
            margin-right: 8px;
          `;

          const pageSpan = doc.createElement('span');
          pageSpan.textContent = `P${m.current_page}`;
          pageSpan.style.cssText = `
            color: #666;
            font-size: 11px;
            display: inline-block;
          `;

          memberItem.appendChild(statusDot);
          memberItem.appendChild(statusText);
          memberItem.appendChild(nameSpan);
          memberItem.appendChild(roleSpan);
          memberItem.appendChild(pageSpan);
          membersList.appendChild(memberItem);
        }

        membersSection.appendChild(membersList);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error loading members:", error);
      const errorText = doc.createElement('p');
      errorText.textContent = '加载成员列表失败';
      errorText.style.cssText = 'color: #dc3545; font-size: 14px;';
      membersSection.appendChild(errorText);
    }

    container.appendChild(membersSection);

    // 清理之前的成员监听器
    if (this.membersListenerUnsubscribe) {
      this.membersListenerUnsubscribe();
      this.membersListenerUnsubscribe = null;
    }

    // 注册成员更新监听器(仅注册一次)
    const listener = (members: SessionMember[]) => {
      logger.log("[ReadingSessionView] Members updated, re-rendering...");
      this.refreshMembersList(doc, sessionId);
    };
    this.sessionManager.onMembersChange(listener);
    
    // 保存取消订阅的函数(如果ReadingSessionManager提供了的话)
    // this.membersListenerUnsubscribe = () => { /* 取消订阅逻辑 */ };
  }

  /**
   * 刷新成员列表(仅更新DOM,不重新注册监听器)
   */
  private async refreshMembersList(doc: Document, sessionId: string): Promise<void> {
    const membersSection = doc.getElementById('session-members-list');
    if (!membersSection) return;

    try {
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineCount = members.filter(m => m.is_online).length;
      const totalCount = members.length;
      
      // 清空现有内容
      membersSection.innerHTML = '';
      
      // 添加标题
      const title = doc.createElement('h3');
      title.textContent = `👥 会话成员 (在线: ${onlineCount} / 总数: ${totalCount})`;
      title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #333;';
      membersSection.appendChild(title);

      if (members.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无成员';
        emptyText.style.cssText = 'color: #999; font-size: 14px;';
        membersSection.appendChild(emptyText);
      } else {
        const membersList = doc.createElement('div');
        membersList.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        `;

        for (const m of members) {
          const memberItem = doc.createElement('div');
          memberItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: ${m.is_online ? '#e7f5ff' : '#f1f3f5'};
            border-radius: 6px;
            font-size: 13px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: hidden;
          `;

          const statusDot = doc.createElement('span');
          statusDot.textContent = '●';
          statusDot.style.cssText = `
            color: ${m.is_online ? '#28a745' : '#999'};
            font-size: 10px;
            flex-shrink: 0;
          `;

          const statusText = doc.createElement('span');
          statusText.textContent = m.is_online ? '在线' : '离线';
          statusText.style.cssText = `
            font-size: 10px;
            color: ${m.is_online ? '#28a745' : '#999'};
            margin-right: 4px;
            flex-shrink: 0;
          `;

          const nameSpan = doc.createElement('span');
          nameSpan.textContent = m.user_name || m.user_email || '未知用户';
          nameSpan.style.cssText = `
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `;

          const roleSpan = doc.createElement('span');
          roleSpan.textContent = m.role === 'host' ? '主持人' : '参与者';
          roleSpan.style.cssText = `
            padding: 2px 8px;
            background: ${m.role === 'host' ? '#ffd43b' : '#adb5bd'};
            border-radius: 4px;
            font-size: 11px;
            color: #000;
            flex-shrink: 0;
            white-space: nowrap;
          `;

          const pageSpan = doc.createElement('span');
          pageSpan.textContent = `P${m.current_page}`;
          pageSpan.style.cssText = `
            color: #666;
            font-size: 11px;
            flex-shrink: 0;
            white-space: nowrap;
          `;

          memberItem.appendChild(statusDot);
          memberItem.appendChild(statusText);
          memberItem.appendChild(nameSpan);
          memberItem.appendChild(roleSpan);
          memberItem.appendChild(pageSpan);
          membersList.appendChild(memberItem);
        }

        membersSection.appendChild(membersList);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error refreshing members:", error);
    }
  }

  /**
   * 渲染标注列表
   */
  private async renderAnnotationsList(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    const annotationsSection = doc.createElement('div');
    annotationsSection.id = 'session-annotations-list';
    annotationsSection.style.cssText = `
      margin-bottom: 16px;
    `;

    try {
      let annotations = await this.sessionManager.getSessionAnnotations(sessionId, 1, 100);
      
      // 获取在线成员列表
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineUserIds = new Set(members.filter(m => m.is_online).map(m => m.user_id));
      
      // 仅显示在线成员的标注
      annotations = annotations.filter(a => onlineUserIds.has(a.user_id));
      
      // 去重 - 使用id作为唯一标识
      const uniqueAnnotations = deduplicateAnnotations(annotations);
      logger.log(`[ReadingSessionView] Deduplicated ${annotations.length} annotations to ${uniqueAnnotations.length} (online users only)`);
      
      // 使用去重后的数据
      annotations = uniqueAnnotations;
      
      // 标题和数量
      const headerDiv = doc.createElement('div');
      headerDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      `;

      const annotationsTitle = doc.createElement('h3');
      annotationsTitle.textContent = '📝 共享标注 (仅在线成员)';
      annotationsTitle.style.cssText = `
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      `;

      const countBadge = doc.createElement('span');
      countBadge.id = 'annotations-count-badge';
      countBadge.textContent = `${annotations.length}`;
      countBadge.style.cssText = `
        background: #0d6efd;
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
      `;

      headerDiv.appendChild(annotationsTitle);
      headerDiv.appendChild(countBadge);
      annotationsSection.appendChild(headerDiv);

      if (annotations.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无标注';
        emptyText.style.cssText = 'color: #999; font-size: 14px;';
        annotationsSection.appendChild(emptyText);
      } else {
        // 批量显示工具栏
        const batchToolbar = this.createBatchDisplayToolbar(doc);
        annotationsSection.appendChild(batchToolbar);
        
        // 筛选排序工具栏
        const toolbar = this.createAnnotationsToolbar(doc, sessionId);
        annotationsSection.appendChild(toolbar);

        // 标注列表容器
        const annotationsList = doc.createElement('div');
        annotationsList.id = 'annotations-list-container';
        annotationsList.style.cssText = `
          display: block;
          max-height: 400px;
          overflow-y: auto;
          overflow-x: hidden;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        `;

        // 默认按最新优先排序
        const sortedAnnotations = [...annotations].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // 渲染标注卡片
        this.renderAnnotationCards(annotationsList, sortedAnnotations, doc);

        annotationsSection.appendChild(annotationsList);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error loading annotations:", error);
      const errorText = doc.createElement('p');
      errorText.textContent = '加载标注列表失败';
      errorText.style.cssText = 'color: #dc3545; font-size: 14px;';
      annotationsSection.appendChild(errorText);
    }

    container.appendChild(annotationsSection);

    // 清理之前的标注监听器
    if (this.annotationsListenerUnsubscribe) {
      this.annotationsListenerUnsubscribe();
      this.annotationsListenerUnsubscribe = null;
    }

    // 注册标注更新监听器(仅注册一次)
    const listener = (event: any) => {
      logger.log("[ReadingSessionView] Annotation updated, re-rendering...");
      this.refreshAnnotationsList(doc, sessionId);
    };
    this.sessionManager.onAnnotation(listener);
    
    // 保存取消订阅的函数(如果ReadingSessionManager提供了的话)
    // this.annotationsListenerUnsubscribe = () => { /* 取消订阅逻辑 */ };
  }

  /**
   * 创建批量显示工具栏(用于PDF页面上批量显示/隐藏标注)
   */
  private createBatchDisplayToolbar(doc: Document): HTMLElement {
    // 使用统一的工具栏创建函数，但需要自定义按钮
    return createBatchDisplayToolbar(
      doc,
      async (filter: BatchDisplayFilter) => {
        // 映射过滤器类型到操作
        const actionMap: Record<BatchDisplayFilter, string> = {
          'all': 'show-all',
          'following': 'show-selected',  // 在共读中对应"选中成员"
          'toggle-native': 'toggle-native',
          'clear': 'hide-all'
        };
        await this.handleBatchDisplay(actionMap[filter]);
      },
      {
        showFollowingButton: true,
        followingButtonText: "选中成员",  // 自定义为"选中成员"
        toggleNativeText: undefined  // 暂不使用toggle-native功能
      }
    );
  }

  /**
   * 处理批量显示操作
   */
  private async handleBatchDisplay(action: string): Promise<void> {
    try {
      logger.log(`[ReadingSessionView] 🎯 Handling batch display action: ${action}`);
      
      const panels = this.context.getPanelsForCurrentItem();
      if (!panels || panels.length === 0) {
        this.context.showMessage("未找到面板", "error");
        return;
      }

      const doc = panels[0].contentSection?.ownerDocument;
      if (!doc) {
        this.context.showMessage("未找到文档", "error");
        return;
      }

      // 获取当前会话的DOI
      const session = this.sessionManager.getCurrentSession();
      if (!session) {
        this.context.showMessage("未找到当前会话", "error");
        return;
      }

      const doi = session.paper_doi;
      if (!doi) {
        this.context.showMessage("会话缺少DOI信息", "error");
        return;
      }

      // 动态导入PDFReaderManager
      const { PDFReaderManager } = await import("../pdfReaderManager");
      const readerManager = PDFReaderManager.getInstance();

      // 查找已打开的PDF阅读器
      const reader = await readerManager.findOpenReader(doi);
      if (!reader) {
        this.context.showMessage("请先打开PDF文件", "warning");
        return;
      }

      // 获取会话标注列表
      const listContainer = doc.getElementById("annotations-list-container");
      if (!listContainer) {
        this.context.showMessage("未找到标注列表", "error");
        return;
      }

      const annotationCards = listContainer.querySelectorAll("[data-annotation-id]");
      
      // 获取所有会话标注
      const sessionAnnotations = await this.sessionManager.getSessionAnnotations(session.id, 1, 1000);
      
      switch (action) {
        case "show-all":
          // 显示所有标注
          logger.log(`[ReadingSessionView] Showing all ${annotationCards.length} annotations`);
          let showCount = 0;
          for (const card of Array.from(annotationCards)) {
            const annotationId = (card as HTMLElement).getAttribute("data-annotation-id");
            if (annotationId) {
              const sessionAnnotation = sessionAnnotations.find(a => a.id === annotationId);
              if (sessionAnnotation) {
                const sharedAnnotation = this.convertToSharedAnnotation(sessionAnnotation);
                if (sharedAnnotation) {
                  await readerManager.highlightAnnotation(reader, sharedAnnotation);
                  showCount++;
                }
              }
            }
          }
          this.context.showMessage(`已在PDF上显示${showCount}个标注`, "info");
          break;

        case "show-selected":
          // 显示选中成员的标注
          const selectedMembers = Array.from(doc.querySelectorAll('[data-member-checkbox]:checked'))
            .map(cb => (cb as HTMLInputElement).value);
          
          if (selectedMembers.length === 0) {
            this.context.showMessage("请先选择成员", "warning");
            return;
          }

          let selectedCount = 0;
          for (const card of Array.from(annotationCards)) {
            const userId = (card as HTMLElement).getAttribute("data-user-id");
            const annotationId = (card as HTMLElement).getAttribute("data-annotation-id");
            
            if (userId && selectedMembers.includes(userId) && annotationId) {
              const sessionAnnotation = sessionAnnotations.find(a => a.id === annotationId);
              if (sessionAnnotation) {
                const sharedAnnotation = this.convertToSharedAnnotation(sessionAnnotation);
                if (sharedAnnotation) {
                  await readerManager.highlightAnnotation(reader, sharedAnnotation);
                  selectedCount++;
                }
              }
            }
          }
          this.context.showMessage(`已在PDF上显示${selectedCount}个标注`, "info");
          break;

        case "hide-all":
          // 隐藏所有标注
          logger.log("[ReadingSessionView] Hiding all annotations");
          await readerManager.clearAllHighlights(reader);
          this.context.showMessage("已清除所有标注显示", "info");
          break;
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error handling batch display:", error);
      this.context.showMessage("操作失败: " + (error instanceof Error ? error.message : String(error)), "error");
    }
  }

  /**
   * 将SessionAnnotation转换为SharedAnnotation格式
   */
  private convertToSharedAnnotation(sessionAnnotation: SessionAnnotation): any | null {
    try {
      const annotationData = sessionAnnotation.annotation_data;
      if (!annotationData || !annotationData.position) {
        logger.warn(`[ReadingSessionView] Invalid annotation data for ${sessionAnnotation.id}`);
        return null;
      }

      return {
        id: sessionAnnotation.id,
        type: annotationData.type || 'highlight',
        content: annotationData.text || annotationData.comment || '',
        comment: annotationData.comment,
        color: annotationData.color || '#ffd400',
        position: annotationData.position,
        username: sessionAnnotation.user_name || sessionAnnotation.user_email,
        show_author_name: true,
        created_at: sessionAnnotation.created_at,
        user_id: sessionAnnotation.user_id
      };
    } catch (error) {
      logger.error(`[ReadingSessionView] Error converting annotation ${sessionAnnotation.id}:`, error);
      return null;
    }
  }

  /**
   * 创建标注工具栏（筛选排序）
   */
  private createAnnotationsToolbar(doc: Document, sessionId: string): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      margin-bottom: 12px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 6px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    `;

    // 排序选择器
    const sortSelect = doc.createElement('select');
    sortSelect.id = 'annotation-sort-select';
    sortSelect.style.cssText = `
      padding: 6px 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      color: #495057;
      font-size: 12px;
      cursor: pointer;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      margin-bottom: 8px;
    `;

    const sortOptions = [
      { value: 'time-desc', label: '⏰ 最新优先' },
      { value: 'time-asc', label: '⏰ 最早优先' },
      { value: 'page', label: '📄 按页码排序' },
    ];

    sortOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      sortSelect.appendChild(option);
    });
    
    // 设置默认值为"最新优先"
    sortSelect.value = 'time-desc';

    sortSelect.addEventListener('change', async () => {
      const filterSelect = doc.getElementById('annotation-filter-select') as HTMLSelectElement;
      await this.applySortFilter(doc, sessionId, sortSelect.value, filterSelect?.value || 'all');
    });

    toolbar.appendChild(sortSelect);
    
    // "只显示关注成员"选择器
    const filterSelect = doc.createElement('select');
    filterSelect.id = 'annotation-filter-select';
    filterSelect.style.cssText = `
      padding: 6px 10px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      color: #495057;
      font-size: 12px;
      cursor: pointer;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;
    
    const filterOptions = [
      { value: 'others', label: '👥 其他成员' },
      { value: 'all', label: '🌐 所有成员（包括我）' },
      { value: 'followed', label: '⭐ 关注成员（不包括我）' },
      { value: 'select', label: '👤 选择成员...' },
    ];
    
    // 默认选中"其他成员"
    filterSelect.value = 'others';
    
    filterOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      filterSelect.appendChild(option);
    });
    
    filterSelect.addEventListener('change', async () => {
      if (filterSelect.value === 'select') {
        // 显示成员选择对话框
        await this.showMemberSelectionDialog(doc, sessionId, sortSelect);
        // 重置为上一个选项
        filterSelect.value = this.lastFilterType || 'others';
      } else {
        this.lastFilterType = filterSelect.value;
        await this.applySortFilter(doc, sessionId, sortSelect.value, filterSelect.value);
      }
    });
    
    // 初始应用筛选(默认显示其他成员)
    setTimeout(() => {
      this.applySortFilter(doc, sessionId, sortSelect.value, 'others');
    }, 100);
    
    toolbar.appendChild(filterSelect);

    return toolbar;
  }

  /**
   * 显示成员选择对话框
   */
  private async showMemberSelectionDialog(doc: Document, sessionId: string, sortSelect: HTMLSelectElement): Promise<void> {
    try {
      // 获取所有在线成员
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineMembers = members.filter(m => m.is_online);
      
      // 创建遮罩层
      const overlay = doc.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      // 创建对话框
      const dialog = doc.createElement('div');
      dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        max-height: 500px;
        overflow: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      `;

      const title = doc.createElement('h3');
      title.textContent = '选择要显示的成员';
      title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px; color: #333;';
      dialog.appendChild(title);

      // 创建成员复选框列表
      const memberList = doc.createElement('div');
      memberList.style.cssText = 'margin-bottom: 15px;';

      for (const member of onlineMembers) {
        const label = doc.createElement('label');
        label.style.cssText = `
          display: flex;
          align-items: center;
          padding: 8px;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        `;
        label.addEventListener('mouseenter', () => {
          label.style.background = '#f8f9fa';
        });
        label.addEventListener('mouseleave', () => {
          label.style.background = 'transparent';
        });

        const checkbox = doc.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = member.user_id;
        checkbox.checked = this.selectedMemberIds.has(member.user_id);
        checkbox.style.marginRight = '8px';

        const name = doc.createElement('span');
        name.textContent = member.user_name || member.user_email || '未知用户';

        label.appendChild(checkbox);
        label.appendChild(name);
        memberList.appendChild(label);
      }

      dialog.appendChild(memberList);

      // 按钮容器
      const buttonContainer = doc.createElement('div');
      buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      `;

      // 取消按钮
      const cancelBtn = doc.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText = `
        padding: 8px 16px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelBtn.addEventListener('click', () => {
        doc.body.removeChild(overlay);
      });

      // 确认按钮
      const confirmBtn = doc.createElement('button');
      confirmBtn.textContent = '确认';
      confirmBtn.style.cssText = `
        padding: 8px 16px;
        background: #0d6efd;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      `;
      confirmBtn.addEventListener('click', async () => {
        // 收集选中的成员ID
        this.selectedMemberIds.clear();
        const checkboxes = memberList.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => this.selectedMemberIds.add(cb.value));
        
        // 应用自定义筛选
        await this.applySortFilter(doc, sessionId, sortSelect.value, 'custom');
        doc.body.removeChild(overlay);
      });

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(confirmBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);
    } catch (error) {
      logger.error("[ReadingSessionView] Error showing member selection dialog:", error);
    }
  }

  /**
   * 应用排序筛选
   */
  private async applySortFilter(doc: Document, sessionId: string, sortType: string, filterType: string = 'all'): Promise<void> {
    try {
      const listContainer = doc.getElementById('annotations-list-container');
      if (!listContainer) return;

      let annotations = await this.sessionManager.getSessionAnnotations(sessionId, 1, 100);
      
      // 获取在线成员列表用于过滤
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineUserIds = new Set(members.filter(m => m.is_online).map(m => m.user_id));
      
      // 仅显示在线成员的标注
      annotations = annotations.filter(a => onlineUserIds.has(a.user_id));
      
      // 获取当前用户ID
      const currentUser = AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id;
      
      // 根据筛选类型过滤
      if (filterType === 'others') {
        // 其他成员:排除当前用户
        if (currentUserId) {
          annotations = annotations.filter(a => a.user_id !== currentUserId);
        }
      } else if (filterType === 'all') {
        // 所有成员(包括我):显示所有在线成员的标注
        // 已经在上面过滤过了,无需额外操作
      } else if (filterType === 'followed') {
        // 关注成员(不包括我):显示关注的用户,但排除自己
        // TODO: 实现关注功能需要后端支持(创建user_follows表)
        logger.warn("[ReadingSessionView] 关注成员筛选功能需要后端user_follows表支持,暂未实现");
        
        // 暂时使用"其他成员"作为替代
        if (currentUserId) {
          annotations = annotations.filter(a => a.user_id !== currentUserId);
        }
        
        // 显示提示信息
        const listContainer = doc.getElementById('annotations-list-container');
        if (listContainer) {
          const notice = doc.createElement('div');
          notice.style.cssText = `
            padding: 12px;
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 6px;
            margin-bottom: 10px;
            color: #856404;
            font-size: 13px;
          `;
          notice.textContent = '💡 关注功能需要后端支持,当前暂时显示其他成员的标注';
          listContainer.insertBefore(notice, listContainer.firstChild);
        }
      } else if (filterType === 'custom') {
        // 自定义选择:仅显示选中的成员
        annotations = annotations.filter(a => this.selectedMemberIds.has(a.user_id));
      }

      // 排序
      let sortedAnnotations = [...annotations];
      switch (sortType) {
        case 'page':
          sortedAnnotations.sort((a, b) => a.page_number - b.page_number);
          break;
        case 'time-desc':
          sortedAnnotations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'time-asc':
          sortedAnnotations.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
      }

      // 重新渲染列表
      listContainer.innerHTML = '';
      this.renderAnnotationCards(listContainer, sortedAnnotations, doc);

    } catch (error) {
      logger.error("[ReadingSessionView] Error applying sort:", error);
    }
  }

  /**
   * 渲染标注卡片
   */
  private renderAnnotationCards(container: HTMLElement, annotations: SessionAnnotation[], doc: Document): void {
    for (const annotation of annotations) {
      const annotationCard = doc.createElement('div');
      annotationCard.setAttribute('data-annotation-id', annotation.id);
      annotationCard.setAttribute('data-page-number', String(annotation.page_number));
      annotationCard.setAttribute('data-user-id', annotation.user_id || '');
      
      // 从annotation_data中提取颜色,如果没有则使用默认黄色
      const annotationColor = annotation.annotation_data?.color || '#ffd400';
      
      annotationCard.style.cssText = `
        padding: 12px;
        background: var(--material-background);
        border-radius: 6px;
        border-left: 4px solid ${annotationColor};
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        margin-bottom: 12px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
      `;

      // 添加hover效果
      annotationCard.addEventListener('mouseenter', () => {
        annotationCard.style.transform = 'translateY(-2px)';
        annotationCard.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      });

      annotationCard.addEventListener('mouseleave', () => {
        annotationCard.style.transform = 'translateY(0)';
        annotationCard.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      });

      // 点击卡片定位到PDF页面
      annotationCard.addEventListener('click', async () => {
        await this.handleLocateAnnotation(annotation);
      });

      // 头部区域 - 用户信息和页码
      const headerDiv = doc.createElement('div');
      headerDiv.style.cssText = `
        margin-bottom: 10px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow: hidden;
      `;

      // 用户信息 - 使用UserHoverCardManager
      const userInfo = doc.createElement('div');
      userInfo.style.cssText = `
        font-size: 12px;
        color: var(--fill-secondary);
        margin-bottom: 4px;
        word-break: break-word;
        overflow-wrap: break-word;
      `;

      const username = annotation.user_id || '';
      const displayName = annotation.user_name || annotation.user_email || '未知用户';
      
      const userElement = this.userHoverCardManager.createUserElement(
        doc,
        username,
        displayName,
        { isAnonymous: false, clickable: true }
      );
      userInfo.appendChild(userElement);

      const separator = doc.createElement('span');
      separator.style.color = 'var(--fill-tertiary)';
      separator.textContent = '·';
      userInfo.appendChild(separator);

      const timeSpan = doc.createElement('span');
      timeSpan.style.color = 'var(--fill-tertiary)';
      timeSpan.textContent = formatDate(annotation.created_at);
      userInfo.appendChild(timeSpan);

      // 页码标签
      const pageInfo = doc.createElement('span');
      pageInfo.textContent = `第 ${annotation.page_number} 页`;
      pageInfo.style.cssText = `
        background: #e7f5ff;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 12px;
        color: #0d6efd;
        display: inline-block;
      `;

      headerDiv.appendChild(userInfo);
      headerDiv.appendChild(pageInfo);
      annotationCard.appendChild(headerDiv);

      // 标注内容 - 带有背景色
      const annotationText = annotation.annotation_data?.text || 
                            annotation.annotation_data?.comment || 
                            '(无内容)';
      
      if (annotationText !== '(无内容)') {
        const contentDiv = doc.createElement('div');
        contentDiv.style.cssText = `
          font-size: 13px;
          line-height: 1.5;
          color: var(--fill-primary);
          background: ${annotationColor}20;
          padding: 8px;
          border-radius: 3px;
          word-break: break-word;
          overflow-wrap: break-word;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        `;
        contentDiv.textContent = annotationText;
        annotationCard.appendChild(contentDiv);
      }

      container.appendChild(annotationCard);
    }
  }

  /**
   * 处理标注定位
   */
  private async handleLocateAnnotation(annotation: SessionAnnotation): Promise<void> {
    try {
      logger.log("[ReadingSessionView] 🎯 Locating annotation:", annotation.id);
      logger.log("[ReadingSessionView] 📄 Full annotation object:", JSON.stringify(annotation));

      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        this.context.showMessage('请先选择一篇文献', 'warning');
        return;
      }

      const doi = currentItem.getField('DOI');
      if (!doi) {
        this.context.showMessage('该文献没有DOI,无法定位', 'warning');
        return;
      }

      // 使用PDFReaderManager来高亮显示标注
      const { PDFReaderManager } = await import('../pdfReaderManager');
      const readerManager = PDFReaderManager.getInstance();
      await readerManager.initialize();

      let reader = await readerManager.findOpenReader(doi);

      if (!reader) {
        logger.log("[ReadingSessionView] Reader not found, trying to open PDF...");
        const opened = await this.openPDFReader(currentItem, annotation.page_number);

        if (opened) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          reader = await readerManager.findOpenReader(doi);
        }
      }

      if (!reader) {
        this.context.showMessage('无法打开PDF阅读器', 'error');
        return;
      }

      // 构造标注数据
      // annotation_data应该包含完整的标注信息(text, comment, type, color, position等)
      const annotationData = annotation.annotation_data || {};
      
      // 尝试从多个来源获取position
      let position = annotationData.position;
      
      // 检查position是否为字符串，如果是则解析
      if (typeof position === 'string') {
        try {
          position = JSON.parse(position);
          logger.log("[ReadingSessionView] ✅ Parsed position from string");
        } catch (error) {
          logger.error("[ReadingSessionView] ❌ Failed to parse position string:", error);
          position = null;
        }
      }
      
      // 如果annotation_data中没有position,尝试使用page_number构造
      if (!position || typeof position.pageIndex !== 'number') {
        position = { 
          pageIndex: annotation.page_number - 1 
        };
        logger.log("[ReadingSessionView] ⚠️ No valid position in annotation_data, using page_number:", annotation.page_number);
      }

      logger.log("[ReadingSessionView] 🎯 Using position:", JSON.stringify(position));

      const success = await readerManager.highlightAnnotation(
        reader,
        {
          id: annotation.id,
          type: annotationData.type || 'highlight',
          content: annotationData.text || annotationData.comment || '',
          comment: annotationData.comment,
          color: annotationData.color || '#ffd400',
          position: position,
          username: annotation.user_name || annotation.user_email,
          user_id: annotation.user_id,
          created_at: annotation.created_at
        },
        {
          scrollToView: true,
          showPopup: true
        }
      );

      if (success) {
        this.context.showMessage(`已定位到第 ${annotation.page_number} 页`, 'info');
        
        // 高亮显示插件面板中的卡片
        this.highlightAnnotationCard(annotation.id);
      } else {
        this.context.showMessage('定位失败', 'error');
      }

    } catch (error) {
      logger.error("[ReadingSessionView] Error locating annotation:", error);
      this.context.showMessage('定位失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  /**
   * 打开PDF阅读器到指定页面
   */
  private async openPDFReader(item: any, pageNumber?: number): Promise<boolean> {
    try {
      const attachmentIDs = item.getAttachments();

      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.isPDFAttachment?.()) {
          const location = pageNumber ? { pageIndex: pageNumber - 1 } : { pageIndex: 0 };
          
          if ((Zotero as any).FileHandlers && (Zotero as any).FileHandlers.open) {
            await (Zotero as any).FileHandlers.open(attachment, { location });
          } else {
            await (Zotero as any).OpenPDF?.openToPage?.(attachment, pageNumber || 1);
          }
          return true;
        }
      }

      logger.warn("[ReadingSessionView] No PDF attachment found");
      return false;
    } catch (error) {
      logger.error("[ReadingSessionView] Error opening PDF:", error);
      return false;
    }
  }

  /**
   * 高亮显示标注卡片
   */
  private highlightAnnotationCard(annotationId: string): void {
    try {
      const panels = this.context.getPanelsForCurrentItem();
      for (const panel of panels) {
        if (!panel.contentSection) continue;

        const card = panel.contentSection.querySelector(`[data-annotation-id="${annotationId}"]`) as HTMLElement;
        if (card) {
          // 保存原始样式
          const originalBackground = card.style.background;
          const originalTransform = card.style.transform;

          // 添加高亮效果
          card.style.background = 'linear-gradient(135deg, rgba(13, 110, 253, 0.1) 0%, rgba(13, 110, 253, 0.05) 100%)';
          card.style.transform = 'scale(1.02)';
          card.style.boxShadow = '0 4px 12px rgba(13, 110, 253, 0.3)';

          // 2秒后恢复原始样式
          setTimeout(() => {
            card.style.background = originalBackground;
            card.style.transform = originalTransform;
            card.style.boxShadow = '';
          }, 2000);

          // 滚动到卡片
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error highlighting card:", error);
    }
  }

  /**
   * 刷新标注列表
   */
  /**
   * 刷新标注列表(仅更新DOM,不重新注册监听器)
   */
  private async refreshAnnotationsList(doc: Document, sessionId: string): Promise<void> {
    const annotationsSection = doc.getElementById('session-annotations-list');
    if (!annotationsSection) return;

    try {
      let annotations = await this.sessionManager.getSessionAnnotations(sessionId, 1, 100);
      
      // 获取在线成员列表,过滤仅在线成员的标注
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineUserIds = new Set(members.filter(m => m.is_online).map(m => m.user_id));
      annotations = annotations.filter(a => onlineUserIds.has(a.user_id));
      
      // 去重
      annotations = deduplicateAnnotations(annotations);
      logger.log(`[ReadingSessionView] Refreshed and deduplicated to ${annotations.length} annotations (online users only)`);
      
      // 获取当前排序方式和过滤器
      const sortSelect = doc.getElementById('annotation-sort-select') as HTMLSelectElement;
      const filterSelect = doc.getElementById('annotation-filter-select') as HTMLSelectElement;
      const currentSort = sortSelect?.value || 'time-desc';
      const currentFilter = filterSelect?.value || 'all';
      
      // 应用过滤器
      if (currentFilter === 'followed') {
        // TODO: 获取当前用户的关注列表
        // const followedUserIds = await this.sessionManager.getFollowedUsers();
        // annotations = annotations.filter(a => followedUserIds.has(a.user_id));
      }
      
      // 应用排序
      let sortedAnnotations = [...annotations];
      switch (currentSort) {
        case 'page':
          sortedAnnotations.sort((a, b) => a.page_number - b.page_number);
          break;
        case 'time-desc':
          sortedAnnotations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'time-asc':
          sortedAnnotations.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
      }
      
      // 更新数量徽章
      const countBadge = doc.getElementById('annotations-count-badge');
      if (countBadge) {
        countBadge.textContent = `${sortedAnnotations.length}`;
      }

      // 更新列表容器
      const listContainer = doc.getElementById('annotations-list-container');
      if (listContainer) {
        listContainer.innerHTML = '';
        this.renderAnnotationCards(listContainer, sortedAnnotations, doc);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error refreshing annotations:", error);
    }
  }

  /**
   * 渲染会话列表界面
   */
  private async renderSessionList(container: HTMLElement, doc: Document): Promise<void> {
    // 先清空容器
    container.innerHTML = '';
    
    // 设置统一padding(优化为Zotero窄窗口)
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

    // 主按钮组(2x2网格布局)
    const mainButtonsContainer = doc.createElement('div');
    mainButtonsContainer.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    `;

    // 会话广场按钮
    const plazaButton = this.createMainButton(doc, '会话广场', '#0d6efd');
    plazaButton.addEventListener('click', () => {
      this.showPublicSessionsPlaza(container, doc, true);
    });

    // 创建会话按钮
    const createButton = this.createMainButton(doc, '创建会话', '#198754');
    createButton.addEventListener('click', () => {
      this.showCreateSessionOptions(container, doc);
    });

    // 加入私密会话按钮
    const joinPrivateButton = this.createMainButton(doc, '加入私密会话', '#fd7e14');
    joinPrivateButton.addEventListener('click', () => {
      this.showJoinPrivatePage(container, doc);
    });

    // 会话管理按钮
    const manageButton = this.createMainButton(doc, '会话管理', '#6c757d');
    manageButton.addEventListener('click', () => {
      this.showSessionManagement(container, doc);
    });

    mainButtonsContainer.appendChild(plazaButton);
    mainButtonsContainer.appendChild(createButton);
    mainButtonsContainer.appendChild(joinPrivateButton);
    mainButtonsContainer.appendChild(manageButton);
    container.appendChild(mainButtonsContainer);

    // 会话广场内容区域(不显示返回按钮)
    const plazaContentContainer = doc.createElement('div');
    plazaContentContainer.id = 'plaza-default-content';
    container.appendChild(plazaContentContainer);
    
    // 使用SessionPlazaView渲染会话广场(不显示返回按钮)
    const plazaView = new SessionPlazaView(
      this.sessionManager,
      async () => await this.render(),
      async (session) => {
        this.lastViewBeforeSession = 'plaza';
        this.currentViewLevel = 'hub';
        this.context.showMessage('已加入会话', 'info');
        await this.render();
      }
    );
    await plazaView.render(plazaContentContainer, doc, false);
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
   * 创建返回按钮
   */


  /**
   * 显示公开会话广场
   * @param showBackButton 是否显示返回按钮(点击主按钮进入时显示,主页默认展示时不显示)
   */
  private async showPublicSessionsPlaza(container: HTMLElement, doc: Document, showBackButton: boolean = false): Promise<void> {
    const plazaView = new SessionPlazaView(
      this.sessionManager,
      async () => await this.render(), // onBack
      async (session) => { // onSessionJoin
        this.lastViewBeforeSession = 'plaza';
        this.currentViewLevel = 'hub';
        this.context.showMessage('已加入会话', 'info');
        await this.render();
      }
    );

    await plazaView.render(container, doc, showBackButton);
  }



  /**
   * 显示创建会话选项
   */
  private showCreateSessionOptions(container: HTMLElement, doc: Document): void {
    const createFormView = new SessionCreateFormView(
      this.sessionManager,
      this.context,
      async () => await this.render(), // onBack
      async () => { // onCreated
        this.currentViewLevel = 'hub';
        await this.render();
      }
    );

    createFormView.render(container, doc);
  }



  /**
   * 显示会话管理页面
   */
  private async showSessionManagement(container: HTMLElement, doc: Document): Promise<void> {
    // 使用新的SessionListView
    const sessionListView = new SessionListView(
      this.sessionManager,
      async () => await this.render(), // 返回回调
      async (session) => {
        // 点击会话卡片回调
        await this.sessionManager.joinSessionByInviteCode(session.invite_code || '');
        this.currentViewLevel = 'hub';
        this.context.showMessage('已进入会话', 'info');
        await this.render();
      }
    );
    
    await sessionListView.render(container, doc);
  }





  /**
   * 显示加入私密会话页面
   */
  private showJoinPrivatePage(container: HTMLElement, doc: Document): void {
    const joinPrivateView = new SessionJoinPrivateView(
      this.sessionManager,
      async () => await this.render(), // onBack
      async () => { // onJoined
        this.lastViewBeforeSession = 'join';
        this.currentViewLevel = 'hub';
        await this.render();
      },
      (msg, type) => this.context.showMessage(msg, type) // showMessage
    );

    joinPrivateView.render(container, doc);
  }



  /**
   * 注册事件监听器
   */
  private registerEventListeners(): void {
    // 监听标注创建事件
    this.sessionManager.onAnnotation((event) => {
      logger.log("[ReadingSessionView] 📝 New annotation:", event);
      // 不自动刷新界面,避免在错误上下文中调用render
    });

    // 监听成员状态变化
    this.sessionManager.onPresence((event) => {
      logger.log("[ReadingSessionView] 👤 Presence update:", event);
      // 用户离线或上线时,自动刷新整个界面
      if (event.type === 'user_left' || event.type === 'user_joined') {
        logger.log("[ReadingSessionView] 🔄 用户状态改变,刷新当前会话页面...");
        this.render(); // 重新渲染整个视图
      }
    });
  }

  /**
   * HTML转义 - 使用正则表达式替代DOM操作
   */


  /**
   * 渲染事件日志时间轴
   */
  private async renderEventTimeline(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    try {
      logger.log('[ReadingSessionView] 🔍 Fetching session logs for:', sessionId);
      
      const timelineTitle = doc.createElement('h3');
      timelineTitle.textContent = '⏱️ 事件时间轴';
      timelineTitle.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 8px;
      `;
      container.appendChild(timelineTitle);

      // 获取事件日志
      const logs = await this.logManager.getSessionLogs(sessionId, 1, 100);
      
      logger.log('[ReadingSessionView] 📊 Received logs count:', logs.length);

      if (logs.length === 0) {
        const emptyMsg = doc.createElement('div');
        emptyMsg.textContent = '暂无事件记录';
        emptyMsg.style.cssText = `
          text-align: center;
          color: #999;
          padding: 40px 20px;
          font-size: 14px;
        `;
        container.appendChild(emptyMsg);
        logger.log('[ReadingSessionView] ℹ️ No logs found for session');
        return;
      }

      // 事件列表容器
      const eventList = doc.createElement('div');
      eventList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      // 按时间倒序渲染事件
      for (const log of logs) {
        const eventCard = this.createEventCard(doc, log);
        eventList.appendChild(eventCard);
      }

      container.appendChild(eventList);

    } catch (error) {
      logger.error('[ReadingSessionView] Error rendering event timeline:', error);
      const errorMsg = doc.createElement('div');
      errorMsg.textContent = '加载事件日志失败';
      errorMsg.style.cssText = 'color: #dc3545; padding: 16px; text-align: center;';
      container.appendChild(errorMsg);
    }
  }

  /**
   * 创建事件卡片
   */
  private createEventCard(doc: Document, log: any): HTMLElement {
    const card = doc.createElement('div');
    
    // 根据事件类型选择颜色和图标
    const eventConfig = this.getEventConfig(log.event_type);
    
    card.style.cssText = `
      background: #f8f9fa;
      border-left: 4px solid ${eventConfig.color};
      border-radius: 6px;
      padding: 12px;
      transition: all 0.2s;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.background = '#e9ecef';
      card.style.transform = 'translateX(4px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '#f8f9fa';
      card.style.transform = 'translateX(0)';
    });

    // 事件头部
    const header = doc.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    `;

    const icon = doc.createElement('span');
    icon.textContent = eventConfig.icon;
    icon.style.fontSize = '18px';
    header.appendChild(icon);

    const actorName = doc.createElement('strong');
    actorName.textContent = log.actor_name || '未知用户';
    actorName.style.cssText = 'color: #333; font-size: 14px;';
    header.appendChild(actorName);

    const time = doc.createElement('span');
    time.textContent = formatDate(log.created_at);
    time.style.cssText = 'color: #999; font-size: 12px; margin-left: auto;';
    header.appendChild(time);

    card.appendChild(header);

    // 事件描述
    const description = doc.createElement('div');
    description.textContent = this.formatEventDescription(log);
    description.style.cssText = `
      color: #666;
      font-size: 13px;
      line-height: 1.5;
    `;
    card.appendChild(description);

    return card;
  }

  /**
   * 获取事件配置(颜色和图标)
   */
  private getEventConfig(eventType: string): { color: string; icon: string } {
    const configs: { [key: string]: { color: string; icon: string } } = {
      'member_join': { color: '#28a745', icon: '✅' },
      'member_leave': { color: '#6c757d', icon: '👋' },
      'annotation_create': { color: '#ffc107', icon: '📝' },
      'annotation_update': { color: '#007bff', icon: '✏️' },
      'annotation_delete': { color: '#dc3545', icon: '🗑️' },
      'annotation_comment': { color: '#17a2b8', icon: '💬' },
    };
    return configs[eventType] || { color: '#6c757d', icon: '📌' };
  }

  /**
   * 格式化事件描述
   */
  private formatEventDescription(log: any): string {
    const metadata = log.metadata || {};
    
    switch (log.event_type) {
      case 'member_join':
        return '加入了会话';
      case 'member_leave':
        return '离开了会话';
      case 'annotation_create':
        const page = metadata.page_number || '?';
        const content = metadata.content || '';
        return `在第${page}页创建了标注${content ? `: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"` : ''}`;
      case 'annotation_update':
        return `更新了第${metadata.page_number || '?'}页的标注`;
      case 'annotation_delete':
        return `删除了第${metadata.page_number || '?'}页的标注`;
      case 'annotation_comment':
        const comment = metadata.comment || '';
        return `评论了标注${comment ? `: "${comment.substring(0, 30)}${comment.length > 30 ? '...' : ''}"` : ''}`;
      default:
        return log.event_type;
    }
  }

  /**
   * 渲染聊天窗口
   */
  private async renderChatWindow(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    logger.log('[ReadingSessionView] 💬 Rendering chat window for session:', sessionId);
    
    // 聊天标题
    const chatTitle = doc.createElement('div');
    chatTitle.style.cssText = `
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      font-size: 15px;
      border-radius: 8px 8px 0 0;
    `;
    chatTitle.textContent = '💬 实时聊天';
    container.appendChild(chatTitle);

    // 消息列表容器
    const messageList = doc.createElement('div');
    messageList.id = `chat-messages-${sessionId}`;
    messageList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8f9fa;
    `;
    container.appendChild(messageList);

    // 加载现有消息
    try {
      logger.log('[ReadingSessionView] 📨 Loading chat messages...');
      await this.loadChatMessages(messageList, doc, sessionId);
      logger.log('[ReadingSessionView] ✅ Chat messages loaded');
    } catch (error) {
      logger.error('[ReadingSessionView] Error loading chat messages:', error);
      // 显示错误但不阻塞整个界面
      const errorDiv = doc.createElement('div');
      errorDiv.textContent = '加载聊天记录失败';
      errorDiv.style.cssText = 'color: #dc3545; padding: 16px; text-align: center; font-size: 13px;';
      messageList.appendChild(errorDiv);
    }

    // 输入区域
    const inputArea = doc.createElement('div');
    inputArea.style.cssText = `
      padding: 12px;
      background: white;
      border-top: 1px solid #e9ecef;
      border-radius: 0 0 8px 8px;
    `;

    // 表情选择器
    const emojiPicker = doc.createElement('div');
    emojiPicker.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    `;
    const emojis = ['😊', '😂', '👍', '❤️', '🎉', '😮', '😢', '🔥'];
    const textarea = doc.createElement('textarea') as HTMLTextAreaElement;
    
    for (const emoji of emojis) {
      const emojiBtn = doc.createElement('button');
      emojiBtn.textContent = emoji;
      emojiBtn.style.cssText = `
        width: 32px;
        height: 32px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
      `;
      emojiBtn.addEventListener('mouseenter', () => {
        emojiBtn.style.background = '#f0f0f0';
        emojiBtn.style.transform = 'scale(1.2)';
      });
      emojiBtn.addEventListener('mouseleave', () => {
        emojiBtn.style.background = 'white';
        emojiBtn.style.transform = 'scale(1)';
      });
      emojiBtn.addEventListener('click', () => {
        textarea.value += emoji;
        textarea.focus();
      });
      emojiPicker.appendChild(emojiBtn);
    }
    inputArea.appendChild(emojiPicker);

    // 输入框和发送按钮容器
    const inputRow = doc.createElement('div');
    inputRow.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    textarea.placeholder = '输入消息...';
    textarea.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      resize: none;
      font-size: 14px;
      font-family: inherit;
      height: 60px;
    `;
    inputRow.appendChild(textarea);

    const sendButton = doc.createElement('button');
    sendButton.textContent = '发送';
    sendButton.style.cssText = `
      padding: 8px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    `;
    sendButton.addEventListener('mouseenter', () => {
      sendButton.style.transform = 'translateY(-2px)';
    });
    sendButton.addEventListener('mouseleave', () => {
      sendButton.style.transform = 'translateY(0)';
    });
    sendButton.addEventListener('click', async () => {
      await this.handleSendMessage(sessionId, textarea, messageList, doc);
    });
    inputRow.appendChild(sendButton);

    inputArea.appendChild(inputRow);
    container.appendChild(inputArea);

    // 启动轮询机制
    this.startChatPolling(sessionId, messageList, doc);
  }

  /**
   * 加载聊天消息
   */
  private async loadChatMessages(container: HTMLElement, doc: Document, sessionId: string): Promise<void> {
    try {
      const messages = await this.logManager.getChatMessages(sessionId, 1, 100);
      
      container.innerHTML = '';
      
      if (messages.length === 0) {
        const emptyMsg = doc.createElement('div');
        emptyMsg.textContent = '暂无聊天记录，开始第一条消息吧！';
        emptyMsg.style.cssText = `
          text-align: center;
          color: #999;
          padding: 20px;
          font-size: 13px;
        `;
        container.appendChild(emptyMsg);
        return;
      }

      for (const message of messages) {
        const msgElement = this.createMessageElement(doc, message);
        container.appendChild(msgElement);
      }

      // 滚动到底部
      container.scrollTop = container.scrollHeight;

    } catch (error) {
      logger.error('[ReadingSessionView] Error loading chat messages:', error);
    }
  }

  /**
   * 创建消息元素
   */
  private createMessageElement(doc: Document, message: any): HTMLElement {
    const msgDiv = doc.createElement('div');
    msgDiv.style.cssText = `
      background: white;
      padding: 10px 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    const header = doc.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    `;

    const userName = doc.createElement('strong');
    userName.textContent = message.user_name || '未知用户';
    userName.style.cssText = 'color: #667eea; font-size: 13px;';
    header.appendChild(userName);

    const time = doc.createElement('span');
    time.textContent = formatDate(message.created_at);
    time.style.cssText = 'color: #999; font-size: 11px;';
    header.appendChild(time);

    msgDiv.appendChild(header);

    const content = doc.createElement('div');
    content.textContent = message.message;
    content.style.cssText = `
      color: #333;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    `;
    msgDiv.appendChild(content);

    return msgDiv;
  }

  /**
   * 发送消息
   */
  private async handleSendMessage(
    sessionId: string,
    textarea: HTMLTextAreaElement,
    messageList: HTMLElement,
    doc: Document
  ): Promise<void> {
    const message = textarea.value.trim();
    if (!message) {
      return;
    }

    try {
      await this.logManager.sendChatMessage(sessionId, message);
      textarea.value = '';
      
      // 立即刷新消息列表
      await this.loadChatMessages(messageList, doc, sessionId);
      
      this.context.showMessage('消息已发送', 'info');
    } catch (error) {
      logger.error('[ReadingSessionView] Error sending message:', error);
      this.context.showMessage('发送消息失败', 'error');
    }
  }

  /**
   * 启动聊天轮询
   */
  private chatPollingInterval: any = null;
  private lastMessageTimestamp: string | null = null;
  private unreadPollingInterval: any = null;

  private startChatPolling(sessionId: string, messageList: HTMLElement, doc: Document): void {
    // 清除旧的轮询
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
    }

    // 每3秒轮询一次新消息
    this.chatPollingInterval = setInterval(async () => {
      try {
        if (!this.lastMessageTimestamp) {
          // 首次轮询,获取最新时间戳
          const messages = await this.logManager.getChatMessages(sessionId, 1, 1);
          if (messages.length > 0) {
            this.lastMessageTimestamp = messages[0].created_at;
          }
          return;
        }

        // 获取新消息
        const newMessages = await this.logManager.getNewMessages(sessionId, this.lastMessageTimestamp);
        
        if (newMessages.length > 0) {
          // 更新时间戳
          this.lastMessageTimestamp = newMessages[newMessages.length - 1].created_at;
          
          // 添加新消息到列表
          for (const message of newMessages) {
            const msgElement = this.createMessageElement(doc, message);
            messageList.appendChild(msgElement);
          }
          
          // 滚动到底部
          messageList.scrollTop = messageList.scrollHeight;
        }
      } catch (error) {
        logger.warn('[ReadingSessionView] Chat polling error:', error);
      }
    }, 3000);
  }

  /**
   * 处理导出纪要
   */
  private async handleExportMinutes(sessionId: string): Promise<void> {
    try {
      logger.log('[ReadingSessionView] Exporting session minutes...');
      
      const content = await this.logManager.exportMinutes(sessionId, 'markdown');
      
      // 保存文件
      const filePath = await this.saveMinutesToFile(content, sessionId);
      
      this.context.showMessage(`纪要已导出至: ${filePath}`, 'info');
    } catch (error) {
      logger.error('[ReadingSessionView] Error exporting minutes:', error);
      this.context.showMessage('导出纪要失败', 'error');
    }
  }

  /**
   * 保存纪要到文件
   */
  private async saveMinutesToFile(content: string, sessionId: string): Promise<string> {
    const Zotero = (globalThis as any).Zotero;
    const OS = Zotero.getMainWindow().OS;
    
    // 获取用户下载目录
    const downloadsDir = OS.Path.join(OS.Constants.Path.homeDir, 'Downloads');
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const fileName = `session_minutes_${sessionId.substring(0, 8)}_${timestamp}.md`;
    const filePath = OS.Path.join(downloadsDir, fileName);
    
    // 写入文件
    await OS.File.writeAtomic(filePath, content, { encoding: 'utf-8' });
    
    return filePath;
  }

  /**
   * 更新未读消息徽章
   */
  private async updateUnreadBadge(sessionId: string, doc: Document): Promise<void> {
    try {
      const unreadCount = await this.logManager.getUnreadCount(sessionId);
      const badge = doc.getElementById('unread-badge');
      
      if (!badge) return;
      
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch (error) {
      logger.error('[ReadingSessionView] Error updating unread badge:', error);
    }
  }
}


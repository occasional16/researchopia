/**
 * 文献共读会话视图
 * 负责渲染共读会话管理界面
 */

import { logger } from "../../utils/logger";
import { ReadingSessionManager, type ReadingSession, type SessionMember, type SessionAnnotation } from "../readingSessionManager";
import type { BaseViewContext } from "./types";
import { formatDate } from "./helpers";
import { AuthManager } from "../auth";

export class ReadingSessionView {
  private sessionManager = ReadingSessionManager.getInstance();
  private currentSessions: ReadingSession[] = [];
  private membersListenerUnsubscribe: (() => void) | null = null;
  private annotationsListenerUnsubscribe: (() => void) | null = null;
  private lastViewBeforeSession: 'plaza' | 'create' | 'join' | 'manage' | null = null; // 记录进入会话前的视图
  private lastFilterType: string = 'others'; // 记录上次的筛选类型
  private selectedMemberIds: Set<string> = new Set(); // 选中的成员ID列表

  constructor(private readonly context: BaseViewContext) {
    logger.log("[ReadingSessionView] 📚 Initializing...");
    
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
        
        // 创建容器
        const container = doc.createElement('div');
        container.style.cssText = `
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        panel.contentSection.appendChild(container);
        
        // 根据是否在会话中显示不同内容
        if (this.sessionManager.isInSession()) {
          await this.renderActiveSession(container, doc);
        } else {
          await this.renderSessionList(container, doc);
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error rendering:", error);
      this.context.showMessage('渲染失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
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

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: 44px;
    `;

    // 返回按钮(返回到上一页面，不离开会话)
    const backButton = this.createBackButton(doc, () => {
      const panels = this.context.getPanelsForCurrentItem();
      if (panels && panels.length > 0 && panels[0].contentSection) {
        // 根据lastViewBeforeSession返回到对应页面
        switch (this.lastViewBeforeSession) {
          case 'plaza':
            this.showPublicSessionsPlaza(panels[0].contentSection, doc, true);
            break;
          case 'create':
            this.showCreateSessionOptions(panels[0].contentSection, doc);
            break;
          case 'join':
            this.showJoinPrivatePage(panels[0].contentSection, doc);
            break;
          case 'manage':
            this.showSessionManagement(panels[0].contentSection, doc);
            break;
          default:
            // 默认返回主页面
            this.renderSessionList(panels[0].contentSection, doc);
        }
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
    `;

    // 论文标题
    const paperTitle = doc.createElement('div');
    paperTitle.style.cssText = 'margin-bottom: 8px;';
    const titleStrong = doc.createElement('strong');
    titleStrong.textContent = session.paper_title;
    titleStrong.style.fontSize = '16px';
    paperTitle.appendChild(titleStrong);
    sessionCard.appendChild(paperTitle);

    // DOI
    const doiDiv = doc.createElement('div');
    doiDiv.textContent = `📄 DOI: ${session.paper_doi}`;
    doiDiv.style.cssText = 'color: #666; font-size: 13px; margin-bottom: 8px;';
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
          display: flex;
          flex-direction: column;
          gap: 8px;
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
          `;

          const statusDot = doc.createElement('span');
          statusDot.textContent = '●';
          statusDot.style.cssText = `
            color: ${m.is_online ? '#28a745' : '#999'};
            font-size: 10px;
          `;

          const statusText = doc.createElement('span');
          statusText.textContent = m.is_online ? '在线' : '离线';
          statusText.style.cssText = `
            font-size: 10px;
            color: ${m.is_online ? '#28a745' : '#999'};
            margin-right: 4px;
          `;

          const nameSpan = doc.createElement('span');
          nameSpan.textContent = m.user_name || m.user_email || '未知用户';
          nameSpan.style.cssText = 'flex: 1;';

          const roleSpan = doc.createElement('span');
          roleSpan.textContent = m.role === 'host' ? '主持人' : '参与者';
          roleSpan.style.cssText = `
            padding: 2px 8px;
            background: ${m.role === 'host' ? '#ffd43b' : '#adb5bd'};
            border-radius: 4px;
            font-size: 11px;
            color: #000;
          `;

          const pageSpan = doc.createElement('span');
          pageSpan.textContent = `P${m.current_page}`;
          pageSpan.style.cssText = `
            color: #666;
            font-size: 11px;
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
          `;

          const statusDot = doc.createElement('span');
          statusDot.textContent = '●';
          statusDot.style.cssText = `
            color: ${m.is_online ? '#28a745' : '#999'};
            font-size: 10px;
          `;

          const statusText = doc.createElement('span');
          statusText.textContent = m.is_online ? '在线' : '离线';
          statusText.style.cssText = `
            font-size: 10px;
            color: ${m.is_online ? '#28a745' : '#999'};
            margin-right: 4px;
          `;

          const nameSpan = doc.createElement('span');
          nameSpan.textContent = m.user_name || m.user_email || '未知用户';
          nameSpan.style.cssText = 'flex: 1;';

          const roleSpan = doc.createElement('span');
          roleSpan.textContent = m.role === 'host' ? '主持人' : '参与者';
          roleSpan.style.cssText = `
            padding: 2px 8px;
            background: ${m.role === 'host' ? '#ffd43b' : '#adb5bd'};
            border-radius: 4px;
            font-size: 11px;
            color: #000;
          `;

          const pageSpan = doc.createElement('span');
          pageSpan.textContent = `P${m.current_page}`;
          pageSpan.style.cssText = `
            color: #666;
            font-size: 11px;
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
      const uniqueAnnotations = this.deduplicateAnnotations(annotations);
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
        // 筛选排序工具栏
        const toolbar = this.createAnnotationsToolbar(doc, sessionId);
        annotationsSection.appendChild(toolbar);

        // 标注列表容器
        const annotationsList = doc.createElement('div');
        annotationsList.id = 'annotations-list-container';
        annotationsList.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 400px;
          overflow-y: auto;
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
   * 去重标注数据
   */
  private deduplicateAnnotations(annotations: SessionAnnotation[]): SessionAnnotation[] {
    const seen = new Set<string>();
    const unique: SessionAnnotation[] = [];

    for (const annotation of annotations) {
      if (!seen.has(annotation.id)) {
        seen.add(annotation.id);
        unique.push(annotation);
      }
    }

    return unique;
  }

  /**
   * 创建标注工具栏（筛选排序）
   */
  private createAnnotationsToolbar(doc: Document, sessionId: string): HTMLElement {
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px;
      background: #f8f9fa;
      border-radius: 6px;
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
      flex: 1;
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
      flex: 1;
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
      annotationCard.style.cssText = `
        padding: 12px;
        background: #fff;
        border: 1px solid #dee2e6;
        border-left: 4px solid #0d6efd;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      `;

      // 添加hover效果
      annotationCard.addEventListener('mouseenter', () => {
        annotationCard.style.transform = 'translateY(-2px)';
        annotationCard.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      });

      annotationCard.addEventListener('mouseleave', () => {
        annotationCard.style.transform = 'translateY(0)';
        annotationCard.style.boxShadow = 'none';
      });

      // 点击卡片定位到PDF页面
      annotationCard.addEventListener('click', async () => {
        await this.handleLocateAnnotation(annotation);
      });

      const header = doc.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        color: #666;
        font-size: 12px;
      `;

      const userInfo = doc.createElement('span');
      userInfo.textContent = `👤 ${annotation.user_name || annotation.user_email || '未知用户'}`;
      
      const pageInfo = doc.createElement('span');
      pageInfo.textContent = `第 ${annotation.page_number} 页`;
      pageInfo.style.cssText = `
        background: #e7f5ff;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        color: #0d6efd;
      `;

      header.appendChild(userInfo);
      header.appendChild(pageInfo);

      const content = doc.createElement('div');
      content.style.cssText = `
        color: #212529;
        line-height: 1.5;
        word-break: break-word;
        margin-bottom: 8px;
      `;
      
      const annotationText = annotation.annotation_data?.text || 
                            annotation.annotation_data?.comment || 
                            '(无内容)';
      content.textContent = annotationText;

      const timestamp = doc.createElement('div');
      timestamp.style.cssText = `
        color: #999;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
      `;
      timestamp.innerHTML = `⏱️ ${formatDate(annotation.created_at)}`;

      annotationCard.appendChild(header);
      annotationCard.appendChild(content);
      annotationCard.appendChild(timestamp);
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
      annotations = this.deduplicateAnnotations(annotations);
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

    // 主按钮组
    const mainButtonsContainer = doc.createElement('div');
    mainButtonsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
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

    // 会话广场内容区域(不显示返回按钮,不显示筛选框)
    const plazaContentContainer = doc.createElement('div');
    plazaContentContainer.id = 'plaza-default-content';
    container.appendChild(plazaContentContainer);
    
    // 显示会话广场标题
    const plazaTitle = doc.createElement('h3');
    plazaTitle.textContent = '会话广场';
    plazaTitle.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;
    plazaContentContainer.appendChild(plazaTitle);

    // 会话列表容器
    const sessionsList = doc.createElement('div');
    sessionsList.id = 'default-plaza-sessions-list';
    sessionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    plazaContentContainer.appendChild(sessionsList);

    // 加载公开会话(默认"最新创建")
    await this.refreshPublicSessions(plazaContentContainer, doc, 'latest', true);
  }

  /**
   * 创建主按钮
   */
  private createMainButton(doc: Document, text: string, bgColor: string): HTMLButtonElement {
    const button = doc.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      flex: 1 1 calc(50% - 6px);
      min-width: 120px;
      padding: 14px 12px;
      background: ${bgColor};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
  private createBackButton(doc: Document, onClick: () => void): HTMLButtonElement {
    const button = doc.createElement('button');
    button.textContent = '← 返回';
    button.style.cssText = `
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 6px 14px;
      background: rgba(108, 117, 125, 0.1);
      color: #495057;
      border: 1px solid #dee2e6;
      border-radius: 20px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
      z-index: 10;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(108, 117, 125, 0.2)';
      button.style.borderColor = '#adb5bd';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(108, 117, 125, 0.1)';
      button.style.borderColor = '#dee2e6';
    });
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * 显示公开会话广场
   * @param showBackButton 是否显示返回按钮(点击主按钮进入时显示,主页默认展示时不显示)
   */
  private async showPublicSessionsPlaza(container: HTMLElement, doc: Document, showBackButton: boolean = false): Promise<void> {
    container.innerHTML = '';

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: ${showBackButton ? '44px' : '0'};
    `;

    // 返回按钮(仅在showBackButton为true时显示)
    if (showBackButton) {
      const backButton = this.createBackButton(doc, () => {
        const panels = this.context.getPanelsForCurrentItem();
        if (panels && panels.length > 0 && panels[0].contentSection) {
          this.renderSessionList(panels[0].contentSection, doc);
        }
      });
      pageContainer.appendChild(backButton);
    }

    // 页面标题
    const title = doc.createElement('h3');
    title.textContent = '会话广场';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;
    pageContainer.appendChild(title);

    // 筛选工具栏
    const toolbar = doc.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
    `;

    const filterLabel = doc.createElement('label');
    filterLabel.textContent = '筛选:';
    filterLabel.style.cssText = `
      font-weight: 600;
      color: #495057;
      display: flex;
      align-items: center;
    `;

    const filterSelect = doc.createElement('select');
    filterSelect.id = 'plaza-filter-select';
    filterSelect.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      flex: 1;
    `;

    const filterOptions = [
      { value: 'latest', label: '⏰ 最新创建' },
      { value: 'most-members', label: '👥 人数最多' },
      { value: 'followed-users', label: '⭐ 我关注的用户' },
    ];

    filterOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      filterSelect.appendChild(option);
    });

    filterSelect.addEventListener('change', () => {
      this.refreshPublicSessions(pageContainer, doc, filterSelect.value, false);
    });

    toolbar.appendChild(filterLabel);
    toolbar.appendChild(filterSelect);
    pageContainer.appendChild(toolbar);

    // 会话列表容器
    const sessionsList = doc.createElement('div');
    sessionsList.id = 'public-sessions-list';
    sessionsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;
    pageContainer.appendChild(sessionsList);

    container.appendChild(pageContainer);

    // 加载公开会话
    await this.refreshPublicSessions(pageContainer, doc, 'latest', false);
  }

  /**
   * 刷新公开会话列表
   * @param isDefaultView 是否是主页默认视图(如果是,使用default-plaza-sessions-list作为ID)
   */
  private async refreshPublicSessions(container: HTMLElement, doc: Document, filterType: string, isDefaultView: boolean = false): Promise<void> {
    const listId = isDefaultView ? 'default-plaza-sessions-list' : 'public-sessions-list';
    const sessionsList = doc.getElementById(listId) || container;
    sessionsList.innerHTML = '<p style="text-align: center; color: #666;">加载中...</p>';

    try {
      // 获取所有公开会话
      let sessions = await this.sessionManager.getPublicSessions();
      
      // 根据筛选条件排序
      switch (filterType) {
        case 'latest':
          // 默认已按created_at降序排序
          break;
        case 'most-members':
          // TODO: 需要添加成员数量字段后才能排序
          // sessions.sort((a, b) => (b as any).member_count - (a as any).member_count);
          break;
        case 'followed-users':
          // TODO: 需要获取关注用户列表并过滤
          break;
      }

      sessionsList.innerHTML = '';

      if (sessions.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无公开会话';
        emptyText.style.cssText = `
          text-align: center;
          color: #666;
          padding: 32px;
        `;
        sessionsList.appendChild(emptyText);
        return;
      }

      for (const session of sessions) {
        const sessionCard = this.createPublicSessionCard(session, doc);
        sessionsList.appendChild(sessionCard);
      }
    } catch (error) {
      logger.error("[ReadingSessionView] Error loading public sessions:", error);
      sessionsList.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 32px;">加载失败</p>';
    }
  }

  /**
   * 创建公开会话卡片
   */
  private createPublicSessionCard(session: ReadingSession, doc: Document): HTMLElement {
    const card = doc.createElement('div');
    card.style.cssText = `
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      card.style.borderColor = '#0d6efd';
    });
    card.addEventListener('mouseleave', () => {
      card.style.boxShadow = 'none';
      card.style.borderColor = '#dee2e6';
    });
    card.addEventListener('click', async () => {
      try {
        this.lastViewBeforeSession = 'plaza'; // 记录从会话广场进入
        await this.sessionManager.joinSessionByInviteCode(session.invite_code);
        this.context.showMessage('已加入会话', 'info');
        await this.render();
      } catch (error) {
        logger.error("[ReadingSessionView] Error joining session:", error);
        this.context.showMessage('加入会话失败', 'error');
      }
    });

    card.innerHTML = `
      <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: #212529;">
        ${this.escapeHtml(session.paper_title)}
      </div>
      <div style="font-size: 13px; color: #6c757d; margin-bottom: 4px;">
        📄 ${this.escapeHtml(session.paper_doi)}
      </div>
      <div style="font-size: 13px; color: #6c757d; margin-bottom: 8px;">
        👤 主持人: ${this.escapeHtml((session as any).creator_name || '未知')}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6c757d;">
        <span>⏱️ ${formatDate(session.created_at)}</span>
        <span style="background: #e7f5ff; padding: 2px 8px; border-radius: 4px; color: #0d6efd; font-weight: 600;">
          👥 ${(session as any).member_count || 1} 人
        </span>
      </div>
    `;

    return card;
  }

  /**
   * 显示创建会话选项
   */
  private showCreateSessionOptions(container: HTMLElement, doc: Document): void {
    container.innerHTML = '';

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: 44px;
    `;

    // 返回按钮
    const backButton = this.createBackButton(doc, () => {
      const panels = this.context.getPanelsForCurrentItem();
      if (panels && panels.length > 0 && panels[0].contentSection) {
        this.renderSessionList(panels[0].contentSection, doc);
      }
    });
    pageContainer.appendChild(backButton);

    const title = doc.createElement('h3');
    title.textContent = '创建会话';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;
    pageContainer.appendChild(title);

    const optionsContainer = doc.createElement('div');
    optionsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    `;

    // 创建公开会话选项
    const publicOption = this.createSessionTypeOption(
      doc,
      '公开会话',
      '任何人都可以查看和加入',
      '🌍',
      '#0d6efd'
    );
    publicOption.addEventListener('click', async () => {
      await this.createSessionWithType('public');
    });

    // 创建私密会话选项
    const privateOption = this.createSessionTypeOption(
      doc,
      '私密会话',
      '需要邀请码才能加入',
      '🔒',
      '#6c757d'
    );
    privateOption.addEventListener('click', async () => {
      await this.createSessionWithType('private');
    });

    optionsContainer.appendChild(publicOption);
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
      padding: 24px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    `;
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px)';
      card.style.boxShadow = `0 8px 16px rgba(0,0,0,0.15)`;
      card.style.background = color;
      card.style.color = 'white';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      card.style.background = 'white';
      card.style.color = '#212529';
    });

    card.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 12px;">${icon}</div>
      <div style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">${title}</div>
      <div style="font-size: 13px; opacity: 0.8;">${description}</div>
    `;

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
        `${type === 'public' ? '公开' : '私密'}会话已创建！邀请码: ${session.inviteCode}`,
        'info'
      );
      await this.render();
    } catch (error) {
      logger.error("[ReadingSessionView] Error creating session:", error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.context.showMessage(`创建会话失败: ${errorMsg}`, 'error');
    }
  }

  /**
   * 显示会话管理页面
   */
  private async showSessionManagement(container: HTMLElement, doc: Document): Promise<void> {
    container.innerHTML = '';

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: 44px;
    `;

    // 返回按钮
    const backButton = this.createBackButton(doc, () => {
      const panels = this.context.getPanelsForCurrentItem();
      if (panels && panels.length > 0 && panels[0].contentSection) {
        this.renderSessionList(panels[0].contentSection, doc);
      }
    });
    pageContainer.appendChild(backButton);

    // 页面标题
    const title = doc.createElement('h3');
    title.textContent = '会话管理';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;
    pageContainer.appendChild(title);

    // 选项卡
    const tabsContainer = doc.createElement('div');
    tabsContainer.style.cssText = `
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      border-bottom: 2px solid #dee2e6;
    `;

    const createdTab = this.createTab(doc, '我创建的会话', true);
    const joinedTab = this.createTab(doc, '我加入的会话', false);

    createdTab.addEventListener('click', () => {
      this.setActiveTab(createdTab, joinedTab);
      this.showMyCreatedSessions(container, doc);
    });

    joinedTab.addEventListener('click', () => {
      this.setActiveTab(joinedTab, createdTab);
      this.showMyJoinedSessions(container, doc);
    });

    tabsContainer.appendChild(createdTab);
    tabsContainer.appendChild(joinedTab);
    pageContainer.appendChild(tabsContainer);

    // 内容区域
    const contentArea = doc.createElement('div');
    contentArea.id = 'management-content-area';
    pageContainer.appendChild(contentArea);

    container.appendChild(pageContainer);

    // 默认显示我创建的会话
    this.showMyCreatedSessions(contentArea, doc);
  }

  /**
   * 创建选项卡
   */
  private createTab(doc: Document, text: string, isActive: boolean): HTMLElement {
    const tab = doc.createElement('div');
    tab.textContent = text;
    tab.style.cssText = `
      padding: 12px 20px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      color: ${isActive ? '#0d6efd' : '#6c757d'};
      border-bottom: 3px solid ${isActive ? '#0d6efd' : 'transparent'};
      transition: all 0.2s;
    `;
    tab.setAttribute('data-active', String(isActive));

    tab.addEventListener('mouseenter', () => {
      if (tab.getAttribute('data-active') !== 'true') {
        tab.style.color = '#495057';
      }
    });

    tab.addEventListener('mouseleave', () => {
      if (tab.getAttribute('data-active') !== 'true') {
        tab.style.color = '#6c757d';
      }
    });

    return tab;
  }

  /**
   * 设置活跃选项卡
   */
  private setActiveTab(activeTab: HTMLElement, inactiveTab: HTMLElement): void {
    activeTab.setAttribute('data-active', 'true');
    activeTab.style.color = '#0d6efd';
    activeTab.style.borderBottom = '3px solid #0d6efd';

    inactiveTab.setAttribute('data-active', 'false');
    inactiveTab.style.color = '#6c757d';
    inactiveTab.style.borderBottom = '3px solid transparent';
  }

  /**
   * 显示我创建的会话
   */
  private async showMyCreatedSessions(container: HTMLElement, doc: Document): Promise<void> {
    const contentArea = doc.getElementById('management-content-area') || container;
    contentArea.innerHTML = '<p style="text-align: center; color: #666; padding: 16px;">加载中...</p>';

    try {
      const sessions = await this.sessionManager.getMyCreatedSessions();

      contentArea.innerHTML = '';

      if (sessions.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无创建的会话';
        emptyText.style.cssText = `
          text-align: center;
          color: #666;
          padding: 32px;
        `;
        contentArea.appendChild(emptyText);
        return;
      }

      const sessionsList = doc.createElement('div');
      sessionsList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      for (const session of sessions) {
        const sessionCard = this.createManageableSessionCard(session, doc, true);
        sessionsList.appendChild(sessionCard);
      }

      contentArea.appendChild(sessionsList);
    } catch (error) {
      logger.error("[ReadingSessionView] Error loading created sessions:", error);
      contentArea.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 32px;">加载失败</p>';
    }
  }

  /**
   * 显示我加入的会话
   */
  private async showMyJoinedSessions(container: HTMLElement, doc: Document): Promise<void> {
    const contentArea = doc.getElementById('management-content-area') || container;
    contentArea.innerHTML = '<p style="text-align: center; color: #666; padding: 16px;">加载中...</p>';

    try {
      const sessions = await this.sessionManager.getMyJoinedSessions();

      contentArea.innerHTML = '';

      if (sessions.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无加入的会话';
        emptyText.style.cssText = `
          text-align: center;
          color: #666;
          padding: 32px;
        `;
        contentArea.appendChild(emptyText);
        return;
      }

      const sessionsList = doc.createElement('div');
      sessionsList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;

      for (const session of sessions) {
        const sessionCard = this.createManageableSessionCard(session, doc, false);
        sessionsList.appendChild(sessionCard);
      }

      contentArea.appendChild(sessionsList);
    } catch (error) {
      logger.error("[ReadingSessionView] Error loading joined sessions:", error);
      contentArea.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 32px;">加载失败</p>';
    }
  }

  /**
   * 创建可管理的会话卡片
   */
  private createManageableSessionCard(session: ReadingSession, doc: Document, isOwner: boolean): HTMLElement {
    const card = doc.createElement('div');
    card.style.cssText = `
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 16px;
      transition: all 0.2s;
    `;

    // 会话信息
    const infoSection = doc.createElement('div');
    infoSection.style.cssText = `
      margin-bottom: 12px;
    `;
    infoSection.innerHTML = `
      <div style="font-weight: 600; font-size: 15px; margin-bottom: 8px; color: #212529;">
        ${this.escapeHtml(session.paper_title)}
      </div>
      <div style="font-size: 13px; color: #6c757d; margin-bottom: 4px;">
        📄 ${this.escapeHtml(session.paper_doi)}
      </div>
      ${!isOwner ? `
        <div style="font-size: 13px; color: #6c757d; margin-bottom: 8px;">
          👤 主持人: ${this.escapeHtml((session as any).creator_name || '未知')}
        </div>
      ` : ''}
      <div style="font-size: 12px; color: #6c757d;">
        🔑 ${session.invite_code} | ⏱️ ${formatDate(session.created_at)}
      </div>
    `;

    // 管理按钮组
    const actionsContainer = doc.createElement('div');
    actionsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #dee2e6;
    `;

    // 进入会话按钮
    const enterButton = this.createActionButton(doc, '进入会话', '#0d6efd');
    enterButton.addEventListener('click', async () => {
      try {
        this.lastViewBeforeSession = 'manage'; // 记录从会话管理进入
        await this.sessionManager.joinSessionByInviteCode(session.invite_code);
        this.context.showMessage('已进入会话', 'info');
        await this.render();
      } catch (error) {
        logger.error("[ReadingSessionView] Error entering session:", error);
        this.context.showMessage('进入会话失败', 'error');
      }
    });
    actionsContainer.appendChild(enterButton);

    // 如果是创建者,显示删除按钮
    if (isOwner) {
      const deleteButton = this.createActionButton(doc, '删除会话', '#dc3545');
      deleteButton.addEventListener('click', async () => {
        // 使用Zotero的Services.prompt.confirm方法
        const confirmed = Services.prompt.confirm(
          null,
          '确认删除会话',
          '删除会话后，所有成员将被移除，会话中的标注将被清除。此操作无法撤销。'
        );
        
        if (!confirmed) {
          return;
        }

        try {
          await this.sessionManager.deleteSession(session.id);
          this.context.showMessage('会话已删除', 'info');
          
          // 删除成功后刷新"我创建的会话"列表
          const managementArea = doc.getElementById('management-content-area');
          if (managementArea) {
            await this.showMyCreatedSessions(managementArea, doc);
          }
        } catch (error) {
          logger.error('[ReadingSessionView] 删除会话失败:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          this.context.showMessage(`删除失败: ${errorMessage}`, 'error');
        }
      });
      actionsContainer.appendChild(deleteButton);
    } else {
      // 如果是参与者,显示退出按钮
      const leaveButton = this.createActionButton(doc, '退出会话', '#ffc107');
      leaveButton.style.color = '#000';
      leaveButton.addEventListener('click', async () => {
        try {
          await this.sessionManager.leaveSession();
          this.context.showMessage('已退出会话', 'info');
          await this.render();
        } catch (error) {
          logger.error("[ReadingSessionView] Error leaving session:", error);
          this.context.showMessage('退出会话失败', 'error');
        }
      });
      actionsContainer.appendChild(leaveButton);
    }

    card.appendChild(infoSection);
    card.appendChild(actionsContainer);
    return card;
  }

  /**
   * 创建操作按钮
   */
  private createActionButton(doc: Document, text: string, bgColor: string): HTMLButtonElement {
    const button = doc.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      padding: 6px 12px;
      background: ${bgColor};
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
      flex: 1;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.opacity = '0.85';
    });
    button.addEventListener('mouseleave', () => {
      button.style.opacity = '1';
    });
    return button;
  }

  /**
   * 显示加入私密会话页面
   */
  private showJoinPrivatePage(container: HTMLElement, doc: Document): void {
    container.innerHTML = '';

    // 页面容器(relative定位用于放置返回按钮)
    const pageContainer = doc.createElement('div');
    pageContainer.style.cssText = `
      position: relative;
      padding-top: 44px;
    `;

    // 返回按钮
    const backButton = this.createBackButton(doc, () => {
      const panels = this.context.getPanelsForCurrentItem();
      if (panels && panels.length > 0 && panels[0].contentSection) {
        this.renderSessionList(panels[0].contentSection, doc);
      }
    });
    pageContainer.appendChild(backButton);

    // 页面标题
    const title = doc.createElement('h3');
    title.textContent = '加入私密会话';
    title.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    `;
    pageContainer.appendChild(title);

    // 输入框容器
    const inputContainer = doc.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 400px;
      margin: 0 auto;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 8px;
    `;

    // 提示文字
    const hint = doc.createElement('p');
    hint.textContent = '请输入邀请码以加入私密会话';
    hint.style.cssText = `
      margin: 0;
      font-size: 14px;
      color: #6c757d;
      text-align: center;
    `;
    inputContainer.appendChild(hint);

    // 邀请码输入框
    const input = doc.createElement('input');
    input.type = 'text';
    input.placeholder = '请输入邀请码...';
    input.style.cssText = `
      padding: 12px;
      border: 1px solid #dee2e6;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    `;
    input.addEventListener('focus', () => {
      input.style.borderColor = '#0d6efd';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#dee2e6';
    });
    inputContainer.appendChild(input);

    // 加入按钮
    const joinButton = doc.createElement('button');
    joinButton.textContent = '加入会话';
    joinButton.style.cssText = `
      padding: 12px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    joinButton.addEventListener('mouseenter', () => {
      joinButton.style.background = '#0b5ed7';
      joinButton.style.transform = 'translateY(-1px)';
    });
    joinButton.addEventListener('mouseleave', () => {
      joinButton.style.background = '#0d6efd';
      joinButton.style.transform = 'translateY(0)';
    });
    joinButton.addEventListener('click', async () => {
      const code = input.value.trim();
      if (!code) {
        this.context.showMessage('请输入邀请码', 'error');
        return;
      }

      try {
        this.lastViewBeforeSession = 'join'; // 记录从加入私密会话页面进入
        await this.sessionManager.joinSessionByInviteCode(code);
        this.context.showMessage('已加入会话', 'info');
        await this.render();
      } catch (error) {
        logger.error('[ReadingSessionView] 加入会话失败:', error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        this.context.showMessage(`加入会话失败: ${errorMessage}`, 'error');
      }
    });
    inputContainer.appendChild(joinButton);

    pageContainer.appendChild(inputContainer);
    container.appendChild(pageContainer);
  }

  /**
   * 显示加入会话对话框
   */
  private async showJoinSessionDialog(): Promise<void> {
    try {
      // 使用Zotero的Services.prompt.prompt方法
      const Services = (globalThis as any).Services || (Zotero as any).getMainWindow().Services;
      
      const input = { value: "" };
      const check = { value: false };
      
      // prompt(parent, dialogTitle, text, value, checkMsg, checkValue)
      const result = Services.prompt.prompt(
        null,
        "加入共读会话",
        "请输入邀请码:",
        input,
        null,
        check
      );
      
      if (!result || !input.value) {
        logger.log("[ReadingSessionView] User cancelled prompt");
        return;
      }

      logger.log(`[ReadingSessionView] Joining session with code: ${input.value}`);
      this.lastViewBeforeSession = null; // 旧对话框方式，没有特定来源页面
      await this.sessionManager.joinSessionByInviteCode(input.value);
      this.context.showMessage('已加入会话', 'info');
      await this.render();
    } catch (error) {
      logger.error("[ReadingSessionView] Error joining session:", error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.context.showMessage(`加入会话失败: ${errorMsg}`, 'error');
    }
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
        logger.log("[ReadingSessionView] 🔄 用户状态改变,刷新界面...");
        this.render(); // 重新渲染整个视图
      }
    });
  }

  /**
   * HTML转义 - 使用正则表达式替代DOM操作
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

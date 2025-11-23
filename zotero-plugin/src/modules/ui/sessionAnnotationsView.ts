/**
 * 会话标注视图
 * 在会话中管理和展示标注:
 * 1. 过滤:全部/我的/他人的
 * 2. 我的标注:可批量管理(共享/取消共享)
 * 3. 他人标注:只读展示 
 */

import { logger } from "../../utils/logger";
import { AuthManager } from "../auth";
import type { BaseViewContext } from "./types";
import { ReadingSessionManager } from '../readingSessionManager';
import { colors, spacing, fontSize, borderRadius } from './styles';
import { APIClient } from "../../utils/apiClient";
import { highlightText, matchesSearch, createSearchBox, formatDate, resolveAnnotationDisplayName, resolveCommentDisplayInfo, createToggleSwitch } from "./helpers";
import { UserHoverCardManager } from "./userHoverCard";

type ViewMode = 'shared' | 'manage'; // 共享标注(只读) vs 管理标注(可操作)
type FilterMode = 'all' | 'mine' | 'others';

export class SessionAnnotationsView {
  private currentMode: ViewMode = 'shared'; // 默认显示共享标注
  private currentFilter: FilterMode = 'all';
  private selectedAnnotationIds: Set<string> = new Set();
  private cachedAnnotations: any[] | null = null;
  private shareStatusCache: Map<string, any> = new Map(); // annotation_id -> share status
  private apiClient = APIClient.getInstance();
  private lastFilterType: string = 'others'; // 记录上次筛选类型
  private selectedMemberIds: Set<string> = new Set(); // 自定义选择的成员ID
  private userHoverCardManager: UserHoverCardManager;
  private pdfReaderManager: any | null = null; // 懒加载PDFReaderManager实例

  constructor(
    private sessionManager: ReadingSessionManager,
    private context: BaseViewContext
  ) {
    this.userHoverCardManager = new UserHoverCardManager(context);
  }

  /**
   * 获取PDFReaderManager实例（懒加载）
   * 从全局Zotero对象获取，避免动态导入的打包问题
   */
  private async getPDFReaderManager(): Promise<any | null> {
    if (this.pdfReaderManager) {
      return this.pdfReaderManager;
    }

    const addon = (Zotero as any).Researchopia;
    if (addon?._pdfReaderManager) {
      this.pdfReaderManager = addon._pdfReaderManager;
      return this.pdfReaderManager;
    }

    try {
      const { PDFReaderManager } = await import("../pdf");
      const manager = PDFReaderManager.getInstance();
      await manager.initialize();
      if (addon) {
        addon._pdfReaderManager = manager;
      }
      this.pdfReaderManager = manager;
      return manager;
    } catch (error) {
      const details = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
      logger.error("[SessionAnnotationsView] Failed to initialize PDFReaderManager on demand:", details);
      return null;
    }
  }

  /**
   * 渲染会话标注视图
   */
  public async render(container: HTMLElement, doc: Document, searchQuery = ""): Promise<void> {
    try {
      logger.log("[SessionAnnotationsView] Rendering with mode:", this.currentMode);
      
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

      // 顶部:模式切换器
      const modeToggle = this.createModeToggle(doc);
      container.appendChild(modeToggle);

      // 创建内容容器(避免子方法清空container时删除toggle)
      const contentContainer = doc.createElement('div');
      contentContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        box-sizing: border-box;
      `;
      container.appendChild(contentContainer);

      // 根据模式渲染不同内容到contentContainer
      if (this.currentMode === 'shared') {
        await this.renderSharedMode(contentContainer, doc, searchQuery);
      } else {
        await this.renderManageMode(contentContainer, doc, searchQuery);
      }

    } catch (error) {
      logger.error("[SessionAnnotationsView] Error rendering:", error);
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: ${fontSize.sm}; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 创建模式切换器(参考sessionMinutesView的次级按钮设计)
   */
  private createModeToggle(doc: Document): HTMLElement {
    const toggle = doc.createElement('div');
    toggle.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: ${spacing.md};
      background: white;
      border-bottom: 1px solid #e5e7eb;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const modes: Array<{id: ViewMode, label: string, icon: string, color: string}> = [
      { id: 'shared', label: '共享标注', icon: '👥', color: '#8b5cf6' },
      { id: 'manage', label: '管理标注', icon: '🔖', color: '#3b82f6' }
    ];

    modes.forEach(mode => {
      const isActive = this.currentMode === mode.id;
      const bgColor = isActive ? mode.color : '#ffffff';
      const textColor = isActive ? '#ffffff' : mode.color;
      
      const btn = doc.createElement('button');
      btn.innerHTML = `
        <span style="font-size: 16px; margin-right: 5px; flex-shrink: 0;">${mode.icon}</span>
        <span style="word-break: break-word; text-align: center; line-height: 1.2;">${mode.label}</span>
      `;
      
      btn.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        background: ${bgColor};
        color: ${textColor};
        border: 2px solid ${mode.color};
        border-radius: 7px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-sizing: border-box;
        white-space: nowrap;
        overflow: hidden;
      `;

      btn.addEventListener('mouseenter', () => {
        if (!isActive) {
          btn.style.background = `${mode.color}15`;
        }
      });

      btn.addEventListener('mouseleave', () => {
        if (!isActive) {
          btn.style.background = '#ffffff';
        }
      });

      btn.addEventListener('click', async () => {
        if (this.currentMode !== mode.id) {
          this.currentMode = mode.id;
          this.selectedAnnotationIds.clear();
          
          // 🆕 清除缓存,确保数据同步
          this.cachedAnnotations = null;
          this.shareStatusCache.clear();
          logger.log(`[SessionAnnotationsView] 🔄 切换到${mode.label}模式,已清除缓存`);
          
          // 重新渲染整个视图
          const mainContainer = btn.closest('[style*="flex-direction: column"]') as HTMLElement;
          if (mainContainer) {
            await this.render(mainContainer, doc, '');
          }
        }
      });

      toggle.appendChild(btn);
    });

    return toggle;
  }

  /**
   * 渲染共享标注模式(只读,显示会话的共享标注)
   * TODO: 移植SharedAnnotationsView的内容
   */
  /**
   * 渲染共享标注模式 - 从readingSessionView备份完整迁移
   */
  private async renderSharedMode(container: HTMLElement, doc: Document, searchQuery: string): Promise<void> {
    logger.log(`[SessionAnnotationsView] 🎯 renderSharedMode() called, timestamp: ${new Date().toISOString()}`);
    
    const session = this.sessionManager.getCurrentSession();
    if (!session) {
      const errorText = doc.createElement('p');
      errorText.textContent = '未找到当前会话';
      errorText.style.cssText = 'color: #dc3545; font-size: 14px; padding: 16px;';
      container.appendChild(errorText);
      return;
    }

    const sessionId = session.id;
    
    // 获取当前用户ID(用于点赞和评论)
    const currentUser = AuthManager.getCurrentUser();
    if (!currentUser) {
      const errorText = doc.createElement('p');
      errorText.textContent = '请先登录';
      errorText.style.cssText = 'color: #dc3545; font-size: 14px; padding: 16px;';
      container.appendChild(errorText);
      return;
    }
    const currentUserId = currentUser.id;

    try {
      let annotations = await this.sessionManager.getSessionAnnotations(sessionId, 1, 100);
      logger.log(`[SessionAnnotationsView] 📥 获取到${annotations.length}个原始标注`);
      
      // 打印所有标注的关键信息用于调试
      annotations.forEach((ann: any, idx: number) => {
        const zoteroKey = ann.annotation_data?.zotero_key;
        logger.log(`[SessionAnnotationsView]   [${idx}] id=${ann.id}, zotero_key=${zoteroKey}, user=${ann.user_id}`);
      });
      
      // 获取在线成员列表
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineUserIds = new Set(members.filter((m: any) => m.is_online).map((m: any) => m.user_id));
      logger.log(`[SessionAnnotationsView] 👥 在线成员数: ${onlineUserIds.size}, 在线成员ID:`, Array.from(onlineUserIds));
      
      // 仅显示在线成员的标注
      const beforeFilterCount = annotations.length;
      annotations = annotations.filter((a: any) => onlineUserIds.has(a.user_id));
      logger.log(`[SessionAnnotationsView] 🔍 在线成员过滤: ${beforeFilterCount} -> ${annotations.length} (移除了${beforeFilterCount - annotations.length}个离线成员的标注)`);
      
      // 去重 - 使用zotero_key作为唯一标识
      const beforeDedupeCount = annotations.length;
      annotations = this.deduplicateAnnotations(annotations);
      logger.log(`[SessionAnnotationsView] 🔄 去重: ${beforeDedupeCount} -> ${annotations.length} (移除了${beforeDedupeCount - annotations.length}个重复标注)`);
      
      // 🆕 visibility过滤 - 显示公开/共享标注,以及当前用户的私密标注
      const currentUser = AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id;
      
      const beforeVisibilityFilter = annotations.length;
      annotations = annotations.filter((ann: any) => {
        // 如果没有visibility属性,默认为公开(兼容旧数据)
        const visibility = ann.visibility || 'public';
        // public/shared: 所有人可见
        // private: 仅作者本人可见
        if (visibility === 'public' || visibility === 'shared') {
          return true;
        } else if (visibility === 'private') {
          return ann.user_id === currentUserId;
        }
        return false;
      });
      logger.log(`[SessionAnnotationsView] 👁️ Visibility过滤: ${beforeVisibilityFilter} -> ${annotations.length} (移除了${beforeVisibilityFilter - annotations.length}个不可见标注)`);
      
      // 标题和数量
      const headerDiv = doc.createElement('div');
      headerDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      `;

      const annotationsTitle = doc.createElement('h3');
      annotationsTitle.textContent = '📝 共享标注';
      annotationsTitle.style.cssText = `
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      `;

      const countBadge = doc.createElement('span');
      countBadge.id = 'shared-annotations-count-badge';
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
      container.appendChild(headerDiv);

      // 批量显示工具栏(始终显示)
      const batchToolbar = this.createBatchDisplayToolbar(doc, sessionId);
      container.appendChild(batchToolbar);
      
      // 筛选排序工具栏(始终显示)
      const toolbar = this.createSharedAnnotationsToolbar(doc, sessionId);
      container.appendChild(toolbar);

      // 标注列表容器
      const annotationsList = doc.createElement('div');
      annotationsList.id = 'shared-annotations-list-container';
      annotationsList.style.cssText = `
        display: block;
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      `;

      if (annotations.length === 0) {
        const emptyText = doc.createElement('p');
        emptyText.textContent = '暂无标注';
        emptyText.style.cssText = 'color: #999; font-size: 14px; padding: 16px;';
        annotationsList.appendChild(emptyText);
      } else {
        // 默认按最新优先排序
        const sortedAnnotations = [...annotations].sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // 渲染标注卡片
        await this.renderSharedAnnotationCards(annotationsList, sortedAnnotations, doc, currentUserId);
      }

      container.appendChild(annotationsList);

      // ⚠️ 不要在这里注册监听器!
      // 监听器已经在全局注册
      // 重复注册会导致标注重复显示
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error loading shared annotations:", error);
      const errorText = doc.createElement('p');
      errorText.textContent = '加载标注列表失败';
      errorText.style.cssText = 'color: #dc3545; font-size: 14px;';
      container.appendChild(errorText);
    }
  }

  /**
   * 渲染管理标注模式(可操作,管理我的标注)
   * 参考MyAnnotationsView的实现
   */
  /**
   * 渲染管理标注模式 - 从MyAnnotationsView完整移植
   * 显示当前文献的所有本地标注,支持批量共享/取消共享操作
   */
  private async renderManageMode(container: HTMLElement, doc: Document, searchQuery: string): Promise<void> {
    try {
      logger.log("[SessionAnnotationsView] 📋 Rendering manage mode...");
      
      container.innerHTML = '';
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: ${spacing.md};
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        background: #f9fafb;
        border-radius: 10px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
      `;

      // 搜索框
      const searchBox = createSearchBox(doc, (query) => {
        const mainContainer = searchBox.closest('[style*="display: flex"]') as HTMLElement;
        if (mainContainer) {
          this.render(mainContainer, doc, query);
        }
      });
      container.appendChild(searchBox);

      // 加载标注
      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        const emptyDiv = doc.createElement('div');
        emptyDiv.style.cssText = 'padding: 40px; text-align: center; color: #9ca3af;';
        emptyDiv.innerHTML = `
          <div style="font-size: 14px;">📄 请先选择一篇文献</div>
          <div style="font-size: 12px; margin-top: 8px;">选择文献后即可管理其标注</div>
        `;
        container.appendChild(emptyDiv);
        return;
      }

      const { AnnotationManager } = await import("../annotations");
      const annotations = await AnnotationManager.getItemAnnotations(currentItem);

      if (annotations.length === 0) {
        const emptyDiv = doc.createElement('div');
        emptyDiv.style.cssText = 'padding: 40px; text-align: center; color: #9ca3af;';
        emptyDiv.innerHTML = `
          <div style="font-size: 14px;">📝 此文献暂无标注</div>
          <div style="font-size: 12px; margin-top: 8px;">请在PDF阅读器中添加标注</div>
        `;
        container.appendChild(emptyDiv);
        return;
      }

      const user = AuthManager.getCurrentUser();
      if (!user) {
        const loginDiv = doc.createElement('div');
        loginDiv.style.cssText = 'padding: 40px; text-align: center; color: #dc3545;';
        loginDiv.textContent = '⚠️ 请先登录';
        container.appendChild(loginDiv);
        return;
      }

      // 同步标注到Supabase
      const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
      const syncedAnnotations = await AnnotationManager.syncAnnotationsWithSupabase(
        annotations,
        documentInfo.id,
        user.id
      );

      // 搜索过滤
      const filteredAnnotations = searchQuery
        ? syncedAnnotations.filter((ann) => matchesSearch(ann, searchQuery))
        : syncedAnnotations;

      if (searchQuery && filteredAnnotations.length < syncedAnnotations.length) {
        const statsDiv = doc.createElement('div');
        statsDiv.style.cssText = `
          padding: 8px 12px;
          background: #e9ecef;
          border-bottom: 1px solid #e9ecef;
          font-size: 12px;
          color: #6c757d;
        `;
        statsDiv.textContent = `找到 ${filteredAnnotations.length} / ${syncedAnnotations.length} 条标注`;
        container.appendChild(statsDiv);
      }

      if (filteredAnnotations.length === 0) {
        const emptyDiv = doc.createElement('div');
        emptyDiv.style.cssText = 'padding: 40px; text-align: center; color: #9ca3af;';
        emptyDiv.innerHTML = `
          <div style="font-size: 14px;">🔍 未找到匹配的标注</div>
          <div style="font-size: 12px; margin-top: 8px;">请尝试其他关键词</div>
        `;
        container.appendChild(emptyDiv);
        return;
      }

      // 渲染标注列表(带批量操作工具栏)
      await this.renderManageAnnotationsList(container, filteredAnnotations, documentInfo.id, user.id, searchQuery);

    } catch (error) {
      logger.error("[SessionAnnotationsView] Error rendering manage mode:", error);
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <div>❌ 加载失败</div>
          <div style="font-size: 12px; margin-top: 8px;">${
            error instanceof Error ? error.message : '未知错误'
          }</div>
        </div>
      `;
    }
  }

  /**
   * 渲染管理标注列表 - 从MyAnnotationsView完整移植
   */
  private async renderManageAnnotationsList(
    container: HTMLElement,
    annotations: any[],
    documentId: string,
    userId: string,
    searchQuery: string
  ): Promise<void> {
    const doc = container.ownerDocument;
    
    // 创建工具栏
    const toolbar = doc.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 14px;
      background: #ffffff;
      border-radius: 10px;
      flex-wrap: wrap;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    `;

    // 创建全选开关
    const selectAllSwitch = createToggleSwitch(
      doc,
      "select-all-annotations",
      false,
      "#3b82f6",
      (checked) => {
        const checkboxes = container.querySelectorAll<HTMLInputElement>(".annotation-checkbox");
        checkboxes.forEach((cb) => {
          cb.checked = checked;
          // 更新对应的开关样式
          const switchContainer = cb.closest('.annotation-switch-container');
          if (switchContainer) {
            const track = switchContainer.querySelector('.switch-track') as HTMLElement;
            const thumb = switchContainer.querySelector('.switch-thumb') as HTMLElement;
            if (track && thumb) {
              track.style.background = checked ? '#3b82f6' : '#d1d5db';
              thumb.style.left = checked ? '20px' : '2px';
            }
          }
        });
      }
    );

    const selectAllLabel = doc.createElement("label");
    selectAllLabel.htmlFor = "select-all-annotations";
    selectAllLabel.textContent = "全选";
    selectAllLabel.style.cssText = "cursor: pointer; font-size: 14px; user-select: none; font-weight: 600; color: #1f2937; line-height: 1; display: flex; align-items: center; margin-left: 8px;";

    // 批量操作分隔符
    const separator = doc.createElement("div");
    separator.textContent = "|";
    separator.style.cssText = "color: #d1d5db; font-size: 14px; margin: 0 4px;";

    // 批量操作标签
    const batchLabel = doc.createElement("div");
    batchLabel.textContent = "批量:";
    batchLabel.style.cssText = "font-size: 14px; font-weight: 700; color: #1f2937; line-height: 1; display: flex; align-items: center;";

    // 4个批量操作按钮(与单个标注卡片按钮一致)
    const batchButtons = [
      { id: "batch-public", text: "🌐 公开", visibility: "public" as const, showAuthorName: true, color: "#2196F3" },
      { id: "batch-anonymous", text: "🎭 匿名", visibility: "anonymous" as const, showAuthorName: false, color: "#FF9800" },
      { id: "batch-private", text: "🔒 私密", visibility: "private" as const, showAuthorName: true, color: "#9E9E9E" },
      { id: "batch-unshare", text: "🗑️ 取消", visibility: "unshared" as const, showAuthorName: false, color: "#ef4444" }
    ];

    toolbar.appendChild(selectAllSwitch);
    toolbar.appendChild(selectAllLabel);
    toolbar.appendChild(separator);
    toolbar.appendChild(batchLabel);

    batchButtons.forEach((btn) => {
      const button = doc.createElement("button");
      button.id = btn.id;
      button.textContent = btn.text;
      button.style.cssText = `
        padding: 10px 14px;
        background: #ffffff;
        color: ${btn.color};
        border: 2px solid ${btn.color};
        border-radius: 7px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      button.addEventListener("mouseenter", () => {
        button.style.background = btn.color;
        button.style.color = "#ffffff";
        button.style.transform = "translateY(-2px)";
        button.style.boxShadow = `0 4px 12px ${btn.color}40`;
      });
      button.addEventListener("mouseleave", () => {
        button.style.background = "#ffffff";
        button.style.color = btn.color;
        button.style.transform = "translateY(0)";
        button.style.boxShadow = "none";
      });

      button.addEventListener("click", async () => {
        await this.handleManageBatchOperation(
          annotations,
          documentId,
          userId,
          btn.visibility,
          btn.showAuthorName
        );
      });

      toolbar.appendChild(button);
    });

    container.appendChild(toolbar);

    // 标注列表容器
    const listContainer = doc.createElement("div");
    listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 600px;
      overflow-y: auto;
    `;

    annotations.forEach((annotation, index) => {
      const annotationCard = this.createManageAnnotationCard(
        doc,
        annotation,
        index,
        documentId,
        userId,
        searchQuery
      );
      listContainer.appendChild(annotationCard);
    });

    container.appendChild(listContainer);
  }

  /**
   * 创建管理标注卡片 - 从MyAnnotationsView完整移植
   */
  private createManageAnnotationCard(
    doc: Document,
    annotation: any,
    index: number,
    documentId: string,
    userId: string,
    searchQuery: string
  ): HTMLElement {
    const card = doc.createElement("div");
    card.className = "annotation-card";
    card.setAttribute("data-annotation-id", annotation.id);
    card.style.cssText = `
      padding: 16px;
      background: #ffffff;
      border-radius: 10px;
      border-left: 5px solid ${annotation.color};
      display: flex;
      gap: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      transition: all 0.2s;
      border: 1px solid #e5e7eb;
    `;

    card.addEventListener("mouseenter", () => {
      card.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.12)";
      card.style.transform = "translateY(-2px)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.08)";
      card.style.transform = "translateY(0)";
    });

    // 创建开关样式的复选框
    const switchContainer = doc.createElement("div");
    switchContainer.className = "annotation-switch-container";
    switchContainer.style.cssText = "margin-top: 4px; flex-shrink: 0;";

    const annotationSwitch = createToggleSwitch(
      doc,
      `annotation-switch-${index}`,
      false,
      "#3b82f6"
    );

    // 添加隐藏的checkbox用于批量操作
    const checkbox = doc.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "annotation-checkbox";
    checkbox.setAttribute("data-annotation-index", index.toString());
    checkbox.style.cssText = "display: none;";

    // 同步开关和checkbox状态
    const switchCheckbox = annotationSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (switchCheckbox) {
      switchCheckbox.addEventListener('change', () => {
        checkbox.checked = switchCheckbox.checked;
      });
    }

    // 为开关的track和thumb添加类名，方便全选时更新
    const track = annotationSwitch.querySelector('div:nth-child(2)') as HTMLElement;
    const thumb = track?.querySelector('div') as HTMLElement;
    if (track) track.className = 'switch-track';
    if (thumb) thumb.className = 'switch-thumb';

    switchContainer.appendChild(annotationSwitch);
    switchContainer.appendChild(checkbox);

    const contentArea = doc.createElement("div");
    contentArea.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 8px;";

    const contentDiv = doc.createElement("div");
    contentDiv.style.cssText = `
      font-size: 13px;
      line-height: 1.5;
      color: #212529;
    `;

    if (annotation.text) {
      const textSpan = doc.createElement("span");
      textSpan.style.cssText = `
        background: ${annotation.color}40;
        padding: 2px 4px;
        border-radius: 2px;
      `;
      textSpan.innerHTML = searchQuery ? highlightText(annotation.text, searchQuery) : annotation.text;
      contentDiv.appendChild(textSpan);
    }

    if (annotation.comment) {
      const commentDiv = doc.createElement("div");
      commentDiv.style.cssText = "margin-top: 6px; font-style: italic; color: #6c757d;";
      commentDiv.innerHTML = searchQuery ? `💬 ${highlightText(annotation.comment, searchQuery)}` : `💬 ${annotation.comment}`;
      contentDiv.appendChild(commentDiv);
    }

    const metadataDiv = doc.createElement("div");
    metadataDiv.style.cssText = "font-size: 11px; color: #9ca3af; display: flex; gap: 12px;";

    const typeMap: Record<string, string> = {
      highlight: "📝 高亮",
      note: "📌 笔记",
      underline: "➖ 下划线",
      image: "🖼️ 图片"
    };

    const metaItems = [
      typeMap[annotation.type] || annotation.type,
      annotation.pageLabel ? `📄 第 ${annotation.pageLabel} 页` : null
    ].filter(Boolean);

    metadataDiv.textContent = metaItems.join(" · ");

    const actionsDiv = doc.createElement("div");
    actionsDiv.style.cssText = "display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;";
    actionsDiv.setAttribute("data-annotation-key", annotation.key);

    // 创建按钮的工厂函数
    const createButton = (text: string, isPrimary: boolean, color: string) => {
      const button = doc.createElement("button");
      button.textContent = text;
      button.style.cssText = `
        flex: 0 0 auto;
        min-width: 80px;
        padding: 6px 12px;
        background: ${isPrimary ? color : "#ffffff"};
        color: ${isPrimary ? "#ffffff" : color};
        border: 2px solid ${color};
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.2s;
        white-space: nowrap;
      `;
      return button;
    };

    // 当前状态(支持新的visibility枚举)
    const currentVisibility = annotation.visibility || "unshared";
    
    // 创建4个共享模式按钮
    const shareModes = [
      { id: "public", label: "🌐 公开", color: "#2196F3", visibility: "public" },
      { id: "anonymous", label: "🎭 匿名", color: "#FF9800", visibility: "anonymous" },
      { id: "private", label: "🔒 私密", color: "#9E9E9E", visibility: "private" },
    ];
    
    const handleModeClick = async (targetVisibility: string) => {
      // 重新sync获取最新状态
      const currentItem = this.context.getCurrentItem();
      if (!currentItem) return;
      
      const { AnnotationManager } = await import("../annotations");
      const annotations = await AnnotationManager.getItemAnnotations(currentItem);
      const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
      const syncedAnnotations = await AnnotationManager.syncAnnotationsWithSupabase(
        annotations,
        documentInfo.id,
        userId
      );
      
      const latestAnnotation = syncedAnnotations.find(a => a.key === annotation.key);
      if (!latestAnnotation) {
        logger.error("[SessionAnnotationsView] ❌ Cannot find annotation after sync!");
        return;
      }
      
      // 共享到目标模式(public显示真实用户名,anonymous隐藏)
      const showAuthorName = targetVisibility === "public";
      await this.handleManageSingleAnnotationShare(
        latestAnnotation,
        documentId,
        userId,
        targetVisibility as "private" | "shared" | "public" | "anonymous",
        showAuthorName
      );
    };
    
    // 渲染3个模式按钮(支持换行避免溢出)
    actionsDiv.style.display = "flex";
    actionsDiv.style.flexWrap = "wrap";  // 关键:允许换行
    actionsDiv.style.gap = "4px";
    
    shareModes.forEach(mode => {
      const isActive = currentVisibility === mode.visibility;
      const button = createButton(
        mode.label,
        isActive,
        mode.color
      );
      button.setAttribute("data-button-type", mode.id);
      button.title = isActive 
        ? `当前为${mode.label}模式` 
        : `切换到${mode.label}模式`;
      
      button.addEventListener("click", async () => {
        // 禁用按钮避免重复点击
        button.disabled = true;
        
        try {
          await handleModeClick(mode.visibility);
          
          // ✅ 更新annotation对象的visibility(重要!避免下次渲染显示旧状态)
          annotation.visibility = mode.visibility;
          annotation.showAuthorName = (mode.visibility === "public"); // anonymous由handleManageSingleAnnotationShare修正为false
          
          // 局部更新按钮状态,避免整页刷新
          actionsDiv.querySelectorAll("button").forEach(btn => {
            const btnType = btn.getAttribute("data-button-type");
            if (shareModes.find(m => m.id === btnType)) {
              // 移除所有active样式
              btn.style.border = "1px solid #ccc";
              btn.style.fontWeight = "normal";
            }
          });
          
          // 激活当前按钮
          button.style.border = `2px solid ${mode.color}`;
          button.style.fontWeight = "bold";
          
          // 如果之前没有取消按钮,添加它
          if (!actionsDiv.querySelector('[data-button-type="cancel"]')) {
            const cancelButton = createButton("🗑️ 取消", false, "#ef4444");
            cancelButton.setAttribute("data-button-type", "cancel");
            cancelButton.title = "取消共享并删除相关数据(点赞/评论)";
            cancelButton.addEventListener("click", async () => {
              const currentItem = this.context.getCurrentItem();
              if (!currentItem) return;
              
              const { AnnotationManager } = await import("../annotations");
              const annotations = await AnnotationManager.getItemAnnotations(currentItem);
              const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
              const syncedAnnotations = await AnnotationManager.syncAnnotationsWithSupabase(
                annotations,
                documentInfo.id,
                userId
              );
              
              const latestAnnotation = syncedAnnotations.find(a => a.key === annotation.key);
              if (!latestAnnotation) {
                logger.error("[SessionAnnotationsView] ❌ Cannot find annotation after sync!");
                return;
              }
              
              await this.handleManageSingleAnnotationShare(
                latestAnnotation,
                documentId,
                userId,
                "unshared",
                false
              );
              
              // 更新annotation对象
              annotation.visibility = undefined;
              annotation.supabaseId = undefined;
              
              // 移除取消按钮
              cancelButton.remove();
            });
            
            actionsDiv.appendChild(cancelButton);
          }
          
        } finally {
          button.disabled = false;
        }
      });
      
      actionsDiv.appendChild(button);
    });
    
    // 取消共享按钮(仅在已共享时显示)
    const isShared = ["public", "anonymous", "private", "shared"].includes(currentVisibility);
    if (isShared) {
      const cancelButton = createButton("🗑️ 取消", false, "#ef4444");
      cancelButton.setAttribute("data-button-type", "cancel");
      cancelButton.title = "取消共享并删除相关数据(点赞/评论)";
      
      cancelButton.addEventListener("click", async () => {
        const currentItem = this.context.getCurrentItem();
        if (!currentItem) return;
        
        const { AnnotationManager } = await import("../annotations");
        const annotations = await AnnotationManager.getItemAnnotations(currentItem);
        const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
        const syncedAnnotations = await AnnotationManager.syncAnnotationsWithSupabase(
          annotations,
          documentInfo.id,
          userId
        );
        
        const latestAnnotation = syncedAnnotations.find(a => a.key === annotation.key);
        if (!latestAnnotation) {
          logger.error("[SessionAnnotationsView] ❌ Cannot find annotation after sync!");
          return;
        }
        
        // 取消共享(删除Supabase记录及关联数据)
        await this.handleManageSingleAnnotationShare(
          latestAnnotation,
          documentId,
          userId,
          "unshared",
          false
        );
        
        // 移除取消按钮并重置所有按钮状态
        cancelButton.remove();
        actionsDiv.querySelectorAll("button").forEach(btn => {
          btn.style.border = "1px solid #ccc";
          btn.style.fontWeight = "normal";
        });
      });
      
      actionsDiv.appendChild(cancelButton);
    }

    contentArea.appendChild(contentDiv);
    contentArea.appendChild(metadataDiv);
    contentArea.appendChild(actionsDiv);

    card.appendChild(switchContainer);
    card.appendChild(contentArea);

    return card;
  }

  /**
   * 处理单个标注共享/取消共享 - 支持4级共享模式(public/anonymous/private/unshared)
   */
  private async handleManageSingleAnnotationShare(
    annotation: any,
    documentId: string,
    userId: string,
    visibility: "private" | "shared" | "public" | "anonymous" | "unshared",
    showAuthorName: boolean
  ): Promise<void> {
    try {
      // 🆕 完全取消共享(删除Supabase记录及关联数据)
      if (visibility === "unshared" && annotation.supabaseId) {
        const relatedData = await this.context.supabaseManager.getAnnotationRelatedData(annotation.supabaseId);

        if (relatedData.likes_count > 0 || relatedData.comments_count > 0) {
          const { ServicesAdapter } = await import('../../adapters');
          const confirmMessage = [
            "取消共享将删除以下相关数据:",
            `• ${relatedData.likes_count} 个点赞`,
            `• ${relatedData.comments_count} 条评论${relatedData.has_nested_comments ? "(包含回复)" : ""}`,
            "",
            "此操作不可撤销,是否继续?"
          ].join("\n");

          const confirmed = ServicesAdapter.confirm(
            "确认取消共享",
            confirmMessage
          );

          if (!confirmed) {
            return;
          }
        }
        
        // 级联删除标注及关联数据
        const success = await this.context.supabaseManager.deleteSharedAnnotation(annotation.supabaseId);
        if (success) {
          this.context.showMessage("已取消共享并删除相关数据", "info");
          // 清除本地缓存
          const { AnnotationManager } = await import("../annotations");
          const currentItem = this.context.getCurrentItem();
          if (currentItem) {
            AnnotationManager.clearCache(currentItem.id);
          }
          this.cachedAnnotations = null;
          
          // 延迟后重新渲染
          await new Promise(resolve => setTimeout(resolve, 800));
          if (this.context.isActive()) {
            for (const panel of this.context.getPanelsForCurrentItem()) {
              if (panel.contentSection) {
                await this.render(panel.contentSection, panel.contentSection.ownerDocument, '');
              }
            }
          }
        } else {
          this.context.showMessage("取消共享失败", "error");
        }
        return;
      }

      const { AnnotationManager } = await import("../annotations");
      
      // 映射visibility: anonymous→public, 其他保持不变
      let targetVisibility: "shared" | "public" | "private";
      if (visibility === "anonymous") {
        targetVisibility = "public";
      } else if (visibility === "unshared") {
        // 不应该走到这里,unshared已在上面单独处理
        logger.error("[SessionAnnotationsView] Unexpected unshared visibility in updateAnnotationSharing");
        return;
      } else {
        targetVisibility = visibility;
      }
      
      const success = await AnnotationManager.updateAnnotationSharing(
        annotation,
        documentId,
        userId,
        targetVisibility,
        visibility === "anonymous" ? false : showAuthorName  // anonymous强制隐藏作者
      );
      
      // 🆕 修正本地visibility状态(anonymous映射为public后需要还原)
      if (success && visibility === "anonymous") {
        annotation.visibility = "anonymous";
        annotation.showAuthorName = false;
      }

      if (success) {
        // 🆕 如果是共享到public/anonymous(显示在社区),且有当前session,则添加到session_annotations表
        if (visibility === 'public' || visibility === 'anonymous') {
          const session = this.sessionManager.getCurrentSession();
          if (session) {
            // updateAnnotationSharing会设置annotation.supabaseId,直接使用
            if (!annotation.supabaseId) {
              logger.error("[SessionAnnotationsView] ❌ Annotation supabaseId not set after updateAnnotationSharing!");
            } else {
              try {
                // 使用POST /api/proxy/annotations/share-to-session API
                await this.apiClient.post('/api/proxy/annotations/share-to-session', {
                  annotation_id: annotation.supabaseId,
                  session_id: session.id
                });
                logger.log(`[SessionAnnotationsView] ✅ Added annotation ${annotation.supabaseId} to session ${session.id}`);
              } catch (error) {
                logger.error("[SessionAnnotationsView] Failed to add annotation to session:", error);
                // 不阻塞主流程,只记录错误
              }
            }
          } else {
            logger.log("[SessionAnnotationsView] ⚠️ No current session, skipping share-to-session");
          }
        }
        
        // 不显示成功消息,避免打断用户操作
        // this.context.showMessage("更新成功", "info");
        
        const currentItem = this.context.getCurrentItem();
        if (currentItem) {
          AnnotationManager.clearCache(currentItem.id);
        }
        this.cachedAnnotations = null;

        // ✅ 不调用 render(),避免整页刷新
        // 按钮状态已在点击事件中局部更新,无需重新渲染
      } else {
        this.context.showMessage("更新失败", "error");
      }
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error updating annotation:", error);
      this.context.showMessage("更新失败: " + (error instanceof Error ? error.message : "未知错误"), "error");
    }
  }

  /**
   * 处理批量操作 - 从MyAnnotationsView完整移植
   */
  private async handleManageBatchOperation(
    allAnnotations: any[],
    documentId: string,
    userId: string,
    visibility: "private" | "shared" | "public" | "anonymous" | "unshared",
    showAuthorName: boolean
  ): Promise<void> {
    try {
      const win = Zotero.getMainWindow();
      if (!win || !win.document) {
        return;
      }

      const checkboxes = win.document.querySelectorAll(".annotation-checkbox:checked");
      if (checkboxes.length === 0) {
        this.context.showMessage("请先选择要操作的标注", "warning");
        return;
      }

      const selectedAnnotations = Array.from(checkboxes).map((cb) => {
        const checkbox = cb as HTMLInputElement;
        const index = parseInt(checkbox.getAttribute("data-annotation-index") || "0", 10);
        return allAnnotations[index];
      });

      // 取消共享(unshared):需要确认删除
      if (visibility === "unshared") {
        let totalLikes = 0;
        let totalComments = 0;
        let hasNested = false;

        for (const ann of selectedAnnotations) {
          if (ann.supabaseId) {
            try {
              const relatedData = await this.context.supabaseManager.getAnnotationRelatedData(ann.supabaseId);
              totalLikes += relatedData.likes_count;
              totalComments += relatedData.comments_count;
              if (relatedData.has_nested_comments) hasNested = true;
            } catch (_) {
              // ignore errors during estimation
            }
          }
        }

        if (totalLikes > 0 || totalComments > 0) {
          const { ServicesAdapter } = await import('../../adapters');
          const confirmMessage = [
            "取消共享将删除以下相关数据:",
            `• ${totalLikes} 个点赞`,
            `• ${totalComments} 条评论${hasNested ? "(包含回复)" : ""}`,
            "",
            "此操作不可撤销,是否继续?"
          ].join("\n");

          const confirmed = ServicesAdapter.confirm(
            "确认取消共享",
            confirmMessage
          );

          if (!confirmed) {
            return;
          }
        }
      }

      const { AnnotationManager } = await import("../annotations");
      
      // 处理unshared:批量删除
      if (visibility === "unshared") {
        const deleteResults = await Promise.all(
          selectedAnnotations.map(async (ann) => {
            if (ann.supabaseId) {
              return await this.context.supabaseManager.deleteSharedAnnotation(ann.supabaseId);
            }
            return true; // 本地标注无需删除
          })
        );
        
        if (deleteResults.every(Boolean)) {
          this.context.showMessage("批量取消共享完成", "info");
          const currentItem = this.context.getCurrentItem();
          if (currentItem) {
            AnnotationManager.clearCache(currentItem.id);
          }
          this.cachedAnnotations = null;
          
          // 延迟后重新渲染
          await new Promise(resolve => setTimeout(resolve, 800));
          if (this.context.isActive()) {
            for (const panel of this.context.getPanelsForCurrentItem()) {
              if (panel.contentSection) {
                await this.render(panel.contentSection, panel.contentSection.ownerDocument, '');
              }
            }
          }
        } else {
          this.context.showMessage("部分取消共享失败", "error");
        }
        return;
      }
      
      // 映射visibility: anonymous → public
      let targetVisibility: "shared" | "public" | "private";
      if (visibility === "anonymous") {
        targetVisibility = "public";
      } else {
        targetVisibility = visibility as "shared" | "public" | "private";
      }
      
      const results = await Promise.all(
        selectedAnnotations.map((ann) =>
          AnnotationManager.updateAnnotationSharing(
            ann,
            documentId,
            userId,
            targetVisibility,
            visibility === "anonymous" ? false : showAuthorName  // anonymous强制隐藏
          )
        )
      );
      
      // 🆕 修正本地visibility状态(anonymous映射为public后需要还原)
      if (visibility === "anonymous") {
        selectedAnnotations.forEach(ann => {
          ann.visibility = "anonymous";
          ann.showAuthorName = false;
        });
      }

      if (results.every(Boolean)) {
        // 🆕 批量添加到session(仅public/anonymous)
        if (visibility === 'public' || visibility === 'anonymous') {
          const session = this.sessionManager.getCurrentSession();
          if (session) {
            // 检查哪些标注有supabaseId
            const annotationsWithId = selectedAnnotations.filter(ann => ann.supabaseId);
            const annotationsWithoutId = selectedAnnotations.filter(ann => !ann.supabaseId);
            
            logger.log(`[SessionAnnotationsView] 📊 Batch share status: ${annotationsWithId.length} with ID, ${annotationsWithoutId.length} without ID`);
            
            if (annotationsWithoutId.length > 0) {
              logger.error("[SessionAnnotationsView] ❌ Some annotations missing supabaseId after updateAnnotationSharing:", 
                annotationsWithoutId.map(a => a.key));
            }
            
            const sharePromises = annotationsWithId.map(ann => 
              this.apiClient.post('/api/proxy/annotations/share-to-session', {
                annotation_id: ann.supabaseId,
                session_id: session.id
              }).catch(error => {
                logger.error(`[SessionAnnotationsView] Failed to share annotation ${ann.supabaseId}:`, error);
              })
            );
            await Promise.all(sharePromises);
            logger.log(`[SessionAnnotationsView] ✅ Batch shared ${sharePromises.length}/${selectedAnnotations.length} annotations to session`);
          } else {
            logger.log("[SessionAnnotationsView] ⚠️ No current session, skipping batch share-to-session");
          }
        }
        
        this.context.showMessage("批量操作完成", "info");
        const currentItem = this.context.getCurrentItem();
        if (currentItem) {
          AnnotationManager.clearCache(currentItem.id);
        }
        this.cachedAnnotations = null;

        // 等待充足延迟确保Supabase批量创建+索引更新+syncAnnotationsWithSupabase获取最新数据
        await new Promise(resolve => setTimeout(resolve, 600));

        // 重新渲染整个管理标注视图
        if (this.context.isActive()) {
          for (const panel of this.context.getPanelsForCurrentItem()) {
            if (panel.contentSection) {
              await this.render(panel.contentSection, panel.contentSection.ownerDocument, '');
            }
          }
        }
      } else {
        this.context.showMessage("部分标注更新失败", "warning");
      }
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error in batch operation:", error);
      this.context.showMessage("批量操作失败: " + (error instanceof Error ? error.message : "未知错误"), "error");
    }
  }

  // ==================== 共享标注模式的辅助方法 (from readingSessionView backup) ====================

  /**
   * 标注去重 - 使用zotero_key作为唯一标识
   */
  private deduplicateAnnotations(annotations: any[]): any[] {
    const seen = new Map<string, any>();
    for (const ann of annotations) {
      const key = ann.annotation_data?.zotero_key || ann.id;
      if (!seen.has(key)) {
        seen.set(key, ann);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * 创建批量显示工具栏 - 完整4按钮版本
   */
  private createBatchDisplayToolbar(doc: Document, sessionId: string): HTMLElement {
    const toolbar = doc.createElement("div");
    toolbar.id = "batch-display-toolbar";
    toolbar.style.cssText = `
      padding: 14px 16px;
      background: #ffffff;
      border-radius: 10px;
      margin: 0 0 16px 0;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    `;

    const label = doc.createElement("span");
    label.textContent = "📍 批量显示:";
    label.style.cssText = `
      color: #1f2937;
      font-weight: 700;
      font-size: 14px;
      margin-right: 6px;
      line-height: 1;
      display: flex;
      align-items: center;
    `;
    toolbar.appendChild(label);

    // 按钮配置: 全部显示、选中成员、隐藏我的标注、清除显示
    const buttons = [
      { id: "show-all", text: "全部显示", icon: "🌐", filter: "all", color: "#3b82f6" },
      { id: "show-following", text: "选中成员", icon: "👥", filter: "following", color: "#3b82f6" },
      { id: "toggle-native", text: "隐藏我的标注", icon: "👁️", filter: "toggle-native", color: "#0891b2" },
      { id: "clear-all", text: "清除显示", icon: "🚫", filter: "clear", color: "#ef4444" }
    ];

    buttons.forEach((btn) => {
      const button = doc.createElement("button");
      button.id = btn.id;
      button.innerHTML = `${btn.icon} ${btn.text}`;
      button.setAttribute("data-filter", btn.filter);

      button.style.cssText = `
        padding: 10px 14px;
        background: #ffffff;
        color: ${btn.color};
        border: 2px solid ${btn.color};
        border-radius: 7px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      `;

      button.addEventListener("mouseenter", () => {
        button.style.background = btn.color;
        button.style.color = "#ffffff";
        button.style.transform = "translateY(-2px)";
        button.style.boxShadow = `0 4px 12px ${btn.color}40`;
      });

      button.addEventListener("mouseleave", () => {
        button.style.background = "#ffffff";
        button.style.color = btn.color;
        button.style.transform = "translateY(0)";
        button.style.boxShadow = "none";
      });

      button.addEventListener("click", () => {
        this.handleBatchDisplay(btn.filter, sessionId, doc);
      });

      toolbar.appendChild(button);
    });

    return toolbar;
  }

  /**
   * 处理批量显示操作 - 从backup完整迁移
   */
  private async handleBatchDisplay(filterType: string, sessionId: string, doc: Document): Promise<void> {
    try {
      logger.log(`[SessionAnnotationsView] 🎯 Handling batch display: ${filterType}`);

      // 获取当前会话
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

      // 获取PDFReaderManager实例
      const readerManager = await this.getPDFReaderManager();
      if (!readerManager) {
        this.context.showMessage('PDF阅读器管理器未初始化，请重启Zotero', 'error');
        return;
      }

      // 处理toggle-native
      if (filterType === "toggle-native") {
        let reader = await readerManager.findOpenReader(doi);
        if (!reader) {
          this.context.showMessage("请先打开PDF文件", "warning");
          return;
        }

        const currentState = readerManager.getNativeAnnotationsState(reader);
        const shouldHide = !currentState;
        const isHidden = readerManager.toggleNativeAnnotations(reader, shouldHide);

        // 更新按钮文字
        const panels = this.context.getPanelsForCurrentItem();
        for (const panel of panels) {
          if (panel.contentSection) {
            const button = panel.contentSection.querySelector('[data-filter="toggle-native"]') as HTMLElement;
            if (button) {
              const newText = isHidden ? "👁️ 显示我的标注" : "👁️ 隐藏我的标注";
              button.innerHTML = newText;
            }
          }
        }

        this.context.showMessage(isHidden ? "已隐藏原生标注" : "已显示原生标注", "info");
        return;
      }

      // 处理clear
      if (filterType === "clear") {
        readerManager.clearAllHighlights();
        this.context.showMessage("已清除所有标注显示", "info");
        return;
      }

      // 获取会话标注
      const sessionAnnotations = await this.sessionManager.getSessionAnnotations(session.id, 1, 1000);
      
      if (!sessionAnnotations || sessionAnnotations.length === 0) {
        this.context.showMessage("没有可显示的标注", "warning");
        return;
      }

      // 筛选标注
      let filteredAnnotations = sessionAnnotations;
      
      if (filterType === "following") {
        // "选中成员"筛选
        const panels = this.context.getPanelsForCurrentItem();
        if (panels && panels.length > 0 && panels[0].contentSection) {
          const doc = panels[0].contentSection.ownerDocument;
          const selectedMembers = Array.from(doc.querySelectorAll('[data-member-checkbox]:checked'))
            .map(cb => (cb as HTMLInputElement).value);
          
          if (selectedMembers.length === 0) {
            this.context.showMessage("请先选择成员", "warning");
            return;
          }

          filteredAnnotations = sessionAnnotations.filter((ann: any) => selectedMembers.includes(ann.user_id));
        }
      } else if (filterType === "all") {
        // 显示全部标注,filteredAnnotations已包含全部
      }

      if (filteredAnnotations.length === 0) {
        this.context.showMessage("没有符合条件的标注", "warning");
        return;
      }

      // 查找或打开PDF阅读器
      let reader = await readerManager.findOpenReader(doi);
      if (!reader) {
        this.context.showMessage("请先打开PDF文件", "warning");
        return;
      }

      this.context.showMessage(`正在显示 ${filteredAnnotations.length} 个标注...`, "info");

      // 转换为共享标注格式
      const sharedAnnotations = filteredAnnotations.map((ann: any) => {
        const annotationData = ann.annotation_data || {};
        
        // 解析position
        let position = annotationData.position;
        if (typeof position === 'string') {
          try {
            position = JSON.parse(position);
          } catch (e) {
            position = null;
          }
        }
        
        // 如果没有有效position,使用page_number构造
        if (!position || typeof position.pageIndex !== 'number') {
          position = ann.page_number ? { pageIndex: ann.page_number - 1 } : null;
        }
        
        return {
          id: ann.id,
          type: annotationData.type || 'highlight',
          content: annotationData.text || annotationData.comment || '',
          comment: annotationData.comment,
          color: annotationData.color || '#ffd400',
          position: position,
          username: ann.user_name || ann.user_email,
          user_id: ann.user_id,
          show_author_name: true,
          created_at: ann.created_at
        };
      }).filter((ann: any) => ann.position && typeof ann.position.pageIndex === 'number');

      logger.log(`[SessionAnnotationsView] Filtered to ${sharedAnnotations.length} valid annotations`);
      if (sharedAnnotations.length > 0) {
        logger.log(`[SessionAnnotationsView] Sample annotation:`, sharedAnnotations[0]);
      }

      const result = await readerManager.highlightMultipleAnnotations(reader, sharedAnnotations);

      this.context.showMessage(
        `成功显示 ${result.success} 个标注${result.failed > 0 ? `, ${result.failed} 个失败` : ""}`,
        result.failed === 0 ? "info" : "warning"
      );
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error handling batch display:", error);
      this.context.showMessage(
        "批量显示失败: " + (error instanceof Error ? error.message : "未知错误"),
        "error"
      );
    }
  }

  /**
   * 创建排序筛选工具栏
   */
  private createSharedAnnotationsToolbar(doc: Document, sessionId: string): HTMLElement {
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
      { value: 'page', label: '📄 按页码排序' }
    ];

    sortOptions.forEach(opt => {
      const option = doc.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      sortSelect.appendChild(option);
    });

    sortSelect.value = 'time-desc';
    sortSelect.addEventListener('change', async () => {
      const filterSelect = doc.getElementById('annotation-filter-select') as HTMLSelectElement;
      await this.applySharedSortFilter(doc, sessionId, sortSelect.value, filterSelect?.value || 'all');
    });

    toolbar.appendChild(sortSelect);

    // 筛选选择器
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
      { value: 'all', label: '🌐 所有成员（包括我）' },
      { value: 'others', label: '👥 其他成员' },
      { value: 'followed', label: '⭐ 关注成员（不包括我）' },
      { value: 'select', label: '👤 选择成员...' },
    ];

    // 默认选中"所有成员(包括我)"
    filterSelect.value = 'all';
    
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
        await this.applySharedSortFilter(doc, sessionId, sortSelect.value, filterSelect.value);
      }
    });

    toolbar.appendChild(filterSelect);

    return toolbar;
  }

  /**
   * 渲染共享标注卡片 - 完全移植SharedAnnotationsView实现
   */
  private async renderSharedAnnotationCards(container: HTMLElement, annotations: any[], doc: Document, currentUserId: string): Promise<void> {
    // 批量获取所有标注的点赞状态
    const annotationIds = annotations.map(a => a.id);
    const likeMap = await this.context.supabaseManager.batchCheckUserLikes(annotationIds, currentUserId);
    
    for (const annotation of annotations) {
      const userLiked = likeMap.get(annotation.id) || false;
      const card = await this.createSharedAnnotationCard(doc, annotation, currentUserId, userLiked);
      container.appendChild(card);
    }
  }

  /**
   * 创建共享标注卡片 - 完整功能(点赞、评论、定位、hover卡片)
   */
  private async createSharedAnnotationCard(
    doc: Document,
    annotation: any,
    currentUserId: string,
    userLiked: boolean
  ): Promise<HTMLElement> {
    const card = doc.createElement("div");
    card.className = "shared-annotation-card";
    card.setAttribute("data-annotation-id", annotation.id);
    card.setAttribute("data-user-id", annotation.user_id || "");
    card.setAttribute("data-created-at", annotation.created_at || "");
    card.setAttribute("data-likes-count", String(annotation.likes_count || 0));
    card.setAttribute("data-comments-count", String(annotation.comments_count || 0));
    card.setAttribute("data-page-number", String(annotation.page_number || 0));
    
    // 从annotation_data中提取颜色,如果没有则使用默认黄色
    const annotationColor = annotation.annotation_data?.color || annotation.color || '#ffd400';
    
    card.style.cssText = `
      padding: 12px;
      background: #ffffff;
      border-radius: 6px;
      border-left: 4px solid ${annotationColor};
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    `;

    // 头部 - 用户信息和时间
    const headerDiv = doc.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6c757d;";

    // 根据visibility和show_author_name决定显示
    const visibility = annotation.visibility || 'public';
    const showAuthorName = annotation.show_author_name;
    
    // Debug log
    logger.log(`[SessionAnnotationsView] 🔍 Annotation ${annotation.id}: visibility=${visibility}, show_author_name=${showAuthorName}`);
    
    const isPrivate = visibility === 'private';
    const isAnonymous = showAuthorName === false && visibility !== 'private';
    
    let displayName: string;
    let username: string;
    let clickable: boolean;
    
    if (isPrivate) {
      // 私密标注显示"私密"
      displayName = '私密';
      username = '';
      clickable = false;
    } else if (isAnonymous) {
      // 匿名标注显示"匿名用户"
      displayName = '匿名用户';
      username = '';
      clickable = false;
    } else {
      // 公开标注显示真实用户名
      displayName = annotation.user_name || annotation.user_email || '未知用户';
      username = annotation.username || '';
      clickable = true;
    }

    // ✨ 使用UserHoverCardManager创建用户元素
    // isPrivate也需要特殊渲染(无头像、无点击),传入displayName会显示"私密"
    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      username,
      displayName,
      { isAnonymous: isAnonymous || isPrivate, clickable, avatarUrl: annotation.avatar_url }
    );
    userInfo.appendChild(userElement);

    const separator = doc.createElement("span");
    separator.style.color = "#9ca3af";
    separator.textContent = "·";
    userInfo.appendChild(separator);

    const timeSpan = doc.createElement("span");
    timeSpan.style.color = "#9ca3af";
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
    card.appendChild(headerDiv);

    // 标注内容
    const annotationText = annotation.annotation_data?.text || 
                          annotation.annotation_data?.comment || 
                          annotation.content ||
                          '';
    
    if (annotationText) {
      const contentDiv = doc.createElement("div");
      contentDiv.style.cssText = `
        font-size: 13px;
        line-height: 1.5;
        color: #212529;
        background: ${annotationColor}20;
        padding: 8px;
        border-radius: 3px;
      `;
      contentDiv.textContent = annotationText;
      card.appendChild(contentDiv);
    }

    // 评论内容
    if (annotation.comment) {
      const commentDiv = doc.createElement("div");
      commentDiv.style.cssText = `
        font-size: 12px;
        line-height: 1.4;
        color: #6c757d;
        font-style: italic;
        padding-left: 12px;
        border-left: 2px solid #e9ecef;
      `;
      commentDiv.textContent = annotation.comment;
      card.appendChild(commentDiv);
    }

    // 操作按钮区域 - 点赞和评论
    const actionsDiv = doc.createElement("div");
    actionsDiv.style.cssText = "display: flex; gap: 16px; align-items: center;";

    // 点赞按钮
    const likeButton = doc.createElement("button");
    likeButton.setAttribute("data-like-button", "true");
    likeButton.innerHTML = `${userLiked ? "❤️" : "🤍"} ${annotation.likes_count || 0}`;
    likeButton.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: ${userLiked ? "#dc3545" : "#6c757d"};
      border: 1px solid ${userLiked ? "#dc3545" : "#e9ecef"};
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    `;

    likeButton.addEventListener("click", async (e) => {
      e.stopPropagation(); // 阻止冒泡到卡片点击事件
      await this.handleLikeAnnotation(annotation.id, currentUserId, card);
    });

    // 评论按钮
    const commentButton = doc.createElement("button");
    commentButton.setAttribute("data-comment-button", "true");
    commentButton.innerHTML = `💬 ${annotation.comments_count || 0}`;
    commentButton.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: #6c757d;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    `;

    commentButton.addEventListener("click", async (e) => {
      e.stopPropagation(); // 阻止冒泡到卡片点击事件
      await this.showCommentsSection(card, annotation.id, currentUserId);
    });

    actionsDiv.appendChild(likeButton);
    actionsDiv.appendChild(commentButton);
    card.appendChild(actionsDiv);

    // 卡片点击事件 - 定位到PDF页面
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // 如果点击的是按钮或评论区域,不触发卡片点击事件
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      if (target.classList.contains('comments-section') || target.closest('.comments-section')) {
        return;
      }

      // 触发定位功能
      await this.handleLocateAnnotation(annotation);
    });

    // Hover效果
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    });

    return card;
  }
  
  /**
   * 处理点赞标注
   * 修复: 点赞后重新获取数据库的真实 likes_count,避免计数错误
   */
  private async handleLikeAnnotation(
    annotationId: string,
    userId: string,
    cardElement?: HTMLElement
  ): Promise<void> {
    if (!cardElement) return;
    
    const likeButton = cardElement.querySelector(
      "button[data-like-button]"
    ) as HTMLButtonElement | null;
    
    if (!likeButton) return;
    
    // 防止并发点击
    if (likeButton.disabled) return;
    
    try {
      // 禁用按钮,显示加载状态
      likeButton.disabled = true;
      const currentCount = parseInt(likeButton.textContent?.match(/\d+/)?.[0] || "0", 10);
      likeButton.innerHTML = `<span style="opacity: 0.5;">...</span>`;
      
      // 执行点赞/取消点赞操作
      const isNowLiked = await this.context.supabaseManager.likeAnnotation(annotationId, userId);
      
      // 直接根据操作结果计算新的点赞数 (不依赖数据库查询,避免 trigger 延迟/历史数据问题)
      const newCount = isNowLiked ? currentCount + 1 : currentCount - 1;
      
      // 更新UI
      if (isNowLiked) {
        likeButton.innerHTML = `❤️ ${newCount}`;
        likeButton.style.color = "#dc3545";
        likeButton.style.borderColor = "#dc3545";
      } else {
        likeButton.innerHTML = `🤍 ${newCount}`;
        likeButton.style.color = "#6c757d";
        likeButton.style.borderColor = "#e9ecef";
      }
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error liking annotation:", error);
      this.context.showMessage("操作失败", "error");
    } finally {
      // 恢复按钮可用状态
      if (likeButton) {
        likeButton.disabled = false;
      }
    }
  }
  
  /**
   * 显示评论区域
   */
  private async showCommentsSection(
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    const doc = cardElement.ownerDocument;

    let commentsSection = cardElement.querySelector(".comments-section") as HTMLElement | null;

    // 切换显示/隐藏
    if (commentsSection) {
      commentsSection.style.display = commentsSection.style.display === "none" ? "flex" : "none";
      return;
    }

    commentsSection = doc.createElement("div");
    commentsSection.className = "comments-section";
    commentsSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
    `;

    try {
      const commentTree = await this.context.supabaseManager.getAnnotationCommentTree(annotationId);

      if (commentTree.length > 0) {
        const commentsList = doc.createElement("div");
        commentsList.className = "comments-tree";
        commentsList.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

        commentTree.forEach((rootComment) => {
          const commentNode = this.renderCommentNode(
            rootComment,
            0,
            doc,
            currentUserId,
            annotationId,
            cardElement
          );
          commentsList.appendChild(commentNode);
        });

        commentsSection.appendChild(commentsList);
      }

      // 创建输入区域容器(textarea + 匿名开关 + 按钮)
      const inputAreaContainer = doc.createElement("div");
      inputAreaContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

      const textarea = doc.createElement("textarea");
      textarea.placeholder = "添加评论...";
      textarea.style.cssText = `
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #e9ecef;
        border-radius: 3px;
        font-size: 12px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        background: #ffffff;
        color: #212529;
        box-sizing: border-box;
      `;

      // 匿名开关容器
      const anonymousContainer = doc.createElement("div");
      anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px;";

      const anonymousSwitch = createToggleSwitch(
        doc,
        `anonymous-comment-${annotationId}`,
        false,
        "#8b5cf6"
      );

      const anonymousLabel = doc.createElement("label");
      anonymousLabel.htmlFor = `anonymous-comment-${annotationId}`;
      anonymousLabel.textContent = "匿名显示";
      anonymousLabel.style.cssText = "font-size: 11px; color: #6c757d; cursor: pointer; user-select: none;";

      anonymousContainer.appendChild(anonymousSwitch);
      anonymousContainer.appendChild(anonymousLabel);

      // 按钮容器
      const buttonContainer = doc.createElement("div");
      buttonContainer.style.cssText = "display: flex; justify-content: flex-end;";

      const submitButton = doc.createElement("button");
      submitButton.textContent = "发送";
      submitButton.style.cssText = `
        padding: 6px 12px;
        background: #0d6efd;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
      `;

      submitButton.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) return;

        try {
          // 从开关中获取checkbox状态
          const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
          const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

          await this.context.supabaseManager.addComment(annotationId, currentUserId, content, null, isAnonymous);
          this.context.showMessage("评论成功", "info");

          const commentButton = cardElement.querySelector(
            "button[data-comment-button]"
          ) as HTMLButtonElement | null;
          if (commentButton) {
            const currentCount = parseInt(commentButton.textContent?.match(/\d+/)?.[0] || "0", 10);
            commentButton.innerHTML = `💬 ${currentCount + 1}`;
          }

          textarea.value = "";
          // 重置开关状态
          if (switchCheckbox) {
            switchCheckbox.checked = false;
            const track = anonymousSwitch.querySelector('.switch-track') as HTMLElement;
            const thumb = track?.querySelector('.switch-thumb') as HTMLElement;
            if (track && thumb) {
              track.style.background = '#d1d5db';
              thumb.style.left = '2px';
            }
          }
          cardElement.removeChild(commentsSection!);
          await this.showCommentsSection(cardElement, annotationId, currentUserId);
        } catch (error) {
          logger.error("[SessionAnnotationsView] Error adding comment:", error);
          this.context.showMessage("评论失败", "error");
        }
      });

      buttonContainer.appendChild(submitButton);

      inputAreaContainer.appendChild(textarea);
      inputAreaContainer.appendChild(anonymousContainer);
      inputAreaContainer.appendChild(buttonContainer);
      commentsSection.appendChild(inputAreaContainer);

      cardElement.appendChild(commentsSection);
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error showing comments:", error);
      this.context.showMessage("加载评论失败", "error");
    }
  }
  
  /**
   * 渲染评论节点(支持嵌套回复)
   */
  private renderCommentNode(
    comment: any,
    depth: number,
    doc: Document,
    currentUserId: string,
    annotationId: string,
    cardElement: HTMLElement
  ): HTMLElement {
    // 评论节点容器
    const container = doc.createElement("div");
    container.className = "comment-node";
    container.setAttribute("data-comment-id", comment.id);
    container.setAttribute("data-depth", depth.toString());
    container.style.cssText = `
      margin-left: ${depth * 20}px;
      ${depth > 0 ? "border-left: 2px solid #e9ecef; padding-left: 8px;" : ""}
      margin-bottom: ${depth > 0 ? "4px" : "8px"};
    `;

    const commentBody = doc.createElement("div");
    commentBody.className = "comment-body";
    commentBody.style.cssText = `
      padding: 8px;
      background: #9ca3af;
      border-radius: 3px;
      font-size: 12px;
    `;

    // 评论头部 - 用户信息和时间
    const header = doc.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText =
      "color: #6c757d; display: flex; gap: 6px; align-items: center; font-size: 11px;";

    const { name: userName, isAnonymous } = resolveCommentDisplayInfo(comment);
    const username = comment.user?.username || comment.username || '';
    const replyCount = comment.reply_count || comment.children?.length || 0;

    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      username,
      userName,
      { isAnonymous, clickable: !isAnonymous }
    );
    userInfo.appendChild(userElement);

    if (isAnonymous) {
      const lockIcon = doc.createElement("span");
      lockIcon.style.cssText = "color: #ced4da; font-size: 10px;";
      lockIcon.textContent = "🔒";
      userInfo.appendChild(lockIcon);
    }

    const sep1 = doc.createElement("span");
    sep1.style.color = "#ced4da";
    sep1.textContent = "·";
    userInfo.appendChild(sep1);

    const timeSpan = doc.createElement("span");
    timeSpan.textContent = formatDate(comment.created_at);
    userInfo.appendChild(timeSpan);

    if (replyCount > 0) {
      const sep2 = doc.createElement("span");
      sep2.style.color = "#0d6efd";
      sep2.textContent = "·";
      userInfo.appendChild(sep2);

      const replySpan = doc.createElement("span");
      replySpan.style.color = "#0d6efd";
      replySpan.textContent = ` ${replyCount} 回复`;
      userInfo.appendChild(replySpan);
    }

    header.appendChild(userInfo);

    // 操作按钮
    const actions = doc.createElement("div");
    actions.style.cssText = "display: flex; gap: 6px; flex-wrap: wrap;";

    const replyBtn = doc.createElement("button");
    replyBtn.textContent = "💬 回复";
    replyBtn.style.cssText = `
      padding: 2px 8px;
      background: transparent;
      color: #0d6efd;
      border: 1px solid currentColor;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    `;
    replyBtn.addEventListener("click", () => {
      this.toggleReplyBox(container, comment, annotationId, currentUserId, cardElement);
    });
    actions.appendChild(replyBtn);

    const isOwnComment = comment.user_id === currentUserId;
    const currentUser = AuthManager.getCurrentUser();
    const isAdmin = currentUser?.role === "admin";
    const canDelete = isOwnComment || isAdmin;

    if (isOwnComment) {
      const editBtn = doc.createElement("button");
      editBtn.textContent = "编辑";
      editBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #0d6efd;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      editBtn.addEventListener("click", () => {
        this.toggleEditMode(commentBody, comment, cardElement, annotationId, currentUserId);
      });
      actions.appendChild(editBtn);
    }

    if (canDelete) {
      const deleteBtn = doc.createElement("button");
      deleteBtn.textContent = isAdmin && !isOwnComment ? "删除(管理员)" : "删除";
      deleteBtn.style.cssText = `
        padding: 2px 8px;
        background: transparent;
        color: #dc3545;
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      deleteBtn.addEventListener("click", async () => {
        const message = replyCount > 0
          ? `此评论有 ${replyCount} 条回复,删除后回复也会被删除。确定继续？`
          : "确定删除这条评论吗？";

        if (confirm(message)) {
          await this.handleDeleteComment(comment.id, cardElement, annotationId, currentUserId);
        }
      });
      actions.appendChild(deleteBtn);
    }

    header.appendChild(actions);
    commentBody.appendChild(header);

    // 评论内容
    const contentDiv = doc.createElement("div");
    contentDiv.className = "comment-content";
    contentDiv.style.cssText = "color: #212529; word-wrap: break-word;";
    contentDiv.textContent = comment.content;
    commentBody.appendChild(contentDiv);

    container.appendChild(commentBody);

    // 回复框容器(初始隐藏)
    const replyBoxContainer = doc.createElement("div");
    replyBoxContainer.className = "reply-box-container";
    replyBoxContainer.style.display = "none";
    container.appendChild(replyBoxContainer);

    // 递归渲染子评论
    if (comment.children && comment.children.length > 0) {
      comment.children.forEach((child: any) => {
        const childNode = this.renderCommentNode(
          child,
          depth + 1,
          doc,
          currentUserId,
          annotationId,
          cardElement
        );
        container.appendChild(childNode);
      });
    }

    return container;
  }

  /**
   * 切换回复框显示
   */
  private toggleReplyBox(
    container: HTMLElement,
    parentComment: any,
    annotationId: string,
    currentUserId: string,
    cardElement: HTMLElement
  ): void {
    const doc = container.ownerDocument;
    const replyBoxContainer = container.querySelector(".reply-box-container") as HTMLElement | null;

    if (!replyBoxContainer) return;

    if (replyBoxContainer.style.display !== "none") {
      replyBoxContainer.style.display = "none";
      replyBoxContainer.innerHTML = "";
      return;
    }

    replyBoxContainer.innerHTML = "";
    replyBoxContainer.style.cssText =
      "display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding: 8px; background: #6c757d; border-radius: 3px;";

    const textarea = doc.createElement("textarea");
    const { name: parentDisplayName } = resolveCommentDisplayInfo(parentComment);
    textarea.placeholder = `回复 @${parentDisplayName}...`;
    textarea.style.cssText = `
      padding: 6px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 50px;
      background: #ffffff;
      color: #212529;
    `;

    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText =
      "display: flex; align-items: center; gap: 8px; font-size: 11px; color: #6c757d;";

    const anonymousSwitch = createToggleSwitch(
      doc,
      `anonymous-reply-${parentComment.id}`,
      false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement("label");
    anonymousLabel.htmlFor = `anonymous-reply-${parentComment.id}`;
    anonymousLabel.textContent = '匿名回复（将显示为"匿名用户"）';
    anonymousLabel.style.cssText = "cursor: pointer; user-select: none;";

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);

    const buttonGroup = doc.createElement("div");
    buttonGroup.style.cssText = "display: flex; gap: 8px; justify-content: flex-end;";

    const submitBtn = doc.createElement("button");
    submitBtn.textContent = "发送";
    submitBtn.style.cssText = `
      padding: 4px 12px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    submitBtn.addEventListener("click", async () => {
      const content = textarea.value.trim();
      if (!content) return;

      try {
        const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
        const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;

        await this.context.supabaseManager.replyToAnnotationComment(
          annotationId,
          parentComment.id,
          currentUserId,
          content,
          isAnonymous
        );
        this.context.showMessage("回复成功", "info");

        const section = cardElement.querySelector(".comments-section") as HTMLElement | null;
        if (section) {
          cardElement.removeChild(section);
          await this.showCommentsSection(cardElement, annotationId, currentUserId);
        }
      } catch (error) {
        logger.error("[SessionAnnotationsView] Error replying to comment:", error);
        this.context.showMessage("回复失败", "error");
      }
    });

    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: #9ca3af;
      color: #212529;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    cancelBtn.addEventListener("click", () => {
      replyBoxContainer.style.display = "none";
      replyBoxContainer.innerHTML = "";
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(submitBtn);
    replyBoxContainer.appendChild(textarea);
    replyBoxContainer.appendChild(anonymousContainer);
    replyBoxContainer.appendChild(buttonGroup);

    textarea.focus();
  }

  /**
   * 切换编辑模式
   */
  private toggleEditMode(
    bodyEl: HTMLElement,
    comment: any,
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): void {
    const doc = bodyEl.ownerDocument;
    const contentDiv = bodyEl.querySelector(".comment-content") as HTMLElement | null;
    if (!contentDiv) return;

    if (bodyEl.classList.contains("editing")) {
      bodyEl.classList.remove("editing");
      contentDiv.textContent = comment.content;
      const editForm = bodyEl.querySelector(".edit-form");
      if (editForm) editForm.remove();
      return;
    }

    bodyEl.classList.add("editing");
    const originalContent = comment.content;

    const editForm = doc.createElement("div");
    editForm.className = "edit-form";
    editForm.style.cssText = "margin-top: 8px;";

    const textarea = doc.createElement("textarea");
    textarea.value = originalContent;
    textarea.style.cssText = `
      width: 100%;
      padding: 6px;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
      background: #ffffff;
      color: #212529;
      box-sizing: border-box;
    `;

    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 6px;";

    const anonymousSwitch = createToggleSwitch(
      doc,
      `toggle-edit-anonymous-${comment.id}`,
      comment.is_anonymous || false,
      "#8b5cf6"
    );

    const anonymousLabel = doc.createElement("label");
    anonymousLabel.htmlFor = `toggle-edit-anonymous-${comment.id}`;
    anonymousLabel.textContent = "匿名显示";
    anonymousLabel.style.cssText = "font-size: 11px; color: #6c757d; cursor: pointer;";

    const anonymousHint = doc.createElement("span");
    anonymousHint.textContent = '(将显示为"匿名用户")';
    anonymousHint.style.cssText = "font-size: 11px; color: #0d6efd; margin-left: 4px;";
    anonymousHint.style.display = (comment.is_anonymous || false) ? "inline" : "none";

    const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (switchCheckbox) {
      switchCheckbox.addEventListener("change", () => {
        anonymousHint.style.display = switchCheckbox.checked ? "inline" : "none";
      });
    }

    anonymousContainer.appendChild(anonymousSwitch);
    anonymousContainer.appendChild(anonymousLabel);
    anonymousContainer.appendChild(anonymousHint);

    const buttonGroup = doc.createElement("div");
    buttonGroup.style.cssText = "display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;";

    const saveBtn = doc.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.cssText = `
      padding: 4px 12px;
      background: #0d6efd;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    saveBtn.addEventListener("click", async () => {
      const newContent = textarea.value.trim();
      const switchCheckbox = anonymousSwitch.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const isAnonymous = switchCheckbox ? switchCheckbox.checked : false;
      const contentChanged = newContent !== originalContent;
      const anonymousChanged = isAnonymous !== (comment.is_anonymous || false);

      if (newContent && (contentChanged || anonymousChanged)) {
        try {
          await this.context.supabaseManager.updateComment(comment.id, newContent, isAnonymous);
          this.context.showMessage("已更新", "info");

          comment.content = newContent;
          comment.is_anonymous = isAnonymous;
          contentDiv.textContent = newContent;

          const section = cardElement.querySelector(".comments-section") as HTMLElement | null;
          if (section) {
            cardElement.removeChild(section);
            await this.showCommentsSection(cardElement, annotationId, currentUserId);
          }
        } catch (error) {
          logger.error("[SessionAnnotationsView] Error updating comment:", error);
          this.context.showMessage("更新失败", "error");
        }
      }
      bodyEl.classList.remove("editing");
      editForm.remove();
    });

    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: #9ca3af;
      color: #212529;
      border: 1px solid #e9ecef;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    cancelBtn.addEventListener("click", () => {
      bodyEl.classList.remove("editing");
      editForm.remove();
    });

    buttonGroup.appendChild(cancelBtn);
    buttonGroup.appendChild(saveBtn);
    editForm.appendChild(textarea);
    editForm.appendChild(anonymousContainer);
    editForm.appendChild(buttonGroup);
    bodyEl.appendChild(editForm);

    textarea.focus();
    textarea.select();
  }

  /**
   * 删除评论
   */
  private async handleDeleteComment(
    commentId: string,
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    try {
      await this.context.supabaseManager.deleteComment(commentId);
      this.context.showMessage("评论已删除", "info");

      const section = cardElement.querySelector(".comments-section") as HTMLElement | null;
      if (section) {
        const commentTree = await this.context.supabaseManager.getAnnotationCommentTree(annotationId);
        const commentsList = section.querySelector(".comments-tree") as HTMLElement | null;
        if (commentsList) {
          commentsList.innerHTML = "";

          const countAllComments = (comments: any[]): number =>
            comments.reduce(
              (total, c) => total + 1 + (c.children ? countAllComments(c.children) : 0),
              0
            );
          const totalComments = countAllComments(commentTree);

          commentTree.forEach((rootComment: any) => {
            const commentNode = this.renderCommentNode(
              rootComment,
              0,
              cardElement.ownerDocument,
              currentUserId,
              annotationId,
              cardElement
            );
            commentsList.appendChild(commentNode);
          });

          const commentButton = cardElement.querySelector(
            "button[data-comment-button]"
          ) as HTMLButtonElement | null;
          if (commentButton) {
            commentButton.innerHTML = `💬 ${totalComments}`;
          }
        }
      }
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error deleting comment:", error);
      this.context.showMessage("删除失败", "error");
    }
  }

  /**
   * 格式化日期
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    } else if (days > 0) {
      return `${days}天前`;
    } else if (hours > 0) {
      return `${hours}小时前`;
    } else if (minutes > 0) {
      return `${minutes}分钟前`;
    } else {
      return '刚刚';
    }
  }

  /**
   * 应用排序筛选 - 从backup完整迁移
   */
  private async applySharedSortFilter(doc: Document, sessionId: string, sortType: string, filterType: string = 'all'): Promise<void> {
    try {
      const listContainer = doc.getElementById('shared-annotations-list-container');
      if (!listContainer) return;

      let annotations = await this.sessionManager.getSessionAnnotations(sessionId, 1, 100);
      
      // 获取当前用户ID
      const currentUser = AuthManager.getCurrentUser();
      const currentUserId = currentUser?.id;
      
      // 根据筛选类型过滤
      if (filterType === 'others') {
        // 其他成员:只显示其他用户的标注(排除当前用户)
        if (currentUserId) {
          annotations = annotations.filter((a: any) => a.user_id !== currentUserId);
        }
      } else if (filterType === 'all') {
        // 所有成员(包括我):显示session中所有共享的标注
        // 无需过滤
      } else if (filterType === 'followed') {
        // 关注成员(不包括我):显示关注的用户,但排除自己
        // TODO: 实现关注功能需要后端支持(创建user_follows表)
        logger.warn("[SessionAnnotationsView] 关注成员筛选功能需要后端user_follows表支持,暂未实现");
        
        // 暂时使用"其他成员"作为替代
        if (currentUserId) {
          annotations = annotations.filter((a: any) => a.user_id !== currentUserId);
        }
        
        // 显示提示信息
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
      } else if (filterType === 'custom') {
        // 自定义选择:仅显示选中的成员
        annotations = annotations.filter((a: any) => this.selectedMemberIds.has(a.user_id));
      }

      // 排序
      let sortedAnnotations = [...annotations];
      switch (sortType) {
        case 'page':
          sortedAnnotations.sort((a: any, b: any) => a.page_number - b.page_number);
          break;
        case 'time-desc':
          sortedAnnotations.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'time-asc':
          sortedAnnotations.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          break;
      }

      // 重新渲染列表
      listContainer.innerHTML = '';
      if (currentUserId) {
        await this.renderSharedAnnotationCards(listContainer, sortedAnnotations, doc, currentUserId);
      } else {
        // 未登录,显示空状态
        const loginNotice = doc.createElement('p');
        loginNotice.textContent = '请先登录以查看标注';
        loginNotice.style.cssText = 'color: #dc3545; font-size: 14px;';
        listContainer.appendChild(loginNotice);
      }

    } catch (error) {
      logger.error("[SessionAnnotationsView] Error applying sort:", error);
    }
  }

  /**
   * 处理标注定位 - 从backup完整迁移
   */
  private async handleLocateAnnotation(annotation: any): Promise<void> {
    try {
      logger.log("[SessionAnnotationsView] 🎯 Locating annotation:", annotation.id);
      logger.log("[SessionAnnotationsView] 📄 Full annotation object:", JSON.stringify(annotation));

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

      // 获取PDFReaderManager实例
      const readerManager = await this.getPDFReaderManager();
      if (!readerManager) {
        this.context.showMessage('PDF阅读器管理器未初始化，请重启Zotero', 'error');
        return;
      }

      let reader = await readerManager.findOpenReader(doi);

      if (!reader) {
        logger.log("[SessionAnnotationsView] Reader not found, trying to open PDF...");
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
      const annotationData = annotation.annotation_data || {};
      
      // 尝试从多个来源获取position
      let position = annotationData.position;
      
      // 检查position是否为字符串，如果是则解析
      if (typeof position === 'string') {
        try {
          position = JSON.parse(position);
          logger.log("[SessionAnnotationsView] ✅ Parsed position from string");
        } catch (error) {
          logger.error("[SessionAnnotationsView] ❌ Failed to parse position string:", error);
          position = null;
        }
      }
      
      // 如果annotation_data中没有position,尝试使用page_number构造
      if (!position || typeof position.pageIndex !== 'number') {
        position = { 
          pageIndex: annotation.page_number - 1 
        };
        logger.log("[SessionAnnotationsView] ⚠️ No valid position in annotation_data, using page_number:", annotation.page_number);
      }

      logger.log("[SessionAnnotationsView] 🎯 Using position:", JSON.stringify(position));

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
      logger.error("[SessionAnnotationsView] Error locating annotation:", error);
      this.context.showMessage('定位失败: ' + (error instanceof Error ? error.message : '未知错误'), 'error');
    }
  }

  /**
   * 打开PDF阅读器到指定页面 - 从backup完整迁移
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

      logger.warn("[SessionAnnotationsView] No PDF attachment found");
      return false;
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error opening PDF:", error);
      return false;
    }
  }

  /**
   * 高亮显示标注卡片 - 从backup完整迁移
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
      logger.error("[SessionAnnotationsView] Error highlighting card:", error);
    }
  }

  /**
   * 显示成员选择对话框 - 从backup完整迁移
   */
  private async showMemberSelectionDialog(doc: Document, sessionId: string, sortSelect: HTMLSelectElement): Promise<void> {
    try {
      // 获取所有在线成员
      const members = await this.sessionManager.getSessionMembers(sessionId, false);
      const onlineMembers = members.filter((m: any) => m.is_online);
      
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
        await this.applySharedSortFilter(doc, sessionId, sortSelect.value, 'custom');
        doc.body.removeChild(overlay);
      });

      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(confirmBtn);
      dialog.appendChild(buttonContainer);

      overlay.appendChild(dialog);
      doc.body.appendChild(overlay);
    } catch (error) {
      logger.error("[SessionAnnotationsView] Error showing member selection dialog:", error);
    }
  }
}

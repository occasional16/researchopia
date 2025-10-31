import { AuthManager } from "../auth";
import type { BaseViewContext, BatchDisplayFilter } from "./types";
import {
  createSearchBox,
  highlightText,
  matchesSearch,
  formatDate,
  resolveAnnotationDisplayName,
  resolveCommentDisplayInfo,
  createToggleSwitch
} from "./helpers";
import { logger } from "../../utils/logger";
import { UserHoverCardManager } from "./userHoverCard";
import { containerPadding } from "./styles";
import { deduplicateAnnotations, createBatchDisplayToolbar, type BatchDisplayFilter as UtilBatchDisplayFilter } from "./annotationUtils";
import { ServicesAdapter } from '../../adapters';

export class SharedAnnotationsView {
  private cachedSharedAnnotations: any[] | null = null;
  private cachedSharedAnnotationsDocumentId: string | null = null;
  private scrollToAnnotationListener: ((event: CustomEvent) => void) | null = null;
  private userHoverCardManager: UserHoverCardManager;

  constructor(private readonly context: BaseViewContext) {
    this.userHoverCardManager = new UserHoverCardManager(context);
    // 监听来自PDF Reader Manager的滚动请求
    try {
      this.setupScrollToAnnotationListener();
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error setting up scroll listener:", error);
    }
  }

  /**
   * 设置监听PDF页面点击标注的事件
   */
  private setupScrollToAnnotationListener(): void {
    try {
      if (this.scrollToAnnotationListener) {
        return; // 已经设置过了
      }

      this.scrollToAnnotationListener = async (event: CustomEvent) => {
        try {
          const { annotationId } = event.detail;
          logger.log("[SharedAnnotationsView] 📍 Received scroll request for:", annotationId);
          await this.scrollToAnnotation(annotationId);
        } catch (error) {
          logger.error("[SharedAnnotationsView] Error handling scroll request:", error);
        }
      };

      // 使用Zotero的window对象
      const win = (Zotero as any).getMainWindow();
      if (win) {
        win.addEventListener('researchopia-scroll-to-annotation', this.scrollToAnnotationListener as EventListener);
        logger.log("[SharedAnnotationsView] ✅ Scroll listener registered");
      } else {
        logger.warn("[SharedAnnotationsView] ⚠️ Main window not available, scroll listener not registered");
      }
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error in setupScrollToAnnotationListener:", error);
    }
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.userHoverCardManager.cleanup();
  }

  /**
   * 滚动到指定的标注卡片并高亮显示
   */
  private async scrollToAnnotation(annotationId: string): Promise<void> {
    try {
      logger.log("[SharedAnnotationsView] 🎯 Scrolling to annotation:", annotationId);

      // 查找所有面板中的标注卡片
      const panels = this.context.getPanelsForCurrentItem();
      for (const panel of panels) {
        if (!panel.contentSection) continue;

        const card = panel.contentSection.querySelector(`[data-annotation-id="${annotationId}"]`) as HTMLElement;
        if (card) {
          // 滚动到卡片
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // 高亮显示卡片
          this.highlightCard(card);

          logger.log("[SharedAnnotationsView] ✅ Scrolled to annotation card");
          return;
        }
      }

      logger.warn("[SharedAnnotationsView] ⚠️ Annotation card not found:", annotationId);

    } catch (error) {
      logger.error("[SharedAnnotationsView] Error scrolling to annotation:", error);
    }
  }

  /**
   * 高亮显示卡片
   */
  private highlightCard(card: HTMLElement): void {
    try {
      // 保存原始样式
      const originalBackground = card.style.background;
      const originalTransform = card.style.transform;

      // 添加高亮效果
      card.style.background = 'linear-gradient(135deg, rgba(0, 123, 255, 0.1) 0%, rgba(0, 123, 255, 0.05) 100%)';
      card.style.transform = 'scale(1.02)';
      card.style.transition = 'all 0.3s ease';
      card.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';

      // 2秒后恢复原始样式
      setTimeout(() => {
        card.style.background = originalBackground;
        card.style.transform = originalTransform;
        card.style.boxShadow = '';
      }, 2000);

      logger.log("[SharedAnnotationsView] ✨ Card highlighted");

    } catch (error) {
      logger.error("[SharedAnnotationsView] Error highlighting card:", error);
    }
  }


  public resetCache(): void {
    this.cachedSharedAnnotations = null;
    this.cachedSharedAnnotationsDocumentId = null;
  }

  public async getSharedAnnotations(forceReload = false): Promise<{
    annotations: any[];
    userId: string;
  } | null> {
    if (!forceReload && this.cachedSharedAnnotations) {
      const user = AuthManager.getCurrentUser();
      if (!user) {
        this.context.showMessage("请先登录", "warning");
        return null;
      }
      return { annotations: this.cachedSharedAnnotations, userId: user.id };
    }

    const user = AuthManager.getCurrentUser();
    if (!user) {
      this.context.showMessage("请先登录", "warning");
      return null;
    }

    const currentItem = this.context.getCurrentItem();
    if (!currentItem) {
      this.context.showMessage("请先选择一篇文献", "warning");
      return null;
    }

    const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
    const annotations = await this.context.supabaseManager.getSharedAnnotations(documentInfo.id);

    this.cachedSharedAnnotations = annotations;
    this.cachedSharedAnnotationsDocumentId = documentInfo.id;

    return { annotations, userId: user.id };
  }

  public async render(container: HTMLElement, searchQuery = ""): Promise<void> {
    logger.log(
      "[SharedAnnotationsView] Rendering shared annotations...",
      searchQuery ? `search: "${searchQuery}"` : "no search"
    );

    const doc = container.ownerDocument;

    let searchBox = container.querySelector(".search-box-container") as HTMLElement | null;
    let listContainer = container.querySelector(".annotations-list-container") as HTMLElement | null;

    const isFirstRender = !searchBox;

    if (isFirstRender) {
      container.innerHTML = "";
      
      // 重置容器样式,确保布局一致
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: ${containerPadding.view};
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        background: #f9fafb;
        border-radius: 10px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
      `;

      searchBox = createSearchBox(doc, (query) => {
        this.render(container, query);
      });
      searchBox.classList.add("search-box-container");
      container.appendChild(searchBox);

      const batchToolbar = this.createBatchDisplayToolbar(doc);
      container.appendChild(batchToolbar);

      listContainer = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      listContainer.classList.add("annotations-list-container");
      listContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        overflow-y: auto;
      `;
      container.appendChild(listContainer);

      this.resetCache();
    }

    if (!listContainer) {
      listContainer = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      listContainer.classList.add("annotations-list-container");
      container.appendChild(listContainer);
    }

    listContainer.innerHTML = "";

    try {
      if (!this.cachedSharedAnnotations || isFirstRender) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: var(--fill-secondary);">
              <div style="margin-bottom: 8px;">⏳ 正在加载共享标注...</div>
            </div>
          </div>
        `;
      }

      const loadResult = await this.getSharedAnnotations(!this.cachedSharedAnnotations || isFirstRender);

      if (!loadResult) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: var(--fill-tertiary);">
              <div style="font-size: 14px;">👥 暂无共享标注</div>
              <div style="font-size: 12px; margin-top: 8px;">请尝试刷新或稍后再试</div>
            </div>
          </div>
        `;
        return;
      }

      const { annotations: sharedAnnotations, userId } = loadResult;

      if (sharedAnnotations.length === 0) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: var(--fill-tertiary);">
              <div style="font-size: 14px;">👥 暂无共享标注</div>
              <div style="font-size: 12px; margin-top: 8px;">成为第一个分享标注的人</div>
            </div>
          </div>
        `;
        return;
      }

      const filteredAnnotations = searchQuery
        ? sharedAnnotations.filter((ann) => matchesSearch(ann, searchQuery))
        : sharedAnnotations;

      if (searchQuery && filteredAnnotations.length < sharedAnnotations.length) {
        const statsDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        statsDiv.style.cssText = `
          padding: 12px 16px;
          background: #ffffff;
          border-radius: 8px;
          font-size: 14px;
          color: #1f2937;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
          margin-bottom: 12px;
        `;
        statsDiv.innerHTML = `
          🔍 找到 <span style="color: #3b82f6; font-size: 16px;">${filteredAnnotations.length}</span> /
          <span style="color: #6b7280;">${sharedAnnotations.length}</span> 条共享标注
        `;
        listContainer.appendChild(statsDiv);
      }

      if (filteredAnnotations.length === 0) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: var(--fill-tertiary);">
              <div style="font-size: 14px;">🔍 未找到匹配的标注</div>
              <div style="font-size: 12px; margin-top: 8px;">请尝试其他关键词</div>
            </div>
          </div>
        `;
        return;
      }

      await this.renderSharedAnnotationsList(listContainer, filteredAnnotations, userId, searchQuery);
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error rendering shared annotations:", error);
      listContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
          <div style="text-align: center; color: var(--accent-red);">
            <div>❌ 加载失败</div>
            <div style="font-size: 12px; margin-top: 8px;">${
              error instanceof Error ? error.message : "未知错误"
            }</div>
          </div>
        </div>
      `;
    }
  }

  private async renderSharedAnnotationsList(
    container: HTMLElement,
    annotations: any[],
    currentUserId: string,
    searchQuery: string
  ): Promise<void> {
    const doc = container.ownerDocument;

    container.innerHTML = "";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";

    const uniqueAnnotations = deduplicateAnnotations(annotations);
    logger.log(
      `[SharedAnnotationsView] Deduplicated ${annotations.length} annotations to ${uniqueAnnotations.length}`
    );

    const statsDiv = doc.createElement("div");
    statsDiv.style.cssText = `
      padding: 12px 16px;
      background: #ffffff;
      border-radius: 8px;
      font-size: 14px;
      color: #1f2937;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      margin-bottom: 12px;
    `;
    statsDiv.innerHTML = `
      👥 共找到 <span style="color: #8b5cf6; font-size: 16px;">${uniqueAnnotations.length}</span> 条共享标注
    `;
    container.appendChild(statsDiv);

    const filterBar = this.createFilterBar(doc);
    container.appendChild(filterBar);

    const listContainer = doc.createElement("div");
    listContainer.id = "annotations-list-container";
    listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 600px;
      overflow-y: auto;
    `;

    const annotationIds = uniqueAnnotations.map((a) => a.id);
    const likeMap = await this.context.supabaseManager.batchCheckUserLikes(annotationIds, currentUserId);

    logger.log(
      `[SharedAnnotationsView] Starting to render ${uniqueAnnotations.length} annotation cards...`
    );
    for (let i = 0; i < uniqueAnnotations.length; i++) {
      const annotation = uniqueAnnotations[i];
      const userLiked = likeMap.get(annotation.id) || false;
      const annotationCard = await this.createSharedAnnotationCard(
        doc,
        annotation,
        currentUserId,
        userLiked,
        searchQuery
      );
      listContainer.appendChild(annotationCard);
    }

    container.appendChild(listContainer);
    logger.log("[SharedAnnotationsView] Shared annotations rendering complete!", uniqueAnnotations.length);
  }

  private createFilterBar(doc: Document): HTMLElement {
    const filterBar = doc.createElement("div");
    filterBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #ffffff;
      border-radius: 8px;
      gap: 12px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      margin-bottom: 12px;
    `;

    const filterSelect = doc.createElement("select");
    filterSelect.id = "annotation-filter-select";
    filterSelect.style.cssText = `
      padding: 8px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      color: #1f2937;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const filterOptions = [
      { value: "default", label: "默认(按页码排序)" },
      { value: "time", label: "最新标注" },
      { value: "quality", label: "优质标注(点赞+评论)" },
      { value: "followed", label: "关注用户" }
    ];

    filterOptions.forEach((opt) => {
      const option = doc.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      filterSelect.appendChild(option);
    });

    filterSelect.addEventListener("change", async () => {
      const selectedFilter = filterSelect.value;
      await this.applyFilter(selectedFilter);
    });

    // 添加select的focus效果
    filterSelect.addEventListener("focus", () => {
      filterSelect.style.borderColor = "#3b82f6";
      filterSelect.style.background = "#ffffff";
    });

    filterSelect.addEventListener("blur", () => {
      filterSelect.style.borderColor = "#e5e7eb";
      filterSelect.style.background = "#f9fafb";
    });

    filterBar.appendChild(filterSelect);

    return filterBar;
  }

  private async applyFilter(filterType: string): Promise<void> {
    const win = Zotero.getMainWindow();
    if (!win || !win.document) return;

    const listContainer = win.document.getElementById("annotations-list-container");
    if (!listContainer) return;

    const cards = Array.from(
      listContainer.querySelectorAll(".shared-annotation-card")
    ) as HTMLElement[];

    const annotations = cards.map((card) => ({
      element: card,
      id: card.getAttribute("data-annotation-id") || "",
      pageIndex: parseInt(card.getAttribute("data-page-index") || "0", 10),
      createdAt: card.getAttribute("data-created-at") || "",
      likesCount: parseInt(card.getAttribute("data-likes-count") || "0", 10),
      commentsCount: parseInt(card.getAttribute("data-comments-count") || "0", 10),
      userId: card.getAttribute("data-user-id") || ""
    }));

    switch (filterType) {
      case "time":
        annotations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case "quality":
        annotations.sort((a, b) => {
          const scoreA = a.likesCount * 2 + a.commentsCount * 3;
          const scoreB = b.likesCount * 2 + b.commentsCount * 3;
          return scoreB - scoreA;
        });
        break;
      case "followed":
        logger.log("[SharedAnnotationsView] Followed users filter not yet implemented");
        break;
      case "default":
      default:
        annotations.sort((a, b) => a.pageIndex - b.pageIndex);
        break;
    }

    listContainer.innerHTML = "";
    annotations.forEach((ann) => {
      listContainer.appendChild(ann.element);
    });
  }

  private async createSharedAnnotationCard(
    doc: Document,
    annotation: any,
    currentUserId: string,
    userLiked: boolean,
    searchQuery: string
  ): Promise<HTMLElement> {
    const card = doc.createElement("div");
    card.className = "shared-annotation-card";
    card.setAttribute("data-annotation-id", annotation.id);
    card.setAttribute("data-user-id", annotation.user_id || "");
    card.setAttribute("data-created-at", annotation.created_at || "");
    card.setAttribute("data-likes-count", String(annotation.likes_count || 0));
    card.setAttribute("data-comments-count", String(annotation.comments_count || 0));
    card.setAttribute("data-page-index", String(annotation.position?.pageIndex || 0));
    card.style.cssText = `
      padding: 12px;
      background: var(--material-background);
      border-radius: 6px;
      border-left: 4px solid ${annotation.color || "#ffd400"};
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    `;

    const headerDiv = doc.createElement("div");
    headerDiv.style.cssText = "display: flex; justify-content: space-between; align-items: center;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText = "display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fill-secondary);";

    const displayName = resolveAnnotationDisplayName(annotation);
    // API返回的字段名是 user 而不是 users
    const username = annotation.user?.username || annotation.users?.username || annotation.username || '';
    const isAnonymous = !annotation.show_author_name;

    const userElement = this.userHoverCardManager.createUserElement(
      doc,
      username,
      displayName,
      { isAnonymous, clickable: !isAnonymous }
    );
    userInfo.appendChild(userElement);

    const separator = doc.createElement("span");
    separator.style.color = "var(--fill-tertiary)";
    separator.textContent = "·";
    userInfo.appendChild(separator);

    const timeSpan = doc.createElement("span");
    timeSpan.style.color = "var(--fill-tertiary)";
    timeSpan.textContent = formatDate(annotation.created_at);
    userInfo.appendChild(timeSpan);

    headerDiv.appendChild(userInfo);
    card.appendChild(headerDiv);

    if (annotation.content) {
      const contentDiv = doc.createElement("div");
      contentDiv.style.cssText = `
        font-size: 13px;
        line-height: 1.5;
        color: var(--fill-primary);
        background: ${annotation.color || "#ffd400"}20;
        padding: 8px;
        border-radius: 3px;
      `;
      contentDiv.innerHTML = searchQuery
        ? highlightText(annotation.content, searchQuery)
        : annotation.content;
      card.appendChild(contentDiv);
    }

    if (annotation.comment) {
      const commentDiv = doc.createElement("div");
      commentDiv.style.cssText = `
        font-size: 12px;
        line-height: 1.4;
        color: var(--fill-secondary);
        font-style: italic;
        padding-left: 12px;
        border-left: 2px solid var(--fill-quinary);
      `;
      commentDiv.innerHTML = searchQuery
        ? highlightText(annotation.comment, searchQuery)
        : annotation.comment;
      card.appendChild(commentDiv);
    }

    const actionsDiv = doc.createElement("div");
    actionsDiv.style.cssText = "display: flex; gap: 16px; align-items: center;";

    const likeButton = doc.createElement("button");
    likeButton.setAttribute("data-like-button", "true");
    likeButton.innerHTML = `${userLiked ? "❤️" : "🤍"} ${annotation.likes_count || 0}`;
    likeButton.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: ${userLiked ? "var(--accent-red)" : "var(--fill-secondary)"};
      border: 1px solid ${userLiked ? "var(--accent-red)" : "var(--fill-quinary)"};
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    `;

    likeButton.addEventListener("click", async () => {
      await this.handleLikeAnnotation(annotation.id, currentUserId, card);
    });

    const commentButton = doc.createElement("button");
    commentButton.setAttribute("data-comment-button", "true");
    commentButton.innerHTML = `💬 ${annotation.comments_count || 0}`;
    commentButton.style.cssText = `
      padding: 4px 10px;
      background: transparent;
      color: var(--fill-secondary);
      border: 1px solid var(--fill-quinary);
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    `;

    commentButton.addEventListener("click", async () => {
      await this.showCommentsSection(card, annotation.id, currentUserId);
    });

    actionsDiv.appendChild(likeButton);
    actionsDiv.appendChild(commentButton);
    card.appendChild(actionsDiv);

    // 添加卡片点击事件，点击卡片时定位到PDF页面
    card.style.cursor = 'pointer';
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      // 如果点击的是按钮，不触发卡片点击事件
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      // ✨ 如果点击的是评论区域（comments-section），不触发卡片点击事件
      if (target.classList.contains('comments-section') || target.closest('.comments-section')) {
        return;
      }

      // 触发定位功能
      await this.handleLocateAnnotation(annotation);
    });

    // 添加hover效果
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    });

    return card;
  }

  private async handleLikeAnnotation(
    annotationId: string,
    userId: string,
    cardElement?: HTMLElement
  ): Promise<void> {
    try {
      await this.context.supabaseManager.likeAnnotation(annotationId, userId);

      if (cardElement) {
        const likeButton = cardElement.querySelector(
          "button[data-like-button]"
        ) as HTMLButtonElement | null;
        if (likeButton) {
          const wasLiked = likeButton.innerHTML.includes("❤️");
          const currentCount = parseInt(likeButton.textContent?.match(/\d+/)?.[0] || "0", 10);

          if (wasLiked) {
            likeButton.innerHTML = `🤍 ${Math.max(0, currentCount - 1)}`;
            likeButton.style.color = "var(--fill-secondary)";
            likeButton.style.borderColor = "var(--fill-quinary)";
          } else {
            likeButton.innerHTML = `❤️ ${currentCount + 1}`;
            likeButton.style.color = "var(--accent-red)";
            likeButton.style.borderColor = "var(--accent-red)";
          }
        }
      } else if (this.context.isActive()) {
        for (const panel of this.context.getPanelsForCurrentItem()) {
          if (panel.contentSection) {
            await this.render(panel.contentSection);
          }
        }
      }
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error liking annotation:", error);
      this.context.showMessage("操作失败", "error");
    }
  }

  private async showCommentsSection(
    cardElement: HTMLElement,
    annotationId: string,
    currentUserId: string
  ): Promise<void> {
    const doc = cardElement.ownerDocument;

    let commentsSection = cardElement.querySelector(".comments-section") as HTMLElement | null;

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
      border-top: 1px solid var(--fill-quinary);
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

      // 创建输入区域容器（包含textarea、匿名选项和按钮）
      const inputAreaContainer = doc.createElement("div");
      inputAreaContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px;";

      const textarea = doc.createElement("textarea");
      textarea.placeholder = "添加评论...";
      textarea.style.cssText = `
        width: 100%;
        padding: 6px 10px;
        border: 1px solid var(--fill-quinary);
        border-radius: 3px;
        font-size: 12px;
        font-family: inherit;
        resize: vertical;
        min-height: 60px;
        background: var(--material-background);
        color: var(--fill-primary);
        box-sizing: border-box;
      `;

      // ✨ 创建匿名开关容器
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
      anonymousLabel.style.cssText = "font-size: 11px; color: var(--fill-secondary); cursor: pointer; user-select: none;";

      anonymousContainer.appendChild(anonymousSwitch);
      anonymousContainer.appendChild(anonymousLabel);

      // 创建按钮容器
      const buttonContainer = doc.createElement("div");
      buttonContainer.style.cssText = "display: flex; justify-content: flex-end;";

      const submitButton = doc.createElement("button");
      submitButton.textContent = "发送";
      submitButton.style.cssText = `
        padding: 6px 12px;
        background: var(--accent-blue);
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
          logger.error("[SharedAnnotationsView] Error adding comment:", error);
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
      logger.error("[SharedAnnotationsView] Error showing comments:", error);
      this.context.showMessage("加载评论失败", "error");
    }
  }

  private renderCommentNode(
    comment: any,
    depth: number,
    doc: Document,
    currentUserId: string,
    annotationId: string,
    cardElement: HTMLElement
  ): HTMLElement {
    const container = doc.createElement("div");
    container.className = "comment-node";
    container.setAttribute("data-comment-id", comment.id);
    container.setAttribute("data-depth", depth.toString());
    container.style.cssText = `
      margin-left: ${depth * 20}px;
      ${depth > 0 ? "border-left: 2px solid var(--fill-quinary); padding-left: 8px;" : ""}
      margin-bottom: ${depth > 0 ? "4px" : "8px"};
    `;

    const commentBody = doc.createElement("div");
    commentBody.className = "comment-body";
    commentBody.style.cssText = `
      padding: 8px;
      background: var(--fill-tertiary);
      border-radius: 3px;
      font-size: 12px;
    `;

    const header = doc.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;";

    const userInfo = doc.createElement("div");
    userInfo.style.cssText =
      "color: var(--fill-secondary); display: flex; gap: 6px; align-items: center; font-size: 11px;";

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
      lockIcon.style.cssText = "color: var(--fill-quaternary); font-size: 10px;";
      lockIcon.textContent = "🔒";
      userInfo.appendChild(lockIcon);
    }

    const sep1 = doc.createElement("span");
    sep1.style.color = "var(--fill-quaternary)";
    sep1.textContent = "·";
    userInfo.appendChild(sep1);

    const timeSpan = doc.createElement("span");
    timeSpan.textContent = formatDate(comment.created_at);
    userInfo.appendChild(timeSpan);

    if (replyCount > 0) {
      const sep2 = doc.createElement("span");
      sep2.style.color = "var(--accent-blue)";
      sep2.textContent = "·";
      userInfo.appendChild(sep2);

      const replySpan = doc.createElement("span");
      replySpan.style.color = "var(--accent-blue)";
      replySpan.textContent = ` ${replyCount} 回复`;
      userInfo.appendChild(replySpan);
    }

    header.appendChild(userInfo);

    const actions = doc.createElement("div");
    actions.style.cssText = "display: flex; gap: 6px; flex-wrap: wrap;";

    const replyBtn = doc.createElement("button");
    replyBtn.textContent = "💬 回复";
    replyBtn.style.cssText = `
      padding: 2px 8px;
      background: transparent;
      color: var(--accent-blue);
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
        color: var(--accent-blue);
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
        color: var(--accent-red);
        border: 1px solid currentColor;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      `;
      deleteBtn.addEventListener("click", async () => {
        const message = replyCount > 0
          ? `此评论有 ${replyCount} 条回复,删除后回复也会被删除。确定继续？`
          : "确定要删除这条评论吗?";

        const confirmed = ServicesAdapter.confirm("确认删除", message);

        if (confirmed) {
          try {
            await this.context.supabaseManager.deleteComment(comment.id);
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
                    doc,
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
            logger.error("[SharedAnnotationsView] Error deleting comment:", error);
            this.context.showMessage("删除失败", "error");
          }
        }
      });
      actions.appendChild(deleteBtn);
    }

    header.appendChild(actions);
    commentBody.appendChild(header);

    const contentDiv = doc.createElement("div");
    contentDiv.className = "comment-content";
    contentDiv.style.cssText = "color: var(--fill-primary); line-height: 1.4; word-wrap: break-word;";
    contentDiv.textContent = comment.content;
    commentBody.appendChild(contentDiv);

    container.appendChild(commentBody);

    const replyBoxContainer = doc.createElement("div");
    replyBoxContainer.className = "reply-box-container";
    replyBoxContainer.style.display = "none";
    container.appendChild(replyBoxContainer);

    if (comment.children && comment.children.length > 0) {
      const childrenContainer = doc.createElement("div");
      childrenContainer.className = "comment-children";
      childrenContainer.style.cssText = "margin-top: 6px;";

      comment.children.forEach((child: any) => {
        const childNode = this.renderCommentNode(
          child,
          depth + 1,
          doc,
          currentUserId,
          annotationId,
          cardElement
        );
        childrenContainer.appendChild(childNode);
      });

      container.appendChild(childrenContainer);
    }

    return container;
  }

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
      "display: flex; flex-direction: column; gap: 8px; margin-top: 8px; padding: 8px; background: var(--fill-secondary); border-radius: 3px;";

    const textarea = doc.createElement("textarea");
  const { name: parentDisplayName } = resolveCommentDisplayInfo(parentComment);
    textarea.placeholder = `回复 @${parentDisplayName}...`;
    textarea.style.cssText = `
      padding: 6px;
      border: 1px solid var(--fill-quinary);
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 50px;
      background: var(--material-background);
      color: var(--fill-primary);
    `;

    const anonymousContainer = doc.createElement("div");
    anonymousContainer.style.cssText =
      "display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--fill-secondary);";

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
      background: var(--accent-blue);
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
        // 从开关中获取checkbox状态
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
        logger.error("[SharedAnnotationsView] Error replying to comment:", error);
        this.context.showMessage("回复失败", "error");
      }
    });

    const cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "取消";
    cancelBtn.style.cssText = `
      padding: 4px 12px;
      background: var(--fill-tertiary);
      color: var(--fill-primary);
      border: 1px solid var(--fill-quinary);
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
      border: 1px solid var(--fill-quinary);
      border-radius: 3px;
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
      background: var(--material-background);
      color: var(--fill-primary);
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
    anonymousLabel.style.cssText = "font-size: 11px; color: var(--fill-secondary); cursor: pointer;";

    const anonymousHint = doc.createElement("span");
    anonymousHint.textContent = '(将显示为"匿名用户")';
    anonymousHint.style.cssText = "font-size: 11px; color: var(--accent-blue); margin-left: 4px;";
    anonymousHint.style.display = (comment.is_anonymous || false) ? "inline" : "none";

    // 监听开关变化
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
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    saveBtn.addEventListener("click", async () => {
      const newContent = textarea.value.trim();
      // 从开关中获取checkbox状态
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
          logger.error("[SharedAnnotationsView] Error updating comment:", error);
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
      background: var(--fill-tertiary);
      color: var(--fill-primary);
      border: 1px solid var(--fill-quinary);
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

  private async handleLocateAnnotation(annotation: any): Promise<void> {
    try {
      logger.log("[SharedAnnotationsView] Locating annotation in PDF:", annotation.id);
      logger.log("[SharedAnnotationsView] 🔍 Annotation object:", JSON.stringify({
        id: annotation.id,
        show_author_name: annotation.show_author_name,
        users: annotation.users,
        username: annotation.username,
        author_name: annotation.author_name
      }));

      if (!annotation.position || typeof annotation.position.pageIndex !== "number") {
        this.context.showMessage("该标注缺少位置信息", "warning");
        return;
      }

      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        this.context.showMessage("请先选择一篇论文", "warning");
        return;
      }

      const doi = currentItem.getField("DOI");
      if (!doi) {
        this.context.showMessage("该论文没有DOI,无法定位", "warning");
        return;
      }

      const { PDFReaderManager } = await import("../pdfReaderManager");
      const readerManager = PDFReaderManager.getInstance();
      await readerManager.initialize();

      let reader = await readerManager.findOpenReader(doi);

      if (!reader) {
        logger.log("[SharedAnnotationsView] Reader not found, trying to open PDF...");
        const opened = await this.openPDFReader(currentItem);

        if (opened) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          reader = await readerManager.findOpenReader(doi);
        }
      }

      if (!reader) {
        this.context.showMessage("无法打开PDF阅读器", "error");
        return;
      }

      const success = await readerManager.highlightAnnotation(
        reader,
        {
          id: annotation.id,
          type: annotation.type || "highlight",
          content: annotation.content || "",
          comment: annotation.comment,
          color: annotation.color || "#ffff00",
          position: annotation.position,
          username: annotation.users?.username, // ✨ 传递username字段
          users: annotation.users, // ✨ 传递users对象
          show_author_name: annotation.show_author_name, // ✨ 传递show_author_name标志
          quality_score: annotation.quality_score,
          created_at: annotation.created_at,
          user_id: annotation.user_id
        },
        {
          scrollToView: true,
          showPopup: true  // ✨ 显示悬浮弹窗
        }
      );

      if (success) {
        this.context.showMessage("已定位到PDF页面", "info");

        // ✨ 高亮显示插件面板中的卡片
        const panels = this.context.getPanelsForCurrentItem();
        for (const panel of panels) {
          if (!panel.contentSection) continue;

          const card = panel.contentSection.querySelector(`[data-annotation-id="${annotation.id}"]`) as HTMLElement;
          if (card) {
            this.highlightCard(card);
            break;
          }
        }
      } else {
        this.context.showMessage("定位失败", "error");
      }
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error locating annotation:", error);
      this.context.showMessage(
        "定位失败: " + (error instanceof Error ? error.message : "未知错误"),
        "error"
      );
    }
  }

  private async openPDFReader(item: any): Promise<boolean> {
    try {
      const attachmentIDs = item.getAttachments();

      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (attachment && attachment.isPDFAttachment?.()) {
          if ((Zotero as any).FileHandlers && (Zotero as any).FileHandlers.open) {
            await (Zotero as any).FileHandlers.open(attachment, { location: { pageIndex: 0 } });
          } else {
            await (Zotero as any).OpenPDF?.openToPage?.(attachment, 1);
          }
          return true;
        }
      }

      logger.warn("[SharedAnnotationsView] No PDF attachment found");
      return false;
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error opening PDF:", error);
      return false;
    }
  }

  private createBatchDisplayToolbar(doc: Document): HTMLElement {
    // 使用统一的工具栏创建函数
    const toolbar = createBatchDisplayToolbar(
      doc,
      async (filter: UtilBatchDisplayFilter) => {
        await this.handleBatchDisplay(filter as BatchDisplayFilter);
      },
      {
        showFollowingButton: true,
        toggleNativeText: "隐藏我的标注"
      }
    );

    // 异步更新"隐藏我的标注"按钮的文字（根据实际状态）
    this.updateToggleNativeButtonText(doc);

    return toolbar;
  }

  /**
   * 更新"隐藏我的标注"按钮的文字（根据实际状态）
   */
  private async updateToggleNativeButtonText(doc: Document): Promise<void> {
    try {
      logger.log("[SharedAnnotationsView] 🔄 Updating toggle button text...");

      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        logger.log("[SharedAnnotationsView] ⚠️ No current item, skipping button update");
        return;
      }

      const doi = currentItem.getField("DOI");
      if (!doi) {
        logger.log("[SharedAnnotationsView] ⚠️ No DOI, skipping button update");
        return;
      }

      const { PDFReaderManager } = await import("../pdfReaderManager");
      const readerManager = PDFReaderManager.getInstance();
      const reader = await readerManager.findOpenReader(doi);

      if (!reader) {
        logger.log("[SharedAnnotationsView] ⚠️ No reader found, skipping button update");
        return;
      }

      // 获取当前实际状态
      const isHidden = readerManager.getNativeAnnotationsState(reader);
      logger.log(`[SharedAnnotationsView] Current native annotations state: ${isHidden ? 'HIDDEN' : 'SHOWN'}`);

      // 更新按钮文字
      const button = doc.querySelector('[data-filter="toggle-native"]') as HTMLElement;
      if (button) {
        const newText = isHidden ? "👁️ 显示我的标注" : "👁️ 隐藏我的标注";
        button.innerHTML = newText;
        logger.log(`[SharedAnnotationsView] ✅ Button text updated to: "${newText}"`);
      } else {
        logger.warn("[SharedAnnotationsView] ⚠️ Toggle button not found in DOM");
      }
    } catch (error) {
      logger.error("[SharedAnnotationsView] ❌ Failed to update toggle button text:", error);
    }
  }

  private async handleBatchDisplay(filterType: BatchDisplayFilter): Promise<void> {
    try {
      logger.log("[SharedAnnotationsView] Handling batch display:", filterType);

      const { PDFReaderManager } = await import("../pdfReaderManager");
      const readerManager = PDFReaderManager.getInstance();
      await readerManager.initialize();

      const currentItem = this.context.getCurrentItem();
      if (!currentItem) {
        this.context.showMessage("请先选择一篇论文", "warning");
        return;
      }

      const doi = currentItem.getField("DOI");
      if (!doi) {
        this.context.showMessage("该论文没有DOI", "warning");
        return;
      }

      if (filterType === "toggle-native") {
        let reader = await readerManager.findOpenReader(doi);
        if (!reader) {
          logger.log("[SharedAnnotationsView] Reader not found, trying to open PDF...");
          const opened = await this.openPDFReader(currentItem);

          if (opened) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            reader = await readerManager.findOpenReader(doi);
          }
        }

        if (!reader) {
          this.context.showMessage("无法打开PDF阅读器", "error");
          return;
        }

        // 🔧 获取当前实际状态（从PDFReaderManager）
        const currentState = readerManager.getNativeAnnotationsState(reader);
        const shouldHide = !currentState; // 切换状态

        logger.log(`[SharedAnnotationsView] Current state: ${currentState ? 'HIDDEN' : 'SHOWN'}, will ${shouldHide ? 'HIDE' : 'SHOW'}`);

        // 执行切换
        const isHidden = readerManager.toggleNativeAnnotations(reader, shouldHide);

        // 更新按钮文字 - 在所有面板中查找并更新
        const panels = this.context.getPanelsForCurrentItem();
        for (const panel of panels) {
          if (panel.contentSection) {
            const button = panel.contentSection.querySelector('[data-filter="toggle-native"]') as HTMLElement;
            if (button) {
              const newText = isHidden ? "👁️ 显示我的标注" : "👁️ 隐藏我的标注";
              button.innerHTML = newText;
              logger.log(`[SharedAnnotationsView] ✅ Button text updated to: "${newText}"`);
            }
          }
        }

        this.context.showMessage(isHidden ? "已隐藏原生标注" : "已显示原生标注", "info");
        return;
      }

      if (filterType === "clear") {
        readerManager.clearAllHighlights();
        this.context.showMessage("已清除所有标注显示", "info");
        return;
      }

      if (!this.cachedSharedAnnotations || this.cachedSharedAnnotations.length === 0) {
        this.context.showMessage("没有可显示的标注", "warning");
        return;
      }

      let reader = await readerManager.findOpenReader(doi);
      if (!reader) {
        logger.log("[SharedAnnotationsView] Reader not found, trying to open PDF...");
        const opened = await this.openPDFReader(currentItem);

        if (opened) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          reader = await readerManager.findOpenReader(doi);
        }
      }

      if (!reader) {
        this.context.showMessage("无法打开PDF阅读器", "error");
        return;
      }

      const filteredAnnotations = this.filterAnnotationsForBatch(
        this.cachedSharedAnnotations,
        filterType
      );

      if (filteredAnnotations.length === 0) {
        this.context.showMessage(
          `没有符合"${this.getFilterLabel(filterType)}"条件的标注`,
          "warning"
        );
        return;
      }

      this.context.showMessage(`正在显示 ${filteredAnnotations.length} 个标注...`, "info");

      const result = await readerManager.highlightMultipleAnnotations(
        reader,
        filteredAnnotations.map((ann) => ({
          id: ann.id,
          type: ann.type || "highlight",
          content: ann.content || "",
          comment: ann.comment,
          color: ann.color || "#ffff00",
          position: ann.position,
          author_name: ann.author_name,
          username: ann.users?.username, // ✨ 传递username字段
          users: ann.users, // ✨ 传递users对象
          show_author_name: ann.show_author_name, // ✨ 传递show_author_name标志
          quality_score: ann.quality_score,
          created_at: ann.created_at,
          user_id: ann.user_id
        }))
      );

      this.context.showMessage(
        `成功显示 ${result.success} 个标注${
          result.failed > 0 ? `, ${result.failed} 个失败` : ""
        }`,
        result.failed === 0 ? "info" : "warning"
      );
    } catch (error) {
      logger.error("[SharedAnnotationsView] Error in batch display:", error);
      this.context.showMessage(
        "批量显示失败: " + (error instanceof Error ? error.message : "未知错误"),
        "error"
      );
    }
  }

  private filterAnnotationsForBatch(annotations: any[], filterType: BatchDisplayFilter): any[] {
    const validAnnotations = annotations.filter(
      (ann) => ann.position && typeof ann.position.pageIndex === "number"
    );

    switch (filterType) {
      case "all":
        return validAnnotations;
      case "quality":
        return validAnnotations.filter(
          (ann) =>
            (ann.likes_count && ann.likes_count > 0) ||
            (ann.comments_count && ann.comments_count > 0) ||
            (ann.quality_score && ann.quality_score >= 4.0)
        );
      case "recent":
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return validAnnotations.filter((ann) => {
          const createdAt = new Date(ann.created_at).getTime();
          return createdAt > oneWeekAgo;
        });
      case "following":
        logger.warn("[SharedAnnotationsView] Following filter not yet implemented");
        return validAnnotations;
      default:
        return validAnnotations;
    }
  }

  private getFilterLabel(filterType: BatchDisplayFilter): string {
    const labels: Record<string, string> = {
      all: "全部标注",
      quality: "优质标注",
      recent: "近期标注",
      following: "关注用户"
    };
    return labels[filterType] || filterType;
  }
}

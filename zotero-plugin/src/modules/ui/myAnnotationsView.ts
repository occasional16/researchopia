import { AuthManager } from "../auth";
import { highlightText, matchesSearch, createSearchBox, createToggleSwitch } from "./helpers";
import type { BaseViewContext } from "./types";
import { containerPadding, getThemeColors } from "./styles";
import { ServicesAdapter } from '../../adapters';

export class MyAnnotationsView {
  private cachedAnnotations: any[] | null = null;
  private cachedDocumentId: string | null = null;

  constructor(private readonly context: BaseViewContext) {}

  public resetCache(): void {
    this.cachedAnnotations = null;
    this.cachedDocumentId = null;
  }

  public async render(container: HTMLElement, searchQuery = ""): Promise<void> {
    const doc = container.ownerDocument;

    let searchBox = container.querySelector(".search-box-container") as HTMLElement | null;
    let listContainer = container.querySelector(".annotations-list-container") as HTMLElement | null;

    const isFirstRender = !searchBox;

    if (isFirstRender) {
      container.innerHTML = "";
      
      // 重置容器样式,确保布局一致
      const containerColors = getThemeColors();
      container.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: ${containerPadding.content};
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
        background: ${containerColors.bgSecondary};
        border-radius: 10px;
        box-shadow: inset 0 1px 3px ${containerColors.shadowSm};
      `;

      searchBox = createSearchBox(doc, (query) => {
        this.render(container, query);
      });
      searchBox.classList.add("search-box-container");
      container.appendChild(searchBox);

      listContainer = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
      listContainer.classList.add("annotations-list-container");
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
      let syncedAnnotations: any[];
      let documentId: string;
      let userId: string;

      if (!this.cachedAnnotations || isFirstRender) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: #6c757d;">
              <div style="margin-bottom: 8px;">⏳ 正在加载标注...</div>
            </div>
          </div>
        `;

        const currentItem = this.context.getCurrentItem();
        if (!currentItem) {
          this.context.showMessage("请先选择一篇文献", "warning");
          return;
        }

  const { AnnotationManager } = await import("../annotations");
        const annotations = await AnnotationManager.getItemAnnotations(currentItem);

        if (annotations.length === 0) {
          listContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
              <div style="text-align: center; color: #9ca3af;">
                <div style="font-size: 14px;">📝 此文献暂无标注</div>
                <div style="font-size: 12px; margin-top: 8px;">请在PDF阅读器中添加标注</div>
              </div>
            </div>
          `;
          return;
        }

        const user = AuthManager.getCurrentUser();
        if (!user) {
          this.context.showMessage("请先登录", "warning");
          return;
        }

        const documentInfo = await this.context.supabaseManager.findOrCreateDocument(currentItem);
        syncedAnnotations = await AnnotationManager.syncAnnotationsWithSupabase(
          annotations,
          documentInfo.id,
          user.id
        );

        this.cachedAnnotations = syncedAnnotations;
        this.cachedDocumentId = documentInfo.id;
        documentId = documentInfo.id;
        userId = user.id;
      } else {
        syncedAnnotations = this.cachedAnnotations;
        documentId = this.cachedDocumentId!;
        const user = AuthManager.getCurrentUser();
        if (!user) {
          this.context.showMessage("请先登录", "warning");
          return;
        }
        userId = user.id;
      }

      const filteredAnnotations = searchQuery
        ? syncedAnnotations.filter((ann) => matchesSearch(ann, searchQuery))
        : syncedAnnotations;

      if (searchQuery && filteredAnnotations.length < syncedAnnotations.length) {
        const statsDiv = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
        statsDiv.style.cssText = `
          padding: 8px 12px;
          background: #e9ecef;
          border-bottom: 1px solid #e9ecef;
          font-size: 12px;
          color: #6c757d;
        `;
        statsDiv.textContent = `找到 ${filteredAnnotations.length} / ${syncedAnnotations.length} 条标注`;
        listContainer.appendChild(statsDiv);
      }

      if (filteredAnnotations.length === 0) {
        listContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
            <div style="text-align: center; color: #9ca3af;">
              <div style="font-size: 14px;">🔍 未找到匹配的标注</div>
              <div style="font-size: 12px; margin-top: 8px;">请尝试其他关键词</div>
            </div>
          </div>
        `;
        return;
      }

      await this.renderAnnotationsList(listContainer, filteredAnnotations, documentId, userId, searchQuery);
    } catch (error) {
      listContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
          <div style="text-align: center; color: #dc3545;">
            <div>❌ 加载失败</div>
            <div style="font-size: 12px; margin-top: 8px;">${error instanceof Error ? error.message : "未知错误"}</div>
          </div>
        </div>
      `;
      throw error;
    }
  }

  private async renderAnnotationsList(
    container: HTMLElement,
    annotations: any[],
    documentId: string,
    userId: string,
    searchQuery: string
  ): Promise<void> {
    const doc = container.ownerDocument;
    container.innerHTML = "";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";

    const toolbarColors = getThemeColors();
    const toolbar = doc.createElement("div");
    toolbar.style.cssText = `
      display: flex;
      gap: 10px;
      padding: 14px;
      background: ${toolbarColors.bgPrimary};
      border-radius: 10px;
      flex-wrap: wrap;
      align-items: center;
      box-shadow: 0 2px 8px ${toolbarColors.shadowMd};
      border: 1px solid ${toolbarColors.borderPrimary};
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

    const btnColors = getThemeColors();
    const selectAllLabel = doc.createElement("label");
    selectAllLabel.htmlFor = "select-all-annotations";
    selectAllLabel.textContent = "全选";
    selectAllLabel.style.cssText = `cursor: pointer; font-size: 14px; user-select: none; font-weight: 600; color: ${btnColors.textPrimary}; line-height: 1; display: flex; align-items: center; margin-left: 8px;`;

    const batchButtons = [
      { id: "batch-public", text: "📢 批量公开共享", visibility: "public" as const, showAuthorName: true, color: btnColors.secondary },
      { id: "batch-anonymous", text: "🕶️ 批量匿名共享", visibility: "public" as const, showAuthorName: false, color: btnColors.primary },
      { id: "batch-unshare", text: "🔒 批量取消共享", visibility: "private" as const, showAuthorName: true, color: btnColors.danger }
    ];

    toolbar.appendChild(selectAllSwitch);
    toolbar.appendChild(selectAllLabel);

    batchButtons.forEach((btn) => {
      const button = doc.createElement("button");
      button.id = btn.id;
      button.textContent = btn.text;
      button.style.cssText = `
        padding: 8px 16px;
        background: ${btnColors.bgPrimary};
        color: ${btn.color};
        border: 2px solid ${btn.color};
        border-radius: 8px;
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
        height: 38px;
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
        await this.handleBatchOperation(
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

    const listContainer = doc.createElement("div");
    listContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 600px;
      overflow-y: auto;
    `;

    annotations.forEach((annotation, index) => {
      const annotationCard = this.createAnnotationCard(
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

  private createAnnotationCard(
    doc: Document,
    annotation: any,
    index: number,
    documentId: string,
    userId: string,
    searchQuery: string
  ): HTMLElement {
    const cardColors = getThemeColors();
    const card = doc.createElement("div");
    card.className = "annotation-card";
    card.setAttribute("data-annotation-id", annotation.id);
    card.style.cssText = `
      padding: 16px;
      background: ${cardColors.bgPrimary};
      border-radius: 10px;
      border-left: 5px solid ${annotation.color};
      display: flex;
      gap: 14px;
      box-shadow: 0 2px 8px ${cardColors.shadowMd};
      transition: all 0.2s;
      border: 1px solid ${cardColors.borderPrimary};
    `;

    card.addEventListener("mouseenter", () => {
      const hoverColors = getThemeColors();
      card.style.boxShadow = `0 4px 12px ${hoverColors.shadowLg}`;
      card.style.transform = "translateY(-2px)";
    });
    card.addEventListener("mouseleave", () => {
      const leaveColors = getThemeColors();
      card.style.boxShadow = `0 2px 8px ${leaveColors.shadowMd}`;
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
      commentDiv.style.cssText = `margin-top: 6px; font-style: italic; color: #6c757d;`;
      commentDiv.innerHTML = searchQuery ? `💬 ${highlightText(annotation.comment, searchQuery)}` : `💬 ${annotation.comment}`;
      contentDiv.appendChild(commentDiv);
    }

    const metadataDiv = doc.createElement("div");
    metadataDiv.style.cssText = `font-size: 11px; color: #9ca3af; display: flex; gap: 12px;`;

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
    actionsDiv.style.cssText = "display: flex; gap: 8px; align-items: center;";

    const shareButton = doc.createElement("button");
    const isShared = annotation.visibility === "public" || annotation.visibility === "shared";
    shareButton.textContent = isShared ? "✅ 已共享" : "📤 共享";
    shareButton.style.cssText = `
      padding: 6px 12px;
      background: ${isShared ? "#10b981" : "#ffffff"};
      color: ${isShared ? "#ffffff" : "#3b82f6"};
      border: 2px solid ${isShared ? "#10b981" : "#3b82f6"};
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s;
    `;

    shareButton.addEventListener("click", async () => {
      const newVisibility = isShared ? "private" : "public";
      const currentShowAuthorName = annotation.showAuthorName !== false;
      await this.handleSingleAnnotationShare(
        annotation,
        documentId,
        userId,
        newVisibility,
        currentShowAuthorName
      );
    });

    const anonymousButton = doc.createElement("button");
    const isAnonymous = annotation.showAuthorName === false;
    anonymousButton.textContent = isAnonymous ? "🎭 匿名" : "👤 公开";
    anonymousButton.style.cssText = `
      padding: 4px 8px;
      background: #9ca3af;
      color: #212529;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
      ${isShared ? "" : "display: none;"}
    `;

    anonymousButton.addEventListener("click", async () => {
      await this.handleSingleAnnotationShare(
        annotation,
        documentId,
        userId,
        annotation.visibility || "public",
        !isAnonymous
      );
    });

    actionsDiv.appendChild(shareButton);
    actionsDiv.appendChild(anonymousButton);

    contentArea.appendChild(contentDiv);
    contentArea.appendChild(metadataDiv);
    contentArea.appendChild(actionsDiv);

    card.appendChild(switchContainer);
    card.appendChild(contentArea);

    return card;
  }

  private async handleSingleAnnotationShare(
    annotation: any,
    documentId: string,
    userId: string,
    visibility: "private" | "shared" | "public",
    showAuthorName: boolean
  ): Promise<void> {
    try {
      if (visibility === "private" && annotation.supabaseId) {
        const relatedData = await this.context.supabaseManager.getAnnotationRelatedData(annotation.supabaseId);

        if (relatedData.likes_count > 0 || relatedData.comments_count > 0) {
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
      }

  const { AnnotationManager } = await import("../annotations");
      const success = await AnnotationManager.updateAnnotationSharing(
        annotation,
        documentId,
        userId,
        visibility,
        showAuthorName
      );

      if (success) {
        this.context.showMessage("更新成功", "info");
        const currentItem = this.context.getCurrentItem();
        if (currentItem) {
          AnnotationManager.clearCache(currentItem.id);
        }
        this.resetCache();

        if (this.context.isActive()) {
          for (const panel of this.context.getPanelsForCurrentItem()) {
            if (panel.contentSection) {
              await this.render(panel.contentSection);
            }
          }
        }
      } else {
        this.context.showMessage("更新失败", "error");
      }
    } catch (error) {
      this.context.showMessage("更新失败: " + (error instanceof Error ? error.message : "未知错误"), "error");
      throw error;
    }
  }

  private async handleBatchOperation(
    allAnnotations: any[],
    documentId: string,
    userId: string,
    visibility: "private" | "shared" | "public",
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

      if (visibility === "private") {
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
      const results = await Promise.all(
        selectedAnnotations.map((ann) =>
          AnnotationManager.updateAnnotationSharing(
            ann,
            documentId,
            userId,
            visibility,
            showAuthorName
          )
        )
      );

      if (results.every(Boolean)) {
        this.context.showMessage("批量操作完成", "info");
        const currentItem = this.context.getCurrentItem();
        if (currentItem) {
          AnnotationManager.clearCache(currentItem.id);
        }
        this.resetCache();

        if (this.context.isActive()) {
          for (const panel of this.context.getPanelsForCurrentItem()) {
            if (panel.contentSection) {
              await this.render(panel.contentSection);
            }
          }
        }
      } else {
        this.context.showMessage("部分标注更新失败", "warning");
      }
    } catch (error) {
      this.context.showMessage("批量操作失败: " + (error instanceof Error ? error.message : "未知错误"), "error");
      throw error;
    }
  }
}

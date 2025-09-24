import { getString } from "../utils/locale";

export class UIManager {
  private currentAnnotations: any[] = [];
  private currentPaper: any = null;

  renderPane(body: Element, item: Zotero.Item | null): void {
    try {
      if (!item) {
        this.renderEmptyState(body);
        return;
      }

      ztoolkit.log('🔍 Rendering pane for item:', item.getDisplayTitle());

      // Clear existing content
      body.innerHTML = '';

      // Check for DOI
      const doi = item.getField('DOI');
      if (!doi) {
        this.renderNoDOIState(body);
        return;
      }

      // Create rich annotation interface
      this.createAnnotationInterface(body, item, doi);

    } catch (error) {
      ztoolkit.log(`❌ Failed to render pane: ${(error as Error).message}`);
      this.renderErrorState(body, (error as Error).message);
    }
  }

  private renderNoDOIState(body: Element): void {
    const container = ztoolkit.UI.createElement(body.ownerDocument, "div", {
      styles: {
        padding: "20px",
        textAlign: "center",
        color: "#666",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }
    });

    const icon = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: "📄" },
      styles: { fontSize: "48px", marginBottom: "15px" }
    });
    container.appendChild(icon);

    const message = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: "此文献没有DOI" },
      styles: { fontSize: "14px", marginBottom: "10px" }
    });
    container.appendChild(message);

    const subMessage = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: "标注共享功能需要DOI来识别论文" },
      styles: { fontSize: "12px" }
    });
    container.appendChild(subMessage);

    body.appendChild(container);
  }

  private createAnnotationInterface(body: Element, item: Zotero.Item, doi: string): void {
    const title = item.getField('title') || '未知';

    // Create main container using ztoolkit.UI.createElement for security
    const container = ztoolkit.UI.createElement(body.ownerDocument, "div", {
      styles: {
        padding: "15px",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }
    });

    // Create header
    const header = this.createHeader(container.ownerDocument, doi, title);
    container.appendChild(header);

    // Create filters
    const filters = this.createFilters(container.ownerDocument);
    container.appendChild(filters);

    // Create loading indicator
    const loadingIndicator = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      id: "loading-indicator",
      styles: {
        textAlign: "center",
        padding: "20px",
        display: "none"
      }
    });
    const loadingText = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: "🔄 加载中..." },
      styles: { fontSize: "14px", color: "#666" }
    });
    loadingIndicator.appendChild(loadingText);
    container.appendChild(loadingIndicator);

    // Create annotations list
    const annotationsList = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      id: "annotations-list",
      styles: { minHeight: "200px" }
    });
    container.appendChild(annotationsList);

    // Create empty state
    const emptyState = this.createEmptyState(container.ownerDocument);
    container.appendChild(emptyState);

    body.appendChild(container);

    // 绑定事件
    this.bindAnnotationEvents(container, item, doi);

    // 加载标注
    this.loadAnnotations(doi);
  }

  private bindAnnotationEvents(container: Element, item: Zotero.Item, doi: string): void {
    // 提取我的标注按钮
    const extractBtn = container.querySelector('#extract-annotations-btn');
    if (extractBtn) {
      extractBtn.addEventListener('click', () => this.handleExtractAnnotations(item));
    }

    // 共享我的标注按钮
    const shareBtn = container.querySelector('#share-annotations-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.handleShareAnnotations(item));
    }

    // 查看共享标注按钮
    const viewBtn = container.querySelector('#view-shared-btn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.handleViewSharedAnnotations(item));
    }

    // 排序选择
    const sortSelect = container.querySelector('#sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => this.handleFilterChange(doi));
    }

    // 类型筛选
    const typeFilter = container.querySelector('#type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', () => this.handleFilterChange(doi));
    }

    // 关注筛选
    const followingOnly = container.querySelector('#following-only');
    if (followingOnly) {
      followingOnly.addEventListener('change', () => this.handleFilterChange(doi));
    }

    // 加载更多按钮
    const loadMoreBtn = container.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMoreAnnotations(doi));
    }
  }

  private async handleUploadAnnotations(item: Zotero.Item): Promise<void> {
    try {
      ztoolkit.log('📤 Starting annotation upload...');

      const annotations = this.extractAnnotations(item);
      if (annotations.length === 0) {
        ztoolkit.getGlobal("alert")("没有找到标注");
        return;
      }

      // 这里应该调用 Supabase API 上传标注
      // await addon.api.supabase.uploadAnnotations(annotations);

      ztoolkit.getGlobal("alert")(`成功提取 ${annotations.length} 个标注`);
      ztoolkit.log(`✅ Extracted ${annotations.length} annotations`);

    } catch (error) {
      ztoolkit.log(`❌ Upload failed: ${(error as Error).message}`);
      ztoolkit.getGlobal("alert")(`上传失败: ${(error as Error).message}`);
    }
  }

  private async loadAnnotations(doi: string, forceRefresh: boolean = false): Promise<void> {
    try {
      const doc = ztoolkit.getGlobal('document') || window.document;
      const loadingIndicator = doc?.getElementById('loading-indicator');
      const annotationsList = doc?.getElementById('annotations-list');
      const emptyState = doc?.getElementById('empty-state');

      if (loadingIndicator) loadingIndicator.style.display = 'block';
      if (annotationsList) annotationsList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'none';

      // 这里应该调用 Supabase API 获取标注
      // const annotations = await addon.api.supabase.getSharedAnnotations(doi);

      // 模拟数据
      const annotations: any[] = [];

      if (loadingIndicator) loadingIndicator.style.display = 'none';

      if (annotations.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
      } else {
        this.renderAnnotations(annotations);
      }

    } catch (error) {
      ztoolkit.log(`❌ Failed to load annotations: ${(error as Error).message}`);
      const doc = ztoolkit.getGlobal('document') || window.document;
      const loadingIndicator = doc?.getElementById('loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.innerHTML = `<div style="color: #dc3545;">加载失败: ${(error as Error).message}</div>`;
      }
    }
  }

  private handleFilterChange(doi: string): void {
    ztoolkit.log('🔄 Filter changed, reloading annotations...');
    this.loadAnnotations(doi);
  }

  private loadMoreAnnotations(doi: string): void {
    ztoolkit.log('📄 Loading more annotations...');
    // 实现加载更多逻辑
  }

  private renderAnnotations(annotations: any[]): void {
    const doc = ztoolkit.getGlobal('document') || window.document;
    const annotationsList = doc?.getElementById('annotations-list');
    if (!annotationsList) return;

    annotationsList.innerHTML = annotations.map(annotation => `
      <div class="annotation-item" style="border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-bottom: 10px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="font-weight: bold; color: #2c3e50; font-size: 13px;">${annotation.user_name || '匿名用户'}</div>
          <div style="font-size: 11px; color: #6c757d;">${new Date(annotation.created_at).toLocaleDateString()}</div>
        </div>
        <div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 12px; line-height: 1.4;">
          ${annotation.content}
        </div>
        ${annotation.comment ? `<div style="color: #495057; font-size: 12px; margin-bottom: 8px;">${annotation.comment}</div>` : ''}
        <div style="display: flex; align-items: center; gap: 15px; font-size: 11px; color: #6c757d;">
          <button style="background: none; border: none; color: #007bff; cursor: pointer; padding: 2px 6px;">
            👍 ${annotation.likes_count || 0}
          </button>
          <button style="background: none; border: none; color: #007bff; cursor: pointer; padding: 2px 6px;">
            💬 ${annotation.comments_count || 0}
          </button>
        </div>
      </div>
    `).join('');
  }

  private createHeader(doc: Document, doi: string, title: string): Element {
    const header = ztoolkit.UI.createElement(doc, "div", {
      id: "annotation-header",
      styles: { marginBottom: "15px" }
    });

    // 标题
    const headerTitle = ztoolkit.UI.createElement(doc, "h3", {
      properties: { textContent: "📝 Researchopia 标注管理" },
      styles: {
        margin: "0 0 10px 0",
        fontSize: "16px",
        color: "#2c3e50"
      }
    });
    header.appendChild(headerTitle);

    // 文献信息
    const paperInfo = ztoolkit.UI.createElement(doc, "div", {
      id: "paper-info",
      styles: {
        fontSize: "11px",
        color: "#666",
        lineHeight: "1.4",
        marginBottom: "15px",
        padding: "8px",
        background: "#f8f9fa",
        borderRadius: "4px"
      }
    });

    const doiInfo = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: `DOI: ${doi}` }
    });
    paperInfo.appendChild(doiInfo);

    const titleInfo = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: `标题: ${title}` },
      styles: { marginTop: "4px" }
    });
    paperInfo.appendChild(titleInfo);

    header.appendChild(paperInfo);

    // 三个主要按钮
    const buttonContainer = ztoolkit.UI.createElement(doc, "div", {
      styles: {
        display: "flex",
        gap: "8px",
        marginBottom: "15px"
      }
    });

    // 提取我的标注按钮
    const extractBtn = ztoolkit.UI.createElement(doc, "button", {
      id: "extract-annotations-btn",
      properties: { textContent: "📋 提取我的标注" },
      styles: {
        flex: "1",
        minWidth: "120px",
        padding: "8px 12px",
        background: "#17a2b8",
        color: "white",
        border: "none",
        borderRadius: "4px",
        fontSize: "12px",
        cursor: "pointer"
      }
    });
    buttonContainer.appendChild(extractBtn);

    // 共享我的标注按钮
    const shareBtn = ztoolkit.UI.createElement(doc, "button", {
      id: "share-annotations-btn",
      properties: { textContent: "📤 共享我的标注" },
      styles: {
        flex: "1",
        minWidth: "120px",
        padding: "8px 12px",
        background: "#28a745",
        color: "white",
        border: "none",
        borderRadius: "4px",
        fontSize: "12px",
        cursor: "pointer"
      }
    });
    shareBtn.disabled = true; // 默认禁用，提取后启用
    buttonContainer.appendChild(shareBtn);

    // 查看共享标注按钮
    const viewBtn = ztoolkit.UI.createElement(doc, "button", {
      id: "view-shared-btn",
      properties: { textContent: "👥 查看共享标注" },
      styles: {
        flex: "1",
        minWidth: "120px",
        padding: "8px 12px",
        background: "#6f42c1",
        color: "white",
        border: "none",
        borderRadius: "4px",
        fontSize: "12px",
        cursor: "pointer"
      }
    });
    buttonContainer.appendChild(viewBtn);

    header.appendChild(buttonContainer);

    // 状态提示区域
    const statusDiv = ztoolkit.UI.createElement(doc, "div", {
      id: "annotation-status",
      styles: {
        background: "#f8f9fa",
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "15px",
        borderLeft: "4px solid #6c757d"
      }
    });

    const statusText = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: '💡 点击"提取我的标注"开始使用标注管理功能' },
      styles: {
        fontSize: "12px",
        color: "#495057"
      }
    });
    statusDiv.appendChild(statusText);
    header.appendChild(statusDiv);

    return header;
  }

  private createFilters(doc: Document): Element {
    const filters = ztoolkit.UI.createElement(doc, "div", {
      id: "annotation-filters",
      styles: {
        marginBottom: "15px",
        padding: "10px",
        background: "#f8f9fa",
        borderRadius: "6px"
      }
    });

    const filtersContainer = ztoolkit.UI.createElement(doc, "div", {
      styles: {
        display: "flex",
        alignItems: "center",
        gap: "15px",
        flexWrap: "wrap"
      }
    });

    // Sort select
    const sortContainer = ztoolkit.UI.createElement(doc, "div", {
      styles: { display: "flex", alignItems: "center", gap: "5px" }
    });
    const sortLabel = ztoolkit.UI.createElement(doc, "label", {
      properties: { textContent: "排序:" },
      styles: { fontSize: "12px", color: "#495057" }
    });
    sortContainer.appendChild(sortLabel);

    const sortSelect = ztoolkit.UI.createElement(doc, "select", {
      id: "sort-select",
      styles: {
        padding: "4px 8px",
        border: "1px solid #ddd",
        borderRadius: "3px",
        fontSize: "12px"
      }
    });

    const sortOptions = [
      { value: "likes_count", text: "👍 按点赞数" },
      { value: "created_at", text: "🕒 按时间" },
      { value: "comments_count", text: "💬 按评论数" }
    ];

    sortOptions.forEach(opt => {
      const option = ztoolkit.UI.createElement(doc, "option", {
        properties: { value: opt.value, textContent: opt.text }
      });
      sortSelect.appendChild(option);
    });

    sortContainer.appendChild(sortSelect);
    filtersContainer.appendChild(sortContainer);

    filters.appendChild(filtersContainer);
    return filters;
  }

  private createEmptyState(doc: Document): Element {
    const emptyState = ztoolkit.UI.createElement(doc, "div", {
      id: "empty-state",
      styles: {
        textAlign: "center",
        padding: "40px",
        color: "#666"
      }
    });

    const icon = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: "📝" },
      styles: { fontSize: "48px", marginBottom: "15px" }
    });
    emptyState.appendChild(icon);

    const message = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: "还没有共享标注" },
      styles: { fontSize: "16px", marginBottom: "8px" }
    });
    emptyState.appendChild(message);

    const subMessage = ztoolkit.UI.createElement(doc, "div", {
      properties: { textContent: "成为第一个分享标注的人吧！" },
      styles: { fontSize: "12px", marginBottom: "15px" }
    });
    emptyState.appendChild(subMessage);

    const shareBtn = ztoolkit.UI.createElement(doc, "button", {
      properties: { textContent: "分享我的标注" },
      styles: {
        padding: "8px 16px",
        background: "#28a745",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer"
      },
      listeners: [{
        type: "click",
        listener: (event) => {
          const doc = (event.target as Element).ownerDocument;
          const uploadBtn = doc.getElementById('upload-annotations-btn');
          if (uploadBtn) uploadBtn.click();
        }
      }]
    });
    emptyState.appendChild(shareBtn);

    return emptyState;
  }

  private renderEmptyState(body: Element): void {
    const container = ztoolkit.UI.createElement(body.ownerDocument, "div", {
      styles: {
        padding: "20px",
        textAlign: "center",
        color: "#666",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }
    });

    const message = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: {
        textContent: "请选择一个文献项目"
      },
      styles: {
        fontSize: "14px"
      }
    });
    container.appendChild(message);

    body.appendChild(container);
  }

  private renderErrorState(body: Element, message: string): void {
    const container = ztoolkit.UI.createElement(body.ownerDocument, "div", {
      styles: {
        padding: "20px",
        textAlign: "center",
        color: "#dc3545",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }
    });

    const icon = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: "❌" },
      styles: { fontSize: "48px", marginBottom: "15px" }
    });
    container.appendChild(icon);

    const errorMessage = ztoolkit.UI.createElement(container.ownerDocument, "div", {
      properties: { textContent: `加载失败: ${message}` },
      styles: { fontSize: "14px" }
    });
    container.appendChild(errorMessage);

    body.appendChild(container);
  }

  extractAnnotations(item: Zotero.Item): any[] {
    try {
      const annotations: any[] = [];
      
      // Get all child items (attachments)
      const childItems = item.getAttachments();
      
      for (const attachmentID of childItems) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment || attachment.attachmentContentType !== 'application/pdf') {
          continue;
        }
        
        // Get annotations for this PDF
        const annotationItems = attachment.getAnnotations();
        
        for (const annotationItem of annotationItems) {
          const annotation = {
            id: annotationItem.key,
            text: annotationItem.annotationText || '',
            comment: annotationItem.annotationComment || '',
            type: annotationItem.annotationType || 'highlight',
            color: annotationItem.annotationColor || '#ffff00',
            page: annotationItem.annotationPageLabel || 1,
            position: annotationItem.annotationPosition || {},
            tags: annotationItem.getTags().map((tag: any) => tag.tag),
            dateAdded: annotationItem.dateAdded,
            dateModified: annotationItem.dateModified,
            // Document metadata
            title: item.getDisplayTitle(),
            doi: item.getField('DOI') || '',
            url: item.getField('url') || '',
            authors: item.getCreators().map((creator: any) => 
              `${creator.firstName || ''} ${creator.lastName || ''}`.trim()
            ).join(', ')
          };
          
          annotations.push(annotation);
        }
      }
      
      ztoolkit.log(`📋 Extracted ${annotations.length} annotations from item: ${item.getDisplayTitle()}`);
      return annotations;

    } catch (error) {
      ztoolkit.log(`❌ Error extracting annotations: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 处理提取我的标注
   */
  private async handleExtractAnnotations(item: Zotero.Item): Promise<void> {
    try {
      ztoolkit.log('Extracting user annotations...');
      this.updateAnnotationStatus('🔄 正在提取标注...', 'info');

      const doc = ztoolkit.getGlobal('document') || window.document;
      const extractBtn = doc?.getElementById('extract-annotations-btn') as HTMLButtonElement;
      if (extractBtn) {
        extractBtn.disabled = true;
        extractBtn.textContent = '🔄 提取中...';
      }

      // 提取标注
      const annotations = this.extractAnnotations(item);

      if (annotations.length === 0) {
        this.updateAnnotationStatus('ℹ️ 未找到标注，请确保PDF已打开并添加了标注', 'warning');
        return;
      }

      // 显示提取的标注
      this.displayExtractedAnnotations(annotations);

      // 启用共享按钮
      const shareBtn = doc?.getElementById('share-annotations-btn') as HTMLButtonElement;
      if (shareBtn) {
        shareBtn.disabled = false;
      }

      this.updateAnnotationStatus(`✅ 成功提取 ${annotations.length} 个标注`, 'success');
      ztoolkit.log(`✅ Extracted ${annotations.length} annotations`);

    } catch (error) {
      ztoolkit.log(`❌ Extract failed: ${(error as Error).message}`);
      this.updateAnnotationStatus('❌ 提取标注失败：' + (error as Error).message, 'error');
    } finally {
      const doc = ztoolkit.getGlobal('document') || window.document;
      const extractBtn = doc?.getElementById('extract-annotations-btn') as HTMLButtonElement;
      if (extractBtn) {
        extractBtn.disabled = false;
        extractBtn.textContent = '📋 提取我的标注';
      }
    }
  }

  /**
   * 处理共享我的标注
   */
  private async handleShareAnnotations(item: Zotero.Item): Promise<void> {
    try {
      // 检查是否已登录
      if (!addon.api.supabase.isAuthenticated()) {
        ztoolkit.getGlobal("alert")('请先在偏好设置中登录后再共享标注');
        return;
      }

      ztoolkit.log('Sharing user annotations...');
      this.updateAnnotationStatus('🔄 正在共享标注...', 'info');

      const doc = ztoolkit.getGlobal('document') || window.document;
      const shareBtn = doc?.getElementById('share-annotations-btn') as HTMLButtonElement;
      if (shareBtn) {
        shareBtn.disabled = true;
        shareBtn.textContent = '🔄 共享中...';
      }

      // 获取已提取的标注
      const annotations = this.extractAnnotations(item);
      if (annotations.length === 0) {
        this.updateAnnotationStatus('⚠️ 请先提取标注', 'warning');
        return;
      }

      // 上传到Supabase
      const doi = item.getField('DOI');
      await addon.api.supabase.uploadAnnotations(doi, annotations);

      this.updateAnnotationStatus(`✅ 成功共享 ${annotations.length} 个标注`, 'success');
      ztoolkit.getGlobal("alert")(`✅ 共享成功！\n\n已共享 ${annotations.length} 个标注到云端`);

    } catch (error) {
      ztoolkit.log(`❌ Share failed: ${(error as Error).message}`);
      this.updateAnnotationStatus('❌ 共享失败：' + (error as Error).message, 'error');
      ztoolkit.getGlobal("alert")(`❌ 共享失败：\n\n${(error as Error).message}\n\n请检查网络连接和登录状态`);
    } finally {
      const doc = ztoolkit.getGlobal('document') || window.document;
      const shareBtn = doc?.getElementById('share-annotations-btn') as HTMLButtonElement;
      if (shareBtn) {
        shareBtn.disabled = false;
        shareBtn.textContent = '📤 共享我的标注';
      }
    }
  }

  /**
   * 更新状态显示
   */
  private updateAnnotationStatus(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    try {
      const doc = ztoolkit.getGlobal('document') || window.document;
      const statusDiv = doc?.getElementById('annotation-status');
      if (!statusDiv) return;

      const colors = {
        info: '#17a2b8',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
      };

      statusDiv.style.borderLeftColor = colors[type];
      const statusText = statusDiv.querySelector('div');
      if (statusText) {
        statusText.textContent = message;
      }
    } catch (error) {
      ztoolkit.log('Failed to update annotation status: ' + (error as Error).message);
    }
  }

  /**
   * 处理查看共享标注
   */
  private async handleViewSharedAnnotations(item: Zotero.Item): Promise<void> {
    try {
      ztoolkit.log('Loading shared annotations...');
      this.updateAnnotationStatus('🔄 正在加载共享标注...', 'info');

      const doc = ztoolkit.getGlobal('document') || window.document;
      const viewBtn = doc?.getElementById('view-shared-btn') as HTMLButtonElement;
      if (viewBtn) {
        viewBtn.disabled = true;
        viewBtn.textContent = '🔄 加载中...';
      }

      const doi = item.getField('DOI');
      const sharedAnnotations = await addon.api.supabase.getSharedAnnotations(doi);

      if (sharedAnnotations.length === 0) {
        this.updateAnnotationStatus('ℹ️ 暂无共享标注', 'info');
        this.showEmptySharedState();
      } else {
        this.displaySharedAnnotations(sharedAnnotations);
        this.updateAnnotationStatus(`✅ 加载了 ${sharedAnnotations.length} 个共享标注`, 'success');
      }

    } catch (error) {
      ztoolkit.log(`❌ Load shared annotations failed: ${(error as Error).message}`);
      this.updateAnnotationStatus('❌ 加载失败：' + (error as Error).message, 'error');
      ztoolkit.getGlobal("alert")(`❌ 加载失败：\n\n${(error as Error).message}\n\n请检查网络连接`);
    } finally {
      const doc = ztoolkit.getGlobal('document') || window.document;
      const viewBtn = doc?.getElementById('view-shared-btn') as HTMLButtonElement;
      if (viewBtn) {
        viewBtn.disabled = false;
        viewBtn.textContent = '👥 查看共享标注';
      }
    }
  }

  /**
   * 显示提取的标注
   */
  private displayExtractedAnnotations(annotations: any[]): void {
    // 实现显示提取标注的逻辑
    ztoolkit.log(`Displaying ${annotations.length} extracted annotations`);
  }

  /**
   * 显示共享标注
   */
  private displaySharedAnnotations(annotations: any[]): void {
    // 实现显示共享标注的逻辑
    ztoolkit.log(`Displaying ${annotations.length} shared annotations`);
  }

  /**
   * 显示空的共享状态
   */
  private showEmptySharedState(): void {
    // 实现显示空状态的逻辑
    ztoolkit.log('Showing empty shared state');
  }
}

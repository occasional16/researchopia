import { AuthManager } from "./auth";
import { AnnotationManager, SharedAnnotation } from "./annotations";
import { getString, getLocaleID } from "../utils/locale";
import { config } from "../../package.json";

// Enable strict mode for Zotero 8 compatibility  
"use strict";

interface ItemPaneSection {
  id: string;
  type: string;
  label: string;
  bodyXHTML: string;
  onInit?: (doc: Document, body: HTMLElement) => void;
  onDestroy?: () => void;
}

export class UIManager {
  private static initialized: boolean = false;
  private static itemPaneSectionId: string | null = null;
  private static currentItem: any = null; // Using any to avoid Zotero type issues

  static async initialize() {
    if (this.initialized) return;

    try {
      ztoolkit.log("UIManager initializing...");
      
      // Register style sheets
      await this.registerStyles();
      
      this.initialized = true;
      ztoolkit.log("UIManager initialized successfully");
      
    } catch (error) {
      ztoolkit.log("UIManager initialization failed:", error);
      throw error;
    }
  }

  static cleanup() {
    if (this.itemPaneSectionId) {
      try {
        (Zotero as any).ItemPaneManager?.unregisterSection?.(this.itemPaneSectionId);
      } catch (error) {
        ztoolkit.log("Error unregistering Item Pane section:", error);
      }
      this.itemPaneSectionId = null;
    }
    
    this.currentItem = null;
    this.initialized = false;
    ztoolkit.log("UIManager cleanup completed");
  }

  /**
   * Register CSS styles for the plugin UI
   */
  static async registerStyles() {
    const css = `
      .researchopia-container {
        padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fafafa;
        border-radius: 6px;
        margin: 8px 0;
      }
      
      .researchopia-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e0e0e0;
      }
      
      .researchopia-title {
        font-weight: 600;
        font-size: 14px;
        color: #333;
      }
      
      .researchopia-status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
        background: #e8f5e8;
        color: #2d5a2d;
      }
      
      .researchopia-status.offline {
        background: #ffeaa7;
        color: #895c00;
      }
      
      .annotation-list {
        max-height: 400px;
        overflow-y: auto;
        margin: 8px 0;
      }
      
      .annotation-item {
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        padding: 10px;
        margin: 6px 0;
        transition: all 0.2s ease;
      }
      
      .annotation-item:hover {
        border-color: #4285f4;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .annotation-text {
        font-size: 13px;
        line-height: 1.4;
        color: #333;
        margin-bottom: 6px;
      }
      
      .annotation-comment {
        font-size: 12px;
        color: #666;
        font-style: italic;
        margin-bottom: 8px;
      }
      
      .annotation-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #888;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid #f0f0f0;
      }
      
      .annotation-author {
        font-weight: 500;
      }
      
      .annotation-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      
      .action-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        transition: background 0.2s ease;
      }
      
      .action-btn:hover {
        background: #f0f0f0;
      }
      
      .action-btn.liked {
        background: #ff6b6b;
        color: white;
      }
      
      .action-btn.followed {
        background: #4285f4;
        color: white;
      }
      
      .loading-spinner {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        color: #666;
      }
      
      .empty-state {
        text-align: center;
        padding: 30px 20px;
        color: #888;
      }
      
      .empty-state-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 6px;
      }
      
      .empty-state-desc {
        font-size: 12px;
      }
      
      .share-btn {
        background: #4285f4;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }
      
      .share-btn:hover {
        background: #3367d6;
      }
      
      .share-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      /* 新增的中文界面样式 */
      .researchopia-main-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .action-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .main-action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border: none;
        border-radius: 6px;
        background: #007acc;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .main-action-btn:hover {
        background: #005a99;
        transform: translateY(-1px);
      }

      .main-action-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
      }

      .main-action-btn .btn-icon {
        font-size: 16px;
      }

      .extract-btn { background: #28a745; }
      .extract-btn:hover { background: #218838; }
      
      .share-btn.main-action-btn { background: #17a2b8; }
      .share-btn.main-action-btn:hover { background: #138496; }
      
      .view-btn { background: #6f42c1; }
      .view-btn:hover { background: #5a32a3; }

      .welcome-message {
        text-align: center;
        padding: 20px;
        background: white;
        border-radius: 6px;
        border-left: 4px solid #007acc;
      }

      .welcome-title {
        font-size: 16px;
        font-weight: bold;
        color: #333;
        margin-bottom: 8px;
      }

      .welcome-desc {
        font-size: 13px;
        color: #666;
        line-height: 1.4;
      }

      .annotations-extract, .annotations-share, .shared-annotations {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .extract-header, .share-header, .shared-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 8px;
        border-bottom: 2px solid #ddd;
      }

      .extract-header h3, .share-header h3, .shared-header h3 {
        margin: 0;
        font-size: 16px;
        color: #333;
      }

      .extract-actions, .share-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .select-all-btn, .select-none-btn, .share-selected-btn, .back-btn {
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
      }

      .select-all-btn:hover, .select-none-btn:hover {
        background: #f0f0f0;
      }

      .share-selected-btn {
        background: #28a745;
        color: white;
        border-color: #28a745;
      }

      .share-selected-btn:hover {
        background: #218838;
      }

      .back-btn {
        background: #6c757d;
        color: white;
        border-color: #6c757d;
      }

      .back-btn:hover {
        background: #5a6268;
      }

      .annotation-checkbox {
        flex-shrink: 0;
        padding-top: 2px;
      }

      .success-state {
        text-align: center;
        padding: 20px;
        background: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 6px;
      }

      .success-title {
        font-size: 16px;
        font-weight: bold;
        color: #155724;
        margin-bottom: 8px;
      }

      .success-desc {
        font-size: 13px;
        color: #155724;
        margin-bottom: 16px;
      }

      .comments-section {
        margin-top: 8px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
      }

      .comments-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 8px;
      }

      .comment-item {
        padding: 6px 8px;
        background: white;
        border-radius: 4px;
        border-left: 2px solid #007acc;
      }

      .comment-author {
        font-size: 10px;
        font-weight: 500;
        color: #007acc;
      }

      .comment-text {
        font-size: 11px;
        margin: 2px 0;
        color: #333;
      }

      .comment-time {
        font-size: 10px;
        color: #888;
      }

      .comment-input {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .comment-input textarea {
        resize: vertical;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 4px 6px;
        font-size: 11px;
      }

      .comment-input button {
        align-self: flex-end;
        padding: 4px 12px;
        font-size: 11px;
        background: #007acc;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      }

      .comment-input button:hover {
        background: #005a99;
      }

      .like-btn, .comment-btn {
        padding: 2px 6px;
        font-size: 11px;
        border: 1px solid #ddd;
        border-radius: 3px;
        background: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .like-btn:hover, .comment-btn:hover {
        background: #f0f0f0;
      }

      .like-btn.liked {
        background: #ffe6e6;
        border-color: #ff6b6b;
        color: #ff6b6b;
      }
    `;

    // Use ztoolkit's CSS insertion method
    try {
      // @ts-ignore - ztoolkit CSS methods exist but may not be typed
      ztoolkit.insertCSS?.(css) || ztoolkit.UI?.insertCSS?.(css, "researchopia-styles") || addon.data.ztoolkit?.UI?.insertCSS?.(css);
      ztoolkit.log("CSS styles registered successfully");
    } catch (error) {
      ztoolkit.log("Error registering CSS styles:", error);
    }
  }

  /**
   * Register Item Pane section for showing shared annotations
   */
  static async registerItemPaneSection() {
    try {
      ztoolkit.log("UIManager: Registering Item Pane section...");

      // Check if ItemPaneManager is available (Zotero 8 compatibility)
      if (!(Zotero as any).ItemPaneManager) {
        ztoolkit.log("UIManager: ItemPaneManager not available, skipping registration");
        return;
      }

      // Register custom section using Zotero 8 API
      this.itemPaneSectionId = (Zotero as any).ItemPaneManager.registerSection({
        paneID: "researchopia-enhanced-annotations",
        pluginID: config.addonID,
        header: {
          label: "社区标注",
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
        },
        sidenav: {
          label: "标注", 
          icon: `chrome://${config.addonRef}/content/icons/favicon.png`,
        },
        onRender: ({ body, item }) => {
          try {
            ztoolkit.log("UIManager: Item Pane onRender called, item:", item?.id);
            
            if (!item || !item.isRegularItem()) {
              body.innerHTML = `
                <div class="researchopia-container">
                  <div class="researchopia-message">
                    <h3>社区标注</h3>
                    <p>请选择一个研究项目来查看共享标注。</p>
                  </div>
                </div>
              `;
              return;
            }

            this.currentItem = item;
            this.renderMainInterface(body);
            
          } catch (error) {
            ztoolkit.log("UIManager: Error in onRender:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            body.innerHTML = `
              <div class="researchopia-container">
                <div class="researchopia-error">
                  <h3>社区标注</h3>
                  <p>加载标注时出错，请稍后重试。</p>
                  <p style="color: #666; font-size: 12px;">错误: ${errorMessage}</p>
                </div>
              </div>
            `;
          }
        },
      });

      ztoolkit.log("UIManager: Item Pane section registered with ID:", this.itemPaneSectionId);
      
    } catch (error) {
      ztoolkit.log("UIManager: Error registering Item Pane section:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      // 创建一个简单的错误通知
      const popupWin = new (Zotero as any).ProgressWindow({ closeOnClick: true });
      popupWin.changeHeadline("Researchopia 注册失败");
      popupWin.addDescription(`Item Pane 注册失败: ${errorMessage}`);
      popupWin.show();
      popupWin.startCloseTimer(5000);
      throw error;
    }
  }

  /**
   * 渲染主界面
   */
  private static renderMainInterface(body: HTMLElement) {
    const item = this.currentItem;
    if (!item) return;

    const doi = item.getField("DOI");
    ztoolkit.log("UIManager: Rendering main interface for item with DOI:", doi);
    
    if (!doi) {
      body.innerHTML = `
        <div class="researchopia-container">
          <div class="empty-state">
            <div class="empty-state-title">未找到DOI</div>
            <div class="empty-state-desc">此论文需要DOI号才能访问共享标注功能</div>
          </div>
        </div>
      `;
      return;
    }

    // 渲染包含三个主要按钮的界面
    body.innerHTML = `
      <div class="researchopia-container">
        <div class="researchopia-header">
          <div class="researchopia-title">社区标注</div>
          <div class="researchopia-status ${AuthManager.isLoggedIn() ? "" : "offline"}">
            ${AuthManager.isLoggedIn() ? "在线" : "离线"}
          </div>
        </div>
        <div class="researchopia-main-panel">
          <div class="action-buttons">
            <button class="main-action-btn extract-btn" id="extract-annotations-btn">
              <span class="btn-icon">📝</span>
              <span class="btn-text">提取我的标注</span>
            </button>
            <button class="main-action-btn share-btn" id="share-annotations-btn" ${!AuthManager.isLoggedIn() ? 'disabled' : ''}>
              <span class="btn-icon">🚀</span>
              <span class="btn-text">共享我的标注</span>
            </button>
            <button class="main-action-btn view-btn" id="view-shared-btn">
              <span class="btn-icon">👥</span>
              <span class="btn-text">查看共享标注</span>
            </button>
          </div>
          <div id="researchopia-panel-content">
            <div class="welcome-message">
              <div class="welcome-title">欢迎使用 Researchopia</div>
              <div class="welcome-desc">
                当前论文: <strong>${this.escapeHtml(item.getDisplayTitle())}</strong><br>
                DOI: <strong>${this.escapeHtml(doi)}</strong><br>
                点击上方按钮开始使用标注分享功能
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 添加事件监听器
    const extractBtn = body.querySelector("#extract-annotations-btn") as HTMLButtonElement;
    const shareBtn = body.querySelector("#share-annotations-btn") as HTMLButtonElement;
    const viewBtn = body.querySelector("#view-shared-btn") as HTMLButtonElement;

    if (extractBtn) {
      extractBtn.addEventListener("click", () => {
        ztoolkit.log("Extract annotations button clicked");
        this.extractMyAnnotations();
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        ztoolkit.log("Share annotations button clicked");
        this.shareMyAnnotations();
      });
    }

    if (viewBtn) {
      viewBtn.addEventListener("click", () => {
        ztoolkit.log("View shared annotations button clicked");
        this.viewSharedAnnotations();
      });
    }

    ztoolkit.log("UIManager: Main interface rendered with event listeners");
  }

  /**
   * Initialize Item Pane section
   */
  private static initItemPane(doc: Document, body: HTMLElement) {
    ztoolkit.log("Researchopia: Item pane section initialized");
    
    // Don't immediately update content - wait for item selection
    // Set initial empty state
    const contentEl = doc.getElementById("researchopia-content");
    if (contentEl) {
      contentEl.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-title">Researchopia 标注分享</div>
          <div class="welcome-desc">请选择一篇论文开始使用</div>
        </div>
      `;
    }
  }

  /**
   * Clean up Item Pane section
   */
  private static destroyItemPane() {
    ztoolkit.log("Destroying Item Pane section");
    this.currentItem = null;
  }

  /**
   * Handle item selection changes
   */
  static async handleItemSelection(itemIds: Array<string | number>) {
    ztoolkit.log("Researchopia: handleItemSelection called with:", itemIds);
    
    if (!itemIds || itemIds.length === 0) {
      this.currentItem = null;
      ztoolkit.log("Researchopia: No items selected, clearing current item");
      return;
    }

    try {
      const itemId = Number(itemIds[0]);
      const item = Zotero.Items.get(itemId);
      
      ztoolkit.log("Researchopia: Item retrieved:", item?.getDisplayTitle?.() || "Unknown");
      
      if (item && item.isRegularItem()) {
        this.currentItem = item;
        ztoolkit.log("Researchopia: Item changed to:", item.getDisplayTitle());
        await this.updateItemPaneForCurrentItem();
        ztoolkit.log("Researchopia: Item pane updated for current item");
      } else {
        this.currentItem = null;
        ztoolkit.log("Researchopia: Item is not a regular item, clearing current item");
      }
      
    } catch (error) {
      ztoolkit.log("Researchopia: Error handling item selection:", error);
    }
  }

  /**
   * Update Item Pane content for current item
   */
  private static async updateItemPaneForCurrentItem() {
    ztoolkit.log("Researchopia: updateItemPaneForCurrentItem called");
    
    // Try multiple ways to find the item pane document
    let itemPaneDoc = this.getItemPaneDocument();
    
    if (!itemPaneDoc) {
      // Try to find document with our elements
      const windows = Zotero.getMainWindows();
      for (const win of windows) {
        const doc = win.document;
        if (doc.getElementById("researchopia-content")) {
          itemPaneDoc = doc;
          break;
        }
      }
    }
    
    if (!itemPaneDoc) {
      ztoolkit.log("Researchopia: Could not find item pane document");
      return;
    }
    
    ztoolkit.log("Researchopia: Found item pane document, updating content");
    await this.updateItemPaneContent(itemPaneDoc);
  }

  /**
   * Update Item Pane content
   */
  private static async updateItemPaneContent(doc: Document) {
    ztoolkit.log("Researchopia: updateItemPaneContent called");
    
    const contentEl = doc.getElementById("researchopia-content");
    if (!contentEl) {
      ztoolkit.log("Researchopia: Content element not found");
      return;
    }

    const statusEl = doc.getElementById("researchopia-status");
    if (statusEl) {
      const isLoggedIn = AuthManager.isLoggedIn();
      statusEl.textContent = isLoggedIn ? "在线" : "离线";
      statusEl.className = `researchopia-status ${isLoggedIn ? "" : "offline"}`;
      ztoolkit.log("Researchopia: Status updated:", isLoggedIn ? "在线" : "离线");
    }

    if (!this.currentItem) {
      ztoolkit.log("Researchopia: No current item, showing default message");
      contentEl.innerHTML = `
        <div class="loading-spinner">
          <span>请选择有DOI的论文以查看共享标注</span>
        </div>
      `;
      return;
    }

    const doi = this.currentItem.getField("DOI");
    ztoolkit.log("Researchopia: Current item DOI:", doi);
    
    if (!doi) {
      ztoolkit.log("Researchopia: No DOI found, showing error message");
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">未找到DOI</div>
          <div class="empty-state-desc">此论文需要DOI号才能访问共享标注功能</div>
        </div>
      `;
      return;
    }

    ztoolkit.log("Researchopia: Rendering enhanced item pane for item:", this.currentItem.getDisplayTitle());
    
    // 显示主要功能按钮界面
    contentEl.innerHTML = `
      <div class="researchopia-main-panel">
        <div class="action-buttons">
          <button class="main-action-btn extract-btn" onclick="window.extractMyAnnotations()">
            <span class="btn-icon">📝</span>
            <span class="btn-text">提取我的标注</span>
          </button>
          <button class="main-action-btn share-btn" onclick="window.shareMyAnnotations()" ${!AuthManager.isLoggedIn() ? 'disabled' : ''}>
            <span class="btn-icon">🚀</span>
            <span class="btn-text">共享我的标注</span>
          </button>
          <button class="main-action-btn view-btn" onclick="window.viewSharedAnnotations()">
            <span class="btn-icon">👥</span>
            <span class="btn-text">查看共享标注</span>
          </button>
        </div>
        <div id="researchopia-panel-content">
          <div class="welcome-message">
            <div class="welcome-title">欢迎使用 Researchopia</div>
            <div class="welcome-desc">
              当前论文DOI: <strong>${this.escapeHtml(doi)}</strong><br>
              点击上方按钮开始使用标注分享功能
            </div>
          </div>
        </div>
      </div>
    `;

    ztoolkit.log("Researchopia: Enhanced item pane content rendered successfully");

    // 绑定功能函数到window对象
    const win = doc.defaultView as any;
    win.extractMyAnnotations = () => {
      ztoolkit.log("Researchopia: Extract annotations clicked");
      this.extractMyAnnotations();
    };
    win.shareMyAnnotations = () => {
      ztoolkit.log("Researchopia: Share annotations clicked");
      this.shareMyAnnotations();
    };
    win.viewSharedAnnotations = () => {
      ztoolkit.log("Researchopia: View shared annotations clicked");
      this.viewSharedAnnotations();
    };
    
    ztoolkit.log("Researchopia: Button event handlers bound to window");
  }

  /**
   * Render annotations list HTML
   */
  private static renderAnnotationsList(annotations: SharedAnnotation[], doc: Document): string {
    const annotationsHtml = annotations.map(annotation => `
      <div class="annotation-item" data-annotation-id="${annotation.id}">
        ${annotation.annotation_text ? `
          <div class="annotation-text">${this.escapeHtml(annotation.annotation_text)}</div>
        ` : ''}
        ${annotation.annotation_comment ? `
          <div class="annotation-comment">${this.escapeHtml(annotation.annotation_comment)}</div>
        ` : ''}
        <div class="annotation-meta">
          <span class="annotation-author">${this.escapeHtml(annotation.user_name || "Anonymous")}</span>
          <div class="annotation-actions">
            ${AuthManager.isLoggedIn() ? `
              <button class="action-btn like-btn ${annotation.is_liked ? "liked" : ""}" 
                      onclick="window.toggleLike('${annotation.id}')">
                👍 ${annotation.likes_count || 0}
              </button>
              <button class="action-btn comment-btn" 
                      onclick="window.showComments('${annotation.id}')">
                💬 ${annotation.comments_count || 0}
              </button>
              ${annotation.user_id !== AuthManager.getCurrentUser()?.id ? `
                <button class="action-btn follow-btn ${annotation.is_following_author ? "followed" : ""}" 
                        onclick="window.toggleFollow('${annotation.user_id}')">
                  ${annotation.is_following_author ? "Following" : "Follow"}
                </button>
              ` : ''}
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Expose action functions to window
    const win = doc.defaultView as any;
    win.toggleLike = async (annotationId: string) => {
      await this.toggleAnnotationLike(annotationId);
    };
    win.showComments = async (annotationId: string) => {
      await this.showAnnotationComments(annotationId);
    };
    win.toggleFollow = async (userId: string) => {
      await this.toggleUserFollow(userId);
    };

    return `
      <div class="annotation-list">
        ${annotationsHtml}
      </div>
      ${AuthManager.isLoggedIn() ? `
        <div style="margin-top: 12px; text-align: center;">
          <button class="share-btn" onclick="window.shareCurrentAnnotations()">
            Share My Annotations
          </button>
        </div>
      ` : ''}
    `;
  }

  /**
   * Share annotations for current item
   */
  private static async shareCurrentItemAnnotations() {
    if (!this.currentItem) return;

    try {
      const success = await AnnotationManager.uploadAnnotations(this.currentItem.id);
      if (success) {
        ztoolkit.log("Annotations shared successfully");
        // Refresh the display
        await this.updateItemPaneForCurrentItem();
      } else {
        ztoolkit.log("Failed to share annotations");
      }
    } catch (error) {
      ztoolkit.log("Error sharing annotations:", error);
    }
  }

  /**
   * 提取我的标注功能
   */
  private static async extractMyAnnotations() {
    if (!this.currentItem) return;

    const doi = this.currentItem.getField("DOI");
    if (!doi) return;

    const contentEl = document.getElementById("researchopia-panel-content");
    if (!contentEl) return;

    try {
      contentEl.innerHTML = `
        <div class="loading-spinner">
          <span>正在提取标注...</span>
        </div>
      `;

      // 获取当前论文的所有标注
      const annotations = await AnnotationManager.getCurrentItemAnnotations();
      
      if (annotations.length === 0) {
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">未找到标注</div>
            <div class="empty-state-desc">此论文尚无标注，请先在PDF阅读器中添加标注</div>
          </div>
        `;
        return;
      }

      // 渲染标注列表（带选择框）
      contentEl.innerHTML = `
        <div class="annotations-extract">
          <div class="extract-header">
            <h3>我的标注 (${annotations.length} 条)</h3>
            <div class="extract-actions">
              <button class="select-all-btn" onclick="window.selectAllAnnotations(true)">全选</button>
              <button class="select-none-btn" onclick="window.selectAllAnnotations(false)">清空</button>
              <button class="back-btn" onclick="window.backToMain()">返回</button>
            </div>
          </div>
          <div class="annotations-list">
            ${annotations.map((ann, index) => `
              <div class="annotation-item">
                <div class="annotation-checkbox">
                  <input type="checkbox" id="ann-${index}" checked>
                </div>
                <div class="annotation-content">
                  <div class="annotation-text">${this.escapeHtml(ann.text)}</div>
                  <div class="annotation-meta">
                    ${ann.comment ? `<div class="annotation-comment">${this.escapeHtml(ann.comment)}</div>` : ''}
                    <div class="annotation-info">页码: ${ann.page || '未知'} | 类型: ${this.getAnnotationTypeText(ann.type)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 绑定功能函数
      const win = document.defaultView as any;
      win.selectAllAnnotations = (selectAll: boolean) => {
        const checkboxes = document.querySelectorAll('#researchopia-panel-content input[type="checkbox"]');
        checkboxes.forEach((cb: any) => cb.checked = selectAll);
      };
      win.backToMain = () => this.updateItemPaneContent(document);

    } catch (error) {
      ztoolkit.log("Error extracting annotations:", error);
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">提取失败</div>
          <div class="empty-state-desc">无法提取标注，请重试</div>
          <button class="back-btn" onclick="window.backToMain()">返回</button>
        </div>
      `;
      (document.defaultView as any).backToMain = () => this.updateItemPaneContent(document);
    }
  }

  /**
   * 共享我的标注功能
   */
  private static async shareMyAnnotations() {
    if (!AuthManager.isLoggedIn()) {
      this.showMessage("请先登录后再共享标注", "warning");
      return;
    }

    if (!this.currentItem) return;

    const doi = this.currentItem.getField("DOI");
    if (!doi) return;

    const contentEl = document.getElementById("researchopia-panel-content");
    if (!contentEl) return;

    try {
      contentEl.innerHTML = `
        <div class="loading-spinner">
          <span>正在获取标注...</span>
        </div>
      `;

      // 获取当前论文的所有标注
      const annotations = await AnnotationManager.getCurrentItemAnnotations();
      
      if (annotations.length === 0) {
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">未找到标注</div>
            <div class="empty-state-desc">此论文尚无标注，请先在PDF阅读器中添加标注</div>
            <button class="back-btn" onclick="window.backToMain()">返回</button>
          </div>
        `;
        (document.defaultView as any).backToMain = () => this.updateItemPaneContent(document);
        return;
      }

      // 渲染标注选择界面
      contentEl.innerHTML = `
        <div class="annotations-share">
          <div class="share-header">
            <h3>选择要共享的标注</h3>
            <div class="share-actions">
              <button class="select-all-btn" onclick="window.selectAllAnnotations(true)">全选</button>
              <button class="select-none-btn" onclick="window.selectAllAnnotations(false)">清空</button>
              <button class="share-selected-btn" onclick="window.shareSelectedAnnotations()">共享所选</button>
              <button class="back-btn" onclick="window.backToMain()">返回</button>
            </div>
          </div>
          <div class="annotations-list">
            ${annotations.map((ann, index) => `
              <div class="annotation-item">
                <div class="annotation-checkbox">
                  <input type="checkbox" id="share-ann-${index}" checked>
                </div>
                <div class="annotation-content">
                  <div class="annotation-text">${this.escapeHtml(ann.text)}</div>
                  <div class="annotation-meta">
                    ${ann.comment ? `<div class="annotation-comment">${this.escapeHtml(ann.comment)}</div>` : ''}
                    <div class="annotation-info">页码: ${ann.page || '未知'} | 类型: ${this.getAnnotationTypeText(ann.type)}</div>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 绑定功能函数
      const win = document.defaultView as any;
      win.selectAllAnnotations = (selectAll: boolean) => {
        const checkboxes = document.querySelectorAll('#researchopia-panel-content input[type="checkbox"]');
        checkboxes.forEach((cb: any) => cb.checked = selectAll);
      };
      win.shareSelectedAnnotations = async () => {
        const checkboxes = document.querySelectorAll('#researchopia-panel-content input[type="checkbox"]:checked');
        const selectedAnnotations = Array.from(checkboxes).map((cb: any) => {
          const index = parseInt(cb.id.replace('share-ann-', ''));
          return annotations[index];
        });

        if (selectedAnnotations.length === 0) {
          this.showMessage("请至少选择一条标注", "warning");
          return;
        }

        try {
          contentEl.innerHTML = `
            <div class="loading-spinner">
              <span>正在共享标注...</span>
            </div>
          `;

          await AnnotationManager.shareAnnotations([this.currentItem!.id]);
          
          contentEl.innerHTML = `
            <div class="success-state">
              <div class="success-title">✅ 共享成功</div>
              <div class="success-desc">已成功共享 ${selectedAnnotations.length} 条标注</div>
              <button class="back-btn" onclick="window.backToMain()">返回主面板</button>
            </div>
          `;
          
          this.showMessage(`成功共享 ${selectedAnnotations.length} 条标注`, "success");
          
        } catch (error) {
          ztoolkit.log("Error sharing annotations:", error);
          this.showMessage("共享失败，请重试", "error");
          contentEl.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-title">共享失败</div>
              <div class="empty-state-desc">无法共享标注，请检查网络连接后重试</div>
              <button class="back-btn" onclick="window.backToMain()">返回</button>
            </div>
          `;
        }
      };
      win.backToMain = () => this.updateItemPaneContent(document);

    } catch (error) {
      ztoolkit.log("Error preparing share:", error);
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">获取标注失败</div>
          <div class="empty-state-desc">无法获取标注，请重试</div>
          <button class="back-btn" onclick="window.backToMain()">返回</button>
        </div>
      `;
      (document.defaultView as any).backToMain = () => this.updateItemPaneContent(document);
    }
  }

  /**
   * 查看共享标注功能
   */
  private static async viewSharedAnnotations() {
    if (!this.currentItem) return;

    const doi = this.currentItem.getField("DOI");
    if (!doi) return;

    const contentEl = document.getElementById("researchopia-panel-content");
    if (!contentEl) return;

    try {
      contentEl.innerHTML = `
        <div class="loading-spinner">
          <span>正在加载共享标注...</span>
        </div>
      `;

      // 获取共享标注
      const annotations = await AnnotationManager.fetchSharedAnnotations(doi);
      
      if (annotations.length === 0) {
        contentEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-title">暂无共享标注</div>
            <div class="empty-state-desc">成为第一个为此论文共享标注的用户！</div>
            <button class="back-btn" onclick="window.backToMain()">返回</button>
          </div>
        `;
        (document.defaultView as any).backToMain = () => this.updateItemPaneContent(document);
        return;
      }

      // 渲染共享标注列表
      contentEl.innerHTML = `
        <div class="shared-annotations">
          <div class="shared-header">
            <h3>共享标注 (${annotations.length} 条)</h3>
            <button class="back-btn" onclick="window.backToMain()">返回</button>
          </div>
          <div class="annotations-list">
            ${annotations.map(ann => `
              <div class="shared-annotation-item" data-annotation-id="${ann.id}">
                <div class="annotation-content">
                  <div class="annotation-text">${this.escapeHtml(ann.annotation_text)}</div>
                  ${ann.annotation_comment ? `<div class="annotation-comment">${this.escapeHtml(ann.annotation_comment)}</div>` : ''}
                  <div class="annotation-meta">
                    <span class="annotation-author">@${this.escapeHtml(ann.user_name || '匿名用户')}</span>
                    <span class="annotation-time">${this.formatTime(ann.created_at)}</span>
                    <span class="annotation-page">页码: ${ann.page_number || '未知'}</span>
                  </div>
                  <div class="annotation-actions">
                    <button class="like-btn ${ann.is_liked ? 'liked' : ''}" onclick="window.toggleLike('${ann.id}')">
                      ❤️ ${ann.likes_count || 0}
                    </button>
                    <button class="comment-btn" onclick="window.toggleComments('${ann.id}')">
                      💬 ${ann.comments_count || 0}
                    </button>
                  </div>
                </div>
                <div class="comments-section" id="comments-${ann.id}" style="display: none;">
                  <div class="comments-list">
                    <!-- 评论将在点击时动态加载 -->
                  </div>
                  ${AuthManager.isLoggedIn() ? `
                    <div class="comment-input">
                      <textarea placeholder="添加评论..." rows="2"></textarea>
                      <button onclick="window.addComment('${ann.id}')">发表</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 绑定功能函数
      const win = document.defaultView as any;
      win.backToMain = () => this.updateItemPaneContent(document);
      win.toggleLike = (annotationId: string) => this.toggleLike(annotationId);
      win.toggleComments = (annotationId: string) => this.toggleComments(annotationId);
      win.addComment = (annotationId: string) => this.addComment(annotationId);

    } catch (error) {
      ztoolkit.log("Error loading shared annotations:", error);
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">加载失败</div>
          <div class="empty-state-desc">无法加载共享标注，请检查网络连接后重试</div>
          <button class="back-btn" onclick="window.backToMain()">返回</button>
        </div>
      `;
      (document.defaultView as any).backToMain = () => this.updateItemPaneContent(document);
    }
  }

  /**
   * 获取标注类型文本
   */
  private static getAnnotationTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      'highlight': '高亮',
      'note': '笔记',
      'underline': '下划线',
      'strikethrough': '删除线',
      'square': '方框',
      'ink': '手绘'
    };
    return typeMap[type] || '其他';
  }

  /**
   * 显示消息
   */
  private static showMessage(message: string, type: "success" | "error" | "warning" | "info" = "info") {
    // 在Zotero中显示消息
    const progressWindow = new Zotero.ProgressWindow({ closeOnClick: true });
    progressWindow.changeHeadline(`Researchopia - ${type}`);
    progressWindow.addDescription(message);
    progressWindow.show();
    progressWindow.startCloseTimer(3000);
  }

  /**
   * 格式化时间
   */
  private static formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
      if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
      
      return date.toLocaleDateString('zh-CN');
    } catch {
      return '未知时间';
    }
  }

  /**
   * 切换点赞状态
   */
  private static async toggleLike(annotationId: string) {
    if (!AuthManager.isLoggedIn()) {
      this.showMessage("请先登录", "warning");
      return;
    }

    try {
      await AnnotationManager.toggleLike(annotationId);
      this.showMessage("操作成功", "success");
      // 刷新显示
      this.viewSharedAnnotations();
    } catch (error) {
      ztoolkit.log("Error toggling like:", error);
      this.showMessage("操作失败", "error");
    }
  }

  /**
   * 切换评论显示
   */
  private static async toggleComments(annotationId: string) {
    const commentsSection = document.getElementById(`comments-${annotationId}`);
    if (!commentsSection) return;

    if (commentsSection.style.display === 'none') {
      commentsSection.style.display = 'block';
      
      // 加载评论
      try {
        const comments = await AnnotationManager.getComments(annotationId);
        const commentsList = commentsSection.querySelector('.comments-list');
        if (commentsList) {
          commentsList.innerHTML = comments.map(comment => `
            <div class="comment-item">
              <div class="comment-author">@${comment.user_name || '匿名用户'}</div>
              <div class="comment-text">${this.escapeHtml(comment.comment_text)}</div>
              <div class="comment-time">${this.formatTime(comment.created_at)}</div>
            </div>
          `).join('');
        }
      } catch (error) {
        ztoolkit.log("Error loading comments:", error);
      }
    } else {
      commentsSection.style.display = 'none';
    }
  }

  /**
   * 添加评论
   */
  private static async addComment(annotationId: string) {
    if (!AuthManager.isLoggedIn()) {
      this.showMessage("请先登录", "warning");
      return;
    }

    const commentsSection = document.getElementById(`comments-${annotationId}`);
    if (!commentsSection) return;

    const textarea = commentsSection.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim()) {
      this.showMessage("请输入评论内容", "warning");
      return;
    }

    try {
      await AnnotationManager.addComment(annotationId, textarea.value.trim());
      textarea.value = '';
      this.showMessage("评论成功", "success");
      
      // 刷新评论
      this.toggleComments(annotationId);
      this.toggleComments(annotationId);
    } catch (error) {
      ztoolkit.log("Error adding comment:", error);
      this.showMessage("评论失败", "error");
    }
  }

  /**
   * Toggle like for annotation
   */
  private static async toggleAnnotationLike(annotationId: string) {
    try {
      // This would check current like status and toggle accordingly
      // For now, we'll assume it's a like action
      const success = await AnnotationManager.likeAnnotation(annotationId);
      if (success) {
        await this.updateItemPaneForCurrentItem();
      }
    } catch (error) {
      ztoolkit.log("Error toggling like:", error);
    }
  }

  /**
   * Show comments for annotation
   */
  private static async showAnnotationComments(annotationId: string) {
    try {
      const comments = await AnnotationManager.getAnnotationComments(annotationId);
      ztoolkit.log("Comments for annotation:", comments);
      // TODO: Show comments in a dialog or expand in place
    } catch (error) {
      ztoolkit.log("Error showing comments:", error);
    }
  }

  /**
   * Toggle follow for user
   */
  private static async toggleUserFollow(userId: string) {
    try {
      // This would check current follow status and toggle accordingly
      const success = await AnnotationManager.followUser(userId);
      if (success) {
        await this.updateItemPaneForCurrentItem();
      }
    } catch (error) {
      ztoolkit.log("Error toggling follow:", error);
    }
  }

  /**
   * Get Item Pane document
   */
  private static getItemPaneDocument(): Document | null {
    try {
      const zoteroPane = Zotero.getActiveZoteroPane();
      const itemPaneDoc = zoteroPane?.document;
      return itemPaneDoc || null;
    } catch {
      return null;
    }
  }

  /**
   * Escape HTML for safe rendering
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Register reader UI components (placeholder for now)
   */
  static async registerReaderUI() {
    ztoolkit.log("Reader UI registration - placeholder implementation");
    // TODO: Implement reader integration for real-time annotation display
  }
}
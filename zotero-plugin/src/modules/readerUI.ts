import { AnnotationManager, SharedAnnotation } from "./annotations";
import { AuthManager } from "./auth";
import { DataTransform } from "../utils/dataTransform";

export class ReaderUIManager {
  private static overlayElements = new Map<string, HTMLElement>();
  private static currentDOI: string | null = null;
  private static currentAnnotations: SharedAnnotation[] = [];
  private static isInitialized = false;

  static initialize() {
    ztoolkit.log("ReaderUIManager initialized");
    this.registerReaderEvents();
  }

  static registerReaderEvents() {
    // Register event listener for when reader toolbar is rendered
    // @ts-expect-error - Reader API exists in Zotero 8
    Zotero.Reader.registerEventListener(
      "renderToolbar",
      (event) => this.onReaderToolbarRender(event),
      addon.data.config.addonID
    );

    // Handle existing readers
    // @ts-expect-error - Reader API exists in Zotero 8
    Zotero.Reader._readers.forEach((reader) => {
      this.onReaderToolbarRender({ reader });
    });

    this.isInitialized = true;
  }

  static async onReaderToolbarRender(event: { reader: any }) {
    const reader = event.reader;
    if (!reader) return;

    try {
      // Wait for reader to be fully initialized
      await this.waitForReader(reader);
      
      // Get the item and DOI
      const item = await reader.getItem();
      if (!item) return;

      const doi = item.getField("DOI");
      if (!doi) {
        ztoolkit.log("No DOI found for item, skipping reader UI injection");
        return;
      }

      this.currentDOI = doi;
      
      // Inject our UI into the reader
      await this.injectReaderUI(reader, doi);
      
      // Load shared annotations
      await this.loadSharedAnnotations(doi);
      
    } catch (error) {
      ztoolkit.log("Error in reader toolbar render:", error);
    }
  }

  static async waitForReader(reader: any): Promise<void> {
    // Wait for reader initialization
    await reader._initPromise;
    
    // Wait for iframe window to be available
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!reader._iframeWindow && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!reader._iframeWindow) {
      throw new Error("Reader iframe window not available");
    }
  }

  static async injectReaderUI(reader: any, doi: string) {
    const iframeWindow = reader._iframeWindow;
    const iframeDocument = iframeWindow.document;
    
    // Check if already injected
    if (iframeDocument.querySelector("#researchopia-reader-overlay")) {
      return;
    }

    // Create overlay container
    const overlay = iframeDocument.createElement("div");
    overlay.id = "researchopia-reader-overlay";
    overlay.innerHTML = `
      <div id="researchopia-reader-panel" class="researchopia-reader-panel collapsed">
        <div class="panel-header">
          <button id="toggle-panel" class="toggle-btn" title="Toggle Shared Annotations">
            📝 <span class="annotation-count">0</span>
          </button>
        </div>
        <div class="panel-content">
          <div class="panel-title">Shared Annotations</div>
          <div class="panel-controls">
            <input type="text" id="reader-search" placeholder="Search annotations..." />
            <select id="reader-filter">
              <option value="all">All Pages</option>
              <option value="current">Current Page</option>
              <option value="following">Following Only</option>
            </select>
          </div>
          <div id="reader-annotations-list" class="annotations-list">
            Loading...
          </div>
        </div>
      </div>
    `;

    // Add CSS styles
    const style = iframeDocument.createElement("style");
    style.textContent = this.getReaderCSS();
    iframeDocument.head.appendChild(style);

    // Append overlay to body
    iframeDocument.body.appendChild(overlay);

    // Add event listeners
    this.addReaderEventListeners(iframeDocument, reader);

    // Store reference
    this.overlayElements.set(reader.itemID, overlay);
  }

  static addReaderEventListeners(doc: Document, reader: any) {
    // Toggle panel
    const toggleBtn = doc.querySelector("#toggle-panel");
    const panel = doc.querySelector("#researchopia-reader-panel");
    
    toggleBtn?.addEventListener("click", () => {
      panel?.classList.toggle("collapsed");
    });

    // Search functionality
    const searchInput = doc.querySelector("#reader-search") as HTMLInputElement;
    searchInput?.addEventListener("input", () => {
      this.filterAnnotations(doc, searchInput.value);
    });

    // Filter functionality
    const filterSelect = doc.querySelector("#reader-filter") as HTMLSelectElement;
    filterSelect?.addEventListener("change", () => {
      this.filterAnnotations(doc, searchInput?.value || "", filterSelect.value);
    });

    // Listen for page changes
    reader.addEventListener?.("pagechange", (event: any) => {
      this.onPageChange(doc, event.pageIndex);
    });

    // Listen for scroll events to highlight relevant annotations
    const viewerContainer = doc.querySelector(".viewer");
    viewerContainer?.addEventListener("scroll", () => {
      this.updateVisibleAnnotations(doc, reader);
    });
  }

  static async loadSharedAnnotations(doi: string) {
    try {
      this.currentAnnotations = await AnnotationManager.fetchSharedAnnotations(doi);
      this.updateAllReaderPanels();
    } catch (error) {
      ztoolkit.log("Error loading shared annotations for reader:", error);
    }
  }

  static updateAllReaderPanels() {
    this.overlayElements.forEach((overlay, itemID) => {
      const doc = overlay.ownerDocument;
      this.renderAnnotationsList(doc);
      this.updateAnnotationCount(doc);
    });
  }

  static renderAnnotationsList(doc: Document) {
    const listContainer = doc.querySelector("#reader-annotations-list");
    if (!listContainer) return;

    if (this.currentAnnotations.length === 0) {
      listContainer.innerHTML = `
        <div class="no-annotations">
          <div class="no-annotations-text">No shared annotations found</div>
        </div>
      `;
      return;
    }

    // Group annotations by page
    const groupedAnnotations = DataTransform.groupByPage(this.currentAnnotations);
    
    let html = "";
    groupedAnnotations.forEach((annotations, pageNumber) => {
      html += `
        <div class="page-group" data-page="${pageNumber}">
          <div class="page-header">Page ${pageNumber || "Unknown"}</div>
          <div class="page-annotations">
      `;
      
      annotations.forEach(annotation => {
        html += this.renderReaderAnnotationItem(annotation);
      });
      
      html += `
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
    this.addAnnotationEventListeners(doc);
  }

  static renderReaderAnnotationItem(annotation: SharedAnnotation): string {
    const timeAgo = this.getTimeAgo(new Date(annotation.created_at));
    
    return `
      <div class="reader-annotation-item" data-id="${annotation.id}" data-page="${annotation.page_number}">
        <div class="annotation-header">
          <span class="author">${annotation.user_name}</span>
          <span class="time">${timeAgo}</span>
          ${annotation.quality_score > 20 ? '<span class="quality-badge">⭐</span>' : ''}
        </div>
        <div class="annotation-content">
          ${annotation.annotation_text ? `
            <div class="annotation-text" style="border-left-color: ${annotation.annotation_color}">
              "${this.escapeHtml(annotation.annotation_text)}"
            </div>
          ` : ''}
          ${annotation.annotation_comment ? `
            <div class="annotation-comment">
              ${this.escapeHtml(annotation.annotation_comment)}
            </div>
          ` : ''}
        </div>
        <div class="annotation-actions">
          <button class="like-btn ${annotation.is_liked ? 'liked' : ''}" data-id="${annotation.id}">
            ${annotation.is_liked ? '❤️' : '👍'} ${annotation.likes_count}
          </button>
          <button class="goto-btn" data-page="${annotation.page_number}" title="Go to page">
            📍
          </button>
        </div>
      </div>
    `;
  }

  static addAnnotationEventListeners(doc: Document) {
    // Like buttons
    doc.querySelectorAll(".like-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const annotationId = target.dataset.id;
        
        if (!annotationId || !AuthManager.isLoggedIn()) return;

        const isLiked = target.classList.contains("liked");
        const success = isLiked ? 
          await AnnotationManager.unlikeAnnotation(annotationId) :
          await AnnotationManager.likeAnnotation(annotationId);

        if (success) {
          target.classList.toggle("liked");
          const countMatch = target.textContent?.match(/\d+/);
          if (countMatch) {
            const currentCount = parseInt(countMatch[0]);
            const newCount = isLiked ? currentCount - 1 : currentCount + 1;
            target.innerHTML = `${isLiked ? '👍' : '❤️'} ${newCount}`;
          }
        }
      });
    });

    // Go to page buttons
    doc.querySelectorAll(".goto-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const pageNumber = parseInt(target.dataset.page || "0");
        if (pageNumber > 0) {
          this.goToPage(doc, pageNumber);
        }
      });
    });
  }

  static filterAnnotations(doc: Document, searchText: string = "", filter: string = "all") {
    const annotations = doc.querySelectorAll(".reader-annotation-item");
    const currentPage = this.getCurrentPage(doc);

    annotations.forEach(annotation => {
      const element = annotation as HTMLElement;
      const annotationPage = parseInt(element.dataset.page || "0");
      const text = element.textContent?.toLowerCase() || "";
      const searchMatch = !searchText || text.includes(searchText.toLowerCase());
      
      let filterMatch = true;
      if (filter === "current" && currentPage > 0) {
        filterMatch = annotationPage === currentPage;
      } else if (filter === "following") {
        filterMatch = element.querySelector(".author")?.classList.contains("following") || false;
      }

      element.style.display = searchMatch && filterMatch ? "block" : "none";
    });

    // Hide empty page groups
    doc.querySelectorAll(".page-group").forEach(group => {
      const visibleAnnotations = group.querySelectorAll(".reader-annotation-item[style*='block'], .reader-annotation-item:not([style*='none'])");
      (group as HTMLElement).style.display = visibleAnnotations.length > 0 ? "block" : "none";
    });
  }

  static updateAnnotationCount(doc: Document) {
    const countElement = doc.querySelector(".annotation-count");
    if (countElement) {
      countElement.textContent = this.currentAnnotations.length.toString();
    }
  }

  static onPageChange(doc: Document, pageIndex: number) {
    // Highlight annotations for current page
    const currentPageAnnotations = doc.querySelectorAll(`[data-page="${pageIndex + 1}"]`);
    
    // Remove previous highlights
    doc.querySelectorAll(".reader-annotation-item.current-page").forEach(el => {
      el.classList.remove("current-page");
    });

    // Add current page highlight
    currentPageAnnotations.forEach(el => {
      el.classList.add("current-page");
    });
  }

  static updateVisibleAnnotations(doc: Document, reader: any) {
    // TODO: Implement logic to show annotations based on visible content
    // This would require more complex integration with the PDF viewer
  }

  static getCurrentPage(doc: Document): number {
    // Try to get current page from PDF viewer
    // This is a simplified implementation
    const pageInput = doc.querySelector('input[type="number"]') as HTMLInputElement;
    return pageInput ? parseInt(pageInput.value) : 1;
  }

  static goToPage(doc: Document, pageNumber: number) {
    // Navigate to specific page
    const pageInput = doc.querySelector('input[type="number"]') as HTMLInputElement;
    if (pageInput) {
      pageInput.value = pageNumber.toString();
      pageInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Utility methods
  static getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  }

  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static getReaderCSS(): string {
    return `
      .researchopia-reader-panel {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 350px;
        max-height: calc(100vh - 100px);
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        transition: transform 0.3s ease;
      }

      .researchopia-reader-panel.collapsed {
        transform: translateX(calc(100% - 50px));
      }

      .panel-header {
        padding: 12px;
        border-bottom: 1px solid #eee;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
      }

      .toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .toggle-btn:hover {
        background: #e9ecef;
      }

      .annotation-count {
        background: #007acc;
        color: white;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
      }

      .panel-content {
        max-height: calc(100vh - 200px);
        overflow-y: auto;
      }

      .panel-title {
        padding: 12px;
        font-weight: 600;
        color: #333;
        border-bottom: 1px solid #eee;
      }

      .panel-controls {
        padding: 12px;
        display: flex;
        gap: 8px;
        border-bottom: 1px solid #eee;
      }

      .panel-controls input {
        flex: 1;
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
      }

      .panel-controls select {
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
      }

      .annotations-list {
        padding: 8px;
      }

      .page-group {
        margin-bottom: 16px;
      }

      .page-header {
        font-weight: 600;
        color: #666;
        font-size: 11px;
        text-transform: uppercase;
        padding: 8px 0 4px 0;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 8px;
      }

      .reader-annotation-item {
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        background: #fafafa;
        transition: all 0.2s ease;
      }

      .reader-annotation-item:hover {
        border-color: #007acc;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .reader-annotation-item.current-page {
        border-color: #28a745;
        background: #f8fff9;
      }

      .annotation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
      }

      .author {
        font-weight: 600;
        color: #007acc;
      }

      .time {
        color: #666;
      }

      .quality-badge {
        font-size: 10px;
      }

      .annotation-text {
        border-left: 3px solid #ffff00;
        padding-left: 8px;
        margin-bottom: 6px;
        font-style: italic;
        color: #333;
      }

      .annotation-comment {
        color: #555;
        line-height: 1.4;
      }

      .annotation-actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
      }

      .annotation-actions button {
        padding: 4px 8px;
        border: 1px solid #ddd;
        border-radius: 3px;
        background: #f8f9fa;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.2s;
      }

      .annotation-actions button:hover {
        background: #e9ecef;
        transform: translateY(-1px);
      }

      .like-btn.liked {
        background: #ffe6e6;
        color: #d63384;
        border-color: #f8d7da;
      }

      .goto-btn {
        background: #e3f2fd;
        color: #1565c0;
        border-color: #bbdefb;
      }

      .no-annotations {
        text-align: center;
        padding: 32px 16px;
        color: #666;
      }

      .no-annotations-text {
        font-style: italic;
      }
    `;
  }

  static cleanup() {
    this.overlayElements.clear();
    this.currentAnnotations = [];
    this.currentDOI = null;
  }
}

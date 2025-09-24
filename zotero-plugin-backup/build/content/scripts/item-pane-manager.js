/**
 * Researchopia Item Pane Manager
 * 管理Zotero右侧Item Pane中的Researchopia面板
 */

class ItemPaneManager {
  constructor() {
    this.sectionId = 'researchopia-section';
    this.isRegistered = false;
    this.currentItem = null;
    this.baseURL = 'https://www.researchopia.com';
  }

  /**
   * 注册Item Pane部分
   */
  async register() {
    try {
      if (this.isRegistered) {
        log("Item Pane section already registered");
        return;
      }

      log("Registering Item Pane section...");

      // 注册Item Pane部分
      await Zotero.ItemPaneManager.registerSection({
        paneID: this.sectionId,
        pluginID: 'researchopia@zotero.plugin',
        header: {
          l10nID: 'researchopia-section-header',
          l10nArgs: null
        },
        sizerID: 'researchopia-section-sizer',
        bodyXHTML: this.getBodyHTML(),
        onInit: this.onInit.bind(this),
        onItemChange: this.onItemChange.bind(this),
        onDestroy: this.onDestroy.bind(this)
      });

      this.isRegistered = true;
      log("Item Pane section registered successfully");

    } catch (error) {
      log("Failed to register Item Pane section: " + error.message);
      throw error;
    }
  }

  /**
   * 获取面板HTML内容
   */
  getBodyHTML() {
    return `
      <div id="researchopia-container" class="researchopia-container">
        <div id="researchopia-loading" class="researchopia-loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading Researchopia...</div>
        </div>
        <div id="researchopia-error" class="researchopia-error" style="display: none;">
          <div class="error-icon">⚠️</div>
          <div class="error-text">Failed to load content</div>
          <button id="researchopia-retry" class="retry-button">Retry</button>
        </div>
        <iframe 
          id="researchopia-iframe" 
          class="researchopia-iframe"
          style="display: none;"
          frameborder="0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">
        </iframe>
      </div>
    `;
  }

  /**
   * 面板初始化回调
   */
  onInit(doc, win) {
    log("Item Pane section initialized");
    
    // 设置重试按钮事件
    const retryButton = doc.getElementById('researchopia-retry');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.loadCurrentItem();
      });
    }

    // 如果有当前项目，立即加载
    if (this.currentItem) {
      this.loadItem(this.currentItem);
    }
  }

  /**
   * 项目变更回调
   */
  onItemChange(item) {
    log("Item changed in Researchopia section");
    this.currentItem = item;
    this.loadItem(item);
  }

  /**
   * 面板销毁回调
   */
  onDestroy() {
    log("Item Pane section destroyed");
    this.currentItem = null;
  }

  /**
   * 加载项目到面板
   */
  loadItem(item) {
    if (!item) {
      this.showError("No item selected");
      return;
    }

    try {
      // 提取项目标识符
      const identifiers = this.extractIdentifiers(item);
      log("Extracted identifiers: " + JSON.stringify(identifiers));

      if (!identifiers.doi && !identifiers.arxiv && !identifiers.pmid) {
        this.showError("No DOI, arXiv ID, or PMID found for this item");
        return;
      }

      // 构建URL
      const url = this.buildURL(identifiers);
      log("Loading URL: " + url);

      // 加载到iframe
      this.loadIframe(url);

    } catch (error) {
      log("Error loading item: " + error.message);
      this.showError("Error loading item: " + error.message);
    }
  }

  /**
   * 重新加载当前项目
   */
  loadCurrentItem() {
    if (this.currentItem) {
      this.loadItem(this.currentItem);
    }
  }

  /**
   * 提取项目标识符
   */
  extractIdentifiers(item) {
    const identifiers = {};

    // 提取DOI
    const doi = item.getField('DOI');
    if (doi) {
      identifiers.doi = doi.trim();
    }

    // 提取arXiv ID
    const arxiv = item.getField('archiveID') || item.getField('arXiv');
    if (arxiv) {
      identifiers.arxiv = arxiv.trim();
    }

    // 提取PMID
    const extra = item.getField('extra') || '';
    const pmidMatch = extra.match(/PMID:\s*(\d+)/i);
    if (pmidMatch) {
      identifiers.pmid = pmidMatch[1];
    }

    return identifiers;
  }

  /**
   * 构建Researchopia URL
   */
  buildURL(identifiers) {
    let url = this.baseURL;

    if (identifiers.doi) {
      url += `/papers/doi/${encodeURIComponent(identifiers.doi)}`;
    } else if (identifiers.arxiv) {
      url += `/papers/arxiv/${encodeURIComponent(identifiers.arxiv)}`;
    } else if (identifiers.pmid) {
      url += `/papers/pmid/${encodeURIComponent(identifiers.pmid)}`;
    }

    // 添加嵌入模式参数
    url += '?embed=zotero&source=plugin';

    return url;
  }

  /**
   * 加载iframe
   */
  loadIframe(url) {
    const doc = this.getDocument();
    if (!doc) return;

    const iframe = doc.getElementById('researchopia-iframe');
    const loading = doc.getElementById('researchopia-loading');
    const error = doc.getElementById('researchopia-error');

    if (!iframe) return;

    // 显示加载状态
    this.showLoading();

    // 设置iframe加载事件
    iframe.onload = () => {
      log("Iframe loaded successfully");
      this.showIframe();
    };

    iframe.onerror = () => {
      log("Iframe failed to load");
      this.showError("Failed to load content");
    };

    // 设置超时
    setTimeout(() => {
      if (loading && loading.style.display !== 'none') {
        this.showError("Loading timeout");
      }
    }, 10000);

    // 加载URL
    iframe.src = url;
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    const doc = this.getDocument();
    if (!doc) return;

    const loading = doc.getElementById('researchopia-loading');
    const error = doc.getElementById('researchopia-error');
    const iframe = doc.getElementById('researchopia-iframe');

    if (loading) loading.style.display = 'block';
    if (error) error.style.display = 'none';
    if (iframe) iframe.style.display = 'none';
  }

  /**
   * 显示iframe
   */
  showIframe() {
    const doc = this.getDocument();
    if (!doc) return;

    const loading = doc.getElementById('researchopia-loading');
    const error = doc.getElementById('researchopia-error');
    const iframe = doc.getElementById('researchopia-iframe');

    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'none';
    if (iframe) iframe.style.display = 'block';
  }

  /**
   * 显示错误状态
   */
  showError(message) {
    const doc = this.getDocument();
    if (!doc) return;

    const loading = doc.getElementById('researchopia-loading');
    const error = doc.getElementById('researchopia-error');
    const iframe = doc.getElementById('researchopia-iframe');
    const errorText = doc.querySelector('.error-text');

    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'block';
    if (iframe) iframe.style.display = 'none';
    if (errorText) errorText.textContent = message;

    log("Showing error: " + message);
  }

  /**
   * 获取当前文档
   */
  getDocument() {
    try {
      return Zotero.getMainWindow().document;
    } catch (error) {
      log("Failed to get document: " + error.message);
      return null;
    }
  }

  /**
   * 注销Item Pane部分
   */
  async unregister() {
    if (this.isRegistered) {
      try {
        await Zotero.ItemPaneManager.unregisterSection(this.sectionId);
        this.isRegistered = false;
        log("Item Pane section unregistered");
      } catch (error) {
        log("Failed to unregister Item Pane section: " + error.message);
      }
    }
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemPaneManager;
} else if (typeof window !== 'undefined') {
  window.ItemPaneManager = ItemPaneManager;
}

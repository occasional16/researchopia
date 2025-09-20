/**
 * Researchopia Annotation Browser
 * 标注浏览和展示模块
 */

const AnnotationBrowser = {
  // 配置
  config: {
    apiBase: 'http://localhost:3000/api/v1',
    itemsPerPage: 20,
    maxSearchResults: 100
  },

  // 状态
  state: {
    currentPage: 1,
    totalPages: 0,
    currentFilters: {},
    currentSort: 'recent',
    searchQuery: '',
    isLoading: false
  },

  // 缓存
  cache: {
    annotations: new Map(),
    users: new Map(),
    documents: new Map()
  },

  /**
   * 初始化标注浏览器
   */
  init() {
    this.log("Initializing Annotation Browser");
    this.setupEventListeners();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Browser [${level.toUpperCase()}]: ${message}`;
      
      // 使用Zotero的日志系统
      if (typeof Zotero !== 'undefined' && Zotero.debug) {
        Zotero.debug(logMessage, level === 'error' ? 1 : 3);
      } else if (typeof console !== 'undefined') {
        console.log(logMessage);
      }
    } catch (e) {
      // 静默处理日志错误
    }
  },

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    try {
      // 监听标注分享事件，刷新浏览器
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.addObserver(this, 'researchopia:annotationShared', false);
        this.log("Event listeners registered");
      }
    } catch (error) {
      this.log(`Error setting up event listeners: ${error.message}`, 'error');
    }
  },

  /**
   * 观察者接口实现
   */
  observe(subject, topic, data) {
    try {
      switch (topic) {
        case 'researchopia:annotationShared':
          this.refreshAnnotations();
          break;
      }
    } catch (error) {
      this.log(`Error handling observer event: ${error.message}`, 'error');
    }
  },

  /**
   * 显示标注浏览器
   */
  async showBrowser() {
    try {
      this.log("Showing annotation browser");
      
      // 创建浏览器窗口
      const browserHTML = this.createBrowserHTML();
      
      const dialog = Services.ww.openWindow(
        null,
        'data:text/html;charset=utf-8,' + encodeURIComponent(browserHTML),
        'annotation-browser',
        'chrome,centerscreen,resizable=yes,width=900,height=700',
        null
      );

      // 设置窗口事件
      dialog.addEventListener('load', () => {
        this.setupBrowserEvents(dialog);
        this.loadAnnotations();
      });

      return dialog;
    } catch (error) {
      this.log(`Error showing browser: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 创建浏览器HTML
   */
  createBrowserHTML() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>标注浏览器 - 研学港</title>
        <meta charset="utf-8">
        <style>
          ${this.getBrowserCSS()}
        </style>
      </head>
      <body>
        <div class="browser-container">
          <!-- 标题栏 -->
          <div class="browser-header">
            <h2>🌊 标注浏览器</h2>
            <div class="header-actions">
              <button onclick="refreshAnnotations()" class="action-btn">🔄 刷新</button>
              <button onclick="showSettings()" class="action-btn">⚙️ 设置</button>
            </div>
          </div>
          
          <!-- 搜索和筛选栏 -->
          <div class="browser-toolbar">
            <div class="search-section">
              <input type="text" id="search-input" placeholder="搜索标注内容、作者、文档..." 
                     onkeyup="handleSearch(event)">
              <button onclick="performSearch()" class="search-btn">🔍 搜索</button>
            </div>
            
            <div class="filter-section">
              <select id="sort-select" onchange="handleSortChange()">
                <option value="recent">最新</option>
                <option value="popular">最热门</option>
                <option value="author">按作者</option>
                <option value="document">按文档</option>
              </select>
              
              <select id="type-filter" onchange="handleFilterChange()">
                <option value="">所有类型</option>
                <option value="highlight">高亮</option>
                <option value="note">笔记</option>
                <option value="underline">下划线</option>
              </select>
              
              <select id="privacy-filter" onchange="handleFilterChange()">
                <option value="">所有可见</option>
                <option value="public">公开</option>
                <option value="friends">好友</option>
              </select>
            </div>
          </div>
          
          <!-- 统计信息 -->
          <div class="browser-stats">
            <span id="total-count">0</span> 个标注
            <span class="separator">|</span>
            <span id="filtered-count">0</span> 个符合条件
            <span class="separator">|</span>
            第 <span id="current-page">1</span> / <span id="total-pages">1</span> 页
          </div>
          
          <!-- 标注列表 -->
          <div class="annotations-container">
            <div id="annotations-list" class="annotations-list">
              <div class="loading-indicator">
                <div class="spinner"></div>
                <p>正在加载标注...</p>
              </div>
            </div>
          </div>
          
          <!-- 分页控制 -->
          <div class="pagination-container">
            <button onclick="previousPage()" id="prev-btn" class="page-btn" disabled>上一页</button>
            <div class="page-numbers" id="page-numbers"></div>
            <button onclick="nextPage()" id="next-btn" class="page-btn" disabled>下一页</button>
          </div>
          
          <!-- 详情面板 -->
          <div id="detail-panel" class="detail-panel hidden">
            <div class="detail-header">
              <h3>标注详情</h3>
              <button onclick="closeDetailPanel()" class="close-btn">✕</button>
            </div>
            <div class="detail-content" id="detail-content">
              <!-- 详情内容将在这里动态加载 -->
            </div>
          </div>
        </div>
        
        <script>
          ${this.getBrowserJS()}
        </script>
      </body>
      </html>
    `;
  },

  /**
   * 获取浏览器CSS样式
   */
  getBrowserCSS() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f8f9fa;
        color: #333;
      }
      
      .browser-container {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      
      .browser-header {
        background: white;
        padding: 16px 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .browser-header h2 {
        color: #495057;
        font-size: 18px;
        margin: 0;
      }
      
      .header-actions {
        display: flex;
        gap: 8px;
      }
      
      .action-btn {
        padding: 6px 12px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .action-btn:hover {
        background: #f8f9fa;
      }
      
      .browser-toolbar {
        background: white;
        padding: 12px 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        gap: 20px;
        align-items: center;
        flex-wrap: wrap;
      }
      
      .search-section {
        display: flex;
        gap: 8px;
        flex: 1;
        min-width: 300px;
      }
      
      #search-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .search-btn {
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .filter-section {
        display: flex;
        gap: 8px;
      }
      
      .filter-section select {
        padding: 6px 8px;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .browser-stats {
        background: #f8f9fa;
        padding: 8px 20px;
        font-size: 12px;
        color: #6c757d;
        border-bottom: 1px solid #e9ecef;
      }
      
      .separator {
        margin: 0 8px;
      }
      
      .annotations-container {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
      }
      
      .annotations-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .annotation-card {
        background: white;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .annotation-card:hover {
        border-color: #007bff;
        box-shadow: 0 2px 8px rgba(0,123,255,0.1);
      }
      
      .annotation-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      
      .annotation-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #6c757d;
      }
      
      .annotation-type {
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        color: white;
      }
      
      .annotation-type.highlight { background: #28a745; }
      .annotation-type.note { background: #007bff; }
      .annotation-type.underline { background: #ffc107; color: #212529; }
      
      .annotation-content {
        margin-bottom: 12px;
      }
      
      .annotation-text {
        font-size: 14px;
        line-height: 1.5;
        color: #495057;
        margin-bottom: 8px;
      }
      
      .annotation-comment {
        font-size: 13px;
        color: #6c757d;
        font-style: italic;
      }
      
      .annotation-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #6c757d;
      }
      
      .annotation-actions {
        display: flex;
        gap: 12px;
      }
      
      .action-link {
        color: #007bff;
        text-decoration: none;
        cursor: pointer;
      }
      
      .action-link:hover {
        text-decoration: underline;
      }
      
      .pagination-container {
        background: white;
        padding: 12px 20px;
        border-top: 1px solid #e9ecef;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
      }
      
      .page-btn {
        padding: 6px 12px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .page-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .page-numbers {
        display: flex;
        gap: 4px;
      }
      
      .page-number {
        padding: 4px 8px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .page-number.active {
        background: #007bff;
        color: white;
        border-color: #007bff;
      }
      
      .loading-indicator {
        text-align: center;
        padding: 40px;
        color: #6c757d;
      }
      
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .detail-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        background: white;
        border-left: 1px solid #e9ecef;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        z-index: 1000;
      }
      
      .detail-panel:not(.hidden) {
        transform: translateX(0);
      }
      
      .detail-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .close-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #6c757d;
      }
      
      .detail-content {
        padding: 20px;
        overflow-y: auto;
        height: calc(100vh - 60px);
      }
    `;
  },

  /**
   * 设置浏览器事件
   */
  setupBrowserEvents(dialog) {
    try {
      // 替换loadAnnotations函数
      dialog.contentWindow.loadAnnotations = () => {
        this.loadAnnotations(dialog);
      };

      // 设置其他事件处理函数
      dialog.contentWindow.AnnotationBrowser = this;

      this.log("Browser events setup completed");
    } catch (error) {
      this.log(`Error setting up browser events: ${error.message}`, 'error');
    }
  },

  /**
   * 加载标注数据
   */
  async loadAnnotations(dialog) {
    try {
      this.state.isLoading = true;
      this.updateLoadingState(dialog, true);

      // 构建查询参数
      const params = new URLSearchParams({
        page: this.state.currentPage,
        limit: this.config.itemsPerPage,
        sort: this.state.currentSort,
        search: this.state.searchQuery
      });

      // 添加筛选条件
      Object.keys(this.state.currentFilters).forEach(key => {
        if (this.state.currentFilters[key]) {
          params.append(key, this.state.currentFilters[key]);
        }
      });

      // 发送请求
      const response = await this.makeRequest(`/annotations/browse?${params.toString()}`);

      if (response.ok) {
        const data = JSON.parse(response.responseText);

        // 更新状态
        this.state.totalPages = Math.ceil(data.total / this.config.itemsPerPage);

        // 缓存数据
        data.annotations.forEach(annotation => {
          this.cache.annotations.set(annotation.id, annotation);
        });

        // 更新界面
        this.renderAnnotations(dialog, data.annotations);
        this.updateStats(dialog, data.total, data.annotations.length);
        this.updatePagination(dialog);

        this.log(`Loaded ${data.annotations.length} annotations`);
      } else {
        throw new Error(`Failed to load annotations: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error loading annotations: ${error.message}`, 'error');
      this.showError(dialog, '加载标注失败: ' + error.message);
    } finally {
      this.state.isLoading = false;
      this.updateLoadingState(dialog, false);
    }
  },

  /**
   * 渲染标注列表
   */
  renderAnnotations(dialog, annotations) {
    try {
      const listContainer = dialog.contentDocument.getElementById('annotations-list');

      if (annotations.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <p>😔 没有找到符合条件的标注</p>
            <p>尝试调整搜索条件或筛选器</p>
          </div>
        `;
        return;
      }

      const annotationCards = annotations.map(annotation => this.createAnnotationCard(annotation)).join('');
      listContainer.innerHTML = annotationCards;

      // 添加点击事件
      listContainer.querySelectorAll('.annotation-card').forEach((card, index) => {
        card.addEventListener('click', () => {
          this.showAnnotationDetail(dialog, annotations[index]);
        });
      });

    } catch (error) {
      this.log(`Error rendering annotations: ${error.message}`, 'error');
    }
  },

  /**
   * 创建标注卡片HTML
   */
  createAnnotationCard(annotation) {
    const typeClass = annotation.type || 'unknown';
    const typeLabel = this.getTypeLabel(annotation.type);
    const timeAgo = this.formatTimeAgo(annotation.createdAt);
    const authorName = annotation.author?.name || '匿名用户';
    const documentTitle = annotation.document?.title || '未知文档';

    return `
      <div class="annotation-card" data-id="${annotation.id}">
        <div class="annotation-header">
          <div class="annotation-meta">
            <span class="annotation-type ${typeClass}">${typeLabel}</span>
            <span class="author-name">${this.escapeHtml(authorName)}</span>
            <span class="time-ago">${timeAgo}</span>
          </div>
          <div class="annotation-stats">
            <span class="likes-count">👍 ${annotation.likes || 0}</span>
            <span class="comments-count">💬 ${annotation.comments || 0}</span>
          </div>
        </div>

        <div class="annotation-content">
          ${annotation.text ? `<div class="annotation-text">${this.escapeHtml(annotation.text)}</div>` : ''}
          ${annotation.comment ? `<div class="annotation-comment">${this.escapeHtml(annotation.comment)}</div>` : ''}
        </div>

        <div class="annotation-footer">
          <div class="document-info">
            <span class="document-title">${this.escapeHtml(documentTitle)}</span>
            ${annotation.pageIndex ? `<span class="page-info">第 ${annotation.pageIndex} 页</span>` : ''}
          </div>
          <div class="annotation-actions">
            <a href="#" class="action-link" onclick="likeAnnotation('${annotation.id}')">点赞</a>
            <a href="#" class="action-link" onclick="commentAnnotation('${annotation.id}')">评论</a>
            <a href="#" class="action-link" onclick="shareAnnotation('${annotation.id}')">分享</a>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 获取类型标签
   */
  getTypeLabel(type) {
    const labels = {
      'highlight': '高亮',
      'note': '笔记',
      'underline': '下划线',
      'strikeout': '删除线',
      'square': '方框',
      'unknown': '其他'
    };
    return labels[type] || '未知';
  },

  /**
   * 格式化时间
   */
  formatTimeAgo(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;

      return date.toLocaleDateString('zh-CN');
    } catch (error) {
      return '未知时间';
    }
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * 更新统计信息
   */
  updateStats(dialog, total, filtered) {
    try {
      const totalCountEl = dialog.contentDocument.getElementById('total-count');
      const filteredCountEl = dialog.contentDocument.getElementById('filtered-count');
      const currentPageEl = dialog.contentDocument.getElementById('current-page');
      const totalPagesEl = dialog.contentDocument.getElementById('total-pages');

      if (totalCountEl) totalCountEl.textContent = total;
      if (filteredCountEl) filteredCountEl.textContent = filtered;
      if (currentPageEl) currentPageEl.textContent = this.state.currentPage;
      if (totalPagesEl) totalPagesEl.textContent = this.state.totalPages;
    } catch (error) {
      this.log(`Error updating stats: ${error.message}`, 'error');
    }
  },

  /**
   * 更新分页控制
   */
  updatePagination(dialog) {
    try {
      const prevBtn = dialog.contentDocument.getElementById('prev-btn');
      const nextBtn = dialog.contentDocument.getElementById('next-btn');
      const pageNumbers = dialog.contentDocument.getElementById('page-numbers');

      // 更新按钮状态
      if (prevBtn) prevBtn.disabled = this.state.currentPage <= 1;
      if (nextBtn) nextBtn.disabled = this.state.currentPage >= this.state.totalPages;

      // 生成页码
      if (pageNumbers) {
        const pages = this.generatePageNumbers();
        pageNumbers.innerHTML = pages.map(page => {
          if (page === '...') {
            return '<span class="page-ellipsis">...</span>';
          }
          const isActive = page === this.state.currentPage;
          return `<button class="page-number ${isActive ? 'active' : ''}"
                    onclick="goToPage(${page})">${page}</button>`;
        }).join('');
      }
    } catch (error) {
      this.log(`Error updating pagination: ${error.message}`, 'error');
    }
  },

  /**
   * 生成页码数组
   */
  generatePageNumbers() {
    const current = this.state.currentPage;
    const total = this.state.totalPages;
    const pages = [];

    if (total <= 7) {
      // 如果总页数少于7页，显示所有页码
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // 复杂的页码逻辑
      pages.push(1);

      if (current > 4) {
        pages.push('...');
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 3) {
        pages.push('...');
      }

      if (total > 1) {
        pages.push(total);
      }
    }

    return pages;
  },

  /**
   * 更新加载状态
   */
  updateLoadingState(dialog, isLoading) {
    try {
      const listContainer = dialog.contentDocument.getElementById('annotations-list');

      if (isLoading) {
        listContainer.innerHTML = `
          <div class="loading-indicator">
            <div class="spinner"></div>
            <p>正在加载标注...</p>
          </div>
        `;
      }
    } catch (error) {
      this.log(`Error updating loading state: ${error.message}`, 'error');
    }
  },

  /**
   * 显示错误信息
   */
  showError(dialog, message) {
    try {
      const listContainer = dialog.contentDocument.getElementById('annotations-list');
      listContainer.innerHTML = `
        <div class="error-state">
          <p>❌ ${this.escapeHtml(message)}</p>
          <button onclick="refreshAnnotations()" class="retry-btn">重试</button>
        </div>
      `;
    } catch (error) {
      this.log(`Error showing error: ${error.message}`, 'error');
    }
  },

  /**
   * 刷新标注列表
   */
  async refreshAnnotations() {
    this.cache.annotations.clear();
    this.state.currentPage = 1;
    // 触发重新加载
    if (typeof Services !== 'undefined' && Services.obs) {
      Services.obs.notifyObservers(null, 'researchopia:refreshBrowser', '');
    }
  },

  /**
   * 发送HTTP请求
   */
  makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.config.apiBase}${endpoint}`;

      xhr.timeout = options.timeout || 10000;
      xhr.open(options.method || 'GET', url, true);

      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // 添加认证头
      if (typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
        const authHeaders = AuthManager.getAuthHeaders();
        Object.assign(headers, authHeaders);
      }

      Object.keys(headers).forEach(key => {
        xhr.setRequestHeader(key, headers[key]);
      });

      xhr.onload = function() {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
          ok: xhr.status >= 200 && xhr.status < 300
        });
      };

      xhr.onerror = function() {
        reject(new Error(`Network error: ${xhr.statusText || 'Connection failed'}`));
      };

      xhr.ontimeout = function() {
        reject(new Error(`Request timeout after ${xhr.timeout}ms`));
      };

      xhr.send(options.body || null);
    });
  },

  /**
   * 获取浏览器JavaScript
   */
  getBrowserJS() {
    return `
      let currentState = {
        page: 1,
        totalPages: 1,
        filters: {},
        sort: 'recent',
        search: ''
      };
      
      function handleSearch(event) {
        if (event.key === 'Enter') {
          performSearch();
        }
      }
      
      function performSearch() {
        const query = document.getElementById('search-input').value;
        currentState.search = query;
        currentState.page = 1;
        loadAnnotations();
      }
      
      function handleSortChange() {
        const sort = document.getElementById('sort-select').value;
        currentState.sort = sort;
        currentState.page = 1;
        loadAnnotations();
      }
      
      function handleFilterChange() {
        const typeFilter = document.getElementById('type-filter').value;
        const privacyFilter = document.getElementById('privacy-filter').value;
        
        currentState.filters = {
          type: typeFilter,
          privacy: privacyFilter
        };
        currentState.page = 1;
        loadAnnotations();
      }
      
      function refreshAnnotations() {
        loadAnnotations();
      }
      
      function loadAnnotations() {
        // 这个函数会被外部的AnnotationBrowser.loadAnnotations()替换
        console.log('Loading annotations...');
      }
      
      function previousPage() {
        if (currentState.page > 1) {
          currentState.page--;
          loadAnnotations();
        }
      }
      
      function nextPage() {
        if (currentState.page < currentState.totalPages) {
          currentState.page++;
          loadAnnotations();
        }
      }
      
      function goToPage(page) {
        currentState.page = page;
        loadAnnotations();
      }
      
      function showAnnotationDetail(annotationId) {
        // 显示标注详情
        if (window.opener && window.opener.AnnotationBrowser) {
          window.opener.AnnotationBrowser.showAnnotationDetail(annotationId);
        }
      }
      
      function closeDetailPanel() {
        document.getElementById('detail-panel').classList.add('hidden');
      }
      
      function showSettings() {
        alert('设置功能即将推出！');
      }
    `;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationBrowser;
}

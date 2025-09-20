/**
 * Researchopia Annotation Selector
 * 标注选择和管理模块
 */

const AnnotationSelector = {
  // 当前选中的标注
  selectedAnnotations: new Set(),
  
  // 所有可用的标注
  availableAnnotations: [],
  
  // 选择器状态
  isVisible: false,
  selectorElement: null,

  /**
   * 初始化标注选择器
   */
  init() {
    this.log("Initializing Annotation Selector");
    this.createSelectorUI();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Selector [${level.toUpperCase()}]: ${message}`;

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
   * 显示标注选择器
   */
  async showSelector(annotations) {
    try {
      this.log(`Showing selector with ${annotations.length} annotations`);
      
      this.availableAnnotations = annotations;
      this.selectedAnnotations.clear();
      
      // 默认选择所有标注
      annotations.forEach(annotation => {
        this.selectedAnnotations.add(annotation.id);
      });
      
      this.updateSelectorUI();
      this.isVisible = true;
      
      return new Promise((resolve, reject) => {
        this.resolveSelection = resolve;
        this.rejectSelection = reject;
        
        // 显示选择器界面
        this.showSelectorDialog();
      });
    } catch (error) {
      this.log(`Error showing selector: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 创建选择器UI
   */
  createSelectorUI() {
    // 选择器UI将在需要时动态创建
    this.log("Selector UI framework initialized");
  },

  /**
   * 显示选择器对话框
   */
  showSelectorDialog() {
    try {
      // 使用内嵌对话框替代弹出窗口
      this.createInlineSelector();
    } catch (error) {
      this.log(`Error showing selector dialog: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 创建内嵌选择器界面
   */
  createInlineSelector() {
    try {
      // 获取当前活动窗口的document
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (!win || !win.document) {
        throw new Error("No active window found for inline selector");
      }

      const doc = win.document;

      // 创建模态背景
      const modalOverlay = doc.createElement('div');
      modalOverlay.id = 'researchopia-annotation-selector-overlay';
      modalOverlay.className = 'researchopia-modal-overlay';
      modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      // 创建选择器容器
      const selectorContainer = doc.createElement('div');
      selectorContainer.className = 'researchopia-annotation-selector';
      selectorContainer.style.cssText = `
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        width: 90%;
        max-width: 800px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `;

      // 创建选择器内容
      selectorContainer.innerHTML = this.getSelectorHTML();
      modalOverlay.appendChild(selectorContainer);

      // 添加到页面（安全地获取容器）
      const container = doc.body || doc.documentElement || doc;
      if (container && typeof container.appendChild === 'function') {
        container.appendChild(modalOverlay);
        this.selectorElement = modalOverlay;
      } else {
        throw new Error('Cannot find suitable container for modal');
      }

      // 设置事件监听器
      this.setupSelectorEvents(selectorContainer);

      // 渲染标注列表
      this.renderAnnotationList(selectorContainer);

      this.log("Inline selector created successfully");
    } catch (error) {
      this.log(`Error creating inline selector: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 获取选择器HTML模板
   */
  getSelectorHTML() {
    return `
      <div class="selector-header" style="padding: 20px; border-bottom: 1px solid #e0e0e0; background: #f8f9fa;">
        <h2 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">选择要分享的标注</h2>
        <p style="margin: 0; color: #666; font-size: 14px;">选择您想要分享到研学港的标注内容</p>
      </div>

      <div class="selector-toolbar" style="padding: 15px 20px; border-bottom: 1px solid #e0e0e0; background: #fff;">
        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
          <div class="selection-controls" style="display: flex; gap: 10px;">
            <button id="select-all-btn" class="toolbar-btn" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">全选</button>
            <button id="select-none-btn" class="toolbar-btn" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">全不选</button>
            <button id="select-highlights-btn" class="toolbar-btn" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">仅高亮</button>
            <button id="select-notes-btn" class="toolbar-btn" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">仅笔记</button>
          </div>

          <div class="view-controls" style="display: flex; gap: 10px; margin-left: auto;">
            <select id="sort-select" style="padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
              <option value="created">按创建时间</option>
              <option value="page">按页面顺序</option>
              <option value="type">按类型分组</option>
            </select>
            <button id="toggle-preview-btn" class="toolbar-btn" style="padding: 6px 12px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer; font-size: 12px;">预览模式</button>
          </div>
        </div>

        <div class="selection-summary" style="margin-top: 10px; font-size: 12px; color: #666;">
          已选择 <span id="selected-count">0</span> / <span id="total-count">0</span> 个标注
        </div>
      </div>

      <div class="selector-content" style="flex: 1; overflow-y: auto; padding: 0;">
        <div id="annotation-list" class="annotation-list" style="padding: 10px 20px;">
          <!-- 标注列表将在这里动态生成 -->
        </div>
      </div>

      <div class="selector-footer" style="padding: 20px; border-top: 1px solid #e0e0e0; background: #f8f9fa;">
        <!-- 社交功能预览区域 -->
        <div id="social-preview-area" class="social-preview-area" style="margin-bottom: 15px;">
          <!-- 社交面板将在这里动态插入 -->
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="privacy-controls" style="display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 14px; color: #333;">分享级别:</label>
            <select id="privacy-select" style="padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
              <option value="public">公开</option>
              <option value="shared">仅好友</option>
              <option value="private">私人</option>
            </select>
          </div>

          <div class="action-buttons" style="display: flex; gap: 10px;">
            <button id="cancel-btn" style="padding: 10px 20px; border: 1px solid #ddd; background: #fff; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
            <button id="share-btn" style="padding: 10px 20px; border: none; background: #007acc; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">分享选中的标注</button>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 设置选择器事件监听器
   */
  setupSelectorEvents(container) {
    try {
      // 获取当前活动窗口
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (!win || !win.document) {
        throw new Error("No active window found");
      }

      const doc = win.document;

      // 移除已存在的选择器
      const existingOverlay = doc.getElementById('researchopia-selector-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      // 创建模态覆盖层
      const overlay = doc.createElement('div');
      overlay.id = 'researchopia-selector-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      // 创建对话框容器
      const dialog = doc.createElement('div');
      dialog.id = 'researchopia-selector-dialog';
      dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        width: 90%;
        max-width: 800px;
        height: 80%;
        max-height: 600px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
      `;

      // 添加对话框内容
      dialog.innerHTML = this.generateSelectorContent();

      overlay.appendChild(dialog);

      // 安全地添加到页面
      const container = doc.body || doc.documentElement || doc;
      if (container && typeof container.appendChild === 'function') {
        container.appendChild(overlay);
      } else {
        throw new Error('Cannot find suitable container for dialog');
      }

      // 设置事件监听器
      this.setupSelectorEvents(overlay, doc);

      this.log("Inline selector created successfully");
      return { overlay, dialog };
    } catch (error) {
      this.log(`Error creating inline selector: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 生成选择器内容
   */
  generateSelectorContent() {
    const annotationsList = Array.from(this.annotations).map(annotation => {
      const isSelected = this.selectedAnnotations.has(annotation.id);
      return `
        <div class="annotation-item ${isSelected ? 'selected' : ''}" data-id="${annotation.id}">
          <div class="annotation-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} />
          </div>
          <div class="annotation-content">
            <div class="annotation-text">${this.escapeHtml(annotation.text || '无文本')}</div>
            <div class="annotation-meta">
              <span class="annotation-type">${annotation.type}</span>
              <span class="annotation-page">第 ${annotation.pageLabel || '?'} 页</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="selector-header">
        <h2>🔖 选择要分享的标注</h2>
        <button class="close-btn" id="selector-close">✕</button>
      </div>
      <div class="selector-content">
        <div class="selector-stats">
          <span>共 ${this.annotations.size} 个标注，已选择 ${this.selectedAnnotations.size} 个</span>
        </div>
        <div class="annotations-list">
          ${annotationsList}
        </div>
      </div>
      <div class="selector-footer">
        <button class="btn secondary" id="selector-cancel">取消</button>
        <button class="btn primary" id="selector-confirm">分享选中的标注</button>
      </div>
      <style>
        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #eee;
        }
        .selector-header h2 {
          margin: 0;
          color: #333;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
        }
        .selector-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }
        .selector-stats {
          margin-bottom: 15px;
          color: #666;
          font-size: 14px;
        }
        .annotations-list {
          max-height: 400px;
          overflow-y: auto;
        }
        .annotation-item {
          display: flex;
          align-items: flex-start;
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .annotation-item:hover {
          background: #f8f9fa;
          border-color: #007acc;
        }
        .annotation-item.selected {
          background: #e3f2fd;
          border-color: #007acc;
        }
        .annotation-checkbox {
          margin-right: 12px;
          margin-top: 2px;
        }
        .annotation-content {
          flex: 1;
        }
        .annotation-text {
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 6px;
          color: #333;
        }
        .annotation-meta {
          font-size: 12px;
          color: #666;
        }
        .annotation-meta span {
          margin-right: 12px;
        }
        .selector-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #eee;
        }
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .btn.primary {
          background: #007acc;
          color: white;
        }
        .btn.secondary {
          background: #f5f5f5;
          color: #333;
        }
        .btn:hover {
          opacity: 0.9;
        }
      </style>
    `;
  },

  /**
   * 设置选择器事件监听器
   */
  setupSelectorEvents(overlay, doc) {
    // 关闭按钮
    const closeBtn = doc.getElementById('selector-close');
    const cancelBtn = doc.getElementById('selector-cancel');
    const confirmBtn = doc.getElementById('selector-confirm');

    const closeDialog = () => {
      overlay.remove();
      if (this.rejectSelection) {
        this.rejectSelection(new Error('User cancelled selection'));
      }
    };

    const confirmSelection = () => {
      const selectedAnnotations = Array.from(this.annotations).filter(
        annotation => this.selectedAnnotations.has(annotation.id)
      );
      overlay.remove();
      if (this.resolveSelection) {
        this.resolveSelection(selectedAnnotations);
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeDialog);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDialog);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmSelection);

    // 标注项点击事件
    const annotationItems = doc.querySelectorAll('.annotation-item');
    annotationItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const annotationId = item.dataset.id;
        const checkbox = item.querySelector('input[type="checkbox"]');

        if (this.selectedAnnotations.has(annotationId)) {
          this.selectedAnnotations.delete(annotationId);
          checkbox.checked = false;
          item.classList.remove('selected');
        } else {
          this.selectedAnnotations.add(annotationId);
          checkbox.checked = true;
          item.classList.add('selected');
        }

        // 更新统计信息
        const statsElement = doc.querySelector('.selector-stats span');
        if (statsElement) {
          statsElement.textContent = `共 ${this.annotations.size} 个标注，已选择 ${this.selectedAnnotations.size} 个`;
        }
      });
    });

    // 点击覆盖层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });
  },

  /**
   * 创建选择器HTML
   */
  createSelectorHTML() {
    const annotations = this.availableAnnotations;
    const annotationItems = annotations.map(annotation => {
      const isSelected = this.selectedAnnotations.has(annotation.id);
      const content = this.getAnnotationPreview(annotation);
      const type = this.getAnnotationType(annotation);
      
      return `
        <div class="annotation-item" data-id="${annotation.id}">
          <label class="annotation-checkbox">
            <input type="checkbox" ${isSelected ? 'checked' : ''} >
            <span class="checkmark"></span>
          </label>
          <div class="annotation-content">
            <div class="annotation-header">
              <span class="annotation-type ${type}">${this.getTypeLabel(type)}</span>
              <span class="annotation-page">第 ${annotation.pageIndex || '?'} 页</span>
            </div>
            <div class="annotation-text">${content}</div>
            <div class="annotation-meta">
              <span class="annotation-date">${this.formatDate(annotation.dateModified)}</span>
              <span class="annotation-color" style="background-color: ${annotation.color || '#ffeb3b'}"></span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>选择要分享的标注</title>
        <meta charset="utf-8">
        <style>
          ${this.getSelectorCSS()}
        </style>
      </head>
      <body>
        <div class="selector-container">
          <div class="selector-header">
            <h2>选择要分享的标注</h2>
            <div class="selector-stats">
              <span id="selected-count">${this.selectedAnnotations.size}</span> / 
              <span id="total-count">${annotations.length}</span> 个标注已选择
            </div>
          </div>
          
          <div class="selector-toolbar">
            <button onclick="selectAll()" class="toolbar-btn">全选</button>
            <button onclick="selectNone()" class="toolbar-btn">全不选</button>
            <button onclick="selectByType('highlight')" class="toolbar-btn">选择高亮</button>
            <button onclick="selectByType('note')" class="toolbar-btn">选择笔记</button>
          </div>
          
          <div class="annotations-list">
            ${annotationItems}
          </div>
          
          <div class="selector-footer">
            <div class="privacy-options">
              <label>
                <input type="radio" name="privacy" value="public" checked>
                <span>公开分享</span>
              </label>
              <label>
                <input type="radio" name="privacy" value="friends">
                <span>仅好友可见</span>
              </label>
              <label>
                <input type="radio" name="privacy" value="private">
                <span>私人标注</span>
              </label>
            </div>
            
            <div class="action-buttons">
              <button id="selector-cancel" class="cancel-btn">取消</button>
              <button id="selector-confirm" class="confirm-btn">分享选中的标注</button>
            </div>
          </div>
        </div>
        
        <script>
          ${this.getSelectorJS()}
        </script>
      </body>
      </html>
    `;
  },

  /**
   * 获取标注预览内容
   */
  getAnnotationPreview(annotation) {
    let content = '';
    
    if (annotation.annotationText) {
      content = annotation.annotationText;
    } else if (annotation.annotationComment) {
      content = annotation.annotationComment;
    } else if (annotation.text) {
      content = annotation.text;
    } else {
      content = '(无文本内容)';
    }
    
    // 限制预览长度
    if (content.length > 100) {
      content = content.substring(0, 100) + '...';
    }
    
    return this.escapeHtml(content);
  },

  /**
   * 获取标注类型
   */
  getAnnotationType(annotation) {
    if (annotation.annotationType) {
      return annotation.annotationType;
    }
    
    // 根据其他属性推断类型
    if (annotation.annotationComment && !annotation.annotationText) {
      return 'note';
    } else if (annotation.annotationText) {
      return 'highlight';
    } else {
      return 'unknown';
    }
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
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) return '未知时间';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '未知时间';
    }
  },

  /**
   * HTML转义
   */
  escapeHtml(text) {
    try {
      // 简单的HTML转义，避免使用document
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    } catch (e) {
      return text || '';
    }
  },

  /**
   * 获取选择器CSS样式
   */
  getSelectorCSS() {
    return `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background: #f8f9fa;
      }
      
      .selector-container {
        max-width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: white;
      }
      
      .selector-header {
        padding: 20px;
        border-bottom: 1px solid #e9ecef;
        background: white;
      }
      
      .selector-header h2 {
        margin: 0 0 10px 0;
        color: #495057;
        font-size: 18px;
      }
      
      .selector-stats {
        color: #6c757d;
        font-size: 14px;
      }
      
      .selector-toolbar {
        padding: 15px 20px;
        border-bottom: 1px solid #e9ecef;
        display: flex;
        gap: 10px;
        background: #f8f9fa;
      }
      
      .toolbar-btn {
        padding: 6px 12px;
        border: 1px solid #dee2e6;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .toolbar-btn:hover {
        background: #e9ecef;
      }
      
      .annotations-list {
        flex: 1;
        overflow-y: auto;
        padding: 10px 20px;
      }
      
      .annotation-item {
        display: flex;
        gap: 12px;
        padding: 12px;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        margin-bottom: 10px;
        background: white;
        transition: all 0.2s ease;
      }
      
      .annotation-item:hover {
        border-color: #007bff;
        box-shadow: 0 2px 4px rgba(0,123,255,0.1);
      }
      
      .annotation-checkbox {
        display: flex;
        align-items: flex-start;
        cursor: pointer;
        margin-top: 2px;
      }
      
      .annotation-content {
        flex: 1;
      }
      
      .annotation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .annotation-type {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;
        color: white;
      }
      
      .annotation-type.highlight { background: #28a745; }
      .annotation-type.note { background: #007bff; }
      .annotation-type.underline { background: #ffc107; color: #212529; }
      .annotation-type.unknown { background: #6c757d; }
      
      .annotation-page {
        font-size: 11px;
        color: #6c757d;
      }
      
      .annotation-text {
        font-size: 13px;
        color: #495057;
        line-height: 1.4;
        margin-bottom: 8px;
      }
      
      .annotation-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .annotation-date {
        font-size: 11px;
        color: #6c757d;
      }
      
      .annotation-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #dee2e6;
      }
      
      .selector-footer {
        padding: 20px;
        border-top: 1px solid #e9ecef;
        background: white;
      }
      
      .privacy-options {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
      }
      
      .privacy-options label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .action-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .cancel-btn, .confirm-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .cancel-btn {
        background: #6c757d;
        color: white;
      }
      
      .confirm-btn {
        background: #007bff;
        color: white;
      }
      
      .cancel-btn:hover { background: #5a6268; }
      .confirm-btn:hover { background: #0056b3; }
    `;
  },

  /**
   * 获取选择器JavaScript
   */
  getSelectorJS() {
    return `
      function toggleAnnotation(id) {
        const checkbox = document.querySelector('[data-id="' + id + '"] input[type="checkbox"]');
        const isChecked = checkbox.checked;
        
        // 通知父窗口
        if (window.opener && window.opener.AnnotationSelector) {
          if (isChecked) {
            window.opener.AnnotationSelector.selectedAnnotations.add(id);
          } else {
            window.opener.AnnotationSelector.selectedAnnotations.delete(id);
          }
          updateStats();
        }
      }
      
      function selectAll() {
        const checkboxes = document.querySelectorAll('.annotation-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
          cb.checked = true;
          const id = cb.closest('.annotation-item').dataset.id;
          if (window.opener && window.opener.AnnotationSelector) {
            window.opener.AnnotationSelector.selectedAnnotations.add(id);
          }
        });
        updateStats();
      }
      
      function selectNone() {
        const checkboxes = document.querySelectorAll('.annotation-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
          cb.checked = false;
          const id = cb.closest('.annotation-item').dataset.id;
          if (window.opener && window.opener.AnnotationSelector) {
            window.opener.AnnotationSelector.selectedAnnotations.delete(id);
          }
        });
        updateStats();
      }
      
      function selectByType(type) {
        const items = document.querySelectorAll('.annotation-item');
        items.forEach(item => {
          const typeElement = item.querySelector('.annotation-type');
          const checkbox = item.querySelector('input[type="checkbox"]');
          const id = item.dataset.id;
          
          if (typeElement.classList.contains(type)) {
            checkbox.checked = true;
            if (window.opener && window.opener.AnnotationSelector) {
              window.opener.AnnotationSelector.selectedAnnotations.add(id);
            }
          }
        });
        updateStats();
      }
      
      function updateStats() {
        const selectedCount = document.querySelectorAll('.annotation-item input[type="checkbox"]:checked').length;
        document.getElementById('selected-count').textContent = selectedCount;
      }
      
      function cancelSelection() {
        if (window.opener && window.opener.AnnotationSelector && window.opener.AnnotationSelector.rejectSelection) {
          window.opener.AnnotationSelector.rejectSelection(new Error('User cancelled'));
        }
        window.close();
      }
      
      function confirmSelection() {
        const privacy = document.querySelector('input[name="privacy"]:checked').value;
        const selectedIds = Array.from(document.querySelectorAll('.annotation-item input[type="checkbox"]:checked'))
          .map(cb => cb.closest('.annotation-item').dataset.id);
        
        if (window.opener && window.opener.AnnotationSelector && window.opener.AnnotationSelector.resolveSelection) {
          window.opener.AnnotationSelector.resolveSelection({
            selectedIds: selectedIds,
            privacy: privacy,
            annotations: selectedIds.map(id => 
              window.opener.AnnotationSelector.availableAnnotations.find(a => a.id === id)
            ).filter(Boolean)
          });
        }
        window.close();
      }
      
      // 初始化统计
      updateStats();
    `;
  },

  /**
   * 设置选择器事件
   */
  setupSelectorEvents(dialog) {
    // 对话框关闭事件
    dialog.addEventListener('unload', () => {
      if (this.rejectSelection) {
        this.rejectSelection(new Error('Dialog closed'));
      }
      this.isVisible = false;
      this.selectorElement = null;
    });
  },

  /**
   * 设置选择器事件监听器
   */
  setupSelectorEvents(container) {
    try {
      const doc = container.ownerDocument;

      // 批量选择按钮
      const selectAllBtn = container.querySelector('#select-all-btn');
      const selectNoneBtn = container.querySelector('#select-none-btn');
      const selectHighlightsBtn = container.querySelector('#select-highlights-btn');
      const selectNotesBtn = container.querySelector('#select-notes-btn');

      // 视图控制
      const sortSelect = container.querySelector('#sort-select');
      const togglePreviewBtn = container.querySelector('#toggle-preview-btn');

      // 操作按钮
      const cancelBtn = container.querySelector('#cancel-btn');
      const shareBtn = container.querySelector('#share-btn');

      // 隐私选择
      const privacySelect = container.querySelector('#privacy-select');

      // 批量选择事件
      if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
          this.selectAll();
          this.updateSelectionUI(container);
        });
      }

      if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', () => {
          this.selectNone();
          this.updateSelectionUI(container);
        });
      }

      if (selectHighlightsBtn) {
        selectHighlightsBtn.addEventListener('click', () => {
          this.selectByType('highlight');
          this.updateSelectionUI(container);
        });
      }

      if (selectNotesBtn) {
        selectNotesBtn.addEventListener('click', () => {
          this.selectByType('note');
          this.updateSelectionUI(container);
        });
      }

      // 排序变化
      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          this.renderAnnotationList(container, sortSelect.value);
        });
      }

      // 预览模式切换
      if (togglePreviewBtn) {
        togglePreviewBtn.addEventListener('click', () => {
          this.togglePreviewMode(container);
        });
      }

      // 操作按钮
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.closeSelector();
          if (this.rejectSelection) {
            this.rejectSelection(new Error('User cancelled'));
          }
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          this.handleShare(container);
        });
      }

      // 点击背景关闭
      if (this.selectorElement) {
        this.selectorElement.addEventListener('click', (e) => {
          if (e.target === this.selectorElement) {
            this.closeSelector();
            if (this.rejectSelection) {
              this.rejectSelection(new Error('User cancelled'));
            }
          }
        });
      }

      this.log("Selector events setup completed");
    } catch (error) {
      this.log(`Error setting up selector events: ${error.message}`, 'error');
    }
  },

  /**
   * 渲染标注列表
   */
  renderAnnotationList(container, sortBy = 'created') {
    try {
      const listContainer = container.querySelector('#annotation-list');
      if (!listContainer) {
        this.log("Annotation list container not found", 'warn');
        return;
      }

      // 排序标注
      const sortedAnnotations = this.sortAnnotations(this.availableAnnotations, sortBy);

      // 清空现有内容
      listContainer.innerHTML = '';

      if (sortedAnnotations.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <p>当前文档没有找到标注</p>
            <p style="font-size: 12px; margin-top: 10px;">请先在PDF中创建一些标注，然后重试</p>
          </div>
        `;
        return;
      }

      // 渲染标注项
      sortedAnnotations.forEach((annotation, index) => {
        const annotationElement = this.createAnnotationElement(annotation, index);
        listContainer.appendChild(annotationElement);
      });

      // 更新统计信息
      this.updateSelectionUI(container);

      // 更新社交功能预览
      this.updateSocialPreview(container, sortedAnnotations);

      this.log(`Rendered ${sortedAnnotations.length} annotations`);
    } catch (error) {
      this.log(`Error rendering annotation list: ${error.message}`, 'error');
    }
  },

  /**
   * 创建标注元素
   */
  createAnnotationElement(annotation, index) {
    try {
      // 获取当前活动窗口的document
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (!win || !win.document) {
        throw new Error("No active window found for annotation element");
      }

      const doc = win.document;
      const element = doc.createElement('div');
      element.className = 'annotation-item';
      element.dataset.annotationId = annotation.id;

      const isSelected = this.selectedAnnotations.has(annotation.id);
      const annotationType = this.getAnnotationType(annotation);
      const annotationColor = this.getAnnotationColor(annotation);
      const annotationText = this.getAnnotationText(annotation);
      const annotationComment = this.getAnnotationComment(annotation);
      const pageInfo = this.getAnnotationPageInfo(annotation);

      element.style.cssText = `
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        margin-bottom: 10px;
        padding: 15px;
        background: ${isSelected ? '#f0f8ff' : '#fff'};
        border-color: ${isSelected ? '#007acc' : '#e0e0e0'};
        cursor: pointer;
        transition: all 0.2s ease;
      `;

      element.innerHTML = `
        <div class="annotation-header" style="display: flex; align-items: center; margin-bottom: 10px;">
          <input type="checkbox" class="annotation-checkbox" ${isSelected ? 'checked' : ''}
                 style="margin-right: 10px; transform: scale(1.2);">

          <div class="annotation-type-badge" style="
            background: ${annotationColor};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 10px;
          ">
            ${this.getTypeDisplayName(annotationType)}
          </div>

          <div class="annotation-meta" style="font-size: 12px; color: #666; flex: 1;">
            ${pageInfo} • ${this.formatDate(annotation.dateCreated)}
          </div>

          <div class="annotation-actions" style="display: flex; gap: 4px;">
            <button class="social-preview-btn" style="
              background: none;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 11px;
              cursor: pointer;
              color: #666;
            ">👥 社交</button>
            <button class="preview-btn" style="
              background: none;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 11px;
              cursor: pointer;
              color: #666;
            ">预览</button>
          </div>
        </div>

        <div class="annotation-content">
          ${annotationText ? `
            <div class="annotation-text" style="
              background: #f8f9fa;
              padding: 8px 12px;
              border-radius: 4px;
              margin-bottom: 8px;
              border-left: 3px solid ${annotationColor};
              font-size: 13px;
              line-height: 1.4;
            ">
              "${annotationText}"
            </div>
          ` : ''}

          ${annotationComment ? `
            <div class="annotation-comment" style="
              font-size: 13px;
              color: #333;
              line-height: 1.4;
              padding: 4px 0;
            ">
              💭 ${annotationComment}
            </div>
          ` : ''}
        </div>
      `;

      // 添加点击事件
      element.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox' && !e.target.classList.contains('preview-btn')) {
          this.toggleAnnotationSelection(annotation.id);
          this.updateAnnotationElement(element, annotation.id);
          this.updateSelectionUI(element.closest('.researchopia-annotation-selector'));
        }
      });

      // 复选框事件
      const checkbox = element.querySelector('.annotation-checkbox');
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        this.toggleAnnotationSelection(annotation.id);
        this.updateAnnotationElement(element, annotation.id);
        const container = element.closest('.researchopia-annotation-selector');
        this.updateSelectionUI(container);
        this.updateSocialPreview(container, this.availableAnnotations);
      });

      // 社交预览按钮事件
      const socialPreviewBtn = element.querySelector('.social-preview-btn');
      if (socialPreviewBtn) {
        socialPreviewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showSocialPreview(annotation);
        });
      }

      // 预览按钮事件
      const previewBtn = element.querySelector('.preview-btn');
      if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showAnnotationPreview(annotation);
        });
      }

      return element;
    } catch (error) {
      this.log(`Error creating annotation element: ${error.message}`, 'error');
      // 创建一个空的div作为回退
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (win && win.document) {
        return win.document.createElement('div');
      } else {
        return null;
      }
    }
  },

  /**
   * 获取标注类型
   */
  getAnnotationType(annotation) {
    try {
      if (annotation.annotationType) {
        return annotation.annotationType;
      }
      if (annotation.type) {
        return annotation.type;
      }
      // 根据Zotero的标注类型判断
      const type = annotation.getField ? annotation.getField('annotationType') : null;
      return type || 'highlight';
    } catch (error) {
      return 'highlight';
    }
  },

  /**
   * 获取标注颜色
   */
  getAnnotationColor(annotation) {
    try {
      const colorMap = {
        'highlight': '#ffd400',
        'note': '#5fb236',
        'underline': '#2ea8e5',
        'text': '#a28ae5',
        'ink': '#ff6666',
        'image': '#f19837'
      };

      const type = this.getAnnotationType(annotation);
      let color = annotation.color || annotation.getField?.('annotationColor');

      if (!color) {
        color = colorMap[type] || '#ffd400';
      }

      return color;
    } catch (error) {
      return '#ffd400';
    }
  },

  /**
   * 获取标注文本内容
   */
  getAnnotationText(annotation) {
    try {
      return annotation.annotationText ||
             annotation.getField?.('annotationText') ||
             annotation.text ||
             '';
    } catch (error) {
      return '';
    }
  },

  /**
   * 获取标注评论
   */
  getAnnotationComment(annotation) {
    try {
      return annotation.annotationComment ||
             annotation.getField?.('annotationComment') ||
             annotation.comment ||
             '';
    } catch (error) {
      return '';
    }
  },

  /**
   * 获取标注页面信息
   */
  getAnnotationPageInfo(annotation) {
    try {
      const pageLabel = annotation.annotationPageLabel ||
                       annotation.getField?.('annotationPageLabel');
      return pageLabel ? `第 ${pageLabel} 页` : '位置未知';
    } catch (error) {
      return '位置未知';
    }
  },

  /**
   * 获取类型显示名称
   */
  getTypeDisplayName(type) {
    const typeNames = {
      'highlight': '高亮',
      'note': '笔记',
      'underline': '下划线',
      'text': '文本框',
      'ink': '手绘',
      'image': '图片'
    };
    return typeNames[type] || '标注';
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '时间未知';
    }
  },

  /**
   * 切换标注选择状态
   */
  toggleAnnotationSelection(annotationId) {
    if (this.selectedAnnotations.has(annotationId)) {
      this.selectedAnnotations.delete(annotationId);
    } else {
      this.selectedAnnotations.add(annotationId);
    }
  },

  /**
   * 更新标注元素状态
   */
  updateAnnotationElement(element, annotationId) {
    const isSelected = this.selectedAnnotations.has(annotationId);
    const checkbox = element.querySelector('.annotation-checkbox');

    if (checkbox) {
      checkbox.checked = isSelected;
    }

    element.style.background = isSelected ? '#f0f8ff' : '#fff';
    element.style.borderColor = isSelected ? '#007acc' : '#e0e0e0';
  },

  /**
   * 更新选择统计
   */
  updateSelectionUI(container) {
    try {
      const selectedCountEl = container.querySelector('#selected-count');
      const totalCountEl = container.querySelector('#total-count');

      if (selectedCountEl) {
        selectedCountEl.textContent = this.selectedAnnotations.size;
      }
      if (totalCountEl) {
        totalCountEl.textContent = this.availableAnnotations.length;
      }

      // 更新分享按钮状态
      const shareBtn = container.querySelector('#share-btn');
      if (shareBtn) {
        shareBtn.disabled = this.selectedAnnotations.size === 0;
        shareBtn.style.opacity = this.selectedAnnotations.size === 0 ? '0.5' : '1';
        shareBtn.textContent = `分享选中的标注 (${this.selectedAnnotations.size})`;
      }
    } catch (error) {
      this.log(`Error updating selection UI: ${error.message}`, 'error');
    }
  },

  /**
   * 批量选择操作
   */
  selectAll() {
    this.selectedAnnotations.clear();
    this.availableAnnotations.forEach(annotation => {
      this.selectedAnnotations.add(annotation.id);
    });
    this.updateAllAnnotationElements();
  },

  selectNone() {
    this.selectedAnnotations.clear();
    this.updateAllAnnotationElements();
  },

  selectByType(type) {
    this.selectedAnnotations.clear();
    this.availableAnnotations.forEach(annotation => {
      if (this.getAnnotationType(annotation) === type) {
        this.selectedAnnotations.add(annotation.id);
      }
    });
    this.updateAllAnnotationElements();
  },

  /**
   * 更新所有标注元素状态
   */
  updateAllAnnotationElements() {
    try {
      // 获取当前活动窗口的document
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      if (!win || !win.document) {
        this.log("No active window found for updating annotation elements", 'warn');
        return;
      }

      const elements = win.document.querySelectorAll('.annotation-item');
      elements.forEach(element => {
        const annotationId = element.dataset.annotationId;
        if (annotationId) {
          this.updateAnnotationElement(element, annotationId);
        }
      });
    } catch (error) {
      this.log(`Error updating annotation elements: ${error.message}`, 'error');
    }
  },

  /**
   * 排序标注
   */
  sortAnnotations(annotations, sortBy) {
    try {
      const sorted = [...annotations];

      switch (sortBy) {
        case 'created':
          return sorted.sort((a, b) => {
            const dateA = new Date(a.dateCreated || 0);
            const dateB = new Date(b.dateCreated || 0);
            return dateB - dateA; // 最新的在前
          });

        case 'page':
          return sorted.sort((a, b) => {
            const pageA = parseInt(a.annotationPageLabel || a.getField?.('annotationPageLabel') || '0');
            const pageB = parseInt(b.annotationPageLabel || b.getField?.('annotationPageLabel') || '0');
            return pageA - pageB;
          });

        case 'type':
          return sorted.sort((a, b) => {
            const typeA = this.getAnnotationType(a);
            const typeB = this.getAnnotationType(b);
            return typeA.localeCompare(typeB);
          });

        default:
          return sorted;
      }
    } catch (error) {
      this.log(`Error sorting annotations: ${error.message}`, 'error');
      return annotations;
    }
  },

  /**
   * 切换预览模式
   */
  togglePreviewMode(container) {
    try {
      const button = container.querySelector('#toggle-preview-btn');
      const annotationItems = container.querySelectorAll('.annotation-item');

      const isPreviewMode = button.textContent === '退出预览';

      if (isPreviewMode) {
        // 退出预览模式
        button.textContent = '预览模式';
        annotationItems.forEach(item => {
          item.style.transform = 'scale(1)';
          item.style.margin = '0 0 10px 0';
        });
      } else {
        // 进入预览模式
        button.textContent = '退出预览';
        annotationItems.forEach(item => {
          item.style.transform = 'scale(0.9)';
          item.style.margin = '5px';
        });
      }
    } catch (error) {
      this.log(`Error toggling preview mode: ${error.message}`, 'error');
    }
  },

  /**
   * 显示社交预览
   */
  showSocialPreview(annotation) {
    try {
      const text = this.getAnnotationText(annotation);
      const comment = this.getAnnotationComment(annotation);
      const type = this.getAnnotationType(annotation);

      let socialContent = `社交功能预览\n\n`;
      socialContent += `标注类型: ${this.getTypeDisplayName(type)}\n`;

      if (text) {
        socialContent += `内容: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n`;
      }

      if (comment) {
        socialContent += `评论: ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}\n`;
      }

      socialContent += `\n分享后其他用户可以:\n`;
      socialContent += `👍 点赞这个标注\n`;
      socialContent += `💬 添加评论和讨论\n`;
      socialContent += `🔗 分享给其他研究者\n`;
      socialContent += `📊 查看标注统计信息\n`;
      socialContent += `🏷️ 添加相关标签\n`;

      // 获取当前隐私设置
      const win = Services.wm.getMostRecentWindow('navigator:browser') ||
                  Services.wm.getMostRecentWindow('mail:3pane') ||
                  Services.wm.getMostRecentWindow(null);

      let privacyLevel = 'public';
      if (win && win.document) {
        const privacySelect = win.document.querySelector('#privacy-select');
        privacyLevel = privacySelect ? privacySelect.value : 'public';
      }

      const privacyText = {
        'public': '公开 - 所有用户可见',
        'shared': '仅好友 - 仅关注的用户可见',
        'private': '私人 - 仅自己可见'
      };

      socialContent += `\n当前隐私设置: ${privacyText[privacyLevel] || '公开'}`;

      alert(socialContent);

    } catch (error) {
      this.log(`Error showing social preview: ${error.message}`, 'error');
    }
  },

  /**
   * 显示标注预览
   */
  showAnnotationPreview(annotation) {
    try {
      const text = this.getAnnotationText(annotation);
      const comment = this.getAnnotationComment(annotation);
      const type = this.getAnnotationType(annotation);
      const page = this.getAnnotationPageInfo(annotation);

      let previewContent = `
        <div style="padding: 15px;">
          <h3 style="margin: 0 0 10px 0; color: #333;">标注预览</h3>
          <div style="margin-bottom: 10px;">
            <strong>类型:</strong> ${this.getTypeDisplayName(type)} |
            <strong>位置:</strong> ${page}
          </div>
      `;

      if (text) {
        previewContent += `
          <div style="margin-bottom: 10px;">
            <strong>选中文本:</strong>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px;">
              "${text}"
            </div>
          </div>
        `;
      }

      if (comment) {
        previewContent += `
          <div style="margin-bottom: 10px;">
            <strong>评论:</strong>
            <div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 5px;">
              ${comment}
            </div>
          </div>
        `;
      }

      previewContent += `</div>`;

      // 简单的预览提示
      alert(previewContent.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim());

    } catch (error) {
      this.log(`Error showing annotation preview: ${error.message}`, 'error');
    }
  },

  /**
   * 处理分享操作
   */
  async handleShare(container) {
    try {
      if (this.selectedAnnotations.size === 0) {
        alert('请至少选择一个标注进行分享');
        return;
      }

      const privacySelect = container.querySelector('#privacy-select');
      const privacyLevel = privacySelect ? privacySelect.value : 'public';

      // 获取选中的标注数据
      const selectedAnnotationData = this.availableAnnotations.filter(annotation =>
        this.selectedAnnotations.has(annotation.id)
      );

      this.log(`Sharing ${selectedAnnotationData.length} annotations with privacy level: ${privacyLevel}`);

      // 关闭选择器
      this.closeSelector();

      // 返回选择结果
      if (this.resolveSelection) {
        this.resolveSelection({
          annotations: selectedAnnotationData,
          privacyLevel: privacyLevel,
          count: selectedAnnotationData.length
        });
      }

    } catch (error) {
      this.log(`Error handling share: ${error.message}`, 'error');
      alert('分享过程中出现错误，请重试');
    }
  },

  /**
   * 关闭选择器
   */
  closeSelector() {
    try {
      if (this.selectorElement && this.selectorElement.parentNode) {
        this.selectorElement.parentNode.removeChild(this.selectorElement);
      }
      this.selectorElement = null;
      this.isVisible = false;
      this.selectedAnnotations.clear();
      this.availableAnnotations = [];

      this.log("Selector closed");
    } catch (error) {
      this.log(`Error closing selector: ${error.message}`, 'error');
    }
  },

  /**
   * 更新选择器UI状态
   */
  updateSelectorUI() {
    // UI更新逻辑在对话框的JavaScript中处理
    this.log(`Updated selector UI with ${this.selectedAnnotations.size} selected annotations`);
  },

  /**
   * 获取选中的标注
   */
  getSelectedAnnotations() {
    return this.availableAnnotations.filter(annotation => 
      this.selectedAnnotations.has(annotation.id)
    );
  },

  /**
   * 更新社交功能预览
   */
  updateSocialPreview(container, annotations) {
    try {
      const socialPreviewArea = container.querySelector('#social-preview-area');
      if (!socialPreviewArea) {
        return;
      }

      // 清空现有内容
      socialPreviewArea.innerHTML = '';

      // 只有选中的标注才显示社交预览
      const selectedAnnotations = annotations.filter(ann =>
        this.selectedAnnotations.has(ann.id)
      );

      if (selectedAnnotations.length === 0) {
        socialPreviewArea.innerHTML = `
          <div style="text-align: center; color: #666; font-size: 12px; padding: 10px;">
            选择标注后查看社交功能预览
          </div>
        `;
        return;
      }

      // 创建社交功能面板
      if (typeof SocialFeatures !== 'undefined' &&
          typeof SocialFeatures.createSocialQuickPanel === 'function') {
        const socialPanel = SocialFeatures.createSocialQuickPanel(container, selectedAnnotations);
        if (socialPanel) {
          socialPreviewArea.appendChild(socialPanel);
        }
      } else {
        // 回退到简单的社交预览
        socialPreviewArea.innerHTML = `
          <div class="simple-social-preview" style="
            background: #f0f8ff;
            border: 1px solid #b3d9ff;
            border-radius: 6px;
            padding: 12px;
            font-size: 12px;
          ">
            <div style="font-weight: bold; margin-bottom: 8px;">🌟 社交功能预览</div>
            <div style="color: #666;">
              分享 ${selectedAnnotations.length} 个标注后，其他用户可以点赞、评论和讨论您的内容
            </div>
          </div>
        `;
      }

    } catch (error) {
      this.log(`Error updating social preview: ${error.message}`, 'error');
    }
  },

  /**
   * 清除选择
   */
  clearSelection() {
    this.selectedAnnotations.clear();
    this.availableAnnotations = [];
    this.isVisible = false;

    if (this.selectorElement) {
      this.selectorElement.close();
      this.selectorElement = null;
    }
  }
};

// 将模块附加到Zotero.Researchopia
if (typeof Zotero !== 'undefined' && Zotero.Researchopia) {
  Zotero.Researchopia.AnnotationSelector = AnnotationSelector;
  Zotero.debug("Researchopia: AnnotationSelector attached to Zotero.Researchopia");
}

// 也将其设为全局变量以便在主插件中使用
if (typeof window !== 'undefined') {
  window.AnnotationSelector = AnnotationSelector;
}

// 导出模块（用于Node.js环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationSelector;
}

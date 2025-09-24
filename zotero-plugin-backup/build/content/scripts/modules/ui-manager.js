/**
 * 用户界面管理器 - UI Manager
 * 负责在Zotero中创建和管理研学港相关的用户界面元素
 */

class UIManager {
  constructor() {
    this.initialized = false;
    this.annotationPanel = null;
    this.toolbarButton = null;
    this.menuItems = [];
    this.currentItem = null;
    this.preferences = {
      showSharedAnnotations: true,
      showPrivateAnnotations: true,
      autoSync: true,
      realtimeUpdates: true
    };
    
    Researchopia.log('UIManager initialized');
  }

  /**
   * 初始化用户界面
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 等待Zotero UI完全加载
      await Zotero.uiReadyPromise;
      
      // 创建界面元素
      this.createAnnotationPanel();
      this.createMenuItems();
      this.createToolbarButton();
      
      // 恢复用户偏好设置
      this.restorePreferences();
      
      Researchopia.log('UIManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.initialize');
    }
  }

  /**
   * 在Item Pane中创建标注面板
   */
  createAnnotationPanel() {
    try {
      const itemPane = document.getElementById('zotero-item-pane');
      if (!itemPane) {
        Researchopia.log('Item pane not found, retrying in 1 second');
        setTimeout(() => this.createAnnotationPanel(), 1000);
        return;
      }

      // 创建研学港标注面板容器
      const panelContainer = document.createElement('div');
      panelContainer.id = 'researchopia-annotation-panel';
      panelContainer.className = 'researchopia-panel';
      
      // 创建面板头部
      const panelHeader = document.createElement('div');
      panelHeader.className = 'researchopia-panel-header';
      panelHeader.innerHTML = `
        <div class="panel-title">
          <img src="${Researchopia.rootURI}icons/icon-16.png" alt="研学港" />
          <span>研学港标注</span>
        </div>
        <div class="panel-controls">
          <button id="researchopia-sync-btn" title="同步标注">
            <span class="sync-icon">⟲</span>
          </button>
          <button id="researchopia-settings-btn" title="设置">
            <span class="settings-icon">⚙</span>
          </button>
        </div>
      `;

      // 创建面板内容区域
      const panelContent = document.createElement('div');
      panelContent.className = 'researchopia-panel-content';
      panelContent.innerHTML = `
        <div id="researchopia-loading" class="loading-state">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
        <div id="researchopia-annotations" class="annotations-container" style="display: none;">
          <div class="filter-controls">
            <select id="annotation-filter">
              <option value="all">所有标注</option>
              <option value="shared">共享标注</option>
              <option value="private">私人标注</option>
            </select>
            <input type="text" id="annotation-search" placeholder="搜索标注..." />
          </div>
          <div id="annotations-list" class="annotations-list"></div>
        </div>
        <div id="researchopia-empty" class="empty-state" style="display: none;">
          <div class="empty-icon">📝</div>
          <p>暂无标注</p>
          <p class="empty-hint">选择一个PDF文档查看相关标注</p>
        </div>
      `;

      // 组装面板
      panelContainer.appendChild(panelHeader);
      panelContainer.appendChild(panelContent);

      // 插入到Item Pane中
      itemPane.appendChild(panelContainer);
      
      // 绑定事件监听器
      this.bindPanelEvents();
      
      // 加载样式
      this.loadPanelStyles();
      
      this.annotationPanel = panelContainer;
      Researchopia.log('Annotation panel created successfully');
      
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.createAnnotationPanel');
    }
  }

  /**
   * 绑定面板事件
   */
  bindPanelEvents() {
    try {
      // 同步按钮
      const syncBtn = document.getElementById('researchopia-sync-btn');
      if (syncBtn) {
        syncBtn.addEventListener('click', () => {
          this.handleSyncClick();
        });
      }

      // 设置按钮
      const settingsBtn = document.getElementById('researchopia-settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          this.showSettingsDialog();
        });
      }

      // 过滤器
      const filterSelect = document.getElementById('annotation-filter');
      if (filterSelect) {
        filterSelect.addEventListener('change', () => {
          this.updateAnnotationDisplay();
        });
      }

      // 搜索框
      const searchInput = document.getElementById('annotation-search');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          this.updateAnnotationDisplay();
        });
      }

    } catch (error) {
      Researchopia.handleError(error, 'UIManager.bindPanelEvents');
    }
  }

  /**
   * 加载面板样式
   */
  loadPanelStyles() {
    try {
      const styleId = 'researchopia-panel-styles';
      if (document.getElementById(styleId)) {
        return; // 样式已加载
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .researchopia-panel {
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 8px 0;
          background: #fff;
        }
        
        .researchopia-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f5f5f5;
          border-bottom: 1px solid #ddd;
          border-radius: 4px 4px 0 0;
        }
        
        .panel-title {
          display: flex;
          align-items: center;
          font-weight: bold;
          color: #333;
        }
        
        .panel-title img {
          width: 16px;
          height: 16px;
          margin-right: 6px;
        }
        
        .panel-controls {
          display: flex;
          gap: 4px;
        }
        
        .panel-controls button {
          background: none;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .panel-controls button:hover {
          background: #e9e9e9;
        }
        
        .researchopia-panel-content {
          padding: 12px;
          max-height: 400px;
          overflow-y: auto;
        }
        
        .loading-state, .empty-state {
          text-align: center;
          padding: 20px;
          color: #666;
        }
        
        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 8px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .filter-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        
        .filter-controls select,
        .filter-controls input {
          flex: 1;
          padding: 4px 8px;
          border: 1px solid #ccc;
          border-radius: 3px;
          font-size: 12px;
        }
        
        .annotations-list {
          max-height: 300px;
          overflow-y: auto;
        }
        
        .annotation-item {
          border: 1px solid #eee;
          border-radius: 4px;
          margin-bottom: 8px;
          padding: 8px;
          background: #fafafa;
        }
        
        .annotation-item:hover {
          background: #f0f0f0;
        }
        
        .annotation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        
        .annotation-type {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 10px;
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .annotation-author {
          font-size: 11px;
          color: #666;
        }
        
        .annotation-content {
          font-size: 12px;
          line-height: 1.4;
          margin-bottom: 4px;
        }
        
        .annotation-text {
          background: #fff3cd;
          padding: 4px;
          border-radius: 2px;
          margin-bottom: 4px;
        }
        
        .annotation-comment {
          color: #555;
          font-style: italic;
        }
        
        .annotation-actions {
          display: flex;
          gap: 8px;
          font-size: 11px;
        }
        
        .annotation-actions button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 2px 4px;
        }
        
        .annotation-actions button:hover {
          color: #333;
        }
        
        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        
        .empty-hint {
          font-size: 12px;
          color: #999;
        }
      `;
      
      document.head.appendChild(style);
      Researchopia.log('Panel styles loaded');
      
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.loadPanelStyles');
    }
  }

  /**
   * 创建菜单项
   */
  createMenuItems() {
    try {
      // 在工具菜单中添加研学港选项
      const toolsMenu = document.getElementById('menu_ToolsPopup');
      if (toolsMenu) {
        const separator = document.createElement('menuseparator');
        toolsMenu.appendChild(separator);

        const researchopiaMenu = document.createElement('menu');
        researchopiaMenu.setAttribute('label', '研学港');
        
        const menuPopup = document.createElement('menupopup');
        
        // 同步标注菜单项
        const syncMenuItem = document.createElement('menuitem');
        syncMenuItem.setAttribute('label', '同步标注');
        syncMenuItem.addEventListener('command', () => {
          this.handleSyncClick();
        });
        menuPopup.appendChild(syncMenuItem);
        
        // 设置菜单项
        const settingsMenuItem = document.createElement('menuitem');
        settingsMenuItem.setAttribute('label', '设置');
        settingsMenuItem.addEventListener('command', () => {
          this.showSettingsDialog();
        });
        menuPopup.appendChild(settingsMenuItem);
        
        // 关于菜单项
        const aboutMenuItem = document.createElement('menuitem');
        aboutMenuItem.setAttribute('label', '关于研学港');
        aboutMenuItem.addEventListener('command', () => {
          this.showAboutDialog();
        });
        menuPopup.appendChild(aboutMenuItem);
        
        researchopiaMenu.appendChild(menuPopup);
        toolsMenu.appendChild(researchopiaMenu);
        
        this.menuItems.push(researchopiaMenu);
        Researchopia.log('Menu items created');
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.createMenuItems');
    }
  }

  /**
   * 创建工具栏按钮
   */
  createToolbarButton() {
    try {
      const toolbar = document.getElementById('zotero-toolbar');
      if (toolbar) {
        const button = document.createElement('toolbarbutton');
        button.id = 'researchopia-toolbar-button';
        button.setAttribute('label', '研学港');
        button.setAttribute('tooltiptext', '研学港标注同步');
        button.setAttribute('image', `${Researchopia.rootURI}icons/icon-16.png`);
        
        button.addEventListener('command', () => {
          this.handleSyncClick();
        });
        
        toolbar.appendChild(button);
        this.toolbarButton = button;
        
        Researchopia.log('Toolbar button created');
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.createToolbarButton');
    }
  }

  /**
   * 更新Item Pane显示
   * @param {Object} item - 选中的Zotero条目
   */
  async updateItemPane(item) {
    try {
      this.currentItem = item;
      
      if (!this.annotationPanel) {
        return;
      }

      const loadingDiv = document.getElementById('researchopia-loading');
      const annotationsDiv = document.getElementById('researchopia-annotations');
      const emptyDiv = document.getElementById('researchopia-empty');

      // 显示加载状态
      if (loadingDiv) loadingDiv.style.display = 'block';
      if (annotationsDiv) annotationsDiv.style.display = 'none';
      if (emptyDiv) emptyDiv.style.display = 'none';

      if (!item || !item.isPDFAttachment()) {
        // 非PDF文档，显示空状态
        if (loadingDiv) loadingDiv.style.display = 'none';
        if (emptyDiv) emptyDiv.style.display = 'block';
        return;
      }

      // 获取标注数据
      await this.loadAnnotationsForItem(item);
      
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.updateItemPane');
    }
  }

  /**
   * 加载指定条目的标注
   * @param {Object} item - Zotero条目
   */
  async loadAnnotationsForItem(item) {
    try {
      // 获取本地标注
      const localAnnotations = await Researchopia.modules.annotationManager?.getAnnotationsForItem(item.id) || [];
      
      // 获取远程标注（如果有DOI）
      let remoteAnnotations = [];
      const doi = this.extractDOI(item);
      if (doi && Researchopia.modules.syncManager) {
        remoteAnnotations = await Researchopia.modules.syncManager.getAnnotationsByDoi(doi);
      }

      // 合并并去重标注
      const allAnnotations = this.mergeAnnotations(localAnnotations, remoteAnnotations);
      
      // 更新显示
      this.displayAnnotations(allAnnotations);
      
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.loadAnnotationsForItem');
      this.showErrorState('加载标注失败');
    }
  }

  /**
   * 显示标注列表
   * @param {Array} annotations - 标注数组
   */
  displayAnnotations(annotations) {
    try {
      const loadingDiv = document.getElementById('researchopia-loading');
      const annotationsDiv = document.getElementById('researchopia-annotations');
      const emptyDiv = document.getElementById('researchopia-empty');
      const annotationsList = document.getElementById('annotations-list');

      if (loadingDiv) loadingDiv.style.display = 'none';

      if (!annotations || annotations.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        if (annotationsDiv) annotationsDiv.style.display = 'none';
        return;
      }

      if (annotationsDiv) annotationsDiv.style.display = 'block';
      if (emptyDiv) emptyDiv.style.display = 'none';

      if (annotationsList) {
        annotationsList.innerHTML = '';
        
        // 应用过滤和搜索
        const filteredAnnotations = this.filterAnnotations(annotations);
        
        filteredAnnotations.forEach(annotation => {
          const annotationElement = this.createAnnotationElement(annotation);
          annotationsList.appendChild(annotationElement);
        });
      }

      Researchopia.log(`Displayed ${annotations.length} annotations`);
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.displayAnnotations');
    }
  }

  /**
   * 创建标注元素
   * @param {Object} annotation - 标注对象
   * @returns {HTMLElement} 标注DOM元素
   */
  createAnnotationElement(annotation) {
    const div = document.createElement('div');
    div.className = 'annotation-item';
    div.dataset.annotationId = annotation.id;

    const typeLabel = this.getAnnotationTypeLabel(annotation.type);
    const authorName = annotation.metadata?.author?.name || '未知用户';
    const createdDate = new Date(annotation.createdAt).toLocaleDateString();

    div.innerHTML = `
      <div class="annotation-header">
        <span class="annotation-type">${typeLabel}</span>
        <span class="annotation-author">${authorName} · ${createdDate}</span>
      </div>
      <div class="annotation-content">
        ${annotation.content?.text ? `<div class="annotation-text">${this.escapeHtml(annotation.content.text)}</div>` : ''}
        ${annotation.content?.comment ? `<div class="annotation-comment">${this.escapeHtml(annotation.content.comment)}</div>` : ''}
      </div>
      <div class="annotation-actions">
        <button onclick="Researchopia.modules.uiManager.likeAnnotation('${annotation.id}')">👍 点赞</button>
        <button onclick="Researchopia.modules.uiManager.replyToAnnotation('${annotation.id}')">💬 回复</button>
        <button onclick="Researchopia.modules.uiManager.shareAnnotation('${annotation.id}')">📤 分享</button>
      </div>
    `;

    return div;
  }

  /**
   * 处理同步按钮点击
   */
  async handleSyncClick() {
    try {
      const syncBtn = document.getElementById('researchopia-sync-btn');
      if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<span class="sync-icon spinning">⟲</span>';
      }

      if (Researchopia.modules.syncManager) {
        await Researchopia.modules.syncManager.triggerManualSync();
      }

      // 刷新当前显示
      if (this.currentItem) {
        await this.updateItemPane(this.currentItem);
      }

      Researchopia.log('Manual sync completed');
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.handleSyncClick');
    } finally {
      const syncBtn = document.getElementById('researchopia-sync-btn');
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = '<span class="sync-icon">⟲</span>';
      }
    }
  }

  /**
   * 显示设置对话框
   */
  showSettingsDialog() {
    // TODO: 实现设置对话框
    alert('设置功能即将推出！');
  }

  /**
   * 显示关于对话框
   */
  showAboutDialog() {
    const aboutText = `研学港 Zotero 插件 v${Researchopia.version}\n\n` +
                     `研学并进，智慧共享\n\n` +
                     `访问 https://www.researchopia.com 了解更多信息`;
    alert(aboutText);
  }

  // 工具方法
  extractDOI(item) {
    try {
      const doi = item.getField('DOI');
      if (doi) return doi.replace(/^doi:/, '').trim();
      
      const url = item.getField('url');
      if (url) {
        const doiMatch = url.match(/doi\.org\/(.+)$/);
        if (doiMatch) return doiMatch[1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  mergeAnnotations(local, remote) {
    const merged = [...local];
    const localIds = new Set(local.map(a => a.id));
    
    remote.forEach(annotation => {
      if (!localIds.has(annotation.id)) {
        merged.push(annotation);
      }
    });
    
    return merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  filterAnnotations(annotations) {
    const filter = document.getElementById('annotation-filter')?.value || 'all';
    const search = document.getElementById('annotation-search')?.value.toLowerCase() || '';
    
    return annotations.filter(annotation => {
      // 应用类型过滤
      if (filter === 'shared' && annotation.metadata?.visibility === 'private') return false;
      if (filter === 'private' && annotation.metadata?.visibility !== 'private') return false;
      
      // 应用搜索过滤
      if (search) {
        const text = (annotation.content?.text || '').toLowerCase();
        const comment = (annotation.content?.comment || '').toLowerCase();
        if (!text.includes(search) && !comment.includes(search)) return false;
      }
      
      return true;
    });
  }

  getAnnotationTypeLabel(type) {
    const labels = {
      'highlight': '高亮',
      'underline': '下划线',
      'note': '笔记',
      'image': '图片',
      'ink': '手绘'
    };
    return labels[type] || '标注';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showErrorState(message) {
    const loadingDiv = document.getElementById('researchopia-loading');
    const annotationsDiv = document.getElementById('researchopia-annotations');
    const emptyDiv = document.getElementById('researchopia-empty');

    if (loadingDiv) loadingDiv.style.display = 'none';
    if (annotationsDiv) annotationsDiv.style.display = 'none';
    if (emptyDiv) {
      emptyDiv.style.display = 'block';
      emptyDiv.innerHTML = `
        <div class="empty-icon">⚠️</div>
        <p>${message}</p>
      `;
    }
  }

  updateAnnotationDisplay() {
    if (this.currentItem) {
      this.loadAnnotationsForItem(this.currentItem);
    }
  }

  // 社交功能实现
  async likeAnnotation(annotationId) {
    try {
      // 实现点赞功能
      const response = await this.makeAPIRequest('POST', `/api/v1/annotations/${annotationId}/like`);
      if (response.success) {
        // 更新UI显示
        this.updateAnnotationLikes(annotationId, response.data.likes);
        Researchopia.log(`Annotation liked: ${annotationId}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.likeAnnotation');
      this.showNotification('点赞失败，请重试', 'error');
    }
  }

  async replyToAnnotation(annotationId) {
    try {
      const replyText = prompt('请输入回复内容：');
      if (!replyText || !replyText.trim()) return;

      const response = await this.makeAPIRequest('POST', `/api/v1/annotations/${annotationId}/reply`, {
        content: replyText.trim()
      });

      if (response.success) {
        // 更新UI显示
        this.updateAnnotationReplies(annotationId, response.data.reply);
        Researchopia.log(`Reply added to annotation: ${annotationId}`);
        this.showNotification('回复成功', 'success');
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.replyToAnnotation');
      this.showNotification('回复失败，请重试', 'error');
    }
  }

  async shareAnnotation(annotationId) {
    try {
      // 显示分享对话框
      this.showShareDialog(annotationId);
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.shareAnnotation');
      this.showNotification('分享失败，请重试', 'error');
    }
  }

  // 偏好设置管理
  getPreferences() {
    return { ...this.preferences };
  }

  setPreferences(prefs) {
    this.preferences = { ...this.preferences, ...prefs };
    this.savePreferences();
  }

  savePreferences() {
    try {
      Zotero.Prefs.set('extensions.researchopia.preferences', JSON.stringify(this.preferences));
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.savePreferences');
    }
  }

  restorePreferences() {
    try {
      const prefsJson = Zotero.Prefs.get('extensions.researchopia.preferences');
      if (prefsJson) {
        this.preferences = { ...this.preferences, ...JSON.parse(prefsJson) };
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.restorePreferences');
    }
  }

  /**
   * 更新标注点赞数
   * @param {string} annotationId - 标注ID
   * @param {number} likes - 点赞数
   */
  updateAnnotationLikes(annotationId, likes) {
    const annotationElement = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (annotationElement) {
      const likeButton = annotationElement.querySelector('.like-button');
      if (likeButton) {
        likeButton.textContent = `👍 ${likes}`;
      }
    }
  }

  /**
   * 更新标注回复
   * @param {string} annotationId - 标注ID
   * @param {Object} reply - 回复对象
   */
  updateAnnotationReplies(annotationId, reply) {
    const annotationElement = document.querySelector(`[data-annotation-id="${annotationId}"]`);
    if (annotationElement) {
      let repliesContainer = annotationElement.querySelector('.replies-container');
      if (!repliesContainer) {
        repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        annotationElement.appendChild(repliesContainer);
      }

      const replyElement = document.createElement('div');
      replyElement.className = 'reply-item';
      replyElement.innerHTML = `
        <div class="reply-author">${reply.author.name}</div>
        <div class="reply-content">${this.escapeHtml(reply.content)}</div>
        <div class="reply-time">${new Date(reply.createdAt).toLocaleString()}</div>
      `;

      repliesContainer.appendChild(replyElement);
    }
  }

  /**
   * 显示分享对话框
   * @param {string} annotationId - 标注ID
   */
  showShareDialog(annotationId) {
    const dialog = document.createElement('div');
    dialog.className = 'share-dialog-overlay';
    dialog.innerHTML = `
      <div class="share-dialog">
        <div class="share-dialog-header">
          <h3>分享标注</h3>
          <button class="close-button" onclick="this.closest('.share-dialog-overlay').remove()">×</button>
        </div>
        <div class="share-dialog-content">
          <div class="share-options">
            <label>
              <input type="radio" name="visibility" value="private" checked>
              <span>私有 - 仅自己可见</span>
            </label>
            <label>
              <input type="radio" name="visibility" value="shared">
              <span>共享 - 研学港用户可见</span>
            </label>
            <label>
              <input type="radio" name="visibility" value="public">
              <span>公开 - 所有人可见</span>
            </label>
          </div>
          <div class="share-actions">
            <button class="cancel-button" onclick="this.closest('.share-dialog-overlay').remove()">取消</button>
            <button class="confirm-button" onclick="Researchopia.modules.uiManager.confirmShare('${annotationId}', this)">确认</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);
  }

  /**
   * 确认分享设置
   * @param {string} annotationId - 标注ID
   * @param {HTMLElement} button - 确认按钮
   */
  async confirmShare(annotationId, button) {
    try {
      const dialog = button.closest('.share-dialog-overlay');
      const visibility = dialog.querySelector('input[name="visibility"]:checked').value;

      const response = await this.makeAPIRequest('PUT', `/api/v1/annotations/${annotationId}`, {
        visibility: visibility
      });

      if (response.success) {
        this.showNotification('分享设置已更新', 'success');
        dialog.remove();

        // 刷新标注显示
        if (this.currentItem) {
          await this.updateItemPane(this.currentItem);
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.confirmShare');
      this.showNotification('分享设置失败，请重试', 'error');
    }
  }

  /**
   * 显示通知消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success, error, info)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // 添加到页面
    document.body.appendChild(notification);

    // 自动移除
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * 发起API请求
   * @param {string} method - HTTP方法
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   */
  async makeAPIRequest(method, endpoint, data = null) {
    try {
      const serverUrl = Researchopia.config.activeServerUrl || 'https://www.researchopia.com';
      const url = `${serverUrl}${endpoint}`;

      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // 添加认证头
      const authToken = Researchopia.modules.authManager?.getToken();
      if (authToken) {
        options.headers['Authorization'] = `Bearer ${authToken}`;
      }

      // 添加请求体
      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error?.message || 'Request failed');
      }

      return responseData;
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.makeAPIRequest');
      throw error;
    }
  }

  /**
   * 更新认证状态显示
   * @param {boolean} isAuthenticated - 是否已认证
   * @param {Object} user - 用户信息
   */
  updateAuthStatus(isAuthenticated, user) {
    try {
      // 更新面板头部的用户信息
      const panelHeader = document.querySelector('.researchopia-panel-header');
      if (panelHeader) {
        let userInfo = panelHeader.querySelector('.user-info');
        if (!userInfo) {
          userInfo = document.createElement('div');
          userInfo.className = 'user-info';
          panelHeader.appendChild(userInfo);
        }

        if (isAuthenticated && user) {
          userInfo.innerHTML = `
            <span class="user-name">${user.name}</span>
            <button class="logout-button" onclick="Researchopia.modules.authManager.logout()">登出</button>
          `;
        } else {
          userInfo.innerHTML = `
            <button class="login-button" onclick="Researchopia.modules.authManager.startAuthentication()">登录</button>
          `;
        }
      }

      // 更新工具栏按钮状态
      if (this.toolbarButton) {
        this.toolbarButton.setAttribute('tooltiptext',
          isAuthenticated ? `研学港 - ${user?.name || '已登录'}` : '研学港 - 未登录'
        );
      }

      Researchopia.log(`Auth status updated: ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`);
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.updateAuthStatus');
    }
  }

  /**
   * 更新连接状态显示
   * @param {string} state - 连接状态
   */
  updateConnectionStatus(state) {
    try {
      const statusIndicator = document.querySelector('.connection-status');
      if (statusIndicator) {
        statusIndicator.className = `connection-status status-${state}`;
        statusIndicator.textContent = this.getConnectionStatusText(state);
      }

      Researchopia.log(`Connection status updated: ${state}`);
    } catch (error) {
      Researchopia.handleError(error, 'UIManager.updateConnectionStatus');
    }
  }

  /**
   * 获取连接状态文本
   * @param {string} state - 连接状态
   * @returns {string} 状态文本
   */
  getConnectionStatusText(state) {
    const statusTexts = {
      'connected': '已连接',
      'connecting': '连接中...',
      'disconnected': '已断开',
      'error': '连接错误'
    };
    return statusTexts[state] || '未知状态';
  }

  /**
   * 更新批量处理进度
   * @param {Object} progress - 进度信息
   */
  updateBatchProgress(progress) {
    try {
      let progressBar = document.querySelector('.batch-progress');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'batch-progress';
        progressBar.innerHTML = `
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <div class="progress-text"></div>
        `;

        const panelContent = document.querySelector('.researchopia-panel-content');
        if (panelContent) {
          panelContent.insertBefore(progressBar, panelContent.firstChild);
        }
      }

      const progressFill = progressBar.querySelector('.progress-fill');
      const progressText = progressBar.querySelector('.progress-text');

      if (progressFill) {
        progressFill.style.width = `${progress.percentage}%`;
      }

      if (progressText) {
        progressText.textContent = `处理中: ${progress.processed}/${progress.total} (${progress.percentage}%)`;
      }

      // 处理完成后隐藏进度条
      if (progress.processed >= progress.total) {
        setTimeout(() => {
          progressBar.remove();
        }, 2000);
      }

    } catch (error) {
      Researchopia.handleError(error, 'UIManager.updateBatchProgress');
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 移除UI元素
    if (this.annotationPanel) {
      this.annotationPanel.remove();
      this.annotationPanel = null;
    }

    if (this.toolbarButton) {
      this.toolbarButton.remove();
      this.toolbarButton = null;
    }

    this.menuItems.forEach(item => item.remove());
    this.menuItems = [];

    // 移除通知和对话框
    document.querySelectorAll('.notification, .share-dialog-overlay').forEach(el => el.remove());

    this.initialized = false;
    Researchopia.log('UIManager cleaned up');
  }
}

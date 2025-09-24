/**
 * Item Pane管理器 - 右侧面板UI集成
 */
class ItemPaneManager {
  constructor(annotationManager, authManager) {
    this.annotationManager = annotationManager;
    this.authManager = authManager;
    this.registeredSectionID = null;
    this.currentItem = null;
    this.sharedAnnotations = [];
  }

  /**
   * 初始化Item Pane集成
   */
  initialize() {
    try {
      this.registeredSectionID = Zotero.ItemPaneManager.registerSection({
        paneID: "researchopia-annotations",
        pluginID: "researchopia@zotero.plugin",
        header: {
          l10nID: "researchopia-annotations-header",
          icon: "chrome://researchopia/content/icons/icon16.svg",
        },
        sidenav: {
          l10nID: "researchopia-annotations-sidenav",
          icon: "chrome://researchopia/content/icons/icon16.svg",
        },
        onRender: this.renderAnnotationsPane.bind(this),
        onDestroy: this.destroyAnnotationsPane.bind(this),
        onItemChange: this.handleItemChange.bind(this),
      });

      Zotero.debug(`ItemPaneManager: Registered section with ID: ${this.registeredSectionID}`);
    } catch (error) {
      Zotero.debug(`ItemPaneManager: Registration failed: ${error.message}`);
    }
  }

  /**
   * 渲染标注面板
   * @param {Object} params - 渲染参数
   */
  async renderAnnotationsPane({ body, item, editable, tabType }) {
    try {
      this.currentItem = item;
      
      if (!item || !item.getField('DOI')) {
        this.renderNoDataMessage(body, '此文献没有DOI，无法显示共享标注');
        return;
      }

      // 显示加载状态
      this.renderLoadingState(body);

      // 获取共享标注
      const doi = item.getField('DOI');
      this.sharedAnnotations = await this.annotationManager.fetchSharedAnnotations(doi);

      // 渲染标注内容
      await this.renderAnnotationsList(body, item);

    } catch (error) {
      Zotero.debug(`ItemPaneManager: Render failed: ${error.message}`);
      this.renderErrorMessage(body, `渲染失败: ${error.message}`);
    }
  }

  /**
   * 渲染标注列表
   * @param {Element} container - 容器元素
   * @param {Object} item - 文献项目
   */
  async renderAnnotationsList(container, item) {
    const doc = container.ownerDocument;
    container.innerHTML = '';

    // 创建主容器
    const mainContainer = doc.createElement('div');
    mainContainer.style.cssText = `
      padding: 15px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fafafa;
      border-radius: 8px;
      margin: 10px;
    `;

    // 创建头部区域
    const header = this.createHeader(doc, item);
    mainContainer.appendChild(header);

    // 创建操作按钮区域
    const actionBar = this.createActionBar(doc, item);
    mainContainer.appendChild(actionBar);

    // 创建标注列表
    const annotationsList = this.createAnnotationsList(doc);
    mainContainer.appendChild(annotationsList);

    container.appendChild(mainContainer);
  }

  /**
   * 创建头部区域
   * @param {Document} doc - 文档对象
   * @param {Object} item - 文献项目
   * @returns {Element} 头部元素
   */
  createHeader(doc, item) {
    const header = doc.createElement('div');
    header.style.cssText = `
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    `;

    const title = doc.createElement('h3');
    title.style.cssText = `
      margin: 0 0 8px 0;
      color: #1f2937;
      font-size: 16px;
      font-weight: 600;
    `;
    title.textContent = '共享标注';

    const subtitle = doc.createElement('div');
    subtitle.style.cssText = `
      color: #6b7280;
      font-size: 12px;
    `;
    subtitle.textContent = `${this.sharedAnnotations.length} 条共享标注`;

    header.appendChild(title);
    header.appendChild(subtitle);

    return header;
  }

  /**
   * 创建操作按钮区域
   * @param {Document} doc - 文档对象
   * @param {Object} item - 文献项目
   * @returns {Element} 操作栏元素
   */
  createActionBar(doc, item) {
    const actionBar = doc.createElement('div');
    actionBar.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    `;

    // 登录/用户状态按钮
    const authButton = this.createAuthButton(doc);
    actionBar.appendChild(authButton);

    // 如果已登录，显示分享按钮
    if (this.authManager.isLoggedIn()) {
      const shareButton = this.createShareButton(doc, item);
      actionBar.appendChild(shareButton);
    }

    // 刷新按钮
    const refreshButton = this.createRefreshButton(doc, item);
    actionBar.appendChild(refreshButton);

    return actionBar;
  }

  /**
   * 创建认证按钮
   * @param {Document} doc - 文档对象
   * @returns {Element} 按钮元素
   */
  createAuthButton(doc) {
    const button = doc.createElement('button');
    const isLoggedIn = this.authManager.isLoggedIn();
    
    button.style.cssText = `
      padding: 8px 16px;
      background: ${isLoggedIn ? '#10b981' : '#6366f1'};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
    `;

    button.textContent = isLoggedIn ? 
      `已登录: ${this.authManager.getCurrentUser()?.email || 'User'}` : 
      '登录';

    button.onclick = async () => {
      if (isLoggedIn) {
        await this.authManager.logout();
      } else {
        await this.authManager.showLoginDialog();
      }
      // 重新渲染面板
      this.renderAnnotationsPane({ 
        body: button.closest('[data-pane-id="researchopia-annotations"]'), 
        item: this.currentItem 
      });
    };

    return button;
  }

  /**
   * 创建分享按钮
   * @param {Document} doc - 文档对象
   * @param {Object} item - 文献项目
   * @returns {Element} 按钮元素
   */
  createShareButton(doc, item) {
    const button = doc.createElement('button');
    button.style.cssText = `
      padding: 8px 16px;
      background: #f59e0b;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
    `;

    button.textContent = '分享我的标注';

    button.onclick = async () => {
      await this.shareUserAnnotations(item);
    };

    return button;
  }

  /**
   * 创建刷新按钮
   * @param {Document} doc - 文档对象
   * @param {Object} item - 文献项目
   * @returns {Element} 按钮元素
   */
  createRefreshButton(doc, item) {
    const button = doc.createElement('button');
    button.style.cssText = `
      padding: 8px 16px;
      background: #6b7280;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s ease;
    `;

    button.textContent = '刷新';

    button.onclick = async () => {
      this.renderAnnotationsPane({ 
        body: button.closest('[data-pane-id="researchopia-annotations"]'), 
        item: this.currentItem 
      });
    };

    return button;
  }

  /**
   * 创建标注列表
   * @param {Document} doc - 文档对象
   * @returns {Element} 列表元素
   */
  createAnnotationsList(doc) {
    const listContainer = doc.createElement('div');
    listContainer.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: white;
    `;

    if (this.sharedAnnotations.length === 0) {
      const emptyMessage = doc.createElement('div');
      emptyMessage.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #6b7280;
        font-style: italic;
      `;
      emptyMessage.textContent = '暂无共享标注';
      listContainer.appendChild(emptyMessage);
    } else {
      this.sharedAnnotations.forEach((annotation, index) => {
        const annotationItem = this.createAnnotationItem(doc, annotation, index);
        listContainer.appendChild(annotationItem);
      });
    }

    return listContainer;
  }

  /**
   * 创建单个标注项
   * @param {Document} doc - 文档对象
   * @param {Object} annotation - 标注数据
   * @param {number} index - 索引
   * @returns {Element} 标注项元素
   */
  createAnnotationItem(doc, annotation, index) {
    const item = doc.createElement('div');
    item.style.cssText = `
      padding: 15px;
      border-bottom: 1px solid #f3f4f6;
      transition: background-color 0.2s ease;
      cursor: pointer;
    `;

    // 悬停效果
    item.onmouseover = function() {
      this.style.backgroundColor = '#f9fafb';
    };
    item.onmouseout = function() {
      this.style.backgroundColor = 'transparent';
    };

    // 创建标注类型指示器
    const typeIndicator = doc.createElement('div');
    typeIndicator.style.cssText = `
      width: 4px;
      height: 100%;
      background-color: ${annotation.color || '#ffd400'};
      position: absolute;
      left: 0;
      top: 0;
    `;
    item.style.position = 'relative';
    item.appendChild(typeIndicator);

    // 创建内容容器
    const contentContainer = doc.createElement('div');
    contentContainer.style.cssText = 'margin-left: 12px;';

    // 标注文本
    if (annotation.text) {
      const textDiv = doc.createElement('div');
      textDiv.style.cssText = `
        font-size: 14px;
        color: #1f2937;
        margin-bottom: 8px;
        line-height: 1.5;
        background-color: ${annotation.color || '#ffd400'}20;
        padding: 8px;
        border-radius: 4px;
        border-left: 3px solid ${annotation.color || '#ffd400'};
      `;
      textDiv.textContent = annotation.text;
      contentContainer.appendChild(textDiv);
    }

    // 标注评论
    if (annotation.comment) {
      const commentDiv = doc.createElement('div');
      commentDiv.style.cssText = `
        font-size: 13px;
        color: #374151;
        margin-bottom: 8px;
        font-style: italic;
        padding: 6px 0;
      `;
      commentDiv.textContent = `💭 ${annotation.comment}`;
      contentContainer.appendChild(commentDiv);
    }

    // 元信息行
    const metaDiv = doc.createElement('div');
    metaDiv.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #6b7280;
      margin-top: 8px;
    `;

    // 左侧信息
    const leftMeta = doc.createElement('div');
    leftMeta.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const userInfo = doc.createElement('span');
    userInfo.textContent = annotation.userName || '匿名用户';
    userInfo.style.fontWeight = '500';

    const pageInfo = doc.createElement('span');
    pageInfo.textContent = `第${annotation.pageLabel || '?'}页`;

    const timeInfo = doc.createElement('span');
    if (annotation.dateAdded) {
      const date = new Date(annotation.dateAdded);
      timeInfo.textContent = this.formatRelativeTime(date);
    }

    leftMeta.appendChild(userInfo);
    leftMeta.appendChild(doc.createTextNode(' • '));
    leftMeta.appendChild(pageInfo);
    if (timeInfo.textContent) {
      leftMeta.appendChild(doc.createTextNode(' • '));
      leftMeta.appendChild(timeInfo);
    }

    // 右侧操作
    const rightMeta = doc.createElement('div');
    rightMeta.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    // 点赞按钮
    const likeButton = doc.createElement('button');
    likeButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #6b7280;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
    `;
    likeButton.innerHTML = `👍 ${annotation.likes || 0}`;
    likeButton.onclick = (e) => {
      e.stopPropagation();
      this.handleLikeAnnotation(annotation);
    };

    // 回复按钮
    const replyButton = doc.createElement('button');
    replyButton.style.cssText = `
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      color: #6b7280;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
    `;
    replyButton.innerHTML = `💬 ${(annotation.replies && annotation.replies.length) || 0}`;
    replyButton.onclick = (e) => {
      e.stopPropagation();
      this.handleReplyToAnnotation(annotation);
    };

    rightMeta.appendChild(likeButton);
    rightMeta.appendChild(replyButton);

    metaDiv.appendChild(leftMeta);
    metaDiv.appendChild(rightMeta);
    contentContainer.appendChild(metaDiv);

    // 回复列表
    if (annotation.replies && annotation.replies.length > 0) {
      const repliesContainer = this.createRepliesContainer(doc, annotation.replies);
      contentContainer.appendChild(repliesContainer);
    }

    item.appendChild(contentContainer);

    // 点击整个项目的处理
    item.onclick = () => {
      this.handleAnnotationClick(annotation);
    };

    return item;
  }

  /**
   * 创建回复容器
   * @param {Document} doc - 文档对象
   * @param {Array} replies - 回复数组
   * @returns {Element} 回复容器元素
   */
  createRepliesContainer(doc, replies) {
    const container = doc.createElement('div');
    container.style.cssText = `
      margin-top: 12px;
      padding-left: 16px;
      border-left: 2px solid #e5e7eb;
    `;

    replies.forEach(reply => {
      const replyDiv = doc.createElement('div');
      replyDiv.style.cssText = `
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 12px;
      `;

      const replyContent = doc.createElement('div');
      replyContent.style.cssText = 'color: #374151; margin-bottom: 4px;';
      replyContent.textContent = reply.content;

      const replyMeta = doc.createElement('div');
      replyMeta.style.cssText = 'color: #6b7280; font-size: 11px;';
      replyMeta.textContent = `${reply.userName} • ${this.formatRelativeTime(new Date(reply.dateAdded))}`;

      replyDiv.appendChild(replyContent);
      replyDiv.appendChild(replyMeta);
      container.appendChild(replyDiv);
    });

    return container;
  }

  /**
   * 格式化相对时间
   * @param {Date} date - 日期对象
   * @returns {string} 格式化的时间字符串
   */
  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}分钟前`;
    } else {
      return '刚刚';
    }
  }

  /**
   * 处理标注点击
   * @param {Object} annotation - 标注对象
   */
  handleAnnotationClick(annotation) {
    Zotero.debug(`ItemPaneManager: Clicked annotation ${annotation.id}`);
    // TODO: 实现跳转到PDF中的标注位置
  }

  /**
   * 处理点赞标注
   * @param {Object} annotation - 标注对象
   */
  handleLikeAnnotation(annotation) {
    Zotero.debug(`ItemPaneManager: Liked annotation ${annotation.id}`);
    // TODO: 实现点赞功能
  }

  /**
   * 处理回复标注
   * @param {Object} annotation - 标注对象
   */
  handleReplyToAnnotation(annotation) {
    Zotero.debug(`ItemPaneManager: Reply to annotation ${annotation.id}`);
    // TODO: 实现回复功能
  }

  /**
   * 分享用户标注
   * @param {Object} item - 文献项目
   */
  async shareUserAnnotations(item) {
    try {
      // 显示进度提示
      const progressAlert = Zotero.alert(null, 'Researchopia', '正在提取和上传标注...', null, null, null, true);

      // 获取用户标注
      const annotations = await this.annotationManager.getItemAnnotations(item);

      if (annotations.length === 0) {
        Zotero.alert(null, 'Researchopia', '该文献没有找到标注，请先在PDF中添加标注。');
        return;
      }

      // 上传标注
      const result = await this.annotationManager.uploadAnnotations(annotations);

      // 关闭进度提示
      if (progressAlert && progressAlert.close) {
        progressAlert.close();
      }

      if (result.success) {
        const message = `成功分享 ${result.uploaded} 条标注！\n\n` +
                       `总计: ${result.total} 条\n` +
                       `成功: ${result.uploaded} 条\n` +
                       (result.errors.length > 0 ? `失败: ${result.errors.length} 条` : '');

        Zotero.alert(null, 'Researchopia', message);

        // 刷新共享标注显示
        await this.refreshSharedAnnotations(item);
      } else {
        const errorMsg = result.errors.length > 0 ?
          `分享失败: ${result.errors[0]}` :
          '分享失败，请稍后重试';
        Zotero.alert(null, 'Researchopia', errorMsg);
      }
    } catch (error) {
      Zotero.debug(`ItemPaneManager: Share failed: ${error.message}`);
      Zotero.alert(null, 'Researchopia', `分享失败: ${error.message}`);
    }
  }

  /**
   * 刷新共享标注
   * @param {Object} item - 文献项目
   */
  async refreshSharedAnnotations(item) {
    try {
      if (!item || !item.getField('DOI')) {
        return;
      }

      const doi = item.getField('DOI');
      this.sharedAnnotations = await this.annotationManager.fetchSharedAnnotations(doi);

      // 重新渲染面板
      const paneElement = document.querySelector('[data-pane-id="researchopia-annotations"]');
      if (paneElement) {
        await this.renderAnnotationsPane({
          body: paneElement,
          item: item
        });
      }
    } catch (error) {
      Zotero.debug(`ItemPaneManager: Refresh failed: ${error.message}`);
    }
  }

  /**
   * 渲染加载状态
   * @param {Element} container - 容器元素
   */
  renderLoadingState(container) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #6b7280;">
        <div>正在加载共享标注...</div>
      </div>
    `;
  }

  /**
   * 渲染无数据消息
   * @param {Element} container - 容器元素
   * @param {string} message - 消息内容
   */
  renderNoDataMessage(container, message) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #6b7280;">
        <div>${message}</div>
      </div>
    `;
  }

  /**
   * 渲染错误消息
   * @param {Element} container - 容器元素
   * @param {string} message - 错误消息
   */
  renderErrorMessage(container, message) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #dc2626;">
        <div>${message}</div>
      </div>
    `;
  }

  /**
   * 处理项目变更
   * @param {Object} item - 新的文献项目
   */
  handleItemChange(item) {
    this.currentItem = item;
  }

  /**
   * 销毁面板
   */
  destroyAnnotationsPane() {
    // 清理资源
    this.currentItem = null;
    this.sharedAnnotations = [];
  }

  /**
   * 注销Item Pane集成
   */
  unregister() {
    if (this.registeredSectionID) {
      Zotero.ItemPaneManager.unregisterSection(this.registeredSectionID);
      this.registeredSectionID = null;
    }
  }
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemPaneManager;
} else if (typeof window !== 'undefined') {
  window.ItemPaneManager = ItemPaneManager;
}

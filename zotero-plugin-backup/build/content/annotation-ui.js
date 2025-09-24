/**
 * 标注UI组件 - 处理标注的展示和交互
 */
class AnnotationUI {
  constructor(annotationManager, authManager) {
    this.annotationManager = annotationManager;
    this.authManager = authManager;
    this.currentAnnotations = [];
    this.currentPaper = null;
  }

  /**
   * 创建标注展示界面
   */
  createAnnotationInterface(container, item) {
    try {
      const doi = item.getField('DOI');
      if (!doi) {
        container.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #666;">
            <div style="font-size: 14px; margin-bottom: 10px;">📄 此文献没有DOI</div>
            <div style="font-size: 12px;">标注共享功能需要DOI来识别论文</div>
          </div>
        `;
        return;
      }

      // 创建主界面
      container.innerHTML = `
        <div id="researchopia-annotation-container" style="padding: 15px;">
          <!-- 头部信息 -->
          <div id="annotation-header" style="margin-bottom: 15px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
              <h3 style="margin: 0; font-size: 16px; color: #2c3e50;">📝 共享标注</h3>
              <div id="annotation-actions" style="display: flex; gap: 8px;">
                <button id="upload-annotations-btn" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                  📤 分享我的标注
                </button>
                <button id="refresh-annotations-btn" style="padding: 6px 12px; background: #17a2b8; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                  🔄 刷新
                </button>
              </div>
            </div>
            <div id="paper-info" style="font-size: 12px; color: #666; line-height: 1.4;">
              <div><strong>DOI:</strong> ${doi}</div>
              <div><strong>标题:</strong> ${item.getField('title') || '未知'}</div>
            </div>
          </div>

          <!-- 筛选和排序 -->
          <div id="annotation-filters" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-size: 12px; color: #495057;">排序:</label>
                <select id="sort-select" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
                  <option value="likes_count">👍 按点赞数</option>
                  <option value="created_at">🕒 按时间</option>
                  <option value="comments_count">💬 按评论数</option>
                </select>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-size: 12px; color: #495057;">类型:</label>
                <select id="type-filter" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 12px;">
                  <option value="all">全部</option>
                  <option value="highlight">高亮</option>
                  <option value="note">笔记</option>
                  <option value="image">图片</option>
                </select>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" id="following-only" style="margin: 0;">
                <label for="following-only" style="font-size: 12px; color: #495057;">仅关注的用户</label>
              </div>
            </div>
          </div>

          <!-- 加载状态 -->
          <div id="loading-indicator" style="text-align: center; padding: 20px; display: none;">
            <div style="font-size: 14px; color: #666;">🔄 加载中...</div>
          </div>

          <!-- 标注列表 -->
          <div id="annotations-list" style="min-height: 200px;">
            <!-- 标注项目将在这里动态生成 -->
          </div>

          <!-- 加载更多 -->
          <div id="load-more-container" style="text-align: center; margin-top: 15px; display: none;">
            <button id="load-more-btn" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
              加载更多
            </button>
          </div>

          <!-- 空状态 -->
          <div id="empty-state" style="text-align: center; padding: 40px; color: #666; display: none;">
            <div style="font-size: 48px; margin-bottom: 15px;">📝</div>
            <div style="font-size: 16px; margin-bottom: 8px;">还没有共享标注</div>
            <div style="font-size: 12px; margin-bottom: 15px;">成为第一个分享标注的人吧！</div>
            <button onclick="document.getElementById('upload-annotations-btn').click()" 
                    style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
              分享我的标注
            </button>
          </div>
        </div>
      `;

      // 绑定事件
      this.bindAnnotationEvents(container, item, doi);
      
      // 加载标注
      this.loadAnnotations(doi);

    } catch (error) {
      console.error('Failed to create annotation interface:', error);
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc3545;">
          <div style="font-size: 14px; margin-bottom: 10px;">❌ 加载失败</div>
          <div style="font-size: 12px;">${error.message}</div>
        </div>
      `;
    }
  }

  /**
   * 绑定标注界面事件
   */
  bindAnnotationEvents(container, item, doi) {
    // 上传标注按钮
    const uploadBtn = container.querySelector('#upload-annotations-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.handleUploadAnnotations(item));
    }

    // 刷新按钮
    const refreshBtn = container.querySelector('#refresh-annotations-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadAnnotations(doi, true));
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

    // 加载更多
    const loadMoreBtn = container.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMoreAnnotations(doi));
    }
  }

  /**
   * 处理上传标注
   */
  async handleUploadAnnotations(item) {
    try {
      if (!this.authManager.isAuthenticated) {
        Zotero.alert(null, 'Researchopia', '请先登录后再分享标注');
        return;
      }

      const uploadBtn = document.getElementById('upload-annotations-btn');
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = '📤 上传中...';
      }

      // 提取标注
      const extractedData = await this.annotationManager.extractAnnotationsFromItem(item);
      
      if (extractedData.annotations.length === 0) {
        Zotero.alert(null, 'Researchopia', '此文献没有找到标注');
        return;
      }

      // 上传标注
      const result = await this.annotationManager.uploadAnnotations(extractedData);
      
      Zotero.alert(
        null, 
        'Researchopia', 
        `✅ 标注分享成功！\n\n共分享了 ${result.success}/${result.total} 个标注`
      );

      // 刷新显示
      this.loadAnnotations(extractedData.doi, true);

    } catch (error) {
      console.error('Failed to upload annotations:', error);
      Zotero.alert(null, 'Researchopia', `❌ 分享失败：${error.message}`);
    } finally {
      const uploadBtn = document.getElementById('upload-annotations-btn');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 分享我的标注';
      }
    }
  }

  /**
   * 加载标注数据
   */
  async loadAnnotations(doi, forceRefresh = false) {
    try {
      const loadingIndicator = document.getElementById('loading-indicator');
      const annotationsList = document.getElementById('annotations-list');
      const emptyState = document.getElementById('empty-state');

      if (loadingIndicator) loadingIndicator.style.display = 'block';
      if (annotationsList) annotationsList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'none';

      // 清除缓存如果强制刷新
      if (forceRefresh) {
        this.annotationManager.clearCache();
      }

      // 获取筛选选项
      const options = this.getFilterOptions();
      
      // 尝试从缓存获取
      let annotations = this.annotationManager.getCachedAnnotations(doi, options);
      
      if (!annotations || forceRefresh) {
        annotations = await this.annotationManager.getSharedAnnotations(doi, options);
      }

      this.currentAnnotations = annotations;
      this.renderAnnotations(annotations);

    } catch (error) {
      console.error('Failed to load annotations:', error);
      const annotationsList = document.getElementById('annotations-list');
      if (annotationsList) {
        annotationsList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc3545;">
            <div style="font-size: 14px; margin-bottom: 10px;">❌ 加载失败</div>
            <div style="font-size: 12px;">${error.message}</div>
          </div>
        `;
      }
    } finally {
      const loadingIndicator = document.getElementById('loading-indicator');
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 获取筛选选项
   */
  getFilterOptions() {
    const sortSelect = document.getElementById('sort-select');
    const typeFilter = document.getElementById('type-filter');
    const followingOnly = document.getElementById('following-only');

    return {
      sortBy: sortSelect ? sortSelect.value : 'likes_count',
      sortOrder: 'desc',
      annotationType: typeFilter && typeFilter.value !== 'all' ? typeFilter.value : null,
      followingOnly: followingOnly ? followingOnly.checked : false,
      limit: 20,
      offset: 0
    };
  }

  /**
   * 处理筛选变化
   */
  handleFilterChange(doi) {
    this.loadAnnotations(doi, true);
  }

  /**
   * 渲染标注列表
   */
  renderAnnotations(annotations) {
    const annotationsList = document.getElementById('annotations-list');
    const emptyState = document.getElementById('empty-state');

    if (!annotationsList) return;

    if (annotations.length === 0) {
      annotationsList.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const annotationsHTML = annotations.map(annotation => 
      this.createAnnotationHTML(annotation)
    ).join('');

    annotationsList.innerHTML = annotationsHTML;

    // 绑定标注项目事件
    this.bindAnnotationItemEvents(annotationsList);
  }

  /**
   * 创建单个标注的HTML
   */
  createAnnotationHTML(annotation) {
    const user = annotation.users || {};
    const createdAt = new Date(annotation.created_at).toLocaleDateString();
    const isOwner = this.authManager.currentUser && 
                   this.authManager.currentUser.id === annotation.user_id;

    // 标注类型图标
    const typeIcon = {
      'highlight': '🖍️',
      'note': '📝',
      'image': '🖼️',
      'ink': '✏️'
    }[annotation.annotation_type] || '📝';

    // 颜色样式
    const colorStyle = annotation.color ? 
      `border-left: 4px solid ${annotation.color}; background: ${annotation.color}15;` : 
      'border-left: 4px solid #ffd400; background: #ffd40015;';

    return `
      <div class="annotation-item" data-annotation-id="${annotation.id}" 
           style="margin-bottom: 15px; padding: 12px; border-radius: 8px; ${colorStyle}">
        
        <!-- 用户信息 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; font-size: 12px;">
              ${user.display_name ? user.display_name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 500; color: #2c3e50;">
                ${user.display_name || user.username || '匿名用户'}
              </div>
              <div style="font-size: 11px; color: #6c757d;">
                ${typeIcon} ${createdAt} ${annotation.page_label ? `· 第${annotation.page_label}页` : ''}
              </div>
            </div>
          </div>
          ${isOwner ? '<div style="font-size: 11px; color: #28a745;">我的标注</div>' : ''}
        </div>

        <!-- 标注内容 -->
        ${annotation.text_content ? `
          <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 4px; font-size: 13px; line-height: 1.4; border-left: 2px solid ${annotation.color || '#ffd400'};">
            "${annotation.text_content}"
          </div>
        ` : ''}

        ${annotation.comment ? `
          <div style="margin-bottom: 8px; font-size: 13px; color: #495057; line-height: 1.4;">
            💭 ${annotation.comment}
          </div>
        ` : ''}

        <!-- 操作按钮 -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px;">
          <div style="display: flex; align-items: center; gap: 15px;">
            <button class="like-btn" data-annotation-id="${annotation.id}" 
                    style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
              👍 ${annotation.likes_count || 0}
            </button>
            <button class="comment-btn" data-annotation-id="${annotation.id}"
                    style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
              💬 ${annotation.comments_count || 0}
            </button>
            <button class="share-btn" data-annotation-id="${annotation.id}"
                    style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6c757d;">
              🔗 分享
            </button>
          </div>
          ${!isOwner ? `
            <button class="follow-btn" data-user-id="${annotation.user_id}"
                    style="padding: 4px 8px; background: #17a2b8; color: white; border: none; border-radius: 3px; font-size: 11px; cursor: pointer;">
              + 关注
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 绑定标注项目事件
   */
  bindAnnotationItemEvents(container) {
    // 点赞按钮
    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const annotationId = e.target.closest('.like-btn').dataset.annotationId;
        this.handleLikeAnnotation(annotationId);
      });
    });

    // 评论按钮
    container.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const annotationId = e.target.closest('.comment-btn').dataset.annotationId;
        this.handleCommentAnnotation(annotationId);
      });
    });

    // 分享按钮
    container.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const annotationId = e.target.closest('.share-btn').dataset.annotationId;
        this.handleShareAnnotation(annotationId);
      });
    });

    // 关注按钮
    container.querySelectorAll('.follow-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.closest('.follow-btn').dataset.userId;
        this.handleFollowUser(userId);
      });
    });
  }

  /**
   * 处理点赞标注
   */
  async handleLikeAnnotation(annotationId) {
    if (!this.authManager.isAuthenticated) {
      Zotero.alert(null, 'Researchopia', '请先登录后再点赞');
      return;
    }

    try {
      // TODO: 实现点赞API调用
      console.log('Like annotation:', annotationId);
    } catch (error) {
      console.error('Failed to like annotation:', error);
    }
  }

  /**
   * 处理评论标注
   */
  async handleCommentAnnotation(annotationId) {
    if (!this.authManager.isAuthenticated) {
      Zotero.alert(null, 'Researchopia', '请先登录后再评论');
      return;
    }

    try {
      // TODO: 实现评论功能
      console.log('Comment annotation:', annotationId);
    } catch (error) {
      console.error('Failed to comment annotation:', error);
    }
  }

  /**
   * 处理分享标注
   */
  async handleShareAnnotation(annotationId) {
    try {
      // TODO: 实现分享功能
      console.log('Share annotation:', annotationId);
    } catch (error) {
      console.error('Failed to share annotation:', error);
    }
  }

  /**
   * 处理关注用户
   */
  async handleFollowUser(userId) {
    if (!this.authManager.isAuthenticated) {
      Zotero.alert(null, 'Researchopia', '请先登录后再关注');
      return;
    }

    try {
      // TODO: 实现关注功能
      console.log('Follow user:', userId);
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  }

  /**
   * 加载更多标注
   */
  async loadMoreAnnotations(doi) {
    try {
      // TODO: 实现分页加载
      console.log('Load more annotations for:', doi);
    } catch (error) {
      console.error('Failed to load more annotations:', error);
    }
  }
}

// 导出供其他模块使用 - 兼容Zotero插件环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationUI;
} else {
  // 在Zotero插件环境中，直接定义为全局变量
  this.AnnotationUI = AnnotationUI;
}

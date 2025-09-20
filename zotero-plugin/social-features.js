/**
 * Researchopia Social Features
 * 标注社交功能模块 - 点赞、评论、关注等
 */

const SocialFeatures = {
  // 配置
  config: {
    apiBase: 'http://localhost:3000/api/v1',
    maxCommentLength: 500,
    maxReplyDepth: 3
  },

  // 缓存
  cache: {
    likes: new Map(),
    comments: new Map(),
    users: new Map()
  },

  /**
   * 初始化社交功能
   */
  init() {
    this.log("Initializing Social Features");
    this.setupEventListeners();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Social [${level.toUpperCase()}]: ${message}`;

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
      // 在Zotero环境中，使用Services.obs进行事件通信
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.addObserver(this, 'researchopia:annotationShared', false);
        Services.obs.addObserver(this, 'researchopia:annotationDisplayed', false);
        this.log("Event listeners registered with Services.obs");
      } else {
        this.log("Services.obs not available, skipping event listeners", 'warn');
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
          this.handleAnnotationShared(JSON.parse(data));
          break;
        case 'researchopia:annotationDisplayed':
          this.enhanceAnnotationDisplay(JSON.parse(data));
          break;
      }
    } catch (error) {
      this.log(`Error handling observer event: ${error.message}`, 'error');
    }
  },

  /**
   * 处理标注分享事件
   */
  async handleAnnotationShared(annotationData) {
    try {
      this.log(`处理标注分享事件: ${annotationData.id}`);

      // 为新分享的标注添加社交功能
      await this.initializeSocialData(annotationData);

      // 显示社交功能提示
      this.showSocialWelcomeMessage(annotationData);

    } catch (error) {
      this.log(`处理标注分享事件失败: ${error.message}`, 'error');
    }
  },

  /**
   * 显示社交功能欢迎消息
   */
  showSocialWelcomeMessage(annotationData) {
    try {
      if (typeof UserInterface !== 'undefined' && UserInterface.showNotification) {
        const message = `🎉 标注已分享！其他用户现在可以点赞、评论和讨论您的标注了。`;
        UserInterface.showNotification(message, 'success');
      }
    } catch (error) {
      this.log(`Error showing social welcome message: ${error.message}`, 'error');
    }
  },

  /**
   * 初始化标注的社交数据
   */
  async initializeSocialData(annotation) {
    try {
      // 创建社交数据结构
      const socialData = {
        annotationId: annotation.id,
        likes: 0,
        comments: [],
        shares: 0,
        createdAt: new Date().toISOString(),
        privacy: annotation.privacy || 'public'
      };

      // 发送到服务器
      await this.createSocialData(socialData);
      
      this.log(`标注社交数据初始化完成: ${annotation.id}`);
    } catch (error) {
      this.log(`初始化社交数据失败: ${error.message}`, 'error');
    }
  },

  /**
   * 点赞标注
   */
  async likeAnnotation(annotationId) {
    try {
      this.log(`点赞标注: ${annotationId}`);
      
      // 检查用户是否已登录
      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录后再点赞');
      }

      // 检查是否已经点赞
      const hasLiked = await this.hasUserLiked(annotationId);
      if (hasLiked) {
        return await this.unlikeAnnotation(annotationId);
      }

      // 发送点赞请求
      const response = await this.makeRequest(`/annotations/${annotationId}/like`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        
        // 更新缓存
        this.cache.likes.set(annotationId, data.likes);
        
        // 触发UI更新事件
        this.dispatchSocialEvent('likeAdded', {
          annotationId,
          likes: data.likes,
          userId: this.getCurrentUserId()
        });

        this.log(`点赞成功: ${annotationId}, 总点赞数: ${data.likes}`);
        return { success: true, likes: data.likes };
      } else {
        throw new Error(`点赞失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`点赞失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 取消点赞
   */
  async unlikeAnnotation(annotationId) {
    try {
      this.log(`取消点赞: ${annotationId}`);
      
      const response = await this.makeRequest(`/annotations/${annotationId}/like`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        
        // 更新缓存
        this.cache.likes.set(annotationId, data.likes);
        
        // 触发UI更新事件
        this.dispatchSocialEvent('likeRemoved', {
          annotationId,
          likes: data.likes,
          userId: this.getCurrentUserId()
        });

        this.log(`取消点赞成功: ${annotationId}, 总点赞数: ${data.likes}`);
        return { success: true, likes: data.likes };
      } else {
        throw new Error(`取消点赞失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`取消点赞失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 添加评论
   */
  async addComment(annotationId, content, parentCommentId = null) {
    try {
      this.log(`添加评论: ${annotationId}`);
      
      // 检查用户是否已登录
      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录后再评论');
      }

      // 验证评论内容
      if (!content || content.trim().length === 0) {
        throw new Error('评论内容不能为空');
      }

      if (content.length > this.config.maxCommentLength) {
        throw new Error(`评论内容不能超过${this.config.maxCommentLength}个字符`);
      }

      // 发送评论请求
      const response = await this.makeRequest(`/annotations/${annotationId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          parentId: parentCommentId
        })
      });

      if (response.ok) {
        const comment = JSON.parse(response.responseText);
        
        // 更新缓存
        this.updateCommentsCache(annotationId, comment);
        
        // 触发UI更新事件
        this.dispatchSocialEvent('commentAdded', {
          annotationId,
          comment
        });

        this.log(`评论添加成功: ${comment.id}`);
        return { success: true, comment };
      } else {
        throw new Error(`添加评论失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`添加评论失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 获取标注的评论列表
   */
  async getComments(annotationId, page = 1, limit = 20) {
    try {
      this.log(`获取评论列表: ${annotationId}`);
      
      // 检查缓存
      const cacheKey = `${annotationId}_${page}_${limit}`;
      if (this.cache.comments.has(cacheKey)) {
        return this.cache.comments.get(cacheKey);
      }

      const response = await this.makeRequest(`/annotations/${annotationId}/comments?page=${page}&limit=${limit}`);

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        
        // 缓存结果
        this.cache.comments.set(cacheKey, data);
        
        this.log(`获取到 ${data.comments.length} 条评论`);
        return data;
      } else {
        throw new Error(`获取评论失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`获取评论失败: ${error.message}`, 'error');
      return { comments: [], total: 0, page, limit };
    }
  },

  /**
   * 删除评论
   */
  async deleteComment(commentId) {
    try {
      this.log(`删除评论: ${commentId}`);
      
      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest(`/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 清除相关缓存
        this.clearCommentsCache();
        
        // 触发UI更新事件
        this.dispatchSocialEvent('commentDeleted', { commentId });

        this.log(`评论删除成功: ${commentId}`);
        return { success: true };
      } else {
        throw new Error(`删除评论失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`删除评论失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 关注用户
   */
  async followUser(userId) {
    try {
      this.log(`关注用户: ${userId}`);
      
      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest(`/users/${userId}/follow`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        
        // 触发UI更新事件
        this.dispatchSocialEvent('userFollowed', {
          userId,
          isFollowing: true
        });

        this.log(`关注用户成功: ${userId}`);
        return { success: true, isFollowing: true };
      } else {
        throw new Error(`关注用户失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`关注用户失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 取消关注用户
   */
  async unfollowUser(userId) {
    try {
      this.log(`取消关注用户: ${userId}`);
      
      const response = await this.makeRequest(`/users/${userId}/follow`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // 触发UI更新事件
        this.dispatchSocialEvent('userUnfollowed', {
          userId,
          isFollowing: false
        });

        this.log(`取消关注成功: ${userId}`);
        return { success: true, isFollowing: false };
      } else {
        throw new Error(`取消关注失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`取消关注失败: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 检查用户是否已点赞
   */
  async hasUserLiked(annotationId) {
    try {
      if (!this.isUserAuthenticated()) {
        return false;
      }

      const response = await this.makeRequest(`/annotations/${annotationId}/like/status`);
      
      if (response.ok) {
        const data = JSON.parse(response.responseText);
        return data.hasLiked;
      }
      
      return false;
    } catch (error) {
      this.log(`检查点赞状态失败: ${error.message}`, 'error');
      return false;
    }
  },

  /**
   * 检查用户是否已认证
   */
  isUserAuthenticated() {
    return typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated();
  },

  /**
   * 获取当前用户ID
   */
  getCurrentUserId() {
    if (this.isUserAuthenticated() && AuthManager.currentUser) {
      return AuthManager.currentUser.id;
    }
    return null;
  },

  /**
   * 创建社交数据
   */
  async createSocialData(socialData) {
    try {
      const response = await this.makeRequest('/annotations/social', {
        method: 'POST',
        body: JSON.stringify(socialData)
      });

      if (!response.ok) {
        throw new Error(`创建社交数据失败: ${response.status}`);
      }

      return JSON.parse(response.responseText);
    } catch (error) {
      this.log(`创建社交数据失败: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 更新评论缓存
   */
  updateCommentsCache(annotationId, newComment) {
    // 清除相关的缓存条目
    for (const [key, value] of this.cache.comments.entries()) {
      if (key.startsWith(annotationId + '_')) {
        this.cache.comments.delete(key);
      }
    }
  },

  /**
   * 清除评论缓存
   */
  clearCommentsCache() {
    this.cache.comments.clear();
  },

  /**
   * 触发社交事件
   */
  dispatchSocialEvent(eventType, data) {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(null, `researchopia:social:${eventType}`, JSON.stringify(data));
      } else {
        this.log(`Event dispatched: ${eventType}`, 'info');
      }
    } catch (error) {
      this.log(`Error dispatching event: ${error.message}`, 'error');
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
      if (this.isUserAuthenticated()) {
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
   * 创建社交功能快速操作面板
   */
  createSocialQuickPanel(container, annotations) {
    try {
      if (!container || !annotations || annotations.length === 0) {
        return null;
      }

      const doc = container.ownerDocument;

      // 创建社交面板
      const socialPanel = doc.createElement('div');
      socialPanel.className = 'researchopia-social-panel';
      socialPanel.innerHTML = `
        <div class="social-panel-header">
          <h4>🌟 社交功能预览</h4>
          <span class="social-panel-count">${annotations.length} 个标注</span>
        </div>
        <div class="social-panel-content">
          <div class="social-stats">
            <div class="stat-item">
              <span class="stat-icon">👍</span>
              <span class="stat-label">预计点赞</span>
              <span class="stat-value" id="estimated-likes">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">💬</span>
              <span class="stat-label">预计评论</span>
              <span class="stat-value" id="estimated-comments">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">👥</span>
              <span class="stat-label">潜在读者</span>
              <span class="stat-value" id="estimated-readers">0</span>
            </div>
          </div>
          <div class="social-tips">
            <div class="tip-item">
              💡 添加详细评论可获得更多互动
            </div>
            <div class="tip-item">
              🏷️ 使用标签帮助其他用户发现
            </div>
          </div>
        </div>
      `;

      // 估算社交数据
      this.estimateSocialMetrics(socialPanel, annotations);

      return socialPanel;
    } catch (error) {
      this.log(`Error creating social quick panel: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 估算社交指标
   */
  estimateSocialMetrics(panel, annotations) {
    try {
      // 基于标注数量和质量估算
      const baseScore = annotations.length;
      const qualityScore = annotations.reduce((score, ann) => {
        let quality = 1;
        const text = ann.content?.text || ann.annotationText || '';
        const comment = ann.content?.comment || ann.annotationComment || '';

        if (comment && comment.length > 50) quality += 1;
        if (text && text.length > 100) quality += 1;
        if (ann.metadata?.tags && ann.metadata.tags.length > 0) quality += 0.5;
        return score + quality;
      }, 0);

      const estimatedLikes = Math.max(1, Math.floor((baseScore + qualityScore) * 0.3));
      const estimatedComments = Math.max(0, Math.floor((baseScore + qualityScore) * 0.15));
      const estimatedReaders = Math.max(5, Math.floor((baseScore + qualityScore) * 2.5));

      // 更新显示
      const likesEl = panel.querySelector('#estimated-likes');
      const commentsEl = panel.querySelector('#estimated-comments');
      const readersEl = panel.querySelector('#estimated-readers');

      if (likesEl) likesEl.textContent = estimatedLikes;
      if (commentsEl) commentsEl.textContent = estimatedComments;
      if (readersEl) readersEl.textContent = estimatedReaders;

    } catch (error) {
      this.log(`Error estimating social metrics: ${error.message}`, 'error');
    }
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SocialFeatures;
}

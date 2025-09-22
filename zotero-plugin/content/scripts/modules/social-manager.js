/**
 * 社交功能管理器 - Social Manager
 * 负责处理点赞、评论、分享等社交功能
 */

class SocialManager {
  constructor() {
    this.initialized = false;
    this.socialCache = new Map(); // annotationId -> socialData
    this.userInteractions = new Map(); // userId -> interactions
    this.notificationQueue = [];
    
    // 社交功能配置
    this.config = {
      maxCommentLength: 500,
      maxReplyDepth: 3,
      enableNotifications: true,
      enableFollowing: true,
      enableSharing: true
    };
    
    Researchopia.log('SocialManager initialized');
  }

  /**
   * 初始化社交管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 加载用户社交数据
      await this.loadUserSocialData();
      
      // 设置事件监听器
      this.setupEventListeners();
      
      Researchopia.log('SocialManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.initialize');
    }
  }

  /**
   * 加载用户社交数据
   */
  async loadUserSocialData() {
    try {
      const currentUser = Researchopia.modules.authManager?.getCurrentUser();
      if (!currentUser) return;
      
      // 从服务器加载用户的社交数据
      const response = await this.makeAPIRequest('GET', `/api/v1/users/${currentUser.id}/social`);
      
      if (response.success) {
        this.userInteractions.set(currentUser.id, response.data);
        Researchopia.log('User social data loaded');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.loadUserSocialData');
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    try {
      // 监听实时管理器的社交事件
      if (Researchopia.modules.realtimeManager) {
        Researchopia.modules.realtimeManager.on('annotation:liked', (data) => {
          this.handleAnnotationLiked(data);
        });
        
        Researchopia.modules.realtimeManager.on('annotation:replied', (data) => {
          this.handleAnnotationReplied(data);
        });
      }
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.setupEventListeners');
    }
  }

  /**
   * 点赞标注
   * @param {string} annotationId - 标注ID
   * @returns {Object} 点赞结果
   */
  async likeAnnotation(annotationId) {
    try {
      const currentUser = Researchopia.modules.authManager?.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // 检查是否已经点赞
      const socialData = this.socialCache.get(annotationId) || {};
      const userLikes = socialData.likes || [];
      
      const alreadyLiked = userLikes.some(like => like.userId === currentUser.id);
      
      if (alreadyLiked) {
        // 取消点赞
        return await this.unlikeAnnotation(annotationId);
      }

      // 发送点赞请求
      const response = await this.makeAPIRequest('POST', `/api/v1/annotations/${annotationId}/like`);
      
      if (response.success) {
        // 更新本地缓存
        this.updateSocialCache(annotationId, 'like', response.data);
        
        // 广播点赞事件
        if (Researchopia.modules.realtimeManager) {
          Researchopia.modules.realtimeManager.sendMessage({
            type: 'annotation:liked',
            payload: {
              annotationId: annotationId,
              userId: currentUser.id,
              likes: response.data.totalLikes
            }
          });
        }
        
        Researchopia.log(`Annotation liked: ${annotationId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Like failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.likeAnnotation');
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消点赞标注
   * @param {string} annotationId - 标注ID
   * @returns {Object} 取消点赞结果
   */
  async unlikeAnnotation(annotationId) {
    try {
      const response = await this.makeAPIRequest('DELETE', `/api/v1/annotations/${annotationId}/like`);
      
      if (response.success) {
        // 更新本地缓存
        this.updateSocialCache(annotationId, 'unlike', response.data);
        
        Researchopia.log(`Annotation unliked: ${annotationId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Unlike failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.unlikeAnnotation');
      return { success: false, error: error.message };
    }
  }

  /**
   * 评论标注
   * @param {string} annotationId - 标注ID
   * @param {string} content - 评论内容
   * @param {string} parentCommentId - 父评论ID（用于回复）
   * @returns {Object} 评论结果
   */
  async commentAnnotation(annotationId, content, parentCommentId = null) {
    try {
      const currentUser = Researchopia.modules.authManager?.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // 验证评论内容
      if (!content || content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }

      if (content.length > this.config.maxCommentLength) {
        throw new Error(`Comment too long (max ${this.config.maxCommentLength} characters)`);
      }

      // 发送评论请求
      const commentData = {
        content: content.trim(),
        parentCommentId: parentCommentId
      };

      const response = await this.makeAPIRequest('POST', `/api/v1/annotations/${annotationId}/comments`, commentData);
      
      if (response.success) {
        // 更新本地缓存
        this.updateSocialCache(annotationId, 'comment', response.data);
        
        // 广播评论事件
        if (Researchopia.modules.realtimeManager) {
          Researchopia.modules.realtimeManager.sendMessage({
            type: 'annotation:replied',
            payload: {
              annotationId: annotationId,
              reply: response.data.comment
            }
          });
        }
        
        Researchopia.log(`Comment added to annotation: ${annotationId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Comment failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.commentAnnotation');
      return { success: false, error: error.message };
    }
  }

  /**
   * 分享标注
   * @param {string} annotationId - 标注ID
   * @param {Object} shareOptions - 分享选项
   * @returns {Object} 分享结果
   */
  async shareAnnotation(annotationId, shareOptions = {}) {
    try {
      const {
        visibility = 'shared', // private, shared, public
        platforms = [], // 分享平台
        message = '' // 分享消息
      } = shareOptions;

      const shareData = {
        visibility: visibility,
        platforms: platforms,
        message: message.trim()
      };

      const response = await this.makeAPIRequest('POST', `/api/v1/annotations/${annotationId}/share`, shareData);
      
      if (response.success) {
        // 更新本地缓存
        this.updateSocialCache(annotationId, 'share', response.data);
        
        Researchopia.log(`Annotation shared: ${annotationId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Share failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.shareAnnotation');
      return { success: false, error: error.message };
    }
  }

  /**
   * 关注用户
   * @param {string} userId - 用户ID
   * @returns {Object} 关注结果
   */
  async followUser(userId) {
    try {
      if (!this.config.enableFollowing) {
        throw new Error('Following feature is disabled');
      }

      const response = await this.makeAPIRequest('POST', `/api/v1/users/${userId}/follow`);
      
      if (response.success) {
        // 更新本地用户交互数据
        const currentUser = Researchopia.modules.authManager?.getCurrentUser();
        if (currentUser) {
          const userInteractions = this.userInteractions.get(currentUser.id) || {};
          userInteractions.following = userInteractions.following || [];
          userInteractions.following.push(userId);
          this.userInteractions.set(currentUser.id, userInteractions);
        }
        
        Researchopia.log(`User followed: ${userId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Follow failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.followUser');
      return { success: false, error: error.message };
    }
  }

  /**
   * 取消关注用户
   * @param {string} userId - 用户ID
   * @returns {Object} 取消关注结果
   */
  async unfollowUser(userId) {
    try {
      const response = await this.makeAPIRequest('DELETE', `/api/v1/users/${userId}/follow`);
      
      if (response.success) {
        // 更新本地用户交互数据
        const currentUser = Researchopia.modules.authManager?.getCurrentUser();
        if (currentUser) {
          const userInteractions = this.userInteractions.get(currentUser.id) || {};
          if (userInteractions.following) {
            userInteractions.following = userInteractions.following.filter(id => id !== userId);
            this.userInteractions.set(currentUser.id, userInteractions);
          }
        }
        
        Researchopia.log(`User unfollowed: ${userId}`);
        return { success: true, data: response.data };
      }
      
      throw new Error(response.error?.message || 'Unfollow failed');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.unfollowUser');
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取标注的社交数据
   * @param {string} annotationId - 标注ID
   * @returns {Object} 社交数据
   */
  async getAnnotationSocialData(annotationId) {
    try {
      // 先检查本地缓存
      if (this.socialCache.has(annotationId)) {
        return this.socialCache.get(annotationId);
      }

      // 从服务器获取
      const response = await this.makeAPIRequest('GET', `/api/v1/annotations/${annotationId}/social`);
      
      if (response.success) {
        // 更新本地缓存
        this.socialCache.set(annotationId, response.data);
        return response.data;
      }
      
      return {
        likes: [],
        comments: [],
        shares: [],
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0
      };
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.getAnnotationSocialData');
      return {
        likes: [],
        comments: [],
        shares: [],
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0
      };
    }
  }

  /**
   * 更新社交缓存
   * @param {string} annotationId - 标注ID
   * @param {string} action - 操作类型
   * @param {Object} data - 数据
   */
  updateSocialCache(annotationId, action, data) {
    try {
      let socialData = this.socialCache.get(annotationId) || {
        likes: [],
        comments: [],
        shares: [],
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0
      };

      switch (action) {
        case 'like':
          socialData.totalLikes = data.totalLikes || socialData.totalLikes + 1;
          break;
        case 'unlike':
          socialData.totalLikes = Math.max(0, (data.totalLikes || socialData.totalLikes - 1));
          break;
        case 'comment':
          socialData.comments.push(data.comment);
          socialData.totalComments = socialData.comments.length;
          break;
        case 'share':
          socialData.totalShares = data.totalShares || socialData.totalShares + 1;
          break;
      }

      this.socialCache.set(annotationId, socialData);
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.updateSocialCache');
    }
  }

  /**
   * 处理标注点赞事件
   * @param {Object} data - 点赞数据
   */
  handleAnnotationLiked(data) {
    try {
      const { annotationId, userId, likes } = data;
      
      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationLikes(annotationId, likes);
      }
      
      // 显示通知
      if (this.config.enableNotifications) {
        this.showNotification(`用户点赞了标注`, 'info');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.handleAnnotationLiked');
    }
  }

  /**
   * 处理标注回复事件
   * @param {Object} data - 回复数据
   */
  handleAnnotationReplied(data) {
    try {
      const { annotationId, reply } = data;
      
      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationReplies(annotationId, reply);
      }
      
      // 显示通知
      if (this.config.enableNotifications) {
        this.showNotification(`收到新回复`, 'info');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.handleAnnotationReplied');
    }
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型
   */
  showNotification(message, type = 'info') {
    try {
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.showNotification(message, type);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.showNotification');
    }
  }

  /**
   * 发起API请求
   * @param {string} method - HTTP方法
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   */
  async makeAPIRequest(method, endpoint, data = null) {
    try {
      if (Researchopia.modules.syncManager) {
        return await Researchopia.modules.syncManager.makeRequest(method, endpoint, data);
      }
      
      throw new Error('SyncManager not available');
    } catch (error) {
      Researchopia.handleError(error, 'SocialManager.makeAPIRequest');
      throw error;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.socialCache.clear();
    this.userInteractions.clear();
    this.notificationQueue = [];
    this.initialized = false;
    
    Researchopia.log('SocialManager cleaned up');
  }
}

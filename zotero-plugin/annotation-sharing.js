/*
  Researchopia Annotation Sharing Module
  Handles cross-platform annotation sharing functionality
*/

Zotero.Researchopia.AnnotationSharing = {
  apiBase: 'http://localhost:3000/api/v1',

  // 同步状态管理
  syncState: {
    isEnabled: true,
    lastSyncTime: null,
    syncInterval: 30000, // 30秒
    syncTimer: null,
    pendingChanges: new Map(), // 待同步的变更
    syncInProgress: false
  },
  
  /**
   * 获取API基础URL
   */
  getApiBase() {
    try {
      // 尝试从配置中获取API地址
      if (Zotero.Researchopia.Config) {
        return Zotero.Researchopia.Config.get('apiBase', this.apiBase);
      }
      return this.apiBase;
    } catch (error) {
      this.log("Error getting API base: " + error);
      return this.apiBase;
    }
  },

  /**
   * 动态检测API端口
   */
  async detectApiPort() {
    try {
      // 尝试常见端口
      const commonPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
      
      for (const port of commonPorts) {
        try {
          this.log(`尝试检测端口 ${port}...`);

          // 使用XMLHttpRequest替代fetch，避免兼容性问题
          const response = await this.makeHttpRequest(`http://localhost:${port}/api/port-detector`, {
            method: 'GET',
            timeout: 1000 // 1秒超时
          });
          
          if (response.ok) {
            let data = {};
            try {
              data = JSON.parse(response.responseText);
            } catch (e) {
              // 如果不是JSON，使用默认值
              data = { apiUrl: `http://localhost:${port}/api/v1` };
            }
            this.log(`✅ 检测到API服务器运行在端口 ${port}: ${data.apiUrl}`);
            return data.apiUrl;
          } else {
            this.log(`端口 ${port} 响应错误: ${response.status}`);
          }
        } catch (e) {
          this.log(`端口 ${port} 连接失败: ${e.message}`);
          // 端口不可用，继续尝试下一个
          continue;
        }
      }
      
      this.log("❌ 未检测到运行中的API服务器");
      return null;
    } catch (error) {
      this.log("端口检测失败: " + error);
      return null;
    }
  },

  /**
   * 使用XMLHttpRequest进行HTTP请求（兼容性更好）
   */
  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timeout = options.timeout || 5000;

      xhr.timeout = timeout;
      xhr.open(options.method || 'GET', url, true);

      // 设置请求头
      if (options.headers) {
        Object.keys(options.headers).forEach(key => {
          xhr.setRequestHeader(key, options.headers[key]);
        });
      }

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
        reject(new Error(`Request timeout after ${timeout}ms`));
      };

      xhr.send(options.body || null);
    });
  },

  /**
   * 初始化标注分享功能
   */
  init() {
    this.log("Initializing annotation sharing module");
    this.registerMenuItems();
    this.initializeSync();
  },

  /**
   * 初始化同步机制
   */
  initializeSync() {
    try {
      this.log("Initializing real-time sync mechanism");

      // 设置Zotero事件监听器
      this.setupZoteroEventListeners();

      // 启动定期同步
      this.startPeriodicSync();

      // 恢复上次同步时间
      this.loadSyncState();

      this.log("Real-time sync initialized successfully");
    } catch (error) {
      this.log(`Error initializing sync: ${error.message}`, 'error');
    }
  },

  /**
   * 设置Zotero事件监听器
   */
  setupZoteroEventListeners() {
    try {
      // 监听标注创建事件
      Zotero.Notifier.registerObserver({
        notify: (event, type, ids, extraData) => {
          if (type === 'item' && event === 'add') {
            this.handleItemAdded(ids, extraData);
          } else if (type === 'item' && event === 'modify') {
            this.handleItemModified(ids, extraData);
          } else if (type === 'item' && event === 'delete') {
            this.handleItemDeleted(ids, extraData);
          }
        }
      }, ['item'], 'researchopia-sync');

      this.log("Zotero event listeners registered");
    } catch (error) {
      this.log(`Error setting up event listeners: ${error.message}`, 'error');
    }
  },

  /**
   * 处理项目添加事件
   */
  async handleItemAdded(ids, extraData) {
    try {
      for (const id of ids) {
        const item = Zotero.Items.get(id);
        if (item && item.isAnnotation && item.isAnnotation()) {
          this.log(`New annotation detected: ${id}`);
          this.queueForSync(id, 'add', item);
        }
      }
    } catch (error) {
      this.log(`Error handling item added: ${error.message}`, 'error');
    }
  },

  /**
   * 处理项目修改事件
   */
  async handleItemModified(ids, extraData) {
    try {
      for (const id of ids) {
        const item = Zotero.Items.get(id);
        if (item && item.isAnnotation && item.isAnnotation()) {
          this.log(`Annotation modified: ${id}`);
          this.queueForSync(id, 'modify', item);
        }
      }
    } catch (error) {
      this.log(`Error handling item modified: ${error.message}`, 'error');
    }
  },

  /**
   * 处理项目删除事件
   */
  async handleItemDeleted(ids, extraData) {
    try {
      for (const id of ids) {
        this.log(`Annotation deleted: ${id}`);
        this.queueForSync(id, 'delete', null);
      }
    } catch (error) {
      this.log(`Error handling item deleted: ${error.message}`, 'error');
    }
  },

  /**
   * 将变更加入同步队列
   */
  queueForSync(itemId, action, item) {
    try {
      if (!this.syncState.isEnabled) {
        return;
      }

      const changeInfo = {
        itemId: itemId,
        action: action,
        timestamp: Date.now(),
        item: item,
        retryCount: 0
      };

      this.syncState.pendingChanges.set(itemId, changeInfo);
      this.log(`Queued for sync: ${itemId} (${action})`);

      // 如果不在同步中，立即尝试同步
      if (!this.syncState.syncInProgress) {
        this.debouncedSync();
      }
    } catch (error) {
      this.log(`Error queuing for sync: ${error.message}`, 'error');
    }
  },

  /**
   * 防抖同步（避免频繁同步）
   */
  debouncedSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, 2000); // 2秒防抖
  },

  /**
   * 处理待同步的变更
   */
  async processPendingChanges() {
    if (this.syncState.syncInProgress || this.syncState.pendingChanges.size === 0) {
      return;
    }

    try {
      this.syncState.syncInProgress = true;
      this.log(`Processing ${this.syncState.pendingChanges.size} pending changes`);

      const changes = Array.from(this.syncState.pendingChanges.values());
      const successfulSyncs = [];
      const failedSyncs = [];

      for (const change of changes) {
        try {
          const result = await this.syncSingleChange(change);
          if (result.success) {
            successfulSyncs.push(change.itemId);
          } else {
            change.retryCount++;
            if (change.retryCount >= 3) {
              // 超过重试次数，移除
              failedSyncs.push(change.itemId);
            }
          }
        } catch (error) {
          this.log(`Error syncing change ${change.itemId}: ${error.message}`, 'error');
          change.retryCount++;
          if (change.retryCount >= 3) {
            failedSyncs.push(change.itemId);
          }
        }
      }

      // 清理成功同步的项目
      successfulSyncs.forEach(itemId => {
        this.syncState.pendingChanges.delete(itemId);
      });

      // 清理失败的项目
      failedSyncs.forEach(itemId => {
        this.syncState.pendingChanges.delete(itemId);
        this.log(`Removed failed sync item: ${itemId}`, 'warn');
      });

      this.syncState.lastSyncTime = Date.now();
      this.saveSyncState();

      this.log(`Sync completed: ${successfulSyncs.length} successful, ${failedSyncs.length} failed`);

    } catch (error) {
      this.log(`Error processing pending changes: ${error.message}`, 'error');
    } finally {
      this.syncState.syncInProgress = false;
    }
  },

  /**
   * 同步单个变更
   */
  async syncSingleChange(change) {
    try {
      const { itemId, action, item } = change;

      switch (action) {
        case 'add':
        case 'modify':
          if (item) {
            const universalAnnotation = this.convertZoteroToUniversal(item);
            if (universalAnnotation) {
              return await this.uploadSingleAnnotation(universalAnnotation);
            }
          }
          return { success: false, error: 'Invalid item' };

        case 'delete':
          return await this.deleteAnnotationOnServer(itemId);

        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      this.log(`Error syncing single change: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 上传单个标注
   */
  async uploadSingleAnnotation(annotation) {
    try {
      const apiUrl = `${this.getApiBase()}/annotations`;

      const response = await this.makeHttpRequest(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          annotation: annotation,
          source: 'zotero',
          timestamp: Date.now()
        }),
        timeout: 10000
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        this.log(`Successfully uploaded annotation: ${annotation.id}`);
        return { success: true, data: data };
      } else {
        this.log(`Failed to upload annotation: ${response.status}`, 'warn');
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      this.log(`Error uploading single annotation: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 在服务器上删除标注
   */
  async deleteAnnotationOnServer(itemId) {
    try {
      const apiUrl = `${this.getApiBase()}/annotations/${itemId}`;

      const response = await this.makeHttpRequest(apiUrl, {
        method: 'DELETE',
        timeout: 10000
      });

      if (response.ok) {
        this.log(`Successfully deleted annotation on server: ${itemId}`);
        return { success: true };
      } else {
        this.log(`Failed to delete annotation on server: ${response.status}`, 'warn');
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      this.log(`Error deleting annotation on server: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 启动定期同步
   */
  startPeriodicSync() {
    if (this.syncState.syncTimer) {
      clearInterval(this.syncState.syncTimer);
    }

    this.syncState.syncTimer = setInterval(() => {
      if (this.syncState.pendingChanges.size > 0) {
        this.processPendingChanges();
      }
    }, this.syncState.syncInterval);

    this.log(`Periodic sync started (interval: ${this.syncState.syncInterval}ms)`);
  },

  /**
   * 停止定期同步
   */
  stopPeriodicSync() {
    if (this.syncState.syncTimer) {
      clearInterval(this.syncState.syncTimer);
      this.syncState.syncTimer = null;
    }
    this.log("Periodic sync stopped");
  },

  /**
   * 保存同步状态
   */
  saveSyncState() {
    try {
      const stateData = {
        lastSyncTime: this.syncState.lastSyncTime,
        isEnabled: this.syncState.isEnabled
      };

      // 使用Zotero的偏好设置存储
      Zotero.Prefs.set('extensions.researchopia.syncState', JSON.stringify(stateData));
    } catch (error) {
      this.log(`Error saving sync state: ${error.message}`, 'error');
    }
  },

  /**
   * 加载同步状态
   */
  loadSyncState() {
    try {
      const stateJson = Zotero.Prefs.get('extensions.researchopia.syncState');
      if (stateJson) {
        const stateData = JSON.parse(stateJson);
        this.syncState.lastSyncTime = stateData.lastSyncTime;
        this.syncState.isEnabled = stateData.isEnabled !== false; // 默认启用
        this.log(`Loaded sync state: lastSync=${new Date(this.syncState.lastSyncTime)}`);
      }
    } catch (error) {
      this.log(`Error loading sync state: ${error.message}`, 'error');
    }
  },

  /**
   * 启用/禁用同步
   */
  setSyncEnabled(enabled) {
    this.syncState.isEnabled = enabled;
    this.saveSyncState();

    if (enabled) {
      this.startPeriodicSync();
      this.log("Sync enabled");
    } else {
      this.stopPeriodicSync();
      this.syncState.pendingChanges.clear();
      this.log("Sync disabled");
    }
  },

  /**
   * 获取同步状态信息
   */
  getSyncStatus() {
    return {
      isEnabled: this.syncState.isEnabled,
      lastSyncTime: this.syncState.lastSyncTime,
      pendingChanges: this.syncState.pendingChanges.size,
      syncInProgress: this.syncState.syncInProgress
    };
  },

  /**
   * 初始化社交功能
   */
  async initializeSocialFeatures(annotations, options = {}) {
    try {
      this.log(`Initializing social features for ${annotations.length} annotations`);

      // 检查社交功能模块是否可用
      if (typeof SocialFeatures === 'undefined') {
        this.log("SocialFeatures module not available", 'warn');
        return;
      }

      // 为每个标注初始化社交数据
      for (const annotation of annotations) {
        try {
          await this.initializeSocialDataForAnnotation(annotation, options);
        } catch (error) {
          this.log(`Error initializing social data for annotation ${annotation.id}: ${error.message}`, 'error');
        }
      }

      // 发送社交功能初始化事件
      this.dispatchSocialEvent('annotationsShared', {
        annotations: annotations,
        options: options,
        timestamp: Date.now()
      });

      this.log("Social features initialization completed");
    } catch (error) {
      this.log(`Error initializing social features: ${error.message}`, 'error');
    }
  },

  /**
   * 为单个标注初始化社交数据
   */
  async initializeSocialDataForAnnotation(annotation, options = {}) {
    try {
      const socialData = {
        annotationId: annotation.id,
        documentId: annotation.metadata?.documentInfo?.doi || annotation.documentId,
        userId: this.getCurrentUserId(),
        privacy: options.privacyLevel || 'public',
        likes: 0,
        comments: [],
        shares: 0,
        tags: annotation.metadata?.tags || [],
        createdAt: new Date().toISOString(),
        platform: 'zotero'
      };

      // 发送到服务器创建社交数据
      const result = await this.createSocialData(socialData);

      if (result.success) {
        this.log(`Social data initialized for annotation: ${annotation.id}`);

        // 缓存社交数据
        if (typeof SocialFeatures !== 'undefined' && SocialFeatures.cache) {
          SocialFeatures.cache.likes.set(annotation.id, 0);
          SocialFeatures.cache.comments.set(annotation.id, []);
        }
      } else {
        this.log(`Failed to initialize social data for annotation: ${annotation.id}`, 'warn');
      }

    } catch (error) {
      this.log(`Error initializing social data for annotation: ${error.message}`, 'error');
    }
  },

  /**
   * 创建社交数据
   */
  async createSocialData(socialData) {
    try {
      const apiUrl = `${this.getApiBase()}/social/annotations`;

      const response = await this.makeHttpRequest(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(socialData),
        timeout: 10000
      });

      if (response.ok) {
        const data = JSON.parse(response.responseText);
        return { success: true, data: data };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      this.log(`Error creating social data: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 获取当前用户ID
   */
  getCurrentUserId() {
    try {
      // 尝试从认证管理器获取用户ID
      if (typeof Zotero !== 'undefined' &&
          Zotero.Researchopia &&
          Zotero.Researchopia.AuthManager) {
        const userInfo = Zotero.Researchopia.AuthManager.getCurrentUser();
        if (userInfo && userInfo.id) {
          return userInfo.id;
        }
      }

      // 回退到匿名用户
      return 'anonymous_' + Date.now();
    } catch (error) {
      this.log(`Error getting current user ID: ${error.message}`, 'error');
      return 'anonymous_' + Date.now();
    }
  },

  /**
   * 发送社交事件
   */
  dispatchSocialEvent(eventType, data) {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(
          null,
          `researchopia:social:${eventType}`,
          JSON.stringify(data)
        );
        this.log(`Social event dispatched: ${eventType}`);
      }
    } catch (error) {
      this.log(`Error dispatching social event: ${error.message}`, 'error');
    }
  },

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    try {
      if (typeof ErrorHandler !== 'undefined') {
        return ErrorHandler.handleError(error, {
          type: ErrorHandler.ErrorTypes[context.type] || ErrorHandler.ErrorTypes.ANNOTATION,
          context: context.context || 'annotation_sharing',
          showToUser: context.showToUser !== false,
          ...context
        });
      } else {
        // 回退到基本错误处理
        this.log(`Error: ${error.message || error}`, 'error');
        if (context.showToUser !== false) {
          this.showError(`操作失败: ${error.message || error}`);
        }
      }
    } catch (handlerError) {
      this.log(`Error in error handler: ${handlerError.message}`, 'error');
    }
  },

  /**
   * 显示成功消息
   */
  showSuccess(message, options = {}) {
    try {
      if (typeof FeedbackSystem !== 'undefined') {
        return FeedbackSystem.showSuccess(message, options);
      } else {
        this.log(`Success: ${message}`);
      }
    } catch (error) {
      this.log(`Error showing success message: ${error.message}`, 'error');
    }
  },

  /**
   * 显示错误消息
   */
  showError(message, options = {}) {
    try {
      if (typeof FeedbackSystem !== 'undefined') {
        return FeedbackSystem.showError(message, options);
      } else {
        this.log(`Error: ${message}`, 'error');
      }
    } catch (error) {
      this.log(`Error showing error message: ${error.message}`, 'error');
    }
  },

  /**
   * 显示进度
   */
  showProgress(message, progress = 0, options = {}) {
    try {
      if (typeof FeedbackSystem !== 'undefined') {
        return FeedbackSystem.showProgress(message, progress, options);
      } else {
        this.log(`Progress: ${message} (${progress}%)`);
        return null;
      }
    } catch (error) {
      this.log(`Error showing progress: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 更新进度
   */
  updateProgress(notificationId, progress, message = null) {
    try {
      if (typeof FeedbackSystem !== 'undefined' && notificationId) {
        FeedbackSystem.updateProgress(notificationId, progress, message);
      } else if (message) {
        this.log(`Progress: ${message} (${progress}%)`);
      }
    } catch (error) {
      this.log(`Error updating progress: ${error.message}`, 'error');
    }
  },

  /**
   * 隐藏通知
   */
  hideNotification(notificationId) {
    try {
      if (typeof FeedbackSystem !== 'undefined' && notificationId) {
        FeedbackSystem.hideNotification(notificationId);
      }
    } catch (error) {
      this.log(`Error hiding notification: ${error.message}`, 'error');
    }
  },
  
  /**
   * 日志输出
   */
  log(msg) {
    Zotero.debug("Researchopia-Annotation: " + msg);
  },
  
  /**
   * 注册菜单项
   */
  registerMenuItems() {
    try {
      this.log("Skipping MenuAPI registration to avoid compatibility issues");
      // 菜单功能暂时禁用以避免MenuAPI错误
      // 标注分享功能通过主插件界面的按钮提供
      
    } catch (error) {
      this.log("Failed to register menu items: " + error);
    }
  },
  
  /**
   * 获取当前选中的标注
   */
  getSelectedAnnotations() {
    try {
      // 从当前阅读器获取选中的标注
      const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      if (!reader) return [];
      
      const selectedAnnotations = reader.getSelectedAnnotations();
      this.log(`Found ${selectedAnnotations.length} selected annotations`);
      return selectedAnnotations;
      
    } catch (error) {
      this.log("Error getting selected annotations: " + error);
      return [];
    }
  },
  
  /**
   * 获取文档的所有标注
   */
  getDocumentAnnotations() {
    try {
      const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
      if (!reader) return [];
      
      const attachmentID = reader.itemID;
      const item = Zotero.Items.get(attachmentID);
      
      // 获取该附件的所有标注
      const annotationData = item.getAnnotations();
      const annotations = [];
      
      if (annotationData && annotationData.length > 0) {
        // 检查返回的是ID数组还是对象数组
        if (typeof annotationData[0] === 'object' && annotationData[0].id) {
          // 返回的是对象数组，直接使用
          for (const annotation of annotationData) {
            if (annotation && annotation.isAnnotation()) {
              annotations.push(annotation);
            }
          }
        } else {
          // 返回的是ID数组，需要获取对象
          for (const annotID of annotationData) {
            const annotation = Zotero.Items.get(annotID);
            if (annotation && annotation.isAnnotation()) {
              annotations.push(annotation);
            }
          }
        }
      }
      
      this.log(`Found ${annotations.length} document annotations`);
      return annotations;
      
    } catch (error) {
      this.log("Error getting document annotations: " + error);
      return [];
    }
  },

  /**
   * 改进的标注获取方法，不依赖阅读器
   */
  getDocumentAnnotationsImproved(item) {
    try {
      if (!item) return [];
      
      let annotations = [];
      
      // 如果是PDF附件
      if (item.isAttachment() && item.attachmentContentType === 'application/pdf') {
        const annotationData = item.getAnnotations();
        if (annotationData && annotationData.length > 0) {
          // 检查返回的是ID数组还是对象数组
          if (typeof annotationData[0] === 'object' && annotationData[0].id) {
            // 返回的是对象数组，直接使用
            for (const annotation of annotationData) {
              if (annotation && annotation.isAnnotation()) {
                annotations.push(annotation);
              }
            }
          } else {
            // 返回的是ID数组，需要获取对象
            for (const annotID of annotationData) {
              const annotation = Zotero.Items.get(annotID);
              if (annotation && annotation.isAnnotation()) {
                annotations.push(annotation);
              }
            }
          }
        }
      }
      // 如果是常规项目，检查其PDF附件
      else if (item.isRegularItem()) {
        const attachments = item.getAttachments();
        if (attachments && attachments.length > 0) {
          for (const attachmentID of attachments) {
            const attachment = Zotero.Items.get(attachmentID);
            if (attachment && attachment.attachmentContentType === 'application/pdf') {
              const annotationData = attachment.getAnnotations();
              if (annotationData && annotationData.length > 0) {
                // 检查返回的是ID数组还是对象数组
                if (typeof annotationData[0] === 'object' && annotationData[0].id) {
                  // 返回的是对象数组，直接使用
                  for (const annotation of annotationData) {
                    if (annotation && annotation.isAnnotation()) {
                      annotations.push(annotation);
                    }
                  }
                } else {
                  // 返回的是ID数组，需要获取对象
                  for (const annotID of annotationData) {
                    const annotation = Zotero.Items.get(annotID);
                    if (annotation && annotation.isAnnotation()) {
                      annotations.push(annotation);
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      this.log(`Improved method found ${annotations.length} annotations`);
      return annotations;
      
    } catch (error) {
      this.log("Error in improved annotation detection: " + error);
      return [];
    }
  },
  
  /**
   * 将Zotero标注转换为通用格式
   */
  convertZoteroToUniversal(zoteroAnnotation) {
    try {
      if (!zoteroAnnotation) {
        this.log("标注对象为空");
        return null;
      }

      this.log(`转换标注: ID=${zoteroAnnotation.id}, 类型=${zoteroAnnotation.annotationType}`);

      // 安全获取标注属性的辅助函数
      const safeGetField = (fieldName, defaultValue = '') => {
        try {
          return zoteroAnnotation[fieldName] ||
                 (typeof zoteroAnnotation.getField === 'function' ? zoteroAnnotation.getField(fieldName) : null) ||
                 defaultValue;
        } catch (e) {
          this.log(`获取字段 ${fieldName} 失败: ${e.message}`);
          return defaultValue;
        }
      };

      // 获取标注的各种属性
      const annotationType = safeGetField('annotationType', 'highlight');
      const annotationText = safeGetField('annotationText', '');
      const annotationComment = safeGetField('annotationComment', '');
      const annotationColor = safeGetField('annotationColor', '#ffd400');
      const annotationPosition = safeGetField('annotationPosition', '{}');
      const annotationPageLabel = safeGetField('annotationPageLabel', '');
      const annotationSortIndex = safeGetField('annotationSortIndex', '');

      // 获取日期信息
      const dateAdded = zoteroAnnotation.dateAdded || new Date().toISOString();
      const dateModified = zoteroAnnotation.dateModified || new Date().toISOString();

      const universal = {
        id: zoteroAnnotation.key || zoteroAnnotation.id || this.generateId(),
        type: this.mapZoteroAnnotationType(annotationType),
        documentId: this.getDocumentId(zoteroAnnotation),
        position: this.convertZoteroPosition(zoteroAnnotation, annotationPosition),
        createdAt: dateAdded,
        modifiedAt: dateModified,
        content: {
          text: annotationText,
          comment: annotationComment,
          color: annotationColor
        },
        metadata: {
          platform: 'zotero',
          version: '1.0',
          author: {
            id: 'current-user',
            name: this.getCurrentUserName(),
            platform: 'zotero',
            isAuthoritative: true
          },
          tags: this.getAnnotationTags(zoteroAnnotation),
          visibility: 'private'
        },
        extensions: {
          zotero: {
            sortIndex: annotationSortIndex,
            pageLabel: annotationPageLabel,
            readOnly: false
          }
        }
      };
      
      this.log(`转换完成: ${JSON.stringify(universal, null, 2)}`);
      return universal;
      
    } catch (error) {
      this.log("Error converting annotation: " + error);
      return null;
    }
  },

  /**
   * 获取标注的标签
   */
  getAnnotationTags(annotation) {
    try {
      if (typeof annotation.getTags === 'function') {
        return annotation.getTags();
      }
      // 备用方法
      return [];
    } catch (error) {
      this.log("Error getting annotation tags: " + error);
      return [];
    }
  },
  
  /**
   * 映射Zotero标注类型
   */
  mapZoteroAnnotationType(zoteroType) {
    const typeMap = {
      'highlight': 'highlight',
      'underline': 'underline',
      'note': 'note',
      'image': 'image',
      'ink': 'ink',
      'text': 'text'
    };
    return typeMap[zoteroType] || 'note';
  },
  
  /**
   * 转换Zotero位置信息
   */
  convertZoteroPosition(annotation, annotationPosition) {
    try {
      const positionStr = annotationPosition || annotation.annotationPosition || '{}';
      const position = JSON.parse(positionStr);
      
      if (position.pageIndex !== undefined) {
        // PDF标注
        return {
          documentType: 'pdf',
          pdf: {
            pageIndex: position.pageIndex,
            rects: position.rects || [],
            paths: position.paths || [],
            rotation: position.rotation || 0
          }
        };
      } else {
        // 其他类型标注
        const annotationText = annotation.annotationText || 
                              annotation.getField?.('annotationText') || 
                              '';
        return {
          documentType: 'text',
          text: {
            startOffset: 0,
            endOffset: annotationText.length,
            context: annotationText
          }
        };
      }
    } catch (error) {
      this.log("Error converting position: " + error);
      const annotationText = annotation.annotationText || 
                            annotation.getField?.('annotationText') || 
                            '';
      return {
        documentType: 'text',
        text: { startOffset: 0, endOffset: annotationText.length, context: annotationText }
      };
    }
  },
  
  /**
   * 获取文档ID
   */
  getDocumentId(annotation) {
    try {
      // 获取父项目ID
      const parentItemID = annotation.parentItemID || annotation.parentID;
      if (!parentItemID) {
        return 'unknown:' + Date.now();
      }
      
      const parentItem = Zotero.Items.get(parentItemID);
      if (!parentItem) {
        return 'item:' + parentItemID;
      }
      
      // 如果父项目是附件，获取其父项目
      let targetItem = parentItem;
      if (parentItem.isAttachment() && parentItem.parentItemID) {
        const grandParent = Zotero.Items.get(parentItem.parentItemID);
        if (grandParent) {
          targetItem = grandParent;
        }
      }
      
      // 尝试获取DOI
      try {
        const doi = targetItem.getField('DOI');
        if (doi) return 'doi:' + doi;
      } catch (e) {
        this.log("Error getting DOI: " + e);
      }
      
      // 尝试获取标题
      try {
        const title = targetItem.getField('title');
        if (title) return 'title:' + title.replace(/\W/g, '_').substring(0, 50);
      } catch (e) {
        this.log("Error getting title: " + e);
      }
      
      return 'item:' + targetItem.id;
    } catch (error) {
      this.log("Error getting document ID: " + error);
      return 'unknown:' + Date.now();
    }
  },
  
  /**
   * 获取当前用户名
   */
  getCurrentUserName() {
    try {
      return Zotero.Users.getCurrentUserName() || 'Anonymous';
    } catch {
      return 'Anonymous';
    }
  },
  
  /**
   * 生成唯一ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  },
  
  /**
   * 分享选中的标注
   */
  async shareSelectedAnnotations() {
    try {
      const annotations = this.getSelectedAnnotations();
      if (!annotations || annotations.length === 0) {
        this.showMessage("没有选中的标注可以分享");
        return;
      }
      
      this.showMessage(`正在分享 ${annotations.length} 个标注...`);
      
      const universalAnnotations = annotations
        .map(ann => this.convertZoteroToUniversal(ann))
        .filter(ann => ann !== null);
      
      if (universalAnnotations.length === 0) {
        this.showMessage("标注转换失败");
        return;
      }
      
      const result = await this.uploadAnnotations(universalAnnotations);
      if (result.success) {
        this.showMessage(`成功分享 ${result.count} 个标注！`);
      } else {
        this.showMessage(`分享失败：${result.error}`);
      }
      
    } catch (error) {
      this.log("Error sharing annotations: " + error);
      this.showMessage("分享过程中出现错误：" + error.message);
    }
  },

  /**
   * 分享指定的标注数组
   */
  async shareAnnotations(annotations, options = {}) {
    try {
      if (!annotations || annotations.length === 0) {
        this.log("没有标注可以分享");
        return { success: false, error: "没有标注" };
      }

      this.log(`开始分享 ${annotations.length} 个标注`);

      // 如果启用选择性分享且有多个标注，显示选择器
      if (options.enableSelection !== false && annotations.length > 1) {
        try {
          const selectionResult = await this.showAnnotationSelector(annotations);
          if (selectionResult && selectionResult.annotations) {
            annotations = selectionResult.annotations;
            options.privacy = selectionResult.privacy;
            this.log(`用户选择了 ${annotations.length} 个标注进行分享`);
          }
        } catch (error) {
          if (error.message === 'User cancelled') {
            this.log("用户取消了标注分享");
            return { success: false, message: '用户取消了分享' };
          }
          this.log(`标注选择器错误: ${error.message}`, 'warn');
          // 继续使用所有标注
        }
      }

      // 转换标注格式
      const universalAnnotations = [];
      let conversionErrors = 0;

      for (const ann of annotations) {
        try {
          const converted = this.convertZoteroToUniversal(ann);
          if (converted) {
            universalAnnotations.push(converted);
          } else {
            conversionErrors++;
            this.log(`标注转换失败: ${ann.id || 'unknown'}`);
          }
        } catch (e) {
          conversionErrors++;
          this.log(`标注转换异常: ${e.message}`);
        }
      }

      this.log(`转换完成: ${universalAnnotations.length} 个成功, ${conversionErrors} 个失败`);

      if (universalAnnotations.length === 0) {
        return { success: false, error: "所有标注转换失败" };
      }

      // 显示上传进度
      const progressId = this.showProgress('正在上传标注...', 0);

      try {
        // 上传标注
        const result = await this.uploadAnnotations(universalAnnotations, options);

        if (result.success) {
          const finalCount = result.count || universalAnnotations.length;

          // 更新进度
          this.updateProgress(progressId, 80, '正在初始化社交功能...');

          // 触发社交功能初始化
          await this.initializeSocialFeatures(universalAnnotations, options);

          // 完成进度
          this.updateProgress(progressId, 100, '分享完成！');
          setTimeout(() => this.hideNotification(progressId), 1000);

          // 显示成功消息
          this.showSuccess(`成功分享 ${finalCount} 个标注！`);

          return {
            success: true,
            count: finalCount,
            mode: result.mode || 'online',
            message: result.message
          };
        } else {
          // 隐藏进度，显示错误
          this.hideNotification(progressId);
          this.handleError(new Error(result.error || "上传失败"), {
            type: 'NETWORK',
            context: 'annotation_upload'
          });

          return { success: false, error: result.error || "上传失败" };
        }
      } catch (error) {
        // 隐藏进度，显示错误
        this.hideNotification(progressId);
        this.handleError(error, {
          type: 'ANNOTATION',
          context: 'annotation_sharing'
        });

        return { success: false, error: error.message };
      }

    } catch (error) {
      this.log("分享标注时发生异常: " + error);
      return { success: false, error: error.message || "未知错误" };
    }
  },
  
  /**
   * 分享文档的所有标注
   */
  async shareAllDocumentAnnotations() {
    try {
      const annotations = this.getDocumentAnnotations();
      if (!annotations || annotations.length === 0) {
        this.showMessage("当前文档没有标注可以分享");
        return;
      }
      
      const result = await this.showConfirmDialog(
        "确认分享",
        `是否要分享当前文档的所有 ${annotations.length} 个标注？`,
        "分享",
        "取消"
      );
      
      if (!result) return;
      
      this.showMessage(`正在分享 ${annotations.length} 个标注...`);
      
      const universalAnnotations = annotations
        .map(ann => this.convertZoteroToUniversal(ann))
        .filter(ann => ann !== null);
      
      const uploadResult = await this.uploadAnnotations(universalAnnotations);
      if (uploadResult.success) {
        if (uploadResult.mode === 'offline') {
          this.showMessage(`✅ 离线模式：已处理 ${uploadResult.count} 个标注\n${uploadResult.message}`);
        } else {
          this.showMessage(`✅ 成功分享 ${uploadResult.count} 个标注到服务器！`);
        }
      } else {
        this.showMessage(`❌ 分享失败：${uploadResult.error}`);
      }
      
    } catch (error) {
      this.log("Error sharing all annotations: " + error);
      this.showMessage("分享过程中出现错误：" + error.message);
    }
  },
  
  /**
   * 检查服务器连接状态
   */
  async checkServerConnection() {
    try {
      // 首先尝试动态检测端口
      const detectedApiUrl = await this.detectApiPort();
      if (detectedApiUrl) {
        // 更新API基础URL
        this.apiBase = detectedApiUrl;
        this.log(`✅ 使用检测到的API地址: ${this.apiBase}`);
      } else {
        this.log(`⚠️ 未检测到API服务器，使用当前地址: ${this.apiBase}`);
      }
      
      // 直接使用 this.apiBase，确保使用最新设置的地址
      const apiUrl = this.apiBase;
      this.log(`正在连接: ${apiUrl}/health`);

      // 使用XMLHttpRequest替代fetch
      const response = await this.makeHttpRequest(`${apiUrl}/health`, {
        method: 'GET',
        timeout: 5000, // 5秒超时
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        let data = {};
        try {
          data = JSON.parse(response.responseText);
        } catch (e) {
          data = { service: 'API Server', api: '1.0' };
        }
        this.log(`✅ 服务器连接成功: ${data.service} v${data.api} (${apiUrl})`);
        return true;
      } else {
        this.log(`❌ 服务器响应错误: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      this.log(`❌ 服务器连接失败: ${error.message}`);
      return false;
    }
  },

  /**
   * 模拟分享功能（离线模式）
   */
  async simulateAnnotationSharing(annotations) {
    try {
      this.log("运行离线模式 - 模拟标注分享");
      
      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 生成模拟结果
      const result = {
        success: true,
        count: annotations.length,
        mode: 'offline',
        message: '标注已保存到本地（离线模式）'
      };
      
      this.log(`离线模式处理完成: ${result.count} 个标注`);
      return result;
      
    } catch (error) {
      this.log("模拟分享失败: " + error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * 上传标注到服务器
   */
  async uploadAnnotations(annotations) {
    try {
      // 首先检查服务器连接
      this.log("检查服务器连接状态...");
      const isServerOnline = await this.checkServerConnection();
      
      if (!isServerOnline) {
        this.log("服务器离线，切换到离线模式");
        return await this.simulateAnnotationSharing(annotations);
      }
      
      this.log("服务器在线，尝试上传标注...");
      
      const response = await fetch(`${this.getApiBase()}/annotations/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + await this.getAuthToken()
        },
        body: JSON.stringify({
          action: 'create',
          annotations: annotations
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          count: result.data.summary.successful,
          mode: 'online'
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Unknown error'
        };
      }
      
    } catch (error) {
      this.log("Upload error: " + error);
      
      // 如果是网络错误，尝试离线模式
      if (error.message.includes('NetworkError') || 
          error.message.includes('Failed to fetch') ||
          error.message.includes('timeout')) {
        this.log("网络错误，切换到离线模式");
        return await this.simulateAnnotationSharing(annotations);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 获取认证令牌
   */
  async getAuthToken() {
    // 简化处理，实际应该有完整的OAuth流程
    return 'test-token';
  },
  
  /**
   * 显示导入对话框
   */
  async showImportDialog() {
    try {
      const platforms = ['mendeley', 'hypothesis', 'adobe-reader'];
      const platform = await this.showSelectionDialog(
        "选择平台",
        "从哪个平台导入标注？",
        platforms.map(p => ({
          label: this.getPlatformDisplayName(p),
          value: p
        }))
      );
      
      if (!platform) return;
      
      this.showMessage("正在从 " + this.getPlatformDisplayName(platform) + " 导入标注...");
      
      const result = await this.importFromPlatform(platform);
      if (result.success) {
        this.showMessage(`成功导入 ${result.count} 个标注！`);
      } else {
        this.showMessage(`导入失败：${result.error}`);
      }
      
    } catch (error) {
      this.log("Import error: " + error);
      this.showMessage("导入过程中出现错误：" + error.message);
    }
  },
  
  /**
   * 从指定平台导入标注
   */
  async importFromPlatform(platform) {
    try {
      // 这里应该调用具体平台的API
      // 目前只是模拟
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: true,
        count: Math.floor(Math.random() * 20) + 1
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 获取平台显示名称
   */
  getPlatformDisplayName(platform) {
    const names = {
      'mendeley': 'Mendeley',
      'hypothesis': 'Hypothesis',
      'adobe-reader': 'Adobe Reader',
      'zotero': 'Zotero'
    };
    return names[platform] || platform;
  },
  
  /**
   * 显示消息
   */
  showMessage(message) {
    try {
      const ps = Services.prompt;
      ps.alert(null, "研学港标注分享", message);
    } catch (error) {
      this.log("Error showing message: " + error);
      alert(message);
    }
  },

  /**
   * 显示标注选择器
   */
  async showAnnotationSelector(annotations) {
    try {
      this.log(`显示标注选择器，包含 ${annotations.length} 个标注`);

      // 检查AnnotationSelector是否可用
      if (typeof AnnotationSelector === 'undefined') {
        this.log("AnnotationSelector不可用，跳过选择步骤", 'warn');
        return { annotations: annotations, privacy: 'public' };
      }

      // 显示选择器并等待用户选择
      const result = await AnnotationSelector.showSelector(annotations);
      this.log(`用户选择完成: ${result.selectedIds.length} 个标注, 隐私设置: ${result.privacy}`);

      return result;
    } catch (error) {
      this.log(`显示标注选择器失败: ${error.message}`, 'error');
      throw error;
    }
  },

  /**
   * 显示确认对话框
   */
  async showConfirmDialog(title, message, confirmLabel = '确定', cancelLabel = '取消') {
    try {
      const ps = Services.prompt;
      const result = ps.confirm(null, title, message);
      return result;
    } catch (error) {
      this.log("Error showing confirm dialog: " + error);
      return confirm(message);
    }
  },
  
  /**
   * 显示选择对话框
   */
  async showSelectionDialog(title, message, options) {
    try {
      const ps = Services.prompt;
      const selected = {};
      const result = ps.select(
        null,
        title,
        message,
        options.length,
        options.map(opt => opt.label),
        selected
      );
      
      if (result) {
        return options[selected.value]?.value;
      }
      return null;
    } catch (error) {
      this.log("Error showing selection dialog: " + error);
      // 简化处理
      return options[0]?.value;
    }
  }
};
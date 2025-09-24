/**
 * 同步管理器 - Sync Manager
 * 负责与研学港服务器的数据同步
 */

class SyncManager {
  constructor() {
    this.initialized = false;
    this.syncTimer = null;
    this.syncInProgress = false;
    this.lastSyncTime = 0;
    this.retryCount = 0;
    this.maxRetries = Researchopia.config.maxRetries;
    this.syncInterval = Researchopia.config.syncInterval;
    
    // API端点配置
    this.apiEndpoints = {
      annotations: '/api/v1/annotations',
      annotationsBatch: '/api/v1/annotations/batch',
      annotationsByDoi: '/api/v1/annotations/doi',
      health: '/api/v1/health'
    };
    
    Researchopia.log('SyncManager initialized');
  }

  /**
   * 初始化同步管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 检查服务器连接
      await this.checkServerConnection();
      
      // 启动定期同步
      this.startPeriodicSync();
      
      // 恢复上次同步时间
      this.restoreLastSyncTime();
      
      Researchopia.log('SyncManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.initialize');
    }
  }

  /**
   * 检查服务器连接
   */
  async checkServerConnection() {
    try {
      const serverUrl = await this.getActiveServerUrl();
      const response = await this.makeRequest('GET', this.apiEndpoints.health);
      
      if (response.success) {
        Researchopia.log(`Connected to server: ${serverUrl}`);
        return true;
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.checkServerConnection');
      return false;
    }
  }

  /**
   * 获取活跃的服务器URL
   */
  async getActiveServerUrl() {
    // 优先尝试本地开发服务器
    for (const url of Researchopia.config.localUrls) {
      try {
        const response = await fetch(`${url}/api/v1/health`, {
          method: 'GET',
          timeout: 3000
        });
        if (response.ok) {
          Researchopia.config.activeServerUrl = url;
          return url;
        }
      } catch (error) {
        // 继续尝试下一个URL
      }
    }
    
    // 回退到生产服务器
    Researchopia.config.activeServerUrl = Researchopia.config.serverUrl;
    return Researchopia.config.serverUrl;
  }

  /**
   * 同步单个标注
   * @param {Object} annotation - UniversalAnnotation格式的标注
   */
  async syncAnnotation(annotation) {
    try {
      if (!this.initialized) {
        Researchopia.log('SyncManager not initialized, skipping sync');
        return;
      }

      const response = await this.makeRequest('POST', this.apiEndpoints.annotations, annotation);
      
      if (response.success) {
        // 清除待同步标记
        if (Researchopia.modules.annotationManager) {
          Researchopia.modules.annotationManager.clearSyncPending(annotation.id);
        }
        
        Researchopia.log(`Annotation synced successfully: ${annotation.id}`);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Sync failed');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.syncAnnotation');
      throw error;
    }
  }

  /**
   * 批量同步标注
   * @param {Array} annotations - 标注数组
   */
  async syncAnnotationsBatch(annotations) {
    try {
      if (!annotations || annotations.length === 0) {
        return { success: true, results: [] };
      }

      const batchData = {
        action: 'create',
        annotations: annotations
      };

      const response = await this.makeRequest('POST', this.apiEndpoints.annotationsBatch, batchData);
      
      if (response.success) {
        // 清除已同步标注的待同步标记
        if (Researchopia.modules.annotationManager) {
          annotations.forEach(annotation => {
            Researchopia.modules.annotationManager.clearSyncPending(annotation.id);
          });
        }
        
        Researchopia.log(`Batch sync completed: ${annotations.length} annotations`);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Batch sync failed');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.syncAnnotationsBatch');
      throw error;
    }
  }

  /**
   * 删除标注
   * @param {string} annotationId - 标注ID
   */
  async deleteAnnotation(annotationId) {
    try {
      const response = await this.makeRequest('DELETE', `${this.apiEndpoints.annotations}/${annotationId}`);
      
      if (response.success) {
        Researchopia.log(`Annotation deleted successfully: ${annotationId}`);
        return true;
      } else {
        throw new Error(response.error?.message || 'Delete failed');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.deleteAnnotation');
      throw error;
    }
  }

  /**
   * 根据DOI获取标注
   * @param {string} doi - DOI标识符
   */
  async getAnnotationsByDoi(doi) {
    try {
      const encodedDoi = encodeURIComponent(doi);
      const response = await this.makeRequest('GET', `${this.apiEndpoints.annotationsByDoi}/${encodedDoi}`);
      
      if (response.success) {
        Researchopia.log(`Retrieved ${response.data?.length || 0} annotations for DOI: ${doi}`);
        return response.data || [];
      } else {
        throw new Error(response.error?.message || 'Failed to get annotations');
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.getAnnotationsByDoi');
      return [];
    }
  }

  /**
   * 执行完整同步
   */
  async performFullSync() {
    try {
      if (this.syncInProgress) {
        Researchopia.log('Sync already in progress, skipping');
        return;
      }

      this.syncInProgress = true;
      Researchopia.log('Starting full sync');

      // 执行双向同步
      await this.performBidirectionalSync();

      // 更新最后同步时间
      this.lastSyncTime = Date.now();
      this.saveLastSyncTime();

      // 重置重试计数
      this.retryCount = 0;

      Researchopia.log('Full sync completed successfully');
    } catch (error) {
      this.retryCount++;
      Researchopia.handleError(error, 'SyncManager.performFullSync');

      // 如果重试次数未达到上限，安排重试
      if (this.retryCount < this.maxRetries) {
        setTimeout(() => {
          this.performFullSync();
        }, 5000 * this.retryCount); // 递增延迟
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 执行双向同步
   */
  async performBidirectionalSync() {
    try {
      Researchopia.log('Starting bidirectional sync');

      // 第一步：上传本地待同步的标注
      await this.uploadLocalChanges();

      // 第二步：下载服务器端的更新
      await this.downloadRemoteChanges();

      // 第三步：解决冲突
      await this.resolveConflicts();

      Researchopia.log('Bidirectional sync completed');
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.performBidirectionalSync');
      throw error;
    }
  }

  /**
   * 上传本地变更
   */
  async uploadLocalChanges() {
    try {
      // 获取待同步的标注
      const pendingAnnotations = Researchopia.modules.annotationManager?.getPendingSyncAnnotations() || [];

      if (pendingAnnotations.length > 0) {
        Researchopia.log(`Uploading ${pendingAnnotations.length} local changes`);
        await this.syncAnnotationsBatch(pendingAnnotations);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.uploadLocalChanges');
      throw error;
    }
  }

  /**
   * 下载远程变更
   */
  async downloadRemoteChanges() {
    try {
      // 获取自上次同步以来的远程变更
      const since = new Date(this.lastSyncTime).toISOString();
      const response = await this.makeRequest('GET', `${this.apiEndpoints.annotations}?since=${since}&limit=100`);

      if (response.success && response.data && response.data.length > 0) {
        Researchopia.log(`Downloading ${response.data.length} remote changes`);

        for (const remoteAnnotation of response.data) {
          await this.processRemoteAnnotation(remoteAnnotation);
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.downloadRemoteChanges');
      throw error;
    }
  }

  /**
   * 处理远程标注
   * @param {Object} remoteAnnotation - 远程标注对象
   */
  async processRemoteAnnotation(remoteAnnotation) {
    try {
      // 检查本地是否存在该标注
      const localAnnotation = Researchopia.modules.annotationManager?.getCachedAnnotation(remoteAnnotation.id);

      if (!localAnnotation) {
        // 本地不存在，直接导入
        await this.importRemoteAnnotation(remoteAnnotation);
      } else {
        // 本地存在，检查是否需要更新
        const remoteModified = new Date(remoteAnnotation.modifiedAt);
        const localModified = new Date(localAnnotation.modifiedAt);

        if (remoteModified > localModified) {
          // 远程更新，需要合并或覆盖
          await this.mergeAnnotations(localAnnotation, remoteAnnotation);
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.processRemoteAnnotation');
    }
  }

  /**
   * 导入远程标注
   * @param {Object} remoteAnnotation - 远程标注对象
   */
  async importRemoteAnnotation(remoteAnnotation) {
    try {
      // 查找对应的本地文档
      const documentId = remoteAnnotation.documentId;
      const localItem = await this.findLocalItemByDOI(documentId);

      if (localItem) {
        // 导入标注到本地文档
        const importResult = await Researchopia.modules.annotationManager?.importAnnotations(
          [remoteAnnotation],
          localItem.id
        );

        if (importResult && importResult[0]?.success) {
          Researchopia.log(`Imported remote annotation: ${remoteAnnotation.id}`);
        }
      } else {
        Researchopia.log(`Local document not found for annotation: ${remoteAnnotation.id}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.importRemoteAnnotation');
    }
  }

  /**
   * 合并标注
   * @param {Object} localAnnotation - 本地标注
   * @param {Object} remoteAnnotation - 远程标注
   */
  async mergeAnnotations(localAnnotation, remoteAnnotation) {
    try {
      // 简单的合并策略：远程优先
      // 实际实现可以更复杂，比如合并评论、标签等

      const mergedAnnotation = {
        ...localAnnotation,
        ...remoteAnnotation,
        // 保留本地的某些字段
        id: localAnnotation.id,
        // 合并标签
        metadata: {
          ...remoteAnnotation.metadata,
          tags: [...new Set([
            ...(localAnnotation.metadata?.tags || []),
            ...(remoteAnnotation.metadata?.tags || [])
          ])]
        }
      };

      // 更新本地标注
      await this.updateLocalAnnotation(mergedAnnotation);

      Researchopia.log(`Merged annotation: ${localAnnotation.id}`);
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.mergeAnnotations');
    }
  }

  /**
   * 启动定期同步
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.performFullSync();
    }, this.syncInterval);

    Researchopia.log(`Periodic sync started with interval: ${this.syncInterval}ms`);
  }

  /**
   * 停止同步
   */
  stopSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      Researchopia.log('Periodic sync stopped');
    }
  }

  /**
   * 发起HTTP请求
   * @param {string} method - HTTP方法
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   */
  async makeRequest(method, endpoint, data = null) {
    try {
      const serverUrl = Researchopia.config.activeServerUrl || await this.getActiveServerUrl();
      const url = `${serverUrl}${endpoint}`;
      
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Researchopia-Zotero-Plugin/${Researchopia.version}`
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
        throw new Error(`HTTP ${response.status}: ${responseData.error?.message || 'Request failed'}`);
      }

      return responseData;
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.makeRequest');
      throw error;
    }
  }

  /**
   * 保存最后同步时间
   */
  saveLastSyncTime() {
    try {
      Zotero.Prefs.set('extensions.researchopia.lastSyncTime', this.lastSyncTime);
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.saveLastSyncTime');
    }
  }

  /**
   * 恢复最后同步时间
   */
  restoreLastSyncTime() {
    try {
      const savedTime = Zotero.Prefs.get('extensions.researchopia.lastSyncTime');
      if (savedTime) {
        this.lastSyncTime = parseInt(savedTime);
        Researchopia.log(`Restored last sync time: ${new Date(this.lastSyncTime).toISOString()}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.restoreLastSyncTime');
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      initialized: this.initialized,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      retryCount: this.retryCount,
      serverUrl: Researchopia.config.activeServerUrl
    };
  }

  /**
   * 手动触发同步
   */
  async triggerManualSync() {
    Researchopia.log('Manual sync triggered');
    await this.performFullSync();
  }

  /**
   * 解决冲突
   */
  async resolveConflicts() {
    try {
      // 获取所有冲突的标注
      const conflicts = await this.detectConflicts();

      if (conflicts.length > 0) {
        Researchopia.log(`Resolving ${conflicts.length} conflicts`);

        for (const conflict of conflicts) {
          await this.resolveConflict(conflict);
        }
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.resolveConflicts');
    }
  }

  /**
   * 检测冲突
   * @returns {Array} 冲突列表
   */
  async detectConflicts() {
    try {
      // 简单的冲突检测逻辑
      const conflicts = [];
      return conflicts;
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.detectConflicts');
      return [];
    }
  }

  /**
   * 解决单个冲突
   * @param {Object} conflict - 冲突对象
   */
  async resolveConflict(conflict) {
    try {
      // 冲突解决策略
      switch (conflict.type) {
        case 'version':
          await this.resolveVersionConflict(conflict);
          break;
        case 'position':
          await this.resolvePositionConflict(conflict);
          break;
        case 'content':
          await this.resolveContentConflict(conflict);
          break;
        default:
          Researchopia.log(`Unknown conflict type: ${conflict.type}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.resolveConflict');
    }
  }

  /**
   * 解决版本冲突
   * @param {Object} conflict - 版本冲突
   */
  async resolveVersionConflict(conflict) {
    try {
      // 简单策略：最新修改时间优先
      const { local, remote } = conflict;
      const localTime = new Date(local.modifiedAt);
      const remoteTime = new Date(remote.modifiedAt);

      if (remoteTime > localTime) {
        await this.updateLocalAnnotation(remote);
      } else {
        await this.syncAnnotation(local);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.resolveVersionConflict');
    }
  }

  /**
   * 解决位置冲突
   * @param {Object} conflict - 位置冲突
   */
  async resolvePositionConflict(conflict) {
    try {
      // 位置冲突通常保留两个标注
      const { local, remote } = conflict;

      // 确保两个标注都存在
      await this.updateLocalAnnotation(local);
      await this.syncAnnotation(remote);
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.resolvePositionConflict');
    }
  }

  /**
   * 解决内容冲突
   * @param {Object} conflict - 内容冲突
   */
  async resolveContentConflict(conflict) {
    try {
      // 内容冲突：合并内容
      const { local, remote } = conflict;

      const mergedAnnotation = {
        ...local,
        content: {
          ...local.content,
          comment: this.mergeComments(local.content?.comment, remote.content?.comment)
        },
        metadata: {
          ...local.metadata,
          tags: [...new Set([
            ...(local.metadata?.tags || []),
            ...(remote.metadata?.tags || [])
          ])]
        }
      };

      await this.updateLocalAnnotation(mergedAnnotation);
      await this.syncAnnotation(mergedAnnotation);
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.resolveContentConflict');
    }
  }

  /**
   * 合并评论
   * @param {string} localComment - 本地评论
   * @param {string} remoteComment - 远程评论
   * @returns {string} 合并后的评论
   */
  mergeComments(localComment, remoteComment) {
    if (!localComment && !remoteComment) return '';
    if (!localComment) return remoteComment;
    if (!remoteComment) return localComment;
    if (localComment === remoteComment) return localComment;

    // 合并不同的评论
    return `${localComment}\n\n[远程评论]: ${remoteComment}`;
  }

  /**
   * 更新本地标注
   * @param {Object} annotation - 标注对象
   */
  async updateLocalAnnotation(annotation) {
    try {
      // 通过标注管理器更新本地标注
      if (Researchopia.modules.annotationManager) {
        // 这里需要实现具体的本地更新逻辑
        Researchopia.log(`Updated local annotation: ${annotation.id}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.updateLocalAnnotation');
    }
  }

  /**
   * 根据DOI查找本地文档
   * @param {string} doi - DOI标识符
   * @returns {Object|null} 本地文档对象
   */
  async findLocalItemByDOI(doi) {
    try {
      if (!doi) return null;

      // 搜索所有条目
      const allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);

      for (const item of allItems) {
        try {
          const itemDOI = item.getField('DOI');
          if (itemDOI && itemDOI.replace(/^doi:/, '').trim() === doi) {
            return item;
          }

          // 也检查URL中的DOI
          const url = item.getField('url');
          if (url) {
            const doiMatch = url.match(/doi\.org\/(.+)$/);
            if (doiMatch && doiMatch[1] === doi) {
              return item;
            }
          }
        } catch (error) {
          // 忽略单个条目的错误
        }
      }

      return null;
    } catch (error) {
      Researchopia.handleError(error, 'SyncManager.findLocalItemByDOI');
      return null;
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopSync();
    this.initialized = false;
    this.syncInProgress = false;
    Researchopia.log('SyncManager cleaned up');
  }
}

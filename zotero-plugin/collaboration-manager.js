/**
 * Researchopia Collaboration Manager
 * 标注协作功能模块 - 实时协作、版本控制、冲突解决
 */

const CollaborationManager = {
  // 配置
  config: {
    apiBase: 'http://localhost:3000/api/v1',
    wsBase: 'ws://localhost:8080',
    maxVersionHistory: 50,
    conflictResolutionTimeout: 30000
  },

  // 状态
  state: {
    activeCollaborations: new Map(),
    websocketConnection: null,
    isConnected: false,
    currentUser: null
  },

  // 缓存
  cache: {
    versionHistory: new Map(),
    collaborators: new Map(),
    pendingChanges: new Map()
  },

  /**
   * 初始化协作管理器
   */
  init() {
    this.log("Initializing Collaboration Manager");
    this.setupEventListeners();
    this.initializeWebSocket();
    return this;
  },

  /**
   * 日志记录
   */
  log(message, level = 'info') {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] Researchopia-Collaboration [${level.toUpperCase()}]: ${message}`;
      
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
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.addObserver(this, 'researchopia:collaborationRequest', false);
        Services.obs.addObserver(this, 'researchopia:annotationChanged', false);
        this.log("Collaboration event listeners registered");
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
        case 'researchopia:collaborationRequest':
          this.handleCollaborationRequest(JSON.parse(data));
          break;
        case 'researchopia:annotationChanged':
          this.handleAnnotationChanged(JSON.parse(data));
          break;
      }
    } catch (error) {
      this.log(`Error handling observer event: ${error.message}`, 'error');
    }
  },

  /**
   * 初始化WebSocket连接
   */
  initializeWebSocket() {
    try {
      if (!this.isUserAuthenticated()) {
        this.log("User not authenticated, skipping WebSocket initialization");
        return;
      }

      this.log("Initializing WebSocket connection");
      
      const wsUrl = `${this.config.wsBase}/collaboration`;
      this.state.websocketConnection = new WebSocket(wsUrl);
      
      this.state.websocketConnection.onopen = () => {
        this.state.isConnected = true;
        this.log("WebSocket connection established");
        this.authenticateWebSocket();
      };
      
      this.state.websocketConnection.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };
      
      this.state.websocketConnection.onclose = () => {
        this.state.isConnected = false;
        this.log("WebSocket connection closed");
        this.scheduleReconnect();
      };
      
      this.state.websocketConnection.onerror = (error) => {
        this.log(`WebSocket error: ${error}`, 'error');
      };
      
    } catch (error) {
      this.log(`Error initializing WebSocket: ${error.message}`, 'error');
    }
  },

  /**
   * WebSocket认证
   */
  authenticateWebSocket() {
    try {
      if (this.state.websocketConnection && this.state.isConnected) {
        const authMessage = {
          type: 'authenticate',
          token: AuthManager.getAuthToken()
        };
        this.state.websocketConnection.send(JSON.stringify(authMessage));
      }
    } catch (error) {
      this.log(`Error authenticating WebSocket: ${error.message}`, 'error');
    }
  },

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(message) {
    try {
      this.log(`Received WebSocket message: ${message.type}`);
      
      switch (message.type) {
        case 'collaboration_invite':
          this.handleCollaborationInvite(message.data);
          break;
        case 'annotation_update':
          this.handleRemoteAnnotationUpdate(message.data);
          break;
        case 'conflict_detected':
          this.handleConflictDetected(message.data);
          break;
        case 'collaborator_joined':
          this.handleCollaboratorJoined(message.data);
          break;
        case 'collaborator_left':
          this.handleCollaboratorLeft(message.data);
          break;
        default:
          this.log(`Unknown message type: ${message.type}`, 'warn');
      }
    } catch (error) {
      this.log(`Error handling WebSocket message: ${error.message}`, 'error');
    }
  },

  /**
   * 开始协作会话
   */
  async startCollaboration(annotationId, collaborators = []) {
    try {
      this.log(`Starting collaboration for annotation: ${annotationId}`);
      
      if (!this.isUserAuthenticated()) {
        throw new Error('请先登录');
      }

      const response = await this.makeRequest('/collaboration/start', {
        method: 'POST',
        body: JSON.stringify({
          annotationId,
          collaborators
        })
      });

      if (response.ok) {
        const collaboration = JSON.parse(response.responseText);
        this.state.activeCollaborations.set(annotationId, collaboration);
        
        // 加入WebSocket房间
        this.joinCollaborationRoom(collaboration.id);
        
        this.log(`Collaboration started: ${collaboration.id}`);
        return { success: true, collaboration };
      } else {
        throw new Error(`启动协作失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error starting collaboration: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 加入协作房间
   */
  joinCollaborationRoom(collaborationId) {
    try {
      if (this.state.websocketConnection && this.state.isConnected) {
        const joinMessage = {
          type: 'join_collaboration',
          collaborationId
        };
        this.state.websocketConnection.send(JSON.stringify(joinMessage));
        this.log(`Joined collaboration room: ${collaborationId}`);
      }
    } catch (error) {
      this.log(`Error joining collaboration room: ${error.message}`, 'error');
    }
  },

  /**
   * 发送标注更新
   */
  async sendAnnotationUpdate(annotationId, changes) {
    try {
      this.log(`Sending annotation update: ${annotationId}`);
      
      const collaboration = this.state.activeCollaborations.get(annotationId);
      if (!collaboration) {
        throw new Error('没有活跃的协作会话');
      }

      // 创建版本信息
      const version = {
        id: this.generateVersionId(),
        annotationId,
        changes,
        author: this.getCurrentUser(),
        timestamp: new Date().toISOString(),
        parentVersion: this.getLatestVersionId(annotationId)
      };

      // 发送到服务器
      const response = await this.makeRequest('/collaboration/update', {
        method: 'POST',
        body: JSON.stringify({
          collaborationId: collaboration.id,
          version
        })
      });

      if (response.ok) {
        // 更新本地版本历史
        this.addVersionToHistory(annotationId, version);
        
        // 通过WebSocket广播更新
        this.broadcastUpdate(collaboration.id, version);
        
        this.log(`Annotation update sent successfully`);
        return { success: true, version };
      } else {
        throw new Error(`发送更新失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error sending annotation update: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 处理远程标注更新
   */
  handleRemoteAnnotationUpdate(data) {
    try {
      this.log(`Handling remote annotation update: ${data.version.annotationId}`);
      
      const { version, collaborationId } = data;
      
      // 检查是否有冲突
      const conflict = this.detectConflict(version);
      if (conflict) {
        this.handleConflict(version, conflict);
        return;
      }

      // 应用更新
      this.applyAnnotationUpdate(version);
      
      // 更新版本历史
      this.addVersionToHistory(version.annotationId, version);
      
      // 通知UI更新
      this.notifyAnnotationUpdated(version);
      
    } catch (error) {
      this.log(`Error handling remote annotation update: ${error.message}`, 'error');
    }
  },

  /**
   * 检测冲突
   */
  detectConflict(incomingVersion) {
    try {
      const annotationId = incomingVersion.annotationId;
      const localVersion = this.getLatestVersionId(annotationId);
      
      // 如果父版本不匹配，可能存在冲突
      if (incomingVersion.parentVersion !== localVersion) {
        const localChanges = this.cache.pendingChanges.get(annotationId);
        if (localChanges && localChanges.length > 0) {
          return {
            type: 'concurrent_edit',
            localVersion,
            incomingVersion,
            localChanges
          };
        }
      }
      
      return null;
    } catch (error) {
      this.log(`Error detecting conflict: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 处理冲突
   */
  async handleConflict(incomingVersion, conflict) {
    try {
      this.log(`Handling conflict for annotation: ${incomingVersion.annotationId}`);
      
      // 显示冲突解决界面
      const resolution = await this.showConflictResolutionDialog(conflict);
      
      if (resolution.action === 'merge') {
        // 合并更改
        const mergedVersion = this.mergeVersions(incomingVersion, conflict.localChanges);
        await this.sendAnnotationUpdate(incomingVersion.annotationId, mergedVersion.changes);
      } else if (resolution.action === 'accept_remote') {
        // 接受远程更改
        this.applyAnnotationUpdate(incomingVersion);
        this.cache.pendingChanges.delete(incomingVersion.annotationId);
      } else if (resolution.action === 'keep_local') {
        // 保持本地更改
        await this.sendAnnotationUpdate(incomingVersion.annotationId, conflict.localChanges);
      }
      
    } catch (error) {
      this.log(`Error handling conflict: ${error.message}`, 'error');
    }
  },

  /**
   * 显示冲突解决对话框
   */
  async showConflictResolutionDialog(conflict) {
    return new Promise((resolve) => {
      try {
        const dialogHTML = this.createConflictResolutionHTML(conflict);
        
        const dialog = Services.ww.openWindow(
          null,
          'data:text/html;charset=utf-8,' + encodeURIComponent(dialogHTML),
          'conflict-resolution',
          'chrome,centerscreen,modal,resizable=yes,width=700,height=500',
          null
        );

        dialog.addEventListener('load', () => {
          dialog.contentWindow.resolveConflict = resolve;
          this.setupConflictResolutionEvents(dialog, conflict);
        });

      } catch (error) {
        this.log(`Error showing conflict resolution dialog: ${error.message}`, 'error');
        resolve({ action: 'accept_remote' }); // 默认接受远程更改
      }
    });
  },

  /**
   * 设置冲突解决事件
   */
  setupConflictResolutionEvents(dialog, conflict) {
    try {
      // 显示冲突内容
      const localChanges = dialog.contentDocument.getElementById('local-changes');
      const remoteChanges = dialog.contentDocument.getElementById('remote-changes');

      if (localChanges) {
        localChanges.textContent = JSON.stringify(conflict.localChanges, null, 2);
      }
      if (remoteChanges) {
        remoteChanges.textContent = JSON.stringify(conflict.incomingVersion.changes, null, 2);
      }

      this.log("Conflict resolution events setup completed");
    } catch (error) {
      this.log(`Error setting up conflict resolution events: ${error.message}`, 'error');
    }
  },

  /**
   * 合并版本
   */
  mergeVersions(incomingVersion, localChanges) {
    try {
      this.log("Merging versions");

      // 简单的合并策略：优先保留本地更改，添加远程的新字段
      const mergedChanges = { ...incomingVersion.changes };

      // 合并文本内容
      if (localChanges.text && incomingVersion.changes.text) {
        mergedChanges.text = localChanges.text + '\n---\n' + incomingVersion.changes.text;
      } else if (localChanges.text) {
        mergedChanges.text = localChanges.text;
      }

      // 合并评论
      if (localChanges.comment && incomingVersion.changes.comment) {
        mergedChanges.comment = localChanges.comment + '\n---\n' + incomingVersion.changes.comment;
      } else if (localChanges.comment) {
        mergedChanges.comment = localChanges.comment;
      }

      // 保留本地的颜色和其他属性
      if (localChanges.color) mergedChanges.color = localChanges.color;
      if (localChanges.tags) mergedChanges.tags = localChanges.tags;

      return {
        id: this.generateVersionId(),
        annotationId: incomingVersion.annotationId,
        changes: mergedChanges,
        author: this.getCurrentUser(),
        timestamp: new Date().toISOString(),
        parentVersion: incomingVersion.id,
        isMerged: true
      };
    } catch (error) {
      this.log(`Error merging versions: ${error.message}`, 'error');
      return incomingVersion;
    }
  },

  /**
   * 应用标注更新
   */
  applyAnnotationUpdate(version) {
    try {
      this.log(`Applying annotation update: ${version.annotationId}`);

      // 这里应该更新Zotero中的实际标注
      // 由于Zotero API的复杂性，这里只是示例实现

      // 通知其他模块标注已更新
      this.notifyAnnotationUpdated(version);

    } catch (error) {
      this.log(`Error applying annotation update: ${error.message}`, 'error');
    }
  },

  /**
   * 通知标注已更新
   */
  notifyAnnotationUpdated(version) {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        Services.obs.notifyObservers(null, 'researchopia:annotationUpdated', JSON.stringify(version));
      }
    } catch (error) {
      this.log(`Error notifying annotation updated: ${error.message}`, 'error');
    }
  },

  /**
   * 广播更新
   */
  broadcastUpdate(collaborationId, version) {
    try {
      if (this.state.websocketConnection && this.state.isConnected) {
        const message = {
          type: 'broadcast_update',
          collaborationId,
          version
        };
        this.state.websocketConnection.send(JSON.stringify(message));
      }
    } catch (error) {
      this.log(`Error broadcasting update: ${error.message}`, 'error');
    }
  },

  /**
   * 添加版本到历史
   */
  addVersionToHistory(annotationId, version) {
    try {
      if (!this.cache.versionHistory.has(annotationId)) {
        this.cache.versionHistory.set(annotationId, []);
      }

      const history = this.cache.versionHistory.get(annotationId);
      history.push(version);

      // 限制历史记录数量
      if (history.length > this.config.maxVersionHistory) {
        history.shift();
      }

      this.log(`Version added to history: ${version.id}`);
    } catch (error) {
      this.log(`Error adding version to history: ${error.message}`, 'error');
    }
  },

  /**
   * 获取最新版本ID
   */
  getLatestVersionId(annotationId) {
    try {
      const history = this.cache.versionHistory.get(annotationId);
      if (history && history.length > 0) {
        return history[history.length - 1].id;
      }
      return null;
    } catch (error) {
      this.log(`Error getting latest version ID: ${error.message}`, 'error');
      return null;
    }
  },

  /**
   * 生成版本ID
   */
  generateVersionId() {
    return 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * 获取当前用户
   */
  getCurrentUser() {
    try {
      if (typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated()) {
        return AuthManager.getCurrentUser();
      }
      return { id: 'anonymous', name: '匿名用户' };
    } catch (error) {
      this.log(`Error getting current user: ${error.message}`, 'error');
      return { id: 'unknown', name: '未知用户' };
    }
  },

  /**
   * 处理协作邀请
   */
  handleCollaborationInvite(data) {
    try {
      this.log(`Received collaboration invite: ${data.collaborationId}`);

      // 显示邀请通知
      this.showCollaborationInvite(data);

    } catch (error) {
      this.log(`Error handling collaboration invite: ${error.message}`, 'error');
    }
  },

  /**
   * 显示协作邀请
   */
  showCollaborationInvite(data) {
    try {
      const message = `${data.inviter.name} 邀请您协作编辑标注`;

      // 这里应该显示一个通知或对话框
      // 暂时使用简单的确认框
      const accept = confirm(`${message}\n\n是否接受邀请？`);

      if (accept) {
        this.acceptCollaborationInvite(data.collaborationId);
      } else {
        this.declineCollaborationInvite(data.collaborationId);
      }

    } catch (error) {
      this.log(`Error showing collaboration invite: ${error.message}`, 'error');
    }
  },

  /**
   * 接受协作邀请
   */
  async acceptCollaborationInvite(collaborationId) {
    try {
      this.log(`Accepting collaboration invite: ${collaborationId}`);

      const response = await this.makeRequest(`/collaboration/${collaborationId}/accept`, {
        method: 'POST'
      });

      if (response.ok) {
        const collaboration = JSON.parse(response.responseText);
        this.state.activeCollaborations.set(collaboration.annotationId, collaboration);
        this.joinCollaborationRoom(collaborationId);

        this.log("Collaboration invite accepted");
        return { success: true };
      } else {
        throw new Error(`接受邀请失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error accepting collaboration invite: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 拒绝协作邀请
   */
  async declineCollaborationInvite(collaborationId) {
    try {
      this.log(`Declining collaboration invite: ${collaborationId}`);

      const response = await this.makeRequest(`/collaboration/${collaborationId}/decline`, {
        method: 'POST'
      });

      if (response.ok) {
        this.log("Collaboration invite declined");
        return { success: true };
      } else {
        throw new Error(`拒绝邀请失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error declining collaboration invite: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 处理协作者加入
   */
  handleCollaboratorJoined(data) {
    try {
      this.log(`Collaborator joined: ${data.user.name}`);

      const collaboration = this.state.activeCollaborations.get(data.annotationId);
      if (collaboration) {
        if (!collaboration.collaborators) {
          collaboration.collaborators = [];
        }
        collaboration.collaborators.push(data.user);

        // 通知UI更新
        this.notifyCollaboratorChanged(data.annotationId, 'joined', data.user);
      }
    } catch (error) {
      this.log(`Error handling collaborator joined: ${error.message}`, 'error');
    }
  },

  /**
   * 处理协作者离开
   */
  handleCollaboratorLeft(data) {
    try {
      this.log(`Collaborator left: ${data.user.name}`);

      const collaboration = this.state.activeCollaborations.get(data.annotationId);
      if (collaboration && collaboration.collaborators) {
        collaboration.collaborators = collaboration.collaborators.filter(
          c => c.id !== data.user.id
        );

        // 通知UI更新
        this.notifyCollaboratorChanged(data.annotationId, 'left', data.user);
      }
    } catch (error) {
      this.log(`Error handling collaborator left: ${error.message}`, 'error');
    }
  },

  /**
   * 通知协作者变更
   */
  notifyCollaboratorChanged(annotationId, action, user) {
    try {
      if (typeof Services !== 'undefined' && Services.obs) {
        const data = { annotationId, action, user };
        Services.obs.notifyObservers(null, 'researchopia:collaboratorChanged', JSON.stringify(data));
      }
    } catch (error) {
      this.log(`Error notifying collaborator changed: ${error.message}`, 'error');
    }
  },

  /**
   * 结束协作会话
   */
  async endCollaboration(annotationId) {
    try {
      this.log(`Ending collaboration for annotation: ${annotationId}`);

      const collaboration = this.state.activeCollaborations.get(annotationId);
      if (!collaboration) {
        throw new Error('没有活跃的协作会话');
      }

      const response = await this.makeRequest(`/collaboration/${collaboration.id}/end`, {
        method: 'POST'
      });

      if (response.ok) {
        this.state.activeCollaborations.delete(annotationId);
        this.cache.pendingChanges.delete(annotationId);

        // 离开WebSocket房间
        this.leaveCollaborationRoom(collaboration.id);

        this.log("Collaboration ended successfully");
        return { success: true };
      } else {
        throw new Error(`结束协作失败: ${response.status}`);
      }
    } catch (error) {
      this.log(`Error ending collaboration: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  },

  /**
   * 离开协作房间
   */
  leaveCollaborationRoom(collaborationId) {
    try {
      if (this.state.websocketConnection && this.state.isConnected) {
        const leaveMessage = {
          type: 'leave_collaboration',
          collaborationId
        };
        this.state.websocketConnection.send(JSON.stringify(leaveMessage));
        this.log(`Left collaboration room: ${collaborationId}`);
      }
    } catch (error) {
      this.log(`Error leaving collaboration room: ${error.message}`, 'error');
    }
  },

  /**
   * 计划重连
   */
  scheduleReconnect() {
    setTimeout(() => {
      if (!this.state.isConnected) {
        this.log("Attempting to reconnect WebSocket");
        this.initializeWebSocket();
      }
    }, 5000);
  },

  /**
   * 检查用户是否已认证
   */
  isUserAuthenticated() {
    return typeof AuthManager !== 'undefined' && AuthManager.isUserAuthenticated();
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
   * 创建冲突解决HTML
   */
  createConflictResolutionHTML(conflict) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>解决标注冲突 - 研学港</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f8f9fa;
          }
          .conflict-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 100%;
          }
          .conflict-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .conflict-header h2 {
            color: #dc3545;
            margin: 0 0 8px 0;
          }
          .conflict-description {
            color: #6c757d;
            font-size: 14px;
          }
          .version-comparison {
            display: flex;
            gap: 20px;
            margin: 20px 0;
          }
          .version-panel {
            flex: 1;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 16px;
          }
          .version-panel h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
          }
          .local-version { border-left: 4px solid #007bff; }
          .remote-version { border-left: 4px solid #28a745; }
          .version-content {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 13px;
            white-space: pre-wrap;
          }
          .resolution-options {
            margin: 20px 0;
          }
          .resolution-option {
            display: flex;
            align-items: center;
            padding: 12px;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
          }
          .resolution-option:hover {
            background: #f8f9fa;
          }
          .resolution-option input[type="radio"] {
            margin-right: 12px;
          }
          .option-description {
            flex: 1;
          }
          .option-title {
            font-weight: 500;
            margin-bottom: 4px;
          }
          .option-subtitle {
            font-size: 12px;
            color: #6c757d;
          }
          .action-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 20px;
          }
          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .btn-primary {
            background: #007bff;
            color: white;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="conflict-container">
          <div class="conflict-header">
            <h2>⚠️ 检测到标注冲突</h2>
            <p class="conflict-description">
              您和其他用户同时修改了同一个标注，请选择如何解决这个冲突。
            </p>
          </div>
          
          <div class="version-comparison">
            <div class="version-panel local-version">
              <h3>🏠 您的更改</h3>
              <div class="version-content" id="local-changes"></div>
            </div>
            <div class="version-panel remote-version">
              <h3>🌐 其他用户的更改</h3>
              <div class="version-content" id="remote-changes"></div>
            </div>
          </div>
          
          <div class="resolution-options">
            <label class="resolution-option">
              <input type="radio" name="resolution" value="keep_local" checked>
              <div class="option-description">
                <div class="option-title">保持我的更改</div>
                <div class="option-subtitle">丢弃其他用户的更改，使用您的版本</div>
              </div>
            </label>
            
            <label class="resolution-option">
              <input type="radio" name="resolution" value="accept_remote">
              <div class="option-description">
                <div class="option-title">接受其他用户的更改</div>
                <div class="option-subtitle">丢弃您的更改，使用其他用户的版本</div>
              </div>
            </label>
            
            <label class="resolution-option">
              <input type="radio" name="resolution" value="merge">
              <div class="option-description">
                <div class="option-title">尝试自动合并</div>
                <div class="option-subtitle">智能合并两个版本的更改（可能需要手动调整）</div>
              </div>
            </label>
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-secondary" onclick="cancelResolution()">取消</button>
            <button class="btn btn-primary" onclick="confirmResolution()">确认解决</button>
          </div>
        </div>
        
        <script>
          function confirmResolution() {
            const selected = document.querySelector('input[name="resolution"]:checked');
            if (selected && window.resolveConflict) {
              window.resolveConflict({ action: selected.value });
            }
            window.close();
          }
          
          function cancelResolution() {
            if (window.resolveConflict) {
              window.resolveConflict({ action: 'accept_remote' });
            }
            window.close();
          }
        </script>
      </body>
      </html>
    `;
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CollaborationManager;
}

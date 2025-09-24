/**
 * 实时协作管理器 - Realtime Manager
 * 负责WebSocket连接和实时标注协作
 */

class RealtimeManager {
  constructor() {
    this.initialized = false;
    this.websocket = null;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 初始重连延迟1秒
    this.heartbeatInterval = null;
    this.messageQueue = [];
    this.eventHandlers = new Map();

    // 实时协作相关状态
    this.onlineUsers = new Map(); // documentId -> Set<userId>
    this.userPresence = new Map(); // documentId -> Map<userId, presenceData>
    this.typingUsers = new Map(); // documentId -> Map<userId, typingData>
    this.currentDocument = null;

    Researchopia.log('RealtimeManager initialized');
  }

  /**
   * 初始化实时协作管理器
   */
  async initialize() {
    try {
      this.initialized = true;
      
      // 注册事件处理器
      this.registerEventHandlers();
      
      // 如果用户已认证，自动连接
      if (Researchopia.modules.authManager?.isAuthenticated()) {
        await this.connect();
      }
      
      Researchopia.log('RealtimeManager initialization completed');
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.initialize');
    }
  }

  /**
   * 连接到WebSocket服务器
   */
  async connect() {
    try {
      if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
        Researchopia.log('WebSocket already connected or connecting');
        return;
      }

      this.connectionState = 'connecting';
      Researchopia.log('Connecting to WebSocket server');

      const serverUrl = await this.getWebSocketUrl();
      const authToken = Researchopia.modules.authManager?.getToken();

      if (!authToken) {
        throw new Error('No authentication token available');
      }

      // 创建WebSocket连接
      this.websocket = new WebSocket(`${serverUrl}?token=${encodeURIComponent(authToken)}`);

      // 设置事件监听器
      this.websocket.onopen = this.handleOpen.bind(this);
      this.websocket.onmessage = this.handleMessage.bind(this);
      this.websocket.onclose = this.handleClose.bind(this);
      this.websocket.onerror = this.handleError.bind(this);

      // 设置连接超时
      setTimeout(() => {
        if (this.connectionState === 'connecting') {
          this.websocket?.close();
          this.handleConnectionTimeout();
        }
      }, 10000); // 10秒超时

    } catch (error) {
      this.connectionState = 'error';
      Researchopia.handleError(error, 'RealtimeManager.connect');
      this.scheduleReconnect();
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect() {
    try {
      Researchopia.log('Disconnecting from WebSocket server');
      
      this.connectionState = 'disconnected';
      this.reconnectAttempts = 0;
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.websocket) {
        this.websocket.close();
        this.websocket = null;
      }

      // 清空消息队列
      this.messageQueue = [];
      
      Researchopia.log('WebSocket disconnected');
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.disconnect');
    }
  }

  /**
   * 处理WebSocket连接打开
   */
  handleOpen(event) {
    try {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      
      Researchopia.log('WebSocket connection established');

      // 启动心跳
      this.startHeartbeat();

      // 发送排队的消息
      this.flushMessageQueue();

      // 通知UI更新连接状态
      this.notifyConnectionStateChange('connected');

    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleOpen');
    }
  }

  /**
   * 处理WebSocket消息
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      Researchopia.log(`Received WebSocket message: ${message.type}`);

      // 处理不同类型的消息
      switch (message.type) {
        case 'annotation:created':
          this.handleAnnotationCreated(message.payload);
          break;
        case 'annotation:updated':
          this.handleAnnotationUpdated(message.payload);
          break;
        case 'annotation:deleted':
          this.handleAnnotationDeleted(message.payload);
          break;
        case 'annotation:liked':
          this.handleAnnotationLiked(message.payload);
          break;
        case 'annotation:replied':
          this.handleAnnotationReplied(message.payload);
          break;
        case 'user:connected':
          this.handleUserConnected(message.payload);
          break;
        case 'user:disconnected':
          this.handleUserDisconnected(message.payload);
          break;
        case 'user:typing':
          this.handleUserTyping(message.payload);
          break;
        case 'cursor:moved':
          this.handleCursorMoved(message.payload);
          break;
        case 'document:opened':
          this.handleDocumentOpened(message.payload);
          break;
        case 'document:closed':
          this.handleDocumentClosed(message.payload);
          break;
        case 'presence:update':
          this.handlePresenceUpdate(message.payload);
          break;
        case 'heartbeat':
          this.handleHeartbeat(message.payload);
          break;
        case 'error':
          this.handleServerError(message.payload);
          break;
        default:
          Researchopia.log(`Unknown message type: ${message.type}`);
      }

    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleMessage');
    }
  }

  /**
   * 处理WebSocket连接关闭
   */
  handleClose(event) {
    try {
      Researchopia.log(`WebSocket connection closed: ${event.code} - ${event.reason}`);
      
      this.connectionState = 'disconnected';
      this.websocket = null;

      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // 通知UI更新连接状态
      this.notifyConnectionStateChange('disconnected');

      // 如果不是主动断开，尝试重连
      if (event.code !== 1000) { // 1000 = 正常关闭
        this.scheduleReconnect();
      }

    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleClose');
    }
  }

  /**
   * 处理WebSocket错误
   */
  handleError(event) {
    try {
      this.connectionState = 'error';
      Researchopia.log('WebSocket error occurred');
      
      // 通知UI更新连接状态
      this.notifyConnectionStateChange('error');

    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleError');
    }
  }

  /**
   * 处理连接超时
   */
  handleConnectionTimeout() {
    try {
      Researchopia.log('WebSocket connection timeout');
      this.connectionState = 'error';
      this.scheduleReconnect();
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleConnectionTimeout');
    }
  }

  /**
   * 安排重连
   */
  scheduleReconnect() {
    try {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        Researchopia.log('Max reconnect attempts reached, giving up');
        this.connectionState = 'error';
        this.notifyConnectionStateChange('error');
        return;
      }

      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

      Researchopia.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        if (this.connectionState !== 'connected') {
          this.connect();
        }
      }, delay);

    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.scheduleReconnect');
    }
  }

  /**
   * 启动心跳
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      }
    }, 30000); // 每30秒发送心跳

    Researchopia.log('Heartbeat started');
  }

  /**
   * 发送消息
   * @param {Object} message - 要发送的消息
   */
  sendMessage(message) {
    try {
      if (this.connectionState === 'connected' && this.websocket) {
        this.websocket.send(JSON.stringify(message));
        Researchopia.log(`Sent WebSocket message: ${message.type}`);
      } else {
        // 连接未建立，将消息加入队列
        this.messageQueue.push(message);
        Researchopia.log(`Queued WebSocket message: ${message.type}`);
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.sendMessage');
    }
  }

  /**
   * 发送排队的消息
   */
  flushMessageQueue() {
    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.sendMessage(message);
      }
      Researchopia.log('Message queue flushed');
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.flushMessageQueue');
    }
  }

  /**
   * 获取WebSocket服务器URL
   */
  async getWebSocketUrl() {
    const serverUrl = Researchopia.config.activeServerUrl || await this.getActiveServerUrl();
    return serverUrl.replace(/^http/, 'ws') + '/ws';
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
   * 注册事件处理器
   */
  registerEventHandlers() {
    // 标注事件处理器
    this.eventHandlers.set('annotation:created', this.handleAnnotationCreated.bind(this));
    this.eventHandlers.set('annotation:updated', this.handleAnnotationUpdated.bind(this));
    this.eventHandlers.set('annotation:deleted', this.handleAnnotationDeleted.bind(this));
    
    // 用户事件处理器
    this.eventHandlers.set('user:connected', this.handleUserConnected.bind(this));
    this.eventHandlers.set('user:disconnected', this.handleUserDisconnected.bind(this));
    
    // 光标事件处理器
    this.eventHandlers.set('cursor:moved', this.handleCursorMoved.bind(this));
    
    // 心跳处理器
    this.eventHandlers.set('heartbeat', this.handleHeartbeat.bind(this));
  }

  // 事件处理方法
  handleAnnotationCreated(payload) {
    try {
      Researchopia.log(`Remote annotation created: ${payload.annotation.id}`);
      
      // 通知UI管理器更新显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAnnotationCreated');
    }
  }

  handleAnnotationUpdated(payload) {
    try {
      Researchopia.log(`Remote annotation updated: ${payload.annotation.id}`);
      
      // 通知UI管理器更新显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAnnotationUpdated');
    }
  }

  handleAnnotationDeleted(payload) {
    try {
      Researchopia.log(`Remote annotation deleted: ${payload.id}`);
      
      // 通知UI管理器更新显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationDisplay();
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAnnotationDeleted');
    }
  }

  handleUserConnected(payload) {
    try {
      Researchopia.log(`User connected: ${payload.user.name}`);
      
      // 可以在UI中显示在线用户指示器
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateOnlineUsers?.(payload.user, 'connected');
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleUserConnected');
    }
  }

  handleUserDisconnected(payload) {
    try {
      Researchopia.log(`User disconnected: ${payload.user.name}`);
      
      // 更新在线用户指示器
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateOnlineUsers?.(payload.user, 'disconnected');
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleUserDisconnected');
    }
  }

  handleCursorMoved(payload) {
    try {
      // 可以在UI中显示其他用户的光标位置
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateUserCursor?.(payload.user, payload.position);
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleCursorMoved');
    }
  }

  handleHeartbeat(payload) {
    // 心跳响应，保持连接活跃
    Researchopia.log('Heartbeat received');
  }

  /**
   * 通知连接状态变化
   * @param {string} state - 连接状态
   */
  notifyConnectionStateChange(state) {
    try {
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateConnectionStatus?.(state);
      }
      
      Researchopia.log(`Connection state changed to: ${state}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.notifyConnectionStateChange');
    }
  }

  /**
   * 广播标注创建事件
   * @param {Object} annotation - 标注对象
   */
  broadcastAnnotationCreated(annotation) {
    this.sendMessage({
      type: 'annotation:created',
      payload: {
        annotation: annotation,
        documentId: annotation.documentId
      }
    });
  }

  /**
   * 广播标注更新事件
   * @param {Object} annotation - 标注对象
   * @param {Object} changes - 变更内容
   */
  broadcastAnnotationUpdated(annotation, changes) {
    this.sendMessage({
      type: 'annotation:updated',
      payload: {
        annotation: annotation,
        changes: changes
      }
    });
  }

  /**
   * 广播标注删除事件
   * @param {string} annotationId - 标注ID
   * @param {string} documentId - 文档ID
   */
  broadcastAnnotationDeleted(annotationId, documentId) {
    this.sendMessage({
      type: 'annotation:deleted',
      payload: {
        id: annotationId,
        documentId: documentId
      }
    });
  }

  /**
   * 处理标注点赞事件
   * @param {Object} payload - 点赞数据
   */
  handleAnnotationLiked(payload) {
    try {
      const { annotationId, userId, likes } = payload;

      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationLikes(annotationId, likes);
      }

      // 触发事件
      this.emit('annotation:liked', { annotationId, userId, likes });

      Researchopia.log(`Annotation liked: ${annotationId} by ${userId}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAnnotationLiked');
    }
  }

  /**
   * 处理标注回复事件
   * @param {Object} payload - 回复数据
   */
  handleAnnotationReplied(payload) {
    try {
      const { annotationId, reply } = payload;

      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.updateAnnotationReplies(annotationId, reply);
      }

      // 触发事件
      this.emit('annotation:replied', { annotationId, reply });

      Researchopia.log(`Annotation replied: ${annotationId}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAnnotationReplied');
    }
  }

  /**
   * 处理用户输入状态
   * @param {Object} payload - 输入状态数据
   */
  handleUserTyping(payload) {
    try {
      const { userId, documentId, isTyping, position } = payload;

      // 显示用户输入指示器
      this.showTypingIndicator(userId, documentId, isTyping, position);

      // 触发事件
      this.emit('user:typing', { userId, documentId, isTyping, position });

      Researchopia.log(`User typing: ${userId} in ${documentId}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleUserTyping');
    }
  }

  /**
   * 处理文档打开事件
   * @param {Object} payload - 文档数据
   */
  handleDocumentOpened(payload) {
    try {
      const { userId, documentId, timestamp } = payload;

      // 更新在线用户列表
      this.updateOnlineUsers(documentId, userId, 'joined');

      // 触发事件
      this.emit('document:opened', { userId, documentId, timestamp });

      Researchopia.log(`Document opened: ${documentId} by ${userId}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleDocumentOpened');
    }
  }

  /**
   * 处理文档关闭事件
   * @param {Object} payload - 文档数据
   */
  handleDocumentClosed(payload) {
    try {
      const { userId, documentId, timestamp } = payload;

      // 更新在线用户列表
      this.updateOnlineUsers(documentId, userId, 'left');

      // 触发事件
      this.emit('document:closed', { userId, documentId, timestamp });

      Researchopia.log(`Document closed: ${documentId} by ${userId}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleDocumentClosed');
    }
  }

  /**
   * 处理用户状态更新
   * @param {Object} payload - 状态数据
   */
  handlePresenceUpdate(payload) {
    try {
      const { userId, status, documentId, cursor } = payload;

      // 更新用户状态
      this.updateUserPresence(userId, status, documentId, cursor);

      // 触发事件
      this.emit('presence:update', { userId, status, documentId, cursor });

      Researchopia.log(`Presence updated: ${userId} - ${status}`);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handlePresenceUpdate');
    }
  }

  /**
   * 处理服务器错误
   * @param {Object} payload - 错误数据
   */
  handleServerError(payload) {
    try {
      const { code, message, details } = payload;

      Researchopia.log(`Server error: ${code} - ${message}`);

      // 根据错误类型采取不同的处理策略
      switch (code) {
        case 'AUTH_EXPIRED':
          // 认证过期，重新认证
          this.handleAuthExpired();
          break;
        case 'RATE_LIMITED':
          // 频率限制，延迟重连
          this.handleRateLimit(details);
          break;
        case 'DOCUMENT_NOT_FOUND':
          // 文档不存在
          this.handleDocumentNotFound(details);
          break;
        default:
          // 通用错误处理
          this.emit('error', { code, message, details });
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleServerError');
    }
  }

  /**
   * 显示输入指示器
   * @param {string} userId - 用户ID
   * @param {string} documentId - 文档ID
   * @param {boolean} isTyping - 是否正在输入
   * @param {Object} position - 输入位置
   */
  showTypingIndicator(userId, documentId, isTyping, position) {
    try {
      // 实现输入指示器显示逻辑
      // 这里可以在UI中显示用户正在输入的提示
      if (Researchopia.modules.uiManager) {
        // 调用UI管理器的方法显示输入指示器
        // Researchopia.modules.uiManager.showTypingIndicator(userId, isTyping, position);
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.showTypingIndicator');
    }
  }

  /**
   * 更新在线用户列表
   * @param {string} documentId - 文档ID
   * @param {string} userId - 用户ID
   * @param {string} action - 动作类型 (joined/left)
   */
  updateOnlineUsers(documentId, userId, action) {
    try {
      if (!this.onlineUsers.has(documentId)) {
        this.onlineUsers.set(documentId, new Set());
      }

      const users = this.onlineUsers.get(documentId);

      if (action === 'joined') {
        users.add(userId);
      } else if (action === 'left') {
        users.delete(userId);
      }

      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        const userList = Array.from(users);
        // Researchopia.modules.uiManager.updateOnlineUsers(documentId, userList);
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.updateOnlineUsers');
    }
  }

  /**
   * 更新用户状态
   * @param {string} userId - 用户ID
   * @param {string} status - 状态
   * @param {string} documentId - 文档ID
   * @param {Object} cursor - 光标位置
   */
  updateUserPresence(userId, status, documentId, cursor) {
    try {
      // 更新用户状态缓存
      if (!this.userPresence.has(documentId)) {
        this.userPresence.set(documentId, new Map());
      }

      const documentPresence = this.userPresence.get(documentId);
      documentPresence.set(userId, {
        status: status,
        cursor: cursor,
        lastUpdate: Date.now()
      });

      // 更新UI显示
      if (Researchopia.modules.uiManager) {
        // Researchopia.modules.uiManager.updateUserPresence(userId, status, cursor);
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.updateUserPresence');
    }
  }

  /**
   * 处理认证过期
   */
  handleAuthExpired() {
    try {
      Researchopia.log('Authentication expired, attempting re-authentication');

      // 断开连接
      this.disconnect();

      // 触发重新认证
      if (Researchopia.modules.authManager) {
        Researchopia.modules.authManager.refreshToken().then(() => {
          // 重新连接
          this.connect();
        }).catch(error => {
          Researchopia.handleError(error, 'RealtimeManager.handleAuthExpired.refreshToken');
        });
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleAuthExpired');
    }
  }

  /**
   * 处理频率限制
   * @param {Object} details - 限制详情
   */
  handleRateLimit(details) {
    try {
      const { retryAfter = 5000 } = details;

      Researchopia.log(`Rate limited, retrying after ${retryAfter}ms`);

      // 延迟重连
      setTimeout(() => {
        if (this.connectionState === 'disconnected') {
          this.connect();
        }
      }, retryAfter);
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleRateLimit');
    }
  }

  /**
   * 处理文档不存在错误
   * @param {Object} details - 错误详情
   */
  handleDocumentNotFound(details) {
    try {
      const { documentId } = details;

      Researchopia.log(`Document not found: ${documentId}`);

      // 通知UI显示错误
      if (Researchopia.modules.uiManager) {
        Researchopia.modules.uiManager.showNotification(
          `文档不存在: ${documentId}`,
          'error'
        );
      }
    } catch (error) {
      Researchopia.handleError(error, 'RealtimeManager.handleDocumentNotFound');
    }
  }

  /**
   * 获取连接状态
   * @returns {Object} 连接状态信息
   */
  getConnectionStatus() {
    return {
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      onlineUsers: this.onlineUsers.size,
      userPresence: this.userPresence.size
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.disconnect();
    this.eventHandlers.clear();
    this.onlineUsers.clear();
    this.userPresence.clear();
    this.initialized = false;

    Researchopia.log('RealtimeManager cleaned up');
  }
}

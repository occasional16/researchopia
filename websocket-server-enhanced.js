const WebSocket = require('ws');
const http = require('http');
const url = require('url');

/**
 * 研学港 WebSocket 实时协作服务器
 * Enhanced WebSocket Server for Real-time Collaboration
 */

class ResearchopiaWebSocketServer {
  constructor(port = 3001) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Map(); // userId -> WebSocket
    this.documentSessions = new Map(); // documentId -> Set of userIds
    this.userSessions = new Map(); // userId -> { ws, documentId, lastSeen }
    
    this.setupServer();
    this.setupWebSocket();
    this.setupHeartbeat();
  }

  /**
   * 设置HTTP服务器
   */
  setupServer() {
    this.server = http.createServer((req, res) => {
      // 处理CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // 健康检查端点
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          clients: this.clients.size,
          activeSessions: this.documentSessions.size
        }));
        return;
      }

      // 默认响应
      res.writeHead(404);
      res.end('Not Found');
    });
  }

  /**
   * 设置WebSocket服务器
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/collaboration'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket Server Error:', error);
    });
  }

  /**
   * 处理新连接
   */
  handleConnection(ws, req) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const { documentId, userId } = parsedUrl.query;

      if (!documentId || !userId) {
        ws.close(1008, 'Missing documentId or userId');
        return;
      }

      console.log(`New connection: User ${userId} for document ${documentId}`);

      // 存储客户端信息
      this.clients.set(userId, ws);
      this.userSessions.set(userId, {
        ws,
        documentId,
        lastSeen: Date.now(),
        userName: parsedUrl.query.userName || 'Anonymous',
        userAvatar: parsedUrl.query.userAvatar
      });

      // 添加到文档会话
      if (!this.documentSessions.has(documentId)) {
        this.documentSessions.set(documentId, new Set());
      }
      this.documentSessions.get(documentId).add(userId);

      // 设置消息处理器
      ws.on('message', (data) => {
        this.handleMessage(userId, data);
      });

      // 设置关闭处理器
      ws.on('close', () => {
        this.handleDisconnection(userId);
      });

      // 设置错误处理器
      ws.on('error', (error) => {
        console.error(`WebSocket Error for user ${userId}:`, error);
        this.handleDisconnection(userId);
      });

      // 发送连接确认
      this.sendToUser(userId, {
        type: 'connection:established',
        payload: {
          userId,
          documentId,
          timestamp: new Date().toISOString()
        }
      });

      // 通知其他用户有新用户加入
      this.broadcastToDocument(documentId, {
        type: 'user:connected',
        payload: {
          user: {
            id: userId,
            name: parsedUrl.query.userName || 'Anonymous',
            avatar: parsedUrl.query.userAvatar
          },
          documentId
        }
      }, userId);

      // 发送当前在线用户列表
      this.sendOnlineUsersList(userId, documentId);

    } catch (error) {
      console.error('Error handling connection:', error);
      ws.close(1008, 'Connection error');
    }
  }

  /**
   * 处理消息
   */
  handleMessage(userId, data) {
    try {
      const message = JSON.parse(data);
      const userSession = this.userSessions.get(userId);
      
      if (!userSession) {
        console.warn(`Received message from unknown user: ${userId}`);
        return;
      }

      // 更新最后活跃时间
      userSession.lastSeen = Date.now();

      switch (message.type) {
        case 'ping':
          this.handlePing(userId, message);
          break;
        case 'annotation:created':
          this.handleAnnotationCreated(userId, message);
          break;
        case 'annotation:updated':
          this.handleAnnotationUpdated(userId, message);
          break;
        case 'annotation:deleted':
          this.handleAnnotationDeleted(userId, message);
          break;
        case 'cursor:moved':
          this.handleCursorMoved(userId, message);
          break;
        case 'user:typing':
          this.handleUserTyping(userId, message);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from user ${userId}:`, error);
    }
  }

  /**
   * 处理ping消息
   */
  handlePing(userId, message) {
    this.sendToUser(userId, {
      type: 'pong',
      payload: {
        timestamp: message.payload?.timestamp || Date.now()
      }
    });
  }

  /**
   * 处理标注创建
   */
  handleAnnotationCreated(userId, message) {
    const { annotation, documentId } = message.payload;
    const userSession = this.userSessions.get(userId);
    
    if (userSession && userSession.documentId === documentId) {
      this.broadcastToDocument(documentId, {
        type: 'annotation:created',
        payload: {
          annotation,
          documentId
        }
      }, userId);
    }
  }

  /**
   * 处理标注更新
   */
  handleAnnotationUpdated(userId, message) {
    const { annotation, documentId } = message.payload;
    const userSession = this.userSessions.get(userId);
    
    if (userSession && userSession.documentId === documentId) {
      this.broadcastToDocument(documentId, {
        type: 'annotation:updated',
        payload: {
          annotation,
          documentId
        }
      }, userId);
    }
  }

  /**
   * 处理标注删除
   */
  handleAnnotationDeleted(userId, message) {
    const { annotationId, documentId } = message.payload;
    const userSession = this.userSessions.get(userId);
    
    if (userSession && userSession.documentId === documentId) {
      this.broadcastToDocument(documentId, {
        type: 'annotation:deleted',
        payload: {
          id: annotationId,
          documentId
        }
      }, userId);
    }
  }

  /**
   * 处理光标移动
   */
  handleCursorMoved(userId, message) {
    const { position, documentId } = message.payload;
    const userSession = this.userSessions.get(userId);
    
    if (userSession && userSession.documentId === documentId) {
      this.broadcastToDocument(documentId, {
        type: 'cursor:moved',
        payload: {
          user: {
            id: userId,
            name: userSession.userName,
            avatar: userSession.userAvatar
          },
          position,
          documentId
        }
      }, userId);
    }
  }

  /**
   * 处理用户打字状态
   */
  handleUserTyping(userId, message) {
    const { isTyping, documentId } = message.payload;
    const userSession = this.userSessions.get(userId);
    
    if (userSession && userSession.documentId === documentId) {
      this.broadcastToDocument(documentId, {
        type: 'user:typing',
        payload: {
          userId,
          isTyping,
          documentId
        }
      }, userId);
    }
  }

  /**
   * 处理断开连接
   */
  handleDisconnection(userId) {
    console.log(`User ${userId} disconnected`);
    
    const userSession = this.userSessions.get(userId);
    if (userSession) {
      const { documentId } = userSession;
      
      // 从文档会话中移除
      if (this.documentSessions.has(documentId)) {
        this.documentSessions.get(documentId).delete(userId);
        if (this.documentSessions.get(documentId).size === 0) {
          this.documentSessions.delete(documentId);
        }
      }

      // 通知其他用户
      this.broadcastToDocument(documentId, {
        type: 'user:disconnected',
        payload: {
          user: {
            id: userId,
            name: userSession.userName
          },
          documentId
        }
      }, userId);
    }

    // 清理用户数据
    this.clients.delete(userId);
    this.userSessions.delete(userId);
  }

  /**
   * 发送消息给特定用户
   */
  sendToUser(userId, message) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        this.handleDisconnection(userId);
      }
    }
  }

  /**
   * 广播消息给文档的所有用户
   */
  broadcastToDocument(documentId, message, excludeUserId = null) {
    const userIds = this.documentSessions.get(documentId);
    if (!userIds) return;

    userIds.forEach(userId => {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    });
  }

  /**
   * 发送在线用户列表
   */
  sendOnlineUsersList(userId, documentId) {
    const userIds = this.documentSessions.get(documentId);
    if (!userIds) return;

    const onlineUsers = Array.from(userIds)
      .filter(id => id !== userId)
      .map(id => {
        const session = this.userSessions.get(id);
        return {
          id,
          name: session?.userName || 'Anonymous',
          avatar: session?.userAvatar,
          lastSeen: session?.lastSeen
        };
      });

    this.sendToUser(userId, {
      type: 'users:online',
      payload: {
        users: onlineUsers,
        documentId
      }
    });
  }

  /**
   * 设置心跳检测
   */
  setupHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60秒超时

      this.userSessions.forEach((session, userId) => {
        if (now - session.lastSeen > timeout) {
          console.log(`User ${userId} timed out`);
          this.handleDisconnection(userId);
        }
      });
    }, 30000); // 每30秒检查一次
  }

  /**
   * 启动服务器
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`🚀 Researchopia WebSocket Server running on port ${this.port}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${this.port}/collaboration`);
      console.log(`🏥 Health check: http://localhost:${this.port}/health`);
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    console.log('WebSocket Server stopped');
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    return {
      port: this.port,
      clients: this.clients.size,
      activeSessions: this.documentSessions.size,
      documentSessions: Array.from(this.documentSessions.keys()),
      userSessions: Array.from(this.userSessions.keys())
    };
  }
}

// 创建并启动服务器
const server = new ResearchopiaWebSocketServer(process.env.WS_PORT || 3001);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  server.stop();
  process.exit(0);
});

// 启动服务器
server.start();

module.exports = ResearchopiaWebSocketServer;

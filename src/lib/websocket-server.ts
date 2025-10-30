// WebSocket服务器用于实时协作
import { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

// 定义消息类型
interface WSMessage {
  type: 'join_document' | 'leave_document' | 'annotation_created' | 'annotation_updated' | 'annotation_deleted' | 'cursor_move' | 'user_typing';
  documentId?: string;
  userId?: string;
  data?: any;
  timestamp?: number;
}

// 用户连接信息
interface UserConnection {
  ws: any;
  userId: string;
  documentId: string | null;
  lastActivity: number;
}

class PDFCollaborationServer {
  private wss: WebSocketServer;
  private connections = new Map<string, UserConnection>();
  private documentUsers = new Map<string, Set<string>>();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ 
      port,
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    console.log(`🚀 PDF协作WebSocket服务器启动在端口 ${port}`);
  }

  private verifyClient(info: { origin: string; req: IncomingMessage }): boolean {
    // 在生产环境中，这里应该实现适当的认证和CORS检查
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://www.researchopia.com',
      'https://researchopia.vercel.app' // 保留vercel作为备用域名
    ];
    
    return allowedOrigins.includes(info.origin) || process.env.NODE_ENV === 'development';
  }

  private handleConnection(ws: any, req: IncomingMessage) {
    const connectionId = this.generateConnectionId();
    console.log(`👤 新用户连接: ${connectionId}`);

    // 初始化连接信息
    const connection: UserConnection = {
      ws,
      userId: '',
      documentId: null,
      lastActivity: Date.now()
    };

    this.connections.set(connectionId, connection);

    // 监听消息
    ws.on('message', (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        console.error('❌ 解析WebSocket消息失败:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // 监听连接关闭
    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    // 监听错误
    ws.on('error', (error: Error) => {
      console.error(`❌ WebSocket连接错误 (${connectionId}):`, error);
      this.handleDisconnection(connectionId);
    });

    // 发送欢迎消息
    this.sendMessage(ws, {
      type: 'connection_established',
      data: { connectionId }
    });
  }

  private handleMessage(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = Date.now();

    switch (message.type) {
      case 'join_document':
        this.handleJoinDocument(connectionId, message);
        break;
      
      case 'leave_document':
        this.handleLeaveDocument(connectionId);
        break;
      
      case 'annotation_created':
      case 'annotation_updated':
      case 'annotation_deleted':
        this.handleAnnotationChange(connectionId, message);
        break;
      
      case 'cursor_move':
        this.handleCursorMove(connectionId, message);
        break;
      
      case 'user_typing':
        this.handleUserTyping(connectionId, message);
        break;
      
      default:
        console.warn(`⚠️ 未知消息类型: ${message.type}`);
    }
  }

  private handleJoinDocument(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || !message.documentId || !message.userId) return;

    // 离开之前的文档
    if (connection.documentId) {
      this.handleLeaveDocument(connectionId);
    }

    // 加入新文档
    connection.userId = message.userId;
    connection.documentId = message.documentId;

    if (!this.documentUsers.has(message.documentId)) {
      this.documentUsers.set(message.documentId, new Set());
    }

    this.documentUsers.get(message.documentId)!.add(connectionId);

    console.log(`📄 用户 ${message.userId} 加入文档 ${message.documentId}`);

    // 通知其他用户
    this.broadcastToDocument(message.documentId, {
      type: 'user_joined',
      userId: message.userId,
      data: { connectionId }
    }, connectionId);

    // 发送当前文档的用户列表
    const documentUsers = Array.from(this.documentUsers.get(message.documentId)!)
      .map(id => this.connections.get(id))
      .filter(conn => conn && conn.userId)
      .map(conn => ({
        connectionId: conn === connection ? connectionId : 'other',
        userId: conn!.userId
      }));

    this.sendMessage(connection.ws, {
      type: 'document_users',
      data: { users: documentUsers }
    });
  }

  private handleLeaveDocument(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.documentId) return;

    const documentId = connection.documentId;
    const documentUsers = this.documentUsers.get(documentId);

    if (documentUsers) {
      documentUsers.delete(connectionId);
      
      // 通知其他用户
      this.broadcastToDocument(documentId, {
        type: 'user_left',
        userId: connection.userId,
        data: { connectionId }
      }, connectionId);

      // 如果文档没有用户了，清理
      if (documentUsers.size === 0) {
        this.documentUsers.delete(documentId);
      }
    }

    connection.documentId = null;
    console.log(`📄 用户 ${connection.userId} 离开文档 ${documentId}`);
  }

  private handleAnnotationChange(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.documentId) return;

    console.log(`📝 标注变更: ${message.type} by ${connection.userId}`);

    // 广播到同一文档的其他用户
    this.broadcastToDocument(connection.documentId, {
      type: message.type,
      userId: connection.userId,
      data: message.data,
      timestamp: Date.now()
    }, connectionId);
  }

  private handleCursorMove(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.documentId) return;

    // 广播光标位置（频率限制）
    this.broadcastToDocument(connection.documentId, {
      type: 'cursor_move',
      userId: connection.userId,
      data: message.data
    }, connectionId);
  }

  private handleUserTyping(connectionId: string, message: WSMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.documentId) return;

    // 广播用户正在输入的状态
    this.broadcastToDocument(connection.documentId, {
      type: 'user_typing',
      userId: connection.userId,
      data: message.data
    }, connectionId);
  }

  private handleDisconnection(connectionId: string) {
    console.log(`👋 用户断开连接: ${connectionId}`);
    
    this.handleLeaveDocument(connectionId);
    this.connections.delete(connectionId);
  }

  private broadcastToDocument(documentId: string, message: any, excludeConnectionId?: string) {
    const documentUsers = this.documentUsers.get(documentId);
    if (!documentUsers) return;

    documentUsers.forEach(connectionId => {
      if (connectionId === excludeConnectionId) return;
      
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === 1) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  private sendMessage(ws: any, message: any) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('❌ 发送WebSocket消息失败:', error);
    }
  }

  private sendError(ws: any, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      data: { message: error }
    });
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // 清理inactive连接
  public cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟超时

    this.connections.forEach((connection, connectionId) => {
      if (now - connection.lastActivity > timeout) {
        console.log(`🧹 清理inactive连接: ${connectionId}`);
        connection.ws.close();
        this.handleDisconnection(connectionId);
      }
    });
  }

  // 获取统计信息
  public getStats() {
    return {
      totalConnections: this.connections.size,
      documentsWithUsers: this.documentUsers.size,
      documentUsers: Object.fromEntries(
        Array.from(this.documentUsers.entries()).map(([docId, users]) => [
          docId,
          users.size
        ])
      )
    };
  }
}

// 启动服务器（如果直接运行此文件）
if (require.main === module) {
  const server = new PDFCollaborationServer(8080);
  
  // 每分钟清理一次inactive连接
  setInterval(() => {
    server.cleanup();
  }, 60000);

  // 每10秒打印统计信息（开发模式）
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      console.log('📊 WebSocket统计:', server.getStats());
    }, 10000);
  }
}

export default PDFCollaborationServer;
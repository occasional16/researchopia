/*
  Real-time Collaboration WebSocket Server
  Handles real-time annotation synchronization and conflict resolution
*/

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';

interface Client {
  userId: string;
  documentId: string;
  permissions: UserPermissions;
  lastSeen: number;
  heartbeatInterval: NodeJS.Timeout | null;
}

interface Room {
  clients: Set<WebSocket>;
  annotations: Map<string, any>;
  locks: Map<string, Lock>;
  lastActivity: number;
}

interface UserPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isOwner: boolean;
}

interface Lock {
  annotationId: string;
  userId: string;
  lockType: string;
  acquiredAt: number;
  expiresAt: number;
}

interface CollabMessage {
  type: string;
  data?: any;
  userId?: string;
  timestamp?: number;
}

export class AnnotationCollaborationServer {
  private port: number;
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Room> = new Map();
  private clients: Map<WebSocket, Client> = new Map();
  
  constructor(port: number = 8080) {
    this.port = port;
    this.setupServer();
  }

  /**
   * 设置HTTP和WebSocket服务器
   */
  private setupServer(): void {
    this.server = createServer();
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/annotations/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const { query } = parse(req.url || '', true);
      this.handleNewConnection(ws, query);
    });

    this.server.on('request', (req: IncomingMessage, res: ServerResponse) => {
      this.handleHttpRequest(req, res);
    });
  }

  /**
   * 处理新的WebSocket连接
   */
  private async handleNewConnection(ws: WebSocket, query: any): Promise<void> {
    const { documentId, userId, token } = query;
    
    if (!documentId || !userId) {
      ws.close(1002, 'Missing documentId or userId');
      return;
    }

    try {
      // 验证用户权限
      const permissions = await this.validateUser(token, userId, documentId);
      if (!permissions.canRead) {
        ws.close(1011, 'Insufficient permissions');
        return;
      }

      // 注册客户端
      this.clients.set(ws, {
        userId,
        documentId,
        permissions,
        lastSeen: Date.now(),
        heartbeatInterval: null
      });

      // 加入房间
      await this.joinRoom(ws, documentId);

      // 设置心跳检测
      this.setupHeartbeat(ws);

      // 设置消息处理
      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        this.handleDisconnection(ws);
      });

      this.log(`User ${userId} connected to document ${documentId}`);

    } catch (error) {
      console.error('Connection setup failed:', error);
      ws.close(1011, 'Connection setup failed');
    }
  }

  /**
   * 验证用户权限
   */
  private async validateUser(token: string, userId: string, documentId: string): Promise<UserPermissions> {
    // 这里应该验证JWT token并查询数据库
    // 目前返回默认权限用于测试
    return {
      canRead: true,
      canWrite: true,
      canDelete: userId === 'admin',
      isOwner: false
    };
  }

  /**
   * 用户加入文档房间
   */
  private async joinRoom(ws: WebSocket, documentId: string): Promise<void> {
    if (!this.rooms.has(documentId)) {
      this.rooms.set(documentId, {
        clients: new Set(),
        annotations: new Map(),
        locks: new Map(),
        lastActivity: Date.now()
      });
    }

    const room = this.rooms.get(documentId)!;
    const client = this.clients.get(ws)!;

    // 添加到房间
    room.clients.add(ws);

    // 发送当前房间状态
    await this.sendRoomState(ws, documentId);

    // 通知其他用户有新用户加入
    this.broadcastToRoom(documentId, {
      type: 'user_joined',
      userId: client.userId,
      timestamp: Date.now()
    }, ws);
  }

  /**
   * 发送房间当前状态给新用户
   */
  private async sendRoomState(ws: WebSocket, documentId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (!room) return;

    // 发送所有标注
    const annotations = Array.from(room.annotations.values());
    this.sendMessage(ws, {
      type: 'room_state',
      data: {
        annotations,
        activeUsers: this.getActiveUsers(documentId),
        locks: Array.from(room.locks.entries())
      },
      timestamp: Date.now()
    });
  }

  /**
   * 处理WebSocket消息
   */
  private async handleMessage(ws: WebSocket, data: Buffer): Promise<void> {
    try {
      const message: CollabMessage = JSON.parse(data.toString());
      const client = this.clients.get(ws);
      
      if (!client) return;

      client.lastSeen = Date.now();

      switch (message.type) {
        case 'annotation_create':
          await this.handleAnnotationCreate(ws, message);
          break;
        case 'annotation_update':
          await this.handleAnnotationUpdate(ws, message);
          break;
        case 'annotation_delete':
          await this.handleAnnotationDelete(ws, message);
          break;
        case 'lock_acquire':
          await this.handleLockAcquire(ws, message);
          break;
        case 'lock_release':
          await this.handleLockRelease(ws, message);
          break;
        case 'cursor_move':
          await this.handleCursorMove(ws, message);
          break;
        case 'heartbeat':
          this.sendMessage(ws, { type: 'heartbeat_ack', timestamp: Date.now() });
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'Message processing failed' },
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理标注创建
   */
  private async handleAnnotationCreate(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    const room = this.rooms.get(client.documentId)!;
    
    if (!client.permissions.canWrite) {
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'No write permission' },
        timestamp: Date.now()
      });
      return;
    }

    const annotation = {
      ...message.data,
      id: message.data?.id || this.generateId(),
      createdBy: client.userId,
      createdAt: Date.now(),
      version: 1
    };

    // 存储标注
    room.annotations.set(annotation.id, annotation);

    // 广播给其他用户
    this.broadcastToRoom(client.documentId, {
      type: 'annotation_created',
      data: annotation,
      userId: client.userId,
      timestamp: Date.now()
    }, ws);

    // 确认创建
    this.sendMessage(ws, {
      type: 'annotation_create_ack',
      data: { id: annotation.id, version: annotation.version },
      timestamp: Date.now()
    });

    this.log(`Annotation ${annotation.id} created by ${client.userId}`);
  }

  /**
   * 处理标注更新
   */
  private async handleAnnotationUpdate(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    const room = this.rooms.get(client.documentId)!;
    const { id, changes, expectedVersion } = message.data || {};

    const existing = room.annotations.get(id);
    if (!existing) {
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'Annotation not found' },
        timestamp: Date.now()
      });
      return;
    }

    // 检查权限
    if (!client.permissions.canWrite && existing.createdBy !== client.userId) {
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'No permission to edit this annotation' },
        timestamp: Date.now()
      });
      return;
    }

    // 版本冲突检查
    if (expectedVersion && existing.version !== expectedVersion) {
      this.sendMessage(ws, {
        type: 'conflict',
        data: {
          id,
          currentVersion: existing.version,
          expectedVersion,
          currentAnnotation: existing
        },
        timestamp: Date.now()
      });
      return;
    }

    // 应用更改
    const updated = {
      ...existing,
      ...changes,
      id, // 保持ID不变
      modifiedBy: client.userId,
      modifiedAt: Date.now(),
      version: existing.version + 1
    };

    room.annotations.set(id, updated);

    // 广播更新
    this.broadcastToRoom(client.documentId, {
      type: 'annotation_updated',
      data: { id, changes, version: updated.version },
      userId: client.userId,
      timestamp: Date.now()
    }, ws);

    // 确认更新
    this.sendMessage(ws, {
      type: 'annotation_update_ack',
      data: { id, version: updated.version },
      timestamp: Date.now()
    });

    this.log(`Annotation ${id} updated by ${client.userId} to version ${updated.version}`);
  }

  /**
   * 处理标注删除
   */
  private async handleAnnotationDelete(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    const room = this.rooms.get(client.documentId)!;
    const { id } = message.data || {};

    const existing = room.annotations.get(id);
    if (!existing) {
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'Annotation not found' },
        timestamp: Date.now()
      });
      return;
    }

    // 检查删除权限
    if (!client.permissions.canDelete && existing.createdBy !== client.userId) {
      this.sendMessage(ws, {
        type: 'error',
        data: { error: 'No permission to delete this annotation' },
        timestamp: Date.now()
      });
      return;
    }

    // 删除标注
    room.annotations.delete(id);

    // 广播删除
    this.broadcastToRoom(client.documentId, {
      type: 'annotation_deleted',
      data: { id },
      userId: client.userId,
      timestamp: Date.now()
    }, ws);

    // 确认删除
    this.sendMessage(ws, {
      type: 'annotation_delete_ack',
      data: { id },
      timestamp: Date.now()
    });

    this.log(`Annotation ${id} deleted by ${client.userId}`);
  }

  /**
   * 处理锁获取
   */
  private async handleLockAcquire(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    const room = this.rooms.get(client.documentId)!;
    const { annotationId, lockType = 'edit' } = message.data || {};

    const existingLock = room.locks.get(annotationId);
    if (existingLock && existingLock.userId !== client.userId) {
      this.sendMessage(ws, {
        type: 'lock_denied',
        data: {
          annotationId,
          currentHolder: existingLock.userId,
          lockType: existingLock.lockType
        },
        timestamp: Date.now()
      });
      return;
    }

    // 获取锁
    const lock: Lock = {
      annotationId,
      userId: client.userId,
      lockType,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 30000 // 30秒超时
    };

    room.locks.set(annotationId, lock);

    // 广播锁状态
    this.broadcastToRoom(client.documentId, {
      type: 'lock_acquired',
      data: lock,
      timestamp: Date.now()
    });

    // 设置自动释放
    setTimeout(() => {
      const currentLock = room.locks.get(annotationId);
      if (currentLock && currentLock.userId === client.userId) {
        this.releaseLock(client.documentId, annotationId);
      }
    }, 30000);

    this.log(`Lock acquired on annotation ${annotationId} by ${client.userId}`);
  }

  /**
   * 处理锁释放
   */
  private async handleLockRelease(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    const { annotationId } = message.data || {};
    
    this.releaseLock(client.documentId, annotationId, client.userId);
  }

  /**
   * 处理光标移动
   */
  private async handleCursorMove(ws: WebSocket, message: CollabMessage): Promise<void> {
    const client = this.clients.get(ws)!;
    
    this.broadcastToRoom(client.documentId, {
      type: 'cursor_moved',
      data: {
        userId: client.userId,
        position: message.data?.position,
        selection: message.data?.selection
      },
      timestamp: Date.now()
    }, ws);
  }

  /**
   * 释放锁
   */
  private releaseLock(documentId: string, annotationId: string, userId?: string): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const lock = room.locks.get(annotationId);
    if (!lock) return;

    // 检查权限（只有锁的拥有者可以释放）
    if (userId && lock.userId !== userId) return;

    room.locks.delete(annotationId);

    this.broadcastToRoom(documentId, {
      type: 'lock_released',
      data: { annotationId, userId: lock.userId },
      timestamp: Date.now()
    });

    this.log(`Lock released on annotation ${annotationId}`);
  }

  /**
   * 向房间内所有客户端广播消息
   */
  private broadcastToRoom(documentId: string, message: CollabMessage, excludeWs?: WebSocket): void {
    const room = this.rooms.get(documentId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    room.clients.forEach(ws => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error('Broadcast error:', error);
          this.handleDisconnection(ws);
        }
      }
    });
  }

  /**
   * 向单个客户端发送消息
   */
  private sendMessage(ws: WebSocket, message: CollabMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Send message error:', error);
        this.handleDisconnection(ws);
      }
    }
  }

  /**
   * 获取房间内活跃用户
   */
  private getActiveUsers(documentId: string): any[] {
    const room = this.rooms.get(documentId);
    if (!room) return [];

    const users: any[] = [];
    const now = Date.now();
    
    room.clients.forEach(ws => {
      const client = this.clients.get(ws);
      if (client && now - client.lastSeen < 60000) { // 1分钟内活跃
        users.push({
          userId: client.userId,
          lastSeen: client.lastSeen,
          permissions: client.permissions
        });
      }
    });

    return users;
  }

  /**
   * 处理客户端断开连接
   */
  private handleDisconnection(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const { userId, documentId } = client;

    // 清理心跳定时器
    if (client.heartbeatInterval) {
      clearInterval(client.heartbeatInterval);
    }

    // 从房间移除
    const room = this.rooms.get(documentId);
    if (room) {
      room.clients.delete(ws);
      
      // 释放用户持有的所有锁
      room.locks.forEach((lock, annotationId) => {
        if (lock.userId === userId) {
          this.releaseLock(documentId, annotationId);
        }
      });
      
      // 通知其他用户
      this.broadcastToRoom(documentId, {
        type: 'user_left',
        userId,
        timestamp: Date.now()
      });

      // 清理空房间
      if (room.clients.size === 0) {
        setTimeout(() => {
          const currentRoom = this.rooms.get(documentId);
          if (currentRoom && currentRoom.clients.size === 0) {
            this.rooms.delete(documentId);
            this.log(`Room ${documentId} cleaned up`);
          }
        }, 60000); // 1分钟后清理空房间
      }
    }

    // 移除客户端记录
    this.clients.delete(ws);
    
    this.log(`User ${userId} disconnected from document ${documentId}`);
  }

  /**
   * 设置心跳检测
   */
  private setupHeartbeat(ws: WebSocket): void {
    const client = this.clients.get(ws)!;
    
    client.heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, { type: 'heartbeat', timestamp: Date.now() });
      } else {
        if (client.heartbeatInterval) {
          clearInterval(client.heartbeatInterval);
        }
      }
    }, 30000); // 每30秒发送心跳
  }

  /**
   * 处理HTTP请求
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const { pathname } = parse(req.url || '');
    
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        rooms: this.rooms.size,
        clients: this.clients.size,
        timestamp: Date.now()
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * 启动服务器
   */
  public start(): void {
    if (this.server) {
      this.server.listen(this.port, () => {
        this.log(`Annotation collaboration server started on port ${this.port}`);
      });
    }
  }

  /**
   * 停止服务器
   */
  public stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
    this.log('Annotation collaboration server stopped');
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    console.log(`[CollabServer] ${new Date().toISOString()} - ${message}`);
  }
}
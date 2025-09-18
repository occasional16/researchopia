/*
  Real-time Collaboration WebSocket Client
  Handles client-side WebSocket connection and real-time synchronization
*/

import { UniversalAnnotation, WebSocketMessage } from '@/types/annotation-protocol';

export interface CollaborationConfig {
  serverUrl: string;
  documentId: string;
  userId: string;
  token?: string;
  retryAttempts?: number;
  reconnectDelay?: number;
}

export interface CollaborationCallbacks {
  onAnnotationCreated?: (annotation: UniversalAnnotation, userId: string) => void;
  onAnnotationUpdated?: (id: string, changes: any, version: number, userId: string) => void;
  onAnnotationDeleted?: (id: string, userId: string) => void;
  onUserJoined?: (userId: string) => void;
  onUserLeft?: (userId: string) => void;
  onCursorMoved?: (userId: string, position: any, selection?: any) => void;
  onLockAcquired?: (annotationId: string, userId: string, lockType: string) => void;
  onLockReleased?: (annotationId: string, userId: string) => void;
  onConflict?: (id: string, currentVersion: number, expectedVersion: number, currentAnnotation: any) => void;
  onError?: (error: string, context?: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: (attempt: number) => void;
}

export class AnnotationCollaborationClient {
  private ws: WebSocket | null = null;
  private config: CollaborationConfig;
  private callbacks: CollaborationCallbacks;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private currentRetryAttempt = 0;
  private isConnected = false;
  private isReconnecting = false;
  private messageQueue: any[] = [];

  constructor(config: CollaborationConfig, callbacks: CollaborationCallbacks = {}) {
    this.config = {
      retryAttempts: 5,
      reconnectDelay: 2000,
      ...config
    };
    this.callbacks = callbacks;
  }

  /**
   * 连接到协作服务器
   */
  async connect(): Promise<boolean> {
    try {
      if (this.ws && this.isConnected) {
        return true;
      }

      this.cleanup();

      const wsUrl = this.buildWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        this.ws.onopen = () => {
          this.isConnected = true;
          this.isReconnecting = false;
          this.currentRetryAttempt = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          this.callbacks.onConnected?.();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnection(event);
          if (!this.isReconnecting) {
            resolve(false);
          }
        };

        this.ws.onerror = (error) => {
          this.callbacks.onError?.('WebSocket connection error', error);
          if (!this.isReconnecting) {
            reject(error);
          }
        };

        // 连接超时
        setTimeout(() => {
          if (!this.isConnected && this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });

    } catch (error) {
      this.callbacks.onError?.('Failed to connect to collaboration server', error);
      return false;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.cleanup();
    this.callbacks.onDisconnected?.();
  }

  /**
   * 创建标注
   */
  async createAnnotation(annotation: Partial<UniversalAnnotation>): Promise<boolean> {
    return this.sendMessage({
      type: 'annotation_create',
      data: annotation,
      timestamp: Date.now()
    });
  }

  /**
   * 更新标注
   */
  async updateAnnotation(id: string, changes: any, expectedVersion?: number): Promise<boolean> {
    return this.sendMessage({
      type: 'annotation_update',
      data: {
        id,
        changes,
        expectedVersion
      },
      timestamp: Date.now()
    });
  }

  /**
   * 删除标注
   */
  async deleteAnnotation(id: string): Promise<boolean> {
    return this.sendMessage({
      type: 'annotation_delete',
      data: { id },
      timestamp: Date.now()
    });
  }

  /**
   * 获取锁
   */
  async acquireLock(annotationId: string, lockType: string = 'edit'): Promise<boolean> {
    return this.sendMessage({
      type: 'lock_acquire',
      data: { annotationId, lockType },
      timestamp: Date.now()
    });
  }

  /**
   * 释放锁
   */
  async releaseLock(annotationId: string): Promise<boolean> {
    return this.sendMessage({
      type: 'lock_release',
      data: { annotationId },
      timestamp: Date.now()
    });
  }

  /**
   * 发送光标位置
   */
  async sendCursorPosition(position: any, selection?: any): Promise<boolean> {
    return this.sendMessage({
      type: 'cursor_move',
      data: { position, selection },
      timestamp: Date.now()
    }, false); // 光标消息不需要排队
  }

  /**
   * 获取连接状态
   */
  isConnectedState(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 构建WebSocket URL
   */
  private buildWebSocketUrl(): string {
    const url = new URL(this.config.serverUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/annotations/ws';
    
    url.searchParams.set('documentId', this.config.documentId);
    url.searchParams.set('userId', this.config.userId);
    
    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    return url.toString();
  }

  /**
   * 发送消息
   */
  private sendMessage(message: any, queueIfDisconnected: boolean = true): boolean {
    if (!this.isConnectedState()) {
      if (queueIfDisconnected) {
        this.messageQueue.push(message);
      }
      return false;
    }

    try {
      this.ws?.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.callbacks.onError?.('Failed to send message', error);
      return false;
    }
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'room_state':
          this.handleRoomState(message.data);
          break;
        case 'annotation_created':
          this.callbacks.onAnnotationCreated?.(message.data, message.userId);
          break;
        case 'annotation_updated':
          this.callbacks.onAnnotationUpdated?.(
            message.data.id,
            message.data.changes,
            message.data.version,
            message.userId
          );
          break;
        case 'annotation_deleted':
          this.callbacks.onAnnotationDeleted?.(message.data.id, message.userId);
          break;
        case 'user_joined':
          this.callbacks.onUserJoined?.(message.userId);
          break;
        case 'user_left':
          this.callbacks.onUserLeft?.(message.userId);
          break;
        case 'cursor_moved':
          this.callbacks.onCursorMoved?.(
            message.data.userId,
            message.data.position,
            message.data.selection
          );
          break;
        case 'lock_acquired':
          this.callbacks.onLockAcquired?.(
            message.data.annotationId,
            message.data.userId,
            message.data.lockType
          );
          break;
        case 'lock_released':
          this.callbacks.onLockReleased?.(message.data.annotationId, message.data.userId);
          break;
        case 'lock_denied':
          this.callbacks.onError?.(
            `Lock denied for annotation ${message.data.annotationId}`,
            message.data
          );
          break;
        case 'conflict':
          this.callbacks.onConflict?.(
            message.data.id,
            message.data.currentVersion,
            message.data.expectedVersion,
            message.data.currentAnnotation
          );
          break;
        case 'error':
          this.callbacks.onError?.(message.data.error, message.data);
          break;
        case 'heartbeat':
          this.sendMessage({ type: 'heartbeat', timestamp: Date.now() }, false);
          break;
        case 'heartbeat_ack':
          // 心跳确认，保持连接活跃
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.callbacks.onError?.('Failed to parse message', error);
    }
  }

  /**
   * 处理房间状态
   */
  private handleRoomState(data: any): void {
    // 初始化房间状态，加载现有标注和用户
    if (data.annotations) {
      data.annotations.forEach((annotation: UniversalAnnotation) => {
        this.callbacks.onAnnotationCreated?.(annotation, annotation.metadata.author.id);
      });
    }

    if (data.activeUsers) {
      data.activeUsers.forEach((user: any) => {
        if (user.userId !== this.config.userId) {
          this.callbacks.onUserJoined?.(user.userId);
        }
      });
    }

    if (data.locks) {
      data.locks.forEach(([annotationId, lock]: [string, any]) => {
        if (lock.userId !== this.config.userId) {
          this.callbacks.onLockAcquired?.(annotationId, lock.userId, lock.lockType);
        }
      });
    }
  }

  /**
   * 处理连接断开
   */
  private handleDisconnection(event: CloseEvent): void {
    this.isConnected = false;
    this.stopHeartbeat();
    this.callbacks.onDisconnected?.();

    // 自动重连
    if (!this.isReconnecting && this.currentRetryAttempt < (this.config.retryAttempts || 5)) {
      this.scheduleReconnect();
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.isReconnecting = true;
    this.currentRetryAttempt++;
    
    const delay = Math.min(
      (this.config.reconnectDelay || 2000) * Math.pow(2, this.currentRetryAttempt - 1),
      30000 // 最大30秒
    );

    this.callbacks.onReconnecting?.(this.currentRetryAttempt);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        if (this.currentRetryAttempt >= (this.config.retryAttempts || 5)) {
          this.callbacks.onError?.('Max reconnection attempts reached', error);
          this.isReconnecting = false;
        } else {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnectedState()) {
        this.sendMessage({ type: 'heartbeat', timestamp: Date.now() }, false);
      }
    }, 30000);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.isConnected = false;
    this.isReconnecting = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 清空消息队列
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message, false);
    }
  }
}
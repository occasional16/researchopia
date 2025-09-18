'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  userId?: string;
  data?: any;
  timestamp?: number;
}

interface CollaborationUser {
  connectionId: string;
  userId: string;
  cursor?: {
    page: number;
    x: number;
    y: number;
  };
  isTyping?: boolean;
}

interface UseWebSocketCollaborationOptions {
  documentId: string;
  userId: string;
  onAnnotationCreated?: (annotation: any) => void;
  onAnnotationUpdated?: (annotation: any) => void;
  onAnnotationDeleted?: (annotationId: string) => void;
  onUserJoined?: (user: CollaborationUser) => void;
  onUserLeft?: (userId: string) => void;
  onCursorMove?: (userId: string, cursor: { page: number; x: number; y: number }) => void;
  onUserTyping?: (userId: string, isTyping: boolean) => void;
  enabled?: boolean;
}

export function useWebSocketCollaboration(options: UseWebSocketCollaborationOptions) {
  const {
    documentId,
    userId,
    onAnnotationCreated,
    onAnnotationUpdated,
    onAnnotationDeleted,
    onUserJoined,
    onUserLeft,
    onCursorMove,
    onUserTyping,
    enabled = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [collaborationUsers, setCollaborationUsers] = useState<CollaborationUser[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 连接WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = process.env.NODE_ENV === 'development' 
        ? 'ws://localhost:8080'
        : 'wss://your-production-websocket-server.com';

      console.log('🔌 连接WebSocket服务器:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket连接成功');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);

        // 加入文档
        ws.send(JSON.stringify({
          type: 'join_document',
          documentId,
          userId,
          timestamp: Date.now()
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('❌ 解析WebSocket消息失败:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket连接关闭:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // 自动重连
        if (enabled && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`🔄 ${delay}ms后尝试重连...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.warn('⚠️  WebSocket连接错误 (演示模式，无实际服务器):', error.type || 'Connection failed');
        setConnectionError('演示模式：WebSocket服务器未运行');
      };

    } catch (error) {
      console.error('❌ WebSocket连接失败:', error);
      setConnectionError('无法建立连接');
    }
  }, [documentId, userId, enabled, reconnectAttempts]);

  // 处理接收到的消息
  const handleMessage = useCallback((message: WSMessage) => {
    switch (message.type) {
      case 'connection_established':
        console.log('🎉 WebSocket连接已建立');
        break;

      case 'document_users':
        setCollaborationUsers(message.data?.users || []);
        break;

      case 'user_joined':
        if (message.userId && message.userId !== userId) {
          const user: CollaborationUser = {
            connectionId: message.data?.connectionId || '',
            userId: message.userId
          };
          setCollaborationUsers(prev => [...prev, user]);
          onUserJoined?.(user);
        }
        break;

      case 'user_left':
        if (message.userId && message.userId !== userId) {
          setCollaborationUsers(prev => 
            prev.filter(user => user.userId !== message.userId)
          );
          onUserLeft?.(message.userId);
        }
        break;

      case 'annotation_created':
        if (message.userId !== userId) {
          onAnnotationCreated?.(message.data);
        }
        break;

      case 'annotation_updated':
        if (message.userId !== userId) {
          onAnnotationUpdated?.(message.data);
        }
        break;

      case 'annotation_deleted':
        if (message.userId !== userId) {
          onAnnotationDeleted?.(message.data?.id);
        }
        break;

      case 'cursor_move':
        if (message.userId && message.userId !== userId && message.data) {
          onCursorMove?.(message.userId, message.data);
          
          // 更新用户光标位置
          setCollaborationUsers(prev =>
            prev.map(user =>
              user.userId === message.userId
                ? { ...user, cursor: message.data }
                : user
            )
          );
        }
        break;

      case 'user_typing':
        if (message.userId && message.userId !== userId) {
          onUserTyping?.(message.userId, message.data?.isTyping || false);
          
          // 更新用户输入状态
          setCollaborationUsers(prev =>
            prev.map(user =>
              user.userId === message.userId
                ? { ...user, isTyping: message.data?.isTyping }
                : user
            )
          );
        }
        break;

      case 'error':
        console.error('❌ 服务器错误:', message.data?.message);
        setConnectionError(message.data?.message || '服务器错误');
        break;

      default:
        console.warn('⚠️ 未知消息类型:', message.type);
    }
  }, [userId, onAnnotationCreated, onAnnotationUpdated, onAnnotationDeleted, onUserJoined, onUserLeft, onCursorMove, onUserTyping]);

  // 发送消息
  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket未连接，消息发送失败');
    }
  }, []);

  // 通知标注创建
  const notifyAnnotationCreated = useCallback((annotation: any) => {
    sendMessage({
      type: 'annotation_created',
      data: annotation,
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // 通知标注更新
  const notifyAnnotationUpdated = useCallback((annotation: any) => {
    sendMessage({
      type: 'annotation_updated',
      data: annotation,
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // 通知标注删除
  const notifyAnnotationDeleted = useCallback((annotationId: string) => {
    sendMessage({
      type: 'annotation_deleted',
      data: { id: annotationId },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // 发送光标位置
  const sendCursorPosition = useCallback((page: number, x: number, y: number) => {
    sendMessage({
      type: 'cursor_move',
      data: { page, x, y },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // 发送用户输入状态
  const sendTypingStatus = useCallback((isTyping: boolean, location?: string) => {
    sendMessage({
      type: 'user_typing',
      data: { isTyping, location },
      timestamp: Date.now()
    });
  }, [sendMessage]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setCollaborationUsers([]);
  }, []);

  // 组件挂载时连接
  useEffect(() => {
    if (enabled && documentId && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, documentId, userId, connect, disconnect]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    // 状态
    isConnected,
    connectionError,
    collaborationUsers,
    
    // 方法
    notifyAnnotationCreated,
    notifyAnnotationUpdated,
    notifyAnnotationDeleted,
    sendCursorPosition,
    sendTypingStatus,
    disconnect,
    
    // 连接控制
    reconnect: connect
  };
}
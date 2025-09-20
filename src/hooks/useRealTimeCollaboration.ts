import { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalAnnotation, WebSocketMessage } from '@/types/annotation-protocol';

interface CollaborationUser {
  id: string;
  name: string;
  avatar?: string;
  position?: {
    page: number;
    x: number;
    y: number;
  };
  lastSeen: Date;
}

interface CollaborationState {
  isConnected: boolean;
  users: CollaborationUser[];
  annotations: UniversalAnnotation[];
  cursorPositions: Map<string, { x: number; y: number; page: number }>;
  isTyping: Map<string, boolean>;
}

interface UseRealTimeCollaborationOptions {
  documentId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  onAnnotationReceived?: (annotation: UniversalAnnotation) => void;
  onAnnotationUpdated?: (annotation: UniversalAnnotation) => void;
  onAnnotationDeleted?: (annotationId: string) => void;
  onUserJoined?: (user: CollaborationUser) => void;
  onUserLeft?: (userId: string) => void;
  onCursorMoved?: (userId: string, position: { x: number; y: number; page: number }) => void;
}

export const useRealTimeCollaboration = (options: UseRealTimeCollaborationOptions) => {
  const {
    documentId,
    userId,
    userName,
    userAvatar,
    onAnnotationReceived,
    onAnnotationUpdated,
    onAnnotationDeleted,
    onUserJoined,
    onUserLeft,
    onCursorMoved
  } = options;

  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    users: [],
    annotations: [],
    cursorPositions: new Map(),
    isTyping: new Map()
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // 连接WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
      const ws = new WebSocket(`${wsUrl}/collaboration?documentId=${documentId}&userId=${userId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));
        
        // 发送用户加入消息
        ws.send(JSON.stringify({
          type: 'user:joined',
          payload: {
            userId,
            userName,
            userAvatar,
            documentId
          }
        }));

        // 启动心跳
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
        stopHeartbeat();
        
        // 尝试重连
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [documentId, userId, userName, userAvatar]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
  }, []);

  // 处理WebSocket消息
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'annotation:created':
        setState(prev => ({
          ...prev,
          annotations: [...prev.annotations, message.payload.annotation]
        }));
        onAnnotationReceived?.(message.payload.annotation);
        break;

      case 'annotation:updated':
        setState(prev => ({
          ...prev,
          annotations: prev.annotations.map(ann =>
            ann.id === message.payload.annotation.id ? message.payload.annotation : ann
          )
        }));
        onAnnotationUpdated?.(message.payload.annotation);
        break;

      case 'annotation:deleted':
        setState(prev => ({
          ...prev,
          annotations: prev.annotations.filter(ann => ann.id !== message.payload.id)
        }));
        onAnnotationDeleted?.(message.payload.id);
        break;

      case 'user:connected':
        setState(prev => ({
          ...prev,
          users: [...prev.users.filter(u => u.id !== message.payload.user.id), {
            id: message.payload.user.id,
            name: message.payload.user.name,
            avatar: message.payload.user.avatar,
            lastSeen: new Date()
          }]
        }));
        onUserJoined?.(message.payload.user);
        break;

      case 'user:disconnected':
        setState(prev => ({
          ...prev,
          users: prev.users.filter(u => u.id !== message.payload.user.id),
          cursorPositions: new Map([...prev.cursorPositions].filter(([id]) => id !== message.payload.user.id)),
          isTyping: new Map([...prev.isTyping].filter(([id]) => id !== message.payload.user.id))
        }));
        onUserLeft?.(message.payload.user.id);
        break;

      case 'cursor:moved':
        setState(prev => ({
          ...prev,
          cursorPositions: new Map(prev.cursorPositions).set(
            message.payload.user.id,
            message.payload.position
          )
        }));
        onCursorMoved?.(message.payload.user.id, message.payload.position);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }, [onAnnotationReceived, onAnnotationUpdated, onAnnotationDeleted, onUserJoined, onUserLeft, onCursorMoved]);

  // 发送标注
  const sendAnnotation = useCallback((annotation: UniversalAnnotation) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'annotation:created',
        payload: {
          annotation,
          documentId
        }
      }));
    }
  }, [documentId]);

  // 更新标注
  const updateAnnotation = useCallback((annotation: UniversalAnnotation) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'annotation:updated',
        payload: {
          annotation,
          documentId
        }
      }));
    }
  }, [documentId]);

  // 删除标注
  const deleteAnnotation = useCallback((annotationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'annotation:deleted',
        payload: {
          id: annotationId,
          documentId
        }
      }));
    }
  }, [documentId]);

  // 发送光标位置
  const sendCursorPosition = useCallback((position: { x: number; y: number; page: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // 节流处理，避免发送过于频繁
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
      
      cursorThrottleRef.current = setTimeout(() => {
        wsRef.current?.send(JSON.stringify({
          type: 'cursor:moved',
          payload: {
            user: { id: userId, name: userName },
            position,
            documentId
          }
        }));
      }, 100);
    }
  }, [userId, userName, documentId]);

  // 发送打字状态
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'user:typing',
        payload: {
          userId,
          isTyping,
          documentId
        }
      }));
    }
  }, [userId, documentId]);

  // 启动心跳
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          payload: { timestamp: Date.now() }
        }));
      }
    }, 30000); // 30秒心跳
  }, []);

  // 停止心跳
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // 获取在线用户
  const getOnlineUsers = useCallback(() => {
    return state.users.filter(user => 
      Date.now() - user.lastSeen.getTime() < 30000 // 30秒内活跃
    );
  }, [state.users]);

  // 获取用户光标位置
  const getUserCursorPosition = useCallback((userId: string) => {
    return state.cursorPositions.get(userId);
  }, [state.cursorPositions]);

  // 检查用户是否在打字
  const isUserTyping = useCallback((userId: string) => {
    return state.isTyping.get(userId) || false;
  }, [state.isTyping]);

  // 清理函数
  const cleanup = useCallback(() => {
    disconnect();
    
    if (cursorThrottleRef.current) {
      clearTimeout(cursorThrottleRef.current);
    }
  }, [disconnect]);

  // 组件挂载时连接
  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    // 状态
    isConnected: state.isConnected,
    users: state.users,
    annotations: state.annotations,
    onlineUsers: getOnlineUsers(),
    
    // 方法
    sendAnnotation,
    updateAnnotation,
    deleteAnnotation,
    sendCursorPosition,
    sendTypingStatus,
    getUserCursorPosition,
    isUserTyping,
    
    // 连接管理
    connect,
    disconnect,
    reconnect: connect
  };
};

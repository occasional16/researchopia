/*
  React Hook for Real-time Annotation Collaboration
  Provides easy-to-use React integration for collaborative annotation features
*/

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  AnnotationCollaborationClient, 
  CollaborationConfig, 
  CollaborationCallbacks 
} from '@/lib/collaboration-client';
import { UniversalAnnotation } from '@/types/annotation-protocol';

export interface UseCollaborationOptions {
  serverUrl?: string;
  documentId: string;
  userId: string;
  token?: string;
  autoConnect?: boolean;
  enableCursorTracking?: boolean;
  enableLocking?: boolean;
}

export interface CollaborationState {
  isConnected: boolean;
  isReconnecting: boolean;
  activeUsers: string[];
  locks: Record<string, { userId: string; lockType: string }>;
  cursors: Record<string, { position: any; selection?: any }>;
  connectionError?: string;
  reconnectAttempt?: number;
}

export interface UseCollaborationReturn {
  // 状态
  state: CollaborationState;
  
  // 连接控制
  connect: () => Promise<boolean>;
  disconnect: () => void;
  
  // 标注操作
  createAnnotation: (annotation: Partial<UniversalAnnotation>) => Promise<boolean>;
  updateAnnotation: (id: string, changes: any, expectedVersion?: number) => Promise<boolean>;
  deleteAnnotation: (id: string) => Promise<boolean>;
  
  // 锁操作
  acquireLock: (annotationId: string, lockType?: string) => Promise<boolean>;
  releaseLock: (annotationId: string) => Promise<boolean>;
  
  // 光标跟踪
  sendCursorPosition: (position: any, selection?: any) => Promise<boolean>;
  
  // 事件回调注册
  onAnnotationCreated: (callback: (annotation: UniversalAnnotation, userId: string) => void) => void;
  onAnnotationUpdated: (callback: (id: string, changes: any, version: number, userId: string) => void) => void;
  onAnnotationDeleted: (callback: (id: string, userId: string) => void) => void;
  onConflict: (callback: (id: string, currentVersion: number, expectedVersion: number, currentAnnotation: any) => void) => void;
}

export const useCollaboration = (options: UseCollaborationOptions): UseCollaborationReturn => {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isReconnecting: false,
    activeUsers: [],
    locks: {},
    cursors: {}
  });

  const clientRef = useRef<AnnotationCollaborationClient | null>(null);
  const callbacksRef = useRef<{
    onAnnotationCreated?: (annotation: UniversalAnnotation, userId: string) => void;
    onAnnotationUpdated?: (id: string, changes: any, version: number, userId: string) => void;
    onAnnotationDeleted?: (id: string, userId: string) => void;
    onConflict?: (id: string, currentVersion: number, expectedVersion: number, currentAnnotation: any) => void;
  }>({});

  // 更新状态的辅助函数
  const updateState = useCallback((updates: Partial<CollaborationState> | ((prev: CollaborationState) => CollaborationState)) => {
    if (typeof updates === 'function') {
      setState(updates);
    } else {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // 创建协作客户端
  const createClient = useCallback(() => {
    const config: CollaborationConfig = {
      serverUrl: options.serverUrl || 'ws://localhost:8080',
      documentId: options.documentId,
      userId: options.userId,
      token: options.token
    };

    const callbacks: CollaborationCallbacks = {
      onConnected: () => {
        updateState({ 
          isConnected: true, 
          isReconnecting: false, 
          connectionError: undefined,
          reconnectAttempt: undefined
        });
      },

      onDisconnected: () => {
        updateState({ 
          isConnected: false,
          activeUsers: [],
          locks: {},
          cursors: {}
        });
      },

      onReconnecting: (attempt: number) => {
        updateState({ 
          isReconnecting: true, 
          reconnectAttempt: attempt 
        });
      },

      onError: (error: string, context?: any) => {
        console.error('[Collaboration]', error, context);
        updateState({ connectionError: error });
      },

      onUserJoined: (userId: string) => {
        updateState(prev => ({
          ...prev,
          activeUsers: [...prev.activeUsers.filter(u => u !== userId), userId]
        }));
      },

      onUserLeft: (userId: string) => {
        updateState(prev => ({
          ...prev,
          activeUsers: prev.activeUsers.filter(u => u !== userId),
          cursors: Object.fromEntries(
            Object.entries(prev.cursors).filter(([uid]) => uid !== userId)
          )
        }));
      },

      onCursorMoved: options.enableCursorTracking ? (userId: string, position: any, selection?: any) => {
        if (userId !== options.userId) {
          updateState(prev => ({
            ...prev,
            cursors: {
              ...prev.cursors,
              [userId]: { position, selection }
            }
          }));
        }
      } : undefined,

      onLockAcquired: options.enableLocking ? (annotationId: string, userId: string, lockType: string) => {
        updateState(prev => ({
          ...prev,
          locks: {
            ...prev.locks,
            [annotationId]: { userId, lockType }
          }
        }));
      } : undefined,

      onLockReleased: options.enableLocking ? (annotationId: string) => {
        updateState(prev => ({
          ...prev,
          locks: Object.fromEntries(
            Object.entries(prev.locks).filter(([id]) => id !== annotationId)
          )
        }));
      } : undefined,

      onAnnotationCreated: (annotation: UniversalAnnotation, userId: string) => {
        callbacksRef.current.onAnnotationCreated?.(annotation, userId);
      },

      onAnnotationUpdated: (id: string, changes: any, version: number, userId: string) => {
        callbacksRef.current.onAnnotationUpdated?.(id, changes, version, userId);
      },

      onAnnotationDeleted: (id: string, userId: string) => {
        callbacksRef.current.onAnnotationDeleted?.(id, userId);
      },

      onConflict: (id: string, currentVersion: number, expectedVersion: number, currentAnnotation: any) => {
        callbacksRef.current.onConflict?.(id, currentVersion, expectedVersion, currentAnnotation);
      }
    };

    return new AnnotationCollaborationClient(config, callbacks);
  }, [options, updateState]);

  // 连接函数
  const connect = useCallback(async (): Promise<boolean> => {
    try {
      if (!clientRef.current) {
        clientRef.current = createClient();
      }

      const success = await clientRef.current.connect();
      if (!success) {
        updateState({ connectionError: 'Failed to connect to collaboration server' });
      }
      return success;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      updateState({ connectionError: errorMsg });
      return false;
    }
  }, [createClient, updateState]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
  }, []);

  // 标注操作
  const createAnnotation = useCallback(async (annotation: Partial<UniversalAnnotation>): Promise<boolean> => {
    if (!clientRef.current) return false;
    return clientRef.current.createAnnotation(annotation);
  }, []);

  const updateAnnotation = useCallback(async (id: string, changes: any, expectedVersion?: number): Promise<boolean> => {
    if (!clientRef.current) return false;
    return clientRef.current.updateAnnotation(id, changes, expectedVersion);
  }, []);

  const deleteAnnotation = useCallback(async (id: string): Promise<boolean> => {
    if (!clientRef.current) return false;
    return clientRef.current.deleteAnnotation(id);
  }, []);

  // 锁操作
  const acquireLock = useCallback(async (annotationId: string, lockType: string = 'edit'): Promise<boolean> => {
    if (!clientRef.current || !options.enableLocking) return false;
    return clientRef.current.acquireLock(annotationId, lockType);
  }, [options.enableLocking]);

  const releaseLock = useCallback(async (annotationId: string): Promise<boolean> => {
    if (!clientRef.current || !options.enableLocking) return false;
    return clientRef.current.releaseLock(annotationId);
  }, [options.enableLocking]);

  // 光标跟踪
  const sendCursorPosition = useCallback(async (position: any, selection?: any): Promise<boolean> => {
    if (!clientRef.current || !options.enableCursorTracking) return false;
    return clientRef.current.sendCursorPosition(position, selection);
  }, [options.enableCursorTracking]);

  // 事件回调注册
  const onAnnotationCreated = useCallback((callback: (annotation: UniversalAnnotation, userId: string) => void) => {
    callbacksRef.current.onAnnotationCreated = callback;
  }, []);

  const onAnnotationUpdated = useCallback((callback: (id: string, changes: any, version: number, userId: string) => void) => {
    callbacksRef.current.onAnnotationUpdated = callback;
  }, []);

  const onAnnotationDeleted = useCallback((callback: (id: string, userId: string) => void) => {
    callbacksRef.current.onAnnotationDeleted = callback;
  }, []);

  const onConflict = useCallback((callback: (id: string, currentVersion: number, expectedVersion: number, currentAnnotation: any) => void) => {
    callbacksRef.current.onConflict = callback;
  }, []);

  // 自动连接和清理
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.documentId, options.userId, options.autoConnect, connect, disconnect]);

  return {
    state,
    connect,
    disconnect,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    acquireLock,
    releaseLock,
    sendCursorPosition,
    onAnnotationCreated,
    onAnnotationUpdated,
    onAnnotationDeleted,
    onConflict
  };
};

// 辅助组件：显示协作状态
export const CollaborationStatus: React.FC<{ state: CollaborationState }> = ({ state }) => {
  if (!state.isConnected && !state.isReconnecting) {
    return (
      <div className="flex items-center space-x-2 text-red-600">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <span className="text-sm">离线</span>
        {state.connectionError && (
          <span className="text-xs opacity-70">({state.connectionError})</span>
        )}
      </div>
    );
  }

  if (state.isReconnecting) {
    return (
      <div className="flex items-center space-x-2 text-yellow-600">
        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
        <span className="text-sm">
          重连中{state.reconnectAttempt ? ` (${state.reconnectAttempt})` : ''}...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-green-600">
      <div className="w-2 h-2 rounded-full bg-green-500"></div>
      <span className="text-sm">在线</span>
      {state.activeUsers.length > 0 && (
        <span className="text-xs opacity-70">
          {state.activeUsers.length} 位协作者
        </span>
      )}
    </div>
  );
};

// 辅助组件：显示活跃用户
export const ActiveUsers: React.FC<{ users: string[]; currentUserId: string }> = ({ users, currentUserId }) => {
  const otherUsers = users.filter(u => u !== currentUserId);
  
  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center space-x-1">
      <span className="text-xs text-gray-500">协作者:</span>
      <div className="flex space-x-1">
        {otherUsers.slice(0, 3).map(userId => (
          <div
            key={userId}
            className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-medium"
            title={userId}
          >
            {userId.charAt(0).toUpperCase()}
          </div>
        ))}
        {otherUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs text-white">
            +{otherUsers.length - 3}
          </div>
        )}
      </div>
    </div>
  );
};
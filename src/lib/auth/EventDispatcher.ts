/**
 * EventDispatcher - 认证事件分发器
 * 用于广播登录、登出、会话变更等事件
 */

export type AuthEventType = 
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'SESSION_REFRESHED'
  | 'SESSION_EXPIRED'
  | 'TOKEN_UPDATED'
  | 'USER_UPDATED';

export interface AuthEvent {
  type: AuthEventType;
  timestamp: number;
  data?: any;
}

export type AuthEventListener = (event: AuthEvent) => void;

export class EventDispatcher {
  private static listeners: Map<AuthEventType, Set<AuthEventListener>> = new Map();

  /**
   * 订阅事件
   */
  static on(eventType: AuthEventType, listener: AuthEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    // 返回取消订阅函数
    return () => this.off(eventType, listener);
  }

  /**
   * 取消订阅
   */
  static off(eventType: AuthEventType, listener: AuthEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 发送事件
   */
  static emit(eventType: AuthEventType, data?: any): void {
    const event: AuthEvent = {
      type: eventType,
      timestamp: Date.now(),
      data,
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in auth event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * 清空所有监听器
   */
  static clear(): void {
    this.listeners.clear();
  }

  /**
   * 获取某个事件的监听器数量
   */
  static getListenerCount(eventType: AuthEventType): number {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.size : 0;
  }
}

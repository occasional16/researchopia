/**
 * 会话日志管理器
 * 负责记录会话事件和聊天消息
 */

import { APIClient } from '../utils/apiClient';
import { logger } from '../utils/logger';
import { AuthManager } from "./auth";
import { config } from "../config/env";

const API_BASE_URL = config.apiBaseUrl;

// 辅助函数
function getToken(): string | null {
  const session = AuthManager.getSession();
  return session?.access_token || null;
}

function getCurrentUser(): any {
  return AuthManager.getCurrentUser();
}

/**
 * 带超时的fetch包装函数(不使用AbortController,兼容Zotero环境)
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms: ${url}`));
    }, timeoutMs);

    fetch(url, options)
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * 事件日志接口
 */
export interface SessionLog {
  id: string;
  session_id: string;
  event_type: 'member_join' | 'member_leave' | 'annotation_create' | 'annotation_update' | 'annotation_delete' | 'annotation_comment';
  actor_id: string;
  actor_name?: string;
  target_id?: string;
  metadata?: any;
  created_at: string;
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  message: string;
  message_type: 'text' | 'emoji' | 'system';
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export class SessionLogManager {
  private static instance: SessionLogManager;
  private apiClient = APIClient.getInstance();
  private logger = logger;

  private constructor() {}

  public static getInstance(): SessionLogManager {
    if (!SessionLogManager.instance) {
      SessionLogManager.instance = new SessionLogManager();
    }
    return SessionLogManager.instance;
  }

  /**
   * 获取会话事件日志
   */
  public async getSessionLogs(sessionId: string, page = 1, limit = 50): Promise<SessionLog[]> {
    try {
      const token = getToken();
      if (!token) {
        logger.warn('[SessionLogManager] No auth token available');
        return []; // 改为返回空数组而不是抛出异常
      }

      const url = `${API_BASE_URL}/api/reading-session/logs?session_id=${sessionId}&page=${page}&limit=${limit}`;
      logger.log('[SessionLogManager] Fetching logs from:', url);

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }, 3000); // 3秒超时

      logger.log('[SessionLogManager] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[SessionLogManager] API error:', errorText);
        return []; // 改为返回空数组而不是抛出异常
      }

      const result = await response.json() as { data?: SessionLog[] };
      logger.log('[SessionLogManager] API result:', result);
      return result.data || [];
    } catch (error) {
      logger.error('[SessionLogManager] Error getting logs:', error);
      return []; // 改为返回空数组
    }
  }

  /**
   * 记录事件日志(异步,不阻塞主流程)
   */
  public logEvent(
    sessionId: string,
    eventType: SessionLog['event_type'],
    targetId?: string,
    metadata?: any
  ): void {
    // 异步执行,不等待结果,不阻塞主流程
    this.logEventAsync(sessionId, eventType, targetId, metadata).catch(error => {
      // 静默失败,仅记录错误
      logger.warn('[SessionLogManager] Failed to log event:', error instanceof Error ? error.message : String(error));
    });
  }

  /**
   * 记录事件日志的实际实现
   */
  private async logEventAsync(
    sessionId: string,
    eventType: SessionLog['event_type'],
    targetId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const token = getToken();
      const user = getCurrentUser();
      
      if (!token || !user) {
        // 未登录时不记录日志
        return;
      }

      const requestBody = {
        session_id: sessionId,
        event_type: eventType,
        actor_id: user.id,
        actor_name: user.user_metadata?.username || user.email,
        target_id: targetId,
        metadata,
      };

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/reading-session/logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }, 3000); // 3秒超时

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[SessionLogManager] Failed to log event - API error:', errorText);
      } else {
        logger.log('[SessionLogManager] ✅ Event logged successfully');
      }

      // 不抛出错误,日志失败不影响主流程
    } catch (error) {
      logger.warn('[SessionLogManager] Failed to log event:', error);
      logger.error('[SessionLogManager] Error details:', error instanceof Error ? error.message : String(error));
      logger.error('[SessionLogManager] Error stack:', error instanceof Error ? error.stack : 'No stack');
    }
  }

  /**
   * 获取聊天消息
   */
  public async getChatMessages(
    sessionId: string,
    options: {
      page?: number;
      limit?: number;
      lastMessageId?: string | null;
    } = {}
  ): Promise<any[]> {
    const { page, limit, lastMessageId } = options;
    this.logger.log(
      `[SessionLogManager] Fetching chat for ${sessionId} with options: ${JSON.stringify(
        options
      )}`
    );
    const params = new URLSearchParams({
      session_id: sessionId,
    });

    // 如果有lastMessageId，我们只关心增量，不关心分页
    if (lastMessageId) {
      params.append('last_message_id', lastMessageId);
    } else {
      // 否则，我们进行分页加载
      if (page) {
        params.append('page', String(page));
      }
      if (limit) {
        params.append('limit', String(limit));
      }
    }

    try {
      const response = await this.apiClient.get<{ data: any[] }>(
        '/api/reading-session/chat',
        params
      );
      this.logger.log(
        `[SessionLogManager] 🔍 getChatMessages API response: ${JSON.stringify(
          response
        )}`
      );
      return response.data || [];
    } catch (error) {
      this.logger.error('[SessionLogManager] Error fetching chat messages:', error);
      return [];
    }
  }

  /**
   * 获取新消息(用于轮询)
   */
  public async getNewMessages(sessionId: string, since: string): Promise<ChatMessage[]> {
    try {
      const token = getToken();
      if (!token) {
        return [];
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/reading-session/chat?session_id=${sessionId}&since=${since}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
        10000 // 10秒超时
      );

      if (!response.ok) {
        return [];
      }

      const result = await response.json() as { data?: ChatMessage[] };
      return result.data || [];
    } catch (error) {
      logger.warn('[SessionLogManager] Error getting new messages:', error);
      return [];
    }
  }

  /**
   * 发送聊天消息
   */
  public async sendChatMessage(
    sessionId: string,
    message: string,
    messageType: 'text' | 'emoji' = 'text',
    metadata?: any
  ): Promise<ChatMessage> {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/reading-session/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message,
          message_type: messageType,
          metadata,
        }),
      }, 10000); // 10秒超时

      if (!response.ok) {
        const error = await response.json() as unknown as { message?: string };
        throw new Error(error.message || '发送消息失败');
      }

      const result = await response.json() as unknown as { data: ChatMessage };
      return result.data;
    } catch (error) {
      logger.error('[SessionLogManager] Error sending message:', error);
      throw error;
    }
  }

  /**
   * 删除消息
   */
  public async deleteChatMessage(messageId: string): Promise<void> {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/reading-session/chat?message_id=${messageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        10000 // 10秒超时
      );

      if (!response.ok) {
        throw new Error('删除消息失败');
      }
    } catch (error) {
      logger.error('[SessionLogManager] Error deleting message:', error);
      throw error;
    }
  }

  /**
   * 获取未读消息数量
   */
  public async getUnreadCount(sessionId: string): Promise<number> {
    try {
      // 从Zotero prefs获取该会话的最后阅读时间
      const lastReadKey = `extensions.researchopia.session.${sessionId}.lastReadTime`;
      const lastReadTime = (Zotero.Prefs as any).get(lastReadKey) || new Date(0).toISOString();

      const messages = await this.getNewMessages(sessionId, lastReadTime);
      
      // 过滤掉当前用户自己发的消息
      const currentUser = getCurrentUser();
      const unreadMessages = messages.filter(msg => msg.user_id !== currentUser?.id);
      
      return unreadMessages.length;
    } catch (error) {
      logger.warn('[SessionLogManager] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * 标记消息为已读
   */
  public markAsRead(sessionId: string): void {
    try {
      const lastReadKey = `extensions.researchopia.session.${sessionId}.lastReadTime`;
      (Zotero.Prefs as any).set(lastReadKey, new Date().toISOString());
    } catch (error) {
      logger.warn('[SessionLogManager] Error marking as read:', error);
    }
  }

  /**
   * 导出会议纪要
   */
  public async exportMinutes(
    sessionId: string,
    format: 'markdown' | 'html' = 'markdown',
    startDate?: string,
    endDate?: string
  ): Promise<string> {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('未登录');
      }

      let url = `${API_BASE_URL}/api/reading-session/export?session_id=${sessionId}&format=${format}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }, 15000); // 导出可能需要更长时间,15秒超时

      if (!response.ok) {
        throw new Error('导出失败');
      }

      return await response.text();
    } catch (error) {
      logger.error('[SessionLogManager] Error exporting minutes:', error);
      throw error;
    }
  }
}

/**
 * 文献共读会话管理器
 * 负责创建、加入、管理文献共读会话，实现实时标注同步
 */

import { logger } from "../utils/logger";
import { AuthManager } from "./auth";
import { SessionLogManager } from "./sessionLogManager";
import { apiGet, apiPost, apiDelete } from "../utils/apiClient";

// 从配置文件导入Supabase配置
import { config } from "../config/env";

const SUPABASE_URL = config.supabaseUrl;
const SUPABASE_ANON_KEY = config.supabaseAnonKey;

// 辅助函数：获取token
function getToken(): string | null {
  const session = AuthManager.getSession();
  return session?.access_token || null;
}

// 辅助函数：获取当前用户
function getCurrentUser(): any {
  return AuthManager.getCurrentUser();
}

/**
 * 共读会话数据结构
 */
export interface ReadingSession {
  id: string;
  paper_doi: string;
  paper_title: string;
  session_type: 'public' | 'private';
  invite_code: string;
  creator_id: string;
  max_participants: number;
  is_active: boolean;
  settings: Record<string, any>;
  created_at: string;
  ended_at?: string;
}

/**
 * 会话成员数据结构
 */
export interface SessionMember {
  id: string;
  session_id: string;
  user_id: string;
  role: 'host' | 'participant';
  joined_at: string;
  last_seen: string;
  current_page: number;
  is_online: boolean;
  user_email?: string;
  user_name?: string;
  avatar_url?: string;
}

/**
 * 会话标注数据结构
 */
export interface SessionAnnotation {
  id: string;
  session_id: string;
  user_id: string;
  paper_doi: string;
  annotation_data: any;
  page_number: number;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  avatar_url?: string;
}

/**
 * 实时标注事件
 */
export interface RealtimeAnnotationEvent {
  type: 'annotation_created' | 'annotation_updated' | 'annotation_deleted';
  annotation: SessionAnnotation;
  user_id: string;
}

/**
 * 实时在线状态事件
 */
export interface RealtimePresenceEvent {
  type: 'user_joined' | 'user_left' | 'user_page_changed';
  user_id: string;
  user_email?: string;
  user_name?: string;
  current_page?: number;
  member?: SessionMember;
}

/**
 * 文献共读会话管理器
 */
export class ReadingSessionManager {
  private static instance: ReadingSessionManager | null = null;
  private currentSession: ReadingSession | null = null;
  private currentMember: SessionMember | null = null;
  private zoteroNotifierID: string | null = null;
  
  private realtimeConnection: any = null;
  private heartbeatInterval: any = null;
  private pollingInterval: any = null;
  
  private annotationListeners: ((event: RealtimeAnnotationEvent) => void)[] = [];
  private presenceListeners: ((event: RealtimePresenceEvent) => void)[] = [];
  private memberListeners: ((members: SessionMember[]) => void)[] = [];
  
  private logManager = SessionLogManager.getInstance();
  
  private membersCache: Map<string, SessionMember[]> = new Map();
  private membersCacheExpiry: Map<string, number> = new Map();
  
  private lastAnnotationCheck: Date = new Date();
  private lastMembersCheck: Date = new Date();
  private lastMemberSnapshot: string = ''; // 用于检测成员列表变化

  private constructor() {
    logger.log("[ReadingSessionManager] 📚 Initializing...");
    // 启动时不自动恢复会话 - 用户需要手动重新加入
    // this.loadSavedSession();
  }

  public static getInstance(): ReadingSessionManager {
    if (!ReadingSessionManager.instance) {
      ReadingSessionManager.instance = new ReadingSessionManager();
    }
    return ReadingSessionManager.instance;
  }

  /**
   * 保存当前会话到首选项
   */
  private saveSession(): void {
    try {
      if (this.currentSession) {
        Zotero.Prefs.set('extensions.zotero.researchopia.currentSession', JSON.stringify(this.currentSession), true);
        logger.log("[ReadingSessionManager] 💾 会话已保存");
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] 保存会话失败:", error);
    }
  }

  /**
   * 从首选项加载保存的会话
   */
  private async loadSavedSession(): Promise<void> {
    try {
      const savedSessionStr = Zotero.Prefs.get('extensions.zotero.researchopia.currentSession', true) as string;
      if (savedSessionStr) {
        const savedSession: ReadingSession = JSON.parse(savedSessionStr);
        
        // 检查会话是否仍然有效
        if (savedSession.is_active) {
          // 验证会话是否仍存在于数据库中
          const token = getToken();
          if (token) {
            try {
              const sessionResult = await this.apiRequest(
                `reading_sessions?id=eq.${savedSession.id}&is_active=eq.true`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                }
              );

              if (sessionResult && sessionResult.length > 0) {
                this.currentSession = sessionResult[0];
                // 重新加入会话
                await this.rejoinSession();
                logger.log("[ReadingSessionManager] ✅ 会话已恢复:", sessionResult[0].id);
              } else {
                // 会话已不存在或已结束
                this.clearSavedSession();
                logger.log("[ReadingSessionManager] ⚠️ 保存的会话已失效");
              }
            } catch (error) {
              logger.error("[ReadingSessionManager] 恢复会话失败:", error);
              this.clearSavedSession();
            }
          }
        } else {
          this.clearSavedSession();
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] 加载保存的会话失败:", error);
    }
  }

  /**
   * 清除保存的会话
   */
  private clearSavedSession(): void {
    try {
      Zotero.Prefs.clear('extensions.zotero.researchopia.currentSession', true);
      this.currentSession = null;
      logger.log("[ReadingSessionManager] 🧹 已清除保存的会话");
    } catch (error) {
      logger.error("[ReadingSessionManager] 清除会话失败:", error);
    }
  }

  /**
   * 重新加入已保存的会话
   */
  private async rejoinSession(): Promise<void> {
    if (!this.currentSession) return;

    const token = getToken();
    const user = getCurrentUser();
    const userId = user?.id;

    if (!token || !userId) {
      this.clearSavedSession();
      return;
    }

    try {
      // 查询成员信息
      const memberResult = await this.apiRequest(
        `session_members?session_id=eq.${this.currentSession.id}&user_id=eq.${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (memberResult && memberResult.length > 0) {
        this.currentMember = memberResult[0];
        // 更新在线状态
        await this.updateOnlineStatus(true);
        // 启动心跳
        this.startHeartbeat();
        // 启动轮询
        this.startPolling();
        logger.log("[ReadingSessionManager] ✅ 已重新连接到会话");
      } else {
        // 不再是成员，清除会话
        this.clearSavedSession();
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] 重新加入会话失败:", error);
      this.clearSavedSession();
    }
  }

  /**
   * 创建共读会话
   */
  public async createSession(
    paperDOI: string,
    paperTitle: string,
    sessionType: 'public' | 'private' = 'private',
    maxParticipants: number = 10
  ): Promise<{ session: ReadingSession; inviteCode: string }> {
    logger.log(`[ReadingSessionManager] 创建会话: ${paperTitle}`);
    
    try {
      const response = await apiPost('/api/proxy/reading-session/create', {
        paper_doi: paperDOI,
        paper_title: paperTitle,
        max_participants: maxParticipants,
        is_public: sessionType === 'public',
        description: null,
      });

      if (!response.success) {
        throw new Error(response.error || '创建会话失败');
      }

      const newSession: ReadingSession = response.data.session;
      const member: SessionMember = response.data.member;
      const inviteCode = newSession.invite_code || '';

      // 设置当前会话和成员(创建后自动进入)
      this.currentSession = newSession;
      this.currentMember = member;

      logger.log(`[ReadingSessionManager] ✅ 会话创建成功: ${newSession.id}`);
      
      return { session: newSession, inviteCode };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ReadingSessionManager] 创建会话失败: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * 通过邀请码加入会话
   */
  public async joinSessionByInviteCode(inviteCode: string): Promise<ReadingSession> {
    logger.log(`[ReadingSessionManager] 通过邀请码加入会话: ${inviteCode}`);
    
    try {
      const response = await apiPost('/api/proxy/reading-session/join', {
        invite_code: inviteCode,
      });

      if (!response.success) {
        throw new Error(response.error || '加入会话失败');
      }

      const foundSession: ReadingSession = response.data.session;
      const member: SessionMember = response.data.member;

      // 设置当前会话和成员
      this.currentSession = foundSession;
      this.currentMember = member;

      logger.log(`[ReadingSessionManager] ✅ 成功加入会话: ${foundSession.id}`);
      
      return foundSession;
    } catch (error) {
      logger.error('[ReadingSessionManager] 加入会话失败:', error);
      throw error;
    }
  }

  /**
   * 加入会话（内部方法）
   */
  private async joinSession(sessionId: string, role: 'host' | 'participant'): Promise<void> {
    const token = getToken();
    const user = getCurrentUser();
    const userId = user?.id;

    if (!token || !userId) {
      throw new Error('未登录');
    }

    // 检查是否已经是成员
    const existingMember = await this.apiRequest(
      `session_members?session_id=eq.${sessionId}&user_id=eq.${userId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (existingMember && existingMember.length > 0) {
      // 已经是成员，更新在线状态
      this.currentMember = existingMember[0];
      await this.updateOnlineStatus(true);
      
      // 获取会话信息
      const sessionResult = await this.apiRequest(
        `reading_sessions?id=eq.${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      this.currentSession = sessionResult[0];
    } else {
      // 创建成员记录
      const memberData = {
        session_id: sessionId,
        user_id: userId,
        role: role,
        is_online: true,
        current_page: 1,
      };

      const memberResult = await this.apiRequest('session_members', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(memberData),
      });

      this.currentMember = Array.isArray(memberResult) ? memberResult[0] : memberResult;

      // 获取会话信息
      const sessionResult = await this.apiRequest(
        `reading_sessions?id=eq.${sessionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      this.currentSession = sessionResult[0];
    }

    // 保存会话到首选项
    this.saveSession();

    // 订阅实时事件
    await this.subscribeToRealtimeEvents();

    // 立即更新一次在线状态(确保用户进入会话时立即显示为在线)
    await this.updateOnlineStatus(true);

    // 启动心跳
    this.startHeartbeat();

    // 注册Zotero标注监听器
    this.registerZoteroAnnotationListener();

    // 同步PDF中已存在的标注
    await this.syncExistingAnnotations();

    // 触发用户加入事件
    this.notifyPresenceListeners({
      type: 'user_joined',
      user_id: userId,
      user_email: user?.email,
      member: this.currentMember || undefined,
    });

    // 记录member_join事件日志
    try {
      await this.logManager.logEvent(sessionId, 'member_join', undefined, {
        role: role,
        user_id: userId,
      });
    } catch (logError) {
      logger.error('[ReadingSessionManager] 记录member_join事件失败:', logError);
      // 不影响主流程,继续执行
    }
  }

  /**
   * 离开当前会话
   */
  public async leaveSession(): Promise<void> {
    if (!this.currentSession || !this.currentMember) {
      logger.warn('[ReadingSessionManager] 没有活跃的会话');
      return;
    }

    logger.log(`[ReadingSessionManager] 离开会话: ${this.currentSession.id}`);

    try {
      const user = getCurrentUser();
      const sessionIdToLog = this.currentSession.id; // 保存sessionId用于日志
      
      // 停止心跳和轮询
      this.stopHeartbeat();
      this.unregisterZoteroAnnotationListener(); // 注销标注监听器
      await this.unsubscribeFromRealtimeEvents();
      
      // 先更新离线状态,触发其他客户端的presence事件
      await this.updateOnlineStatus(false);
      
      // 再删除该用户的所有标注
      if (user) {
        logger.log(`[ReadingSessionManager] 🗑️ 删除用户 ${user.id} 的所有标注...`);
        await this.deleteAllUserAnnotations(user.id);
      }

      // 通知本地监听器
      this.notifyPresenceListeners({
        type: 'user_left',
        user_id: user?.id || '',
        user_email: user?.email,
      });

      // 记录member_leave事件日志
      try {
        await this.logManager.logEvent(sessionIdToLog, 'member_leave', undefined, {
          user_id: user?.id,
        });
      } catch (logError) {
        logger.error('[ReadingSessionManager] 记录member_leave事件失败:', logError);
      }

      this.currentSession = null;
      this.currentMember = null;

      // 清除保存的会话
      this.clearSavedSession();

      logger.log('[ReadingSessionManager] ✅ 已离开会话');
    } catch (error) {
      logger.error('[ReadingSessionManager] 离开会话失败:', error);
      throw error;
    }
  }

  /**
   * 处理用户登出 - 删除用户的所有标注并退出会话
   */
  public async handleUserLogout(): Promise<void> {
    if (!this.currentSession || !this.currentMember) {
      return;
    }

    logger.log("[ReadingSessionManager] 🚪 处理用户登出,清理标注和会话...");

    try {
      const token = getToken();
      const user = getCurrentUser();
      const userId = user?.id;

      if (!token || !userId) {
        return;
      }

      // 退出会话(leaveSession内部会删除标注)
      await this.leaveSession();

      logger.log("[ReadingSessionManager] ✅ 用户登出处理完成");
    } catch (error) {
      logger.error("[ReadingSessionManager] 处理用户登出失败:", error);
    }
  }

  /**
   * 删除会话(仅创建者可以删除)
   */
  public async deleteSession(sessionId: string): Promise<void> {
    logger.log(`[ReadingSessionManager] 删除会话: ${sessionId}`);

    try {
      const response = await apiDelete(`/api/proxy/reading-session/delete?session_id=${sessionId}`);

      if (!response.success) {
        throw new Error(response.error || '删除会话失败');
      }

      // 如果当前在这个会话中,清除本地状态
      if (this.currentSession?.id === sessionId) {
        this.stopHeartbeat();
        this.unregisterZoteroAnnotationListener();
        await this.unsubscribeFromRealtimeEvents();
        this.currentSession = null;
        this.currentMember = null;
        this.clearSavedSession();
      }

      logger.log('[ReadingSessionManager] ✅ 会话已删除');
    } catch (error) {
      logger.error('[ReadingSessionManager] 删除会话失败:', error);
      throw error;
    }
  }

  /**
   * 删除用户在当前会话中的所有标注
   */
  private async deleteAllUserAnnotations(userId: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const token = getToken();
    if (!token) {
      return;
    }

    try {
      logger.log(`[ReadingSessionManager] 🗑️ 删除用户 ${userId} 的所有标注...`);

      // 删除数据库中的标注记录
      await this.apiRequest(
        `session_annotations?session_id=eq.${this.currentSession.id}&user_id=eq.${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      logger.log("[ReadingSessionManager] ✅ 用户标注已删除");

      // 通知其他成员刷新标注
      this.notifyAnnotationsChanged();
    } catch (error) {
      logger.error("[ReadingSessionManager] 删除用户标注失败:", error);
      throw error;
    }
  }

  /**
   * 通知标注已变更
   */
  private notifyAnnotationsChanged(): void {
    // 触发标注更新事件,让UI重新加载
    for (const listener of this.annotationListeners) {
      // 发送一个通用的刷新信号
      try {
        listener({
          type: 'annotation_deleted',
          annotation: {} as SessionAnnotation,
          user_id: '',
        });
      } catch (error) {
        logger.error("[ReadingSessionManager] Error notifying annotation listener:", error);
      }
    }
  }

  /**
   * 获取当前用户创建的会话列表
   */
  public async getMyCreatedSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] 获取我创建的会话列表');
    
    try {
      const response = await apiGet('/api/proxy/reading-session/list?type=created');

      logger.log('[ReadingSessionManager] 🔍 API response:', {
        success: response.success,
        dataLength: (response.data || []).length,
        error: response.error
      });

      if (!response.success) {
        throw new Error(response.error || '获取创建的会话列表失败');
      }

      const sessions = (response.data || []).map((session: any) => {
        const creator = session.creator;
        return {
          ...session,
          creator_name: creator?.username || creator?.email?.split('@')[0] || '未知用户',
          creator_email: creator?.email,
          creator: undefined,
        };
      });

      // 为每个会话添加成员统计(仍需要单独查询,因为API不返回统计)
      const token = getToken();
      const sessionsWithCount = await Promise.all(
        sessions.map(async (session: any) => {
          try {
            // 查询所有成员
            const members = await this.apiRequest(
              `session_members?session_id=eq.${session.id}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );
            
            const memberList = members || [];
            const totalCount = memberList.length;
            
            // 统计在线人数(last_seen在5分钟内)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const onlineCount = memberList.filter((m: SessionMember) => m.last_seen > fiveMinutesAgo).length;
            
            return {
              ...session,
              member_count: totalCount,
              online_count: onlineCount,
            };
          } catch (error) {
            logger.error(`[ReadingSessionManager] 查询会话 ${session.id} 成员失败:`, error);
            return {
              ...session,
              member_count: 0,
              online_count: 0,
            };
          }
        })
      );
      
      logger.log('[ReadingSessionManager] 📋 My created sessions:', sessionsWithCount.map((s: any) => ({
        id: s.id,
        title: s.paper_title,
        type: s.session_type,
        active: s.is_active,
        members: s.member_count
      })));
      
      return sessionsWithCount;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ReadingSessionManager] 获取创建的会话列表失败: ${errorMsg}`);
      return [];
    }
  }

  /**
   * 获取当前用户加入的会话列表(不包括创建的)
   */
  public async getMyJoinedSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] 获取我加入的会话列表');
    
    const token = getToken();
    const user = getCurrentUser();
    const userId = user?.id;
    
    if (!token || !userId) {
      throw new Error('未登录');
    }

    try {
      // 查询用户加入过的所有会话(通过 session_members 表)
      const membersResult = await this.apiRequest(
        `session_members?user_id=eq.${userId}&select=session_id,role`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!membersResult || membersResult.length === 0) {
        return [];
      }

      // 过滤出非创建者的会话ID
      const joinedSessionIds = membersResult
        .filter((m: any) => m.role === 'participant')
        .map((m: any) => m.session_id);

      if (joinedSessionIds.length === 0) {
        return [];
      }
      
      // 查询这些会话的详细信息,只返回仍然活跃的会话,并关联创建者信息
      const sessionsResult = await this.apiRequest(
        `reading_sessions?id=in.(${joinedSessionIds.join(',')})&is_active=eq.true&select=*,users!reading_sessions_creator_id_fkey(email,username)&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      // 将嵌套的用户信息扁平化到主对象中,并添加成员统计
      const sessionsWithCount = await Promise.all(
        (sessionsResult || []).map(async (session: any) => {
          try {
            // 查询所有成员
            const members = await this.apiRequest(
              `session_members?session_id=eq.${session.id}`,
              {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              }
            );
            
            const memberList = members || [];
            const totalCount = memberList.length;
            
            // 统计在线人数(last_seen在5分钟内)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const onlineCount = memberList.filter((m: SessionMember) => m.last_seen > fiveMinutesAgo).length;
            
            return {
              ...session,
              creator_name: session.users?.username || session.users?.email?.split('@')[0] || '未知',
              creator_email: session.users?.email,
              member_count: totalCount,
              online_count: onlineCount,
              // 移除原始的 users 属性以保持返回数据一致性
              users: undefined,
            };
          } catch (error) {
            logger.error(`[ReadingSessionManager] 查询会话 ${session.id} 成员失败:`, error);
            return {
              ...session,
              creator_name: session.users?.username || session.users?.email?.split('@')[0] || '未知',
              creator_email: session.users?.email,
              member_count: 0,
              online_count: 0,
              users: undefined,
            };
          }
        })
      );

      return sessionsWithCount;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ReadingSessionManager] 获取加入的会话列表失败: ${errorMsg}`);
      return [];
    }
  }

  /**
   * 获取所有公开会话列表
   */
  public async getPublicSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] 获取公开会话列表');
    
    try {
      const response = await apiGet('/api/proxy/reading-session/list?type=public');

      logger.log('[ReadingSessionManager] 🔍 API response:', {
        success: response.success,
        dataLength: (response.data || []).length,
        error: response.error
      });

      if (!response.success) {
        throw new Error(response.error || '获取公开会话列表失败');
      }

      const sessions = (response.data || []).map((session: any) => {
        const creator = session.creator;
        return {
          ...session,
          creator_name: creator?.username || creator?.email?.split('@')[0] || '未知用户',
          creator_email: creator?.email,
          creator: undefined,
        };
      });

      logger.log('[ReadingSessionManager] 📋 Public sessions:', sessions.map((s: any) => ({
        id: s.id,
        title: s.paper_title,
        type: s.session_type,
        active: s.is_active,
        creator: s.creator_name
      })));

      return sessions;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ReadingSessionManager] 获取公开会话列表失败: ${errorMsg}`);
      return [];
    }
  }

  /**
   * 获取当前用户的会话列表(包括创建的和加入的)
   */
  public async getMySessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] 获取我的会话列表');
    
    try {
      const response = await apiGet('/api/proxy/reading-session/list?type=my');

      if (!response.success) {
        throw new Error(response.error || '获取会话列表失败');
      }

      const sessions = (response.data || []).map((session: any) => {
        const creator = session.creator;
        return {
          ...session,
          creator_name: creator?.username || creator?.email?.split('@')[0] || '未知用户',
          creator_email: creator?.email,
          creator: undefined,
        };
      });

      return sessions;
    } catch (error) {
      logger.error('[ReadingSessionManager] 获取我的会话列表失败:', error);
      return [];
    }
  }

  /**
   * 获取会话成员列表
   */
  public async getSessionMembers(
    sessionId: string,
    useCache: boolean = true
  ): Promise<SessionMember[]> {
    if (useCache) {
      const cached = this.membersCache.get(sessionId);
      const expiry = this.membersCacheExpiry.get(sessionId);
      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }
    }

    try {
      const response = await apiGet(`/api/proxy/reading-session/members?session_id=${sessionId}`);

      if (!response.success) {
        throw new Error(response.error || '获取成员列表失败');
      }

      const members: SessionMember[] = response.data || [];

      this.membersCache.set(sessionId, members);
      this.membersCacheExpiry.set(sessionId, Date.now() + 5000);

      return members;
    } catch (error) {
      logger.error('[ReadingSessionManager] 获取成员列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话成员数量
   */
  private async getSessionMembersCount(sessionId: string): Promise<number> {
    const token = getToken();
    
    if (!token) {
      return 0;
    }

    try {
      const result = await this.apiRequest(
        `session_members?session_id=eq.${sessionId}&select=count`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Prefer': 'count=exact',
          },
        }
      );

      return result?.length || 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[ReadingSessionManager] 获取成员数量失败: ${errorMsg}`);
      return 0;
    }
  }

  /**
   * 创建会话标注
   */
  public async createAnnotation(
    annotationData: any,
    pageNumber: number
  ): Promise<SessionAnnotation> {
    if (!this.currentSession || !this.currentMember) {
      throw new Error('没有活跃的会话');
    }

    logger.log(`[ReadingSessionManager] 创建标注: page ${pageNumber}`);

    const token = getToken();
    const user = getCurrentUser();
    const userId = user?.id;
    
    if (!token || !userId) {
      throw new Error('未登录');
    }

    try {
      const data = {
        session_id: this.currentSession.id,
        user_id: userId,
        paper_doi: this.currentSession.paper_doi,
        annotation_data: annotationData,
        page_number: pageNumber,
      };

      const result = await this.apiRequest('session_annotations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });

      const annotation: SessionAnnotation = Array.isArray(result) ? result[0] : result;

      annotation.user_email = user?.email;
      annotation.user_name = user?.username || user?.email;

      // 记录annotation_create事件日志
      try {
        await this.logManager.logEvent(
          this.currentSession.id,
          'annotation_create',
          annotation.id,
          {
            page: pageNumber,
            text: annotationData.text?.substring(0, 100), // 只记录前100字符
            type: annotationData.type,
            color: annotationData.color,
          }
        );
      } catch (logError) {
        logger.error('[ReadingSessionManager] 记录annotation_create事件失败:', logError);
      }

      logger.log(`[ReadingSessionManager] ✅ 标注创建成功: ${annotation.id}`);

      return annotation;
    } catch (error) {
      logger.error('[ReadingSessionManager] 创建标注失败:', error);
      throw error;
    }
  }

  /**
   * 获取会话标注列表
   */
  public async getSessionAnnotations(
    sessionId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<SessionAnnotation[]> {
    const token = getToken();
    
    if (!token) {
      throw new Error('未登录');
    }

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const result = await this.apiRequest(
        `session_annotations?session_id=eq.${sessionId}&select=*,users:user_id(email,username,avatar_url)&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Range': `${from}-${to}`,
          },
        }
      );

      const annotations: SessionAnnotation[] = (result || []).map((a: any) => ({
        ...a,
        user_email: a.users?.email,
        user_name: a.users?.username || a.users?.email,
        avatar_url: a.users?.avatar_url,
      }));

      return annotations;
    } catch (error) {
      logger.error('[ReadingSessionManager] 获取标注列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新当前页码
   */
  public async updateCurrentPage(pageNumber: number): Promise<void> {
    if (!this.currentMember) {
      return;
    }

    const token = getToken();
    
    if (!token) {
      return;
    }

    try {
      await this.apiRequest(`session_members?id=eq.${this.currentMember.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_page: pageNumber,
          last_seen: new Date().toISOString(),
        }),
      });

      this.currentMember.current_page = pageNumber;

      const user = getCurrentUser();
      this.notifyPresenceListeners({
        type: 'user_page_changed',
        user_id: user?.id || '',
        current_page: pageNumber,
      });
    } catch (error) {
      logger.error('[ReadingSessionManager] 更新页码失败:', error);
    }
  }

  /**
   * 更新在线状态
   */
  private async updateOnlineStatus(isOnline: boolean): Promise<void> {
    if (!this.currentMember) {
      return;
    }

    const token = getToken();
    
    if (!token) {
      return;
    }

    try {
      await this.apiRequest(`session_members?id=eq.${this.currentMember.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        }),
      });

      this.currentMember.is_online = isOnline;
    } catch (error) {
      logger.error('[ReadingSessionManager] 更新在线状态失败:', error);
    }
  }

  /**
   * 订阅实时事件
   */
  private async subscribeToRealtimeEvents(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    logger.log(`[ReadingSessionManager] 订阅实时事件: ${this.currentSession.id}`);

    // 启动轮询
    this.startPolling();
  }

  /**
   * 取消订阅实时事件
   */
  private async unsubscribeFromRealtimeEvents(): Promise<void> {
    logger.log('[ReadingSessionManager] 取消订阅实时事件');

    this.stopPolling();

    if (this.realtimeConnection) {
      try {
        this.realtimeConnection.close();
      } catch (error) {
        logger.error('[ReadingSessionManager] 关闭连接失败:', error);
      }
      this.realtimeConnection = null;
    }
  }

  /**
   * 启动轮询
   */
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    logger.log('[ReadingSessionManager] 启动轮询');

    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollAnnotations();
        await this.pollMembers();
      } catch (error) {
        logger.error('[ReadingSessionManager] 轮询错误:', error);
      }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.log('[ReadingSessionManager] 停止轮询');
    }
  }

  private async pollAnnotations(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const token = getToken();
      
      if (!token) {
        return;
      }

      const result = await this.apiRequest(
        `session_annotations?session_id=eq.${this.currentSession.id}&created_at=gt.${this.lastAnnotationCheck.toISOString()}&select=*,users:user_id(email,username,avatar_url)&order=created_at.asc`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (result && result.length > 0) {
        for (const a of result) {
          const annotation: SessionAnnotation = {
            ...a,
            user_email: a.users?.email,
            user_name: a.users?.username || a.users?.email,
            avatar_url: a.users?.avatar_url,
          };

          this.notifyAnnotationListeners({
            type: 'annotation_created',
            annotation,
            user_id: a.user_id,
          });
        }

        this.lastAnnotationCheck = new Date();
      }
    } catch (error) {
      // 静默失败
    }
  }

  private async pollMembers(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const members = await this.getSessionMembers(this.currentSession.id, false);
      
      // 生成成员列表的快照(用于检测变化)
      const currentSnapshot = JSON.stringify(
        members.map(m => ({
          user_id: m.user_id,
          is_online: m.is_online,
          current_page: m.current_page,
          last_seen: m.last_seen
        }))
      );
      
      // 只有当成员列表实际变化时才通知监听器(避免频繁无效渲染)
      if (currentSnapshot !== this.lastMemberSnapshot) {
        this.lastMemberSnapshot = currentSnapshot;
        this.notifyMemberListeners(members);
      }
      
      this.lastMembersCheck = new Date();
    } catch (error) {
      // 静默失败
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    logger.log('[ReadingSessionManager] 启动心跳');

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updateOnlineStatus(true);
      } catch (error) {
        logger.error('[ReadingSessionManager] 心跳错误:', error);
      }
    }, 30000);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.log('[ReadingSessionManager] 停止心跳');
    }
  }

  /**
   * 注册事件监听器
   */
  public onAnnotation(callback: (event: RealtimeAnnotationEvent) => void): void {
    this.annotationListeners.push(callback);
  }

  public onPresence(callback: (event: RealtimePresenceEvent) => void): void {
    this.presenceListeners.push(callback);
  }

  public onMembersChange(callback: (members: SessionMember[]) => void): void {
    this.memberListeners.push(callback);
  }

  /**
   * 注册Zotero标注监听器
   * 监听用户创建的标注并自动同步到会话
   */
  private registerZoteroAnnotationListener(): void {
    if (this.zoteroNotifierID) {
      // 已经注册过,先注销
      (Zotero as any).Notifier.unregisterObserver(this.zoteroNotifierID);
      this.zoteroNotifierID = null;
    }

    const notifierCallback = {
      notify: async (event: string, type: string, ids: any[], extraData: any) => {
        logger.log(`[ReadingSessionManager] 🔔 Notifier收到事件: event=${event}, type=${type}, ids=${ids}`);
        
        // ✅ 处理删除事件
        if (event === 'delete' && type === 'item' && this.currentSession) {
          logger.log(`[ReadingSessionManager] 🗑️ 处理标注删除事件, 当前会话: ${this.currentSession.id}`);
          // 从数据库中删除对应的session_annotations
          for (const id of ids) {
            try {
              // 从extraData中获取标注的key(如果有的话)
              const key = extraData?.[id]?.key;
              if (key) {
                await this.deleteAnnotationByKey(key);
                logger.log(`[ReadingSessionManager] ✅ 已删除标注: ${key}`);
              }
            } catch (error) {
              logger.error('[ReadingSessionManager] 删除标注失败:', error);
            }
          }
          return;
        }
        
        if (event === 'add' && type === 'item' && this.currentSession) {
          logger.log(`[ReadingSessionManager] 📋 处理标注添加事件, 当前会话: ${this.currentSession.id}`);
          // 检查是否是标注
          for (const id of ids) {
            try {
              const item = await (Zotero.Items as any).getAsync(id);
              logger.log(`[ReadingSessionManager] 📄 检查项目 ${id}: isAnnotation=${item?.isAnnotation()}`);
              
              if (!item || !item.isAnnotation()) continue;

              // 标注 → PDF附件 → 文献条目
              const pdfAttachment = item.parentItem;
              logger.log(`[ReadingSessionManager] 📎 标注的PDF附件:`, pdfAttachment?.key);
              if (!pdfAttachment) continue;

              // PDF附件的父项才是文献条目
              const paperItem = pdfAttachment.parentItem;
              logger.log(`[ReadingSessionManager] 📚 PDF的文献条目:`, paperItem?.key);
              if (!paperItem) continue;

              // 从文献条目获取DOI
              const doi = paperItem.getField('DOI');
              logger.log(`[ReadingSessionManager] 🔍 文献DOI: ${doi}, 会话DOI: ${this.currentSession.paper_doi}`);
              
              if (!doi || doi !== this.currentSession.paper_doi) {
                logger.log(`[ReadingSessionManager] ⏭️ DOI不匹配或为空,跳过此标注`);
                continue;
              }

              // 获取标注数据
              const annotationData = {
                key: item.key,
                type: item.annotationType,
                text: item.annotationText || '',
                comment: item.annotationComment || '',
                color: item.annotationColor || '',
                position: item.annotationPosition || null,
                tags: item.getTags().map((t: any) => t.tag),
              };

              // 获取页码
              const pageIndex = item.annotationPageLabel || '1';
              const pageNumber = parseInt(pageIndex) || 1;

              // 同步到会话
              await this.createAnnotation(annotationData, pageNumber);
              
              logger.log(`[ReadingSessionManager] ✅ 标注已自动同步到会话: ${item.key}`);
            } catch (error) {
              logger.error('[ReadingSessionManager] 标注同步失败:', error);
            }
          }
        }
      }
    };

    this.zoteroNotifierID = (Zotero as any).Notifier.registerObserver(notifierCallback, ['item']);
    logger.log('[ReadingSessionManager] ✅ Zotero标注监听器已注册');
  }

  /**
   * 注销Zotero标注监听器
   */
  private unregisterZoteroAnnotationListener(): void {
    if (this.zoteroNotifierID) {
      (Zotero as any).Notifier.unregisterObserver(this.zoteroNotifierID);
      this.zoteroNotifierID = null;
      logger.log('[ReadingSessionManager] ✅ Zotero标注监听器已注销');
    }
  }

  /**
   * 同步PDF中已存在的标注到会话
   * 在加入会话时调用,将PDF中已有的标注同步到session_annotations表
   */
  private async syncExistingAnnotations(): Promise<void> {
    if (!this.currentSession) {
      logger.warn('[ReadingSessionManager] 没有活跃会话,跳过同步已有标注');
      return;
    }

    try {
      logger.log('[ReadingSessionManager] 🔄 开始同步已有标注...');

      // 获取所有条目
      const allItems = await (Zotero.Items as any).getAll((Zotero as any).Libraries.userLibraryID);
      
      let syncCount = 0;
      let paperItem: any = null;

      // 查找匹配DOI的文献条目
      for (const item of allItems) {
        if (item.itemType === 'journalArticle' || item.itemType === 'conferencePaper') {
          try {
            const doi = item.getField('DOI');
            if (doi === this.currentSession.paper_doi) {
              paperItem = item;
              logger.log('[ReadingSessionManager] 📚 找到匹配的文献条目:', item.key);
              break;
            }
          } catch (e) {
            // 某些条目可能没有DOI字段
            continue;
          }
        }
      }

      if (!paperItem) {
        logger.log('[ReadingSessionManager] ⚠️ 未找到匹配的文献条目');
        return;
      }

      // 获取文献的PDF附件
      const attachments = paperItem.getAttachments();
      
      if (!attachments || attachments.length === 0) {
        logger.log('[ReadingSessionManager] ⚠️ 文献没有PDF附件');
        return;
      }

      // 遍历所有附件
      for (const attachmentID of attachments) {
        try {
          // ✅ 确保attachmentID是数字类型
          const numericAttachmentID = typeof attachmentID === 'number' ? attachmentID : parseInt(String(attachmentID), 10);
          
          if (isNaN(numericAttachmentID)) {
            logger.warn(`[ReadingSessionManager] ⚠️ 无效的附件ID,跳过: ${attachmentID}`);
            continue;
          }

          const attachment = await (Zotero.Items as any).getAsync(numericAttachmentID);
          
          if (!attachment) {
            logger.warn(`[ReadingSessionManager] ⚠️ 无法获取附件,跳过: ${numericAttachmentID}`);
            continue;
          }
          
          // 只处理PDF附件
          if (attachment.attachmentContentType !== 'application/pdf') {
            logger.log(`[ReadingSessionManager] ⏭️ 非PDF附件,跳过: ${attachment.key} (${attachment.attachmentContentType})`);
            continue;
          }

          // 获取该PDF的所有标注 - getAnnotations()返回的是ID数组
          const annotationIDs = attachment.getAnnotations();
          logger.log(`[ReadingSessionManager] 📎 PDF附件 ${attachment.key} (ID: ${numericAttachmentID}) 有 ${annotationIDs.length} 条标注`);
          
          if (!annotationIDs || annotationIDs.length === 0) {
            logger.log(`[ReadingSessionManager] ⏭️ 此PDF没有标注,跳过`);
            continue;
          }
          
          for (const annotationID of annotationIDs) {
            try {
              // ✅ 确保annotationID是数字类型
              let numericAnnotationID: number;
              
              if (typeof annotationID === 'number') {
                numericAnnotationID = annotationID;
              } else if (typeof annotationID === 'object' && annotationID && 'id' in annotationID) {
                // 如果是对象,尝试获取其id属性
                numericAnnotationID = parseInt(String((annotationID as any).id), 10);
                logger.log(`[ReadingSessionManager] 📝 从对象中提取ID: ${numericAnnotationID}`);
              } else {
                numericAnnotationID = parseInt(String(annotationID), 10);
              }
              
              if (isNaN(numericAnnotationID)) {
                logger.warn(`[ReadingSessionManager] ⚠️ 无效的标注ID,跳过: ${JSON.stringify(annotationID)}`);
                continue;
              }

              logger.log(`[ReadingSessionManager] 📝 处理标注ID: ${numericAnnotationID}`);
              const annotation = await (Zotero.Items as any).getAsync(numericAnnotationID);
              
              if (!annotation) {
                logger.warn(`[ReadingSessionManager] ⚠️ 无法获取标注,跳过: ${numericAnnotationID}`);
                continue;
              }
              
              if (!annotation.isAnnotation || !annotation.isAnnotation()) {
                logger.warn(`[ReadingSessionManager] ⚠️ 项目${numericAnnotationID}不是标注,跳过`);
                continue;
              }
            
            // 检查是否已存在
            const existing = await this.checkAnnotationExists(annotation.key);
            if (existing) {
              logger.log(`[ReadingSessionManager] ⏭️ 标注已存在,跳过: ${annotation.key}`);
              continue;
            }

            // 获取标注数据
            const annotationData = {
              key: annotation.key,
              type: annotation.annotationType,
              text: annotation.annotationText || '',
              comment: annotation.annotationComment || '',
              color: annotation.annotationColor || '',
              position: annotation.annotationPosition || null,
              tags: annotation.getTags().map((t: any) => t.tag),
            };

            // 获取页码
            const pageIndex = annotation.annotationPageLabel || '1';
            const pageNumber = parseInt(pageIndex) || 1;

            // 同步到会话
            await this.createAnnotation(annotationData, pageNumber);
            syncCount++;
            
            logger.log(`[ReadingSessionManager] ✅ 已同步标注 ${syncCount}: ${annotation.key} (ID: ${numericAnnotationID}, Page: ${pageNumber})`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`[ReadingSessionManager] ❌ 同步标注失败 (ID: ${annotationID}): ${errorMsg}`);
            // 继续处理下一个标注,不中断整个同步过程
          }
        }
        } catch (attachmentError) {
          const errorMsg = attachmentError instanceof Error ? attachmentError.message : String(attachmentError);
          logger.error(`[ReadingSessionManager] ❌ 处理附件失败 (ID: ${attachmentID}): ${errorMsg}`);
          // 继续处理下一个附件
        }
      }

      logger.log(`[ReadingSessionManager] ✅ 同步完成,共同步 ${syncCount} 条已有标注`);
    } catch (error) {
      logger.error('[ReadingSessionManager] 同步已有标注失败:', error);
    }
  }

  /**
   * 检查标注是否已存在于会话中
   */
  private async checkAnnotationExists(annotationKey: string): Promise<boolean> {
    if (!this.currentSession) return false;

    try {
      const token = getToken();
      if (!token) return false;

      const result = await this.apiRequest(
        `session_annotations?session_id=eq.${this.currentSession.id}&annotation_data->>key=eq.${annotationKey}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      return result && result.length > 0;
    } catch (error) {
      logger.error('[ReadingSessionManager] 检查标注是否存在失败:', error);
      return false;
    }
  }

  /**
   * 通过Zotero标注key删除会话中的标注
   */
  private async deleteAnnotationByKey(annotationKey: string): Promise<void> {
    if (!this.currentSession) {
      logger.warn('[ReadingSessionManager] 没有活跃会话,无法删除标注');
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        logger.warn('[ReadingSessionManager] 未登录,无法删除标注');
        return;
      }

      // 查找并删除匹配的标注
      const result = await this.apiRequest(
        `session_annotations?session_id=eq.${this.currentSession.id}&annotation_data->>key=eq.${annotationKey}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      logger.log(`[ReadingSessionManager] ✅ 已从数据库删除标注: ${annotationKey}`);
      
      // 记录annotation_delete事件日志
      try {
        await this.logManager.logEvent(
          this.currentSession.id,
          'annotation_delete',
          annotationKey,
          {
            key: annotationKey,
          }
        );
      } catch (logError) {
        logger.error('[ReadingSessionManager] 记录annotation_delete事件失败:', logError);
      }
      
      // 触发标注删除事件,通知界面更新
      this.notifyAnnotationListeners({
        type: 'annotation_deleted',
        annotation: { id: annotationKey } as any,
        user_id: getCurrentUser()?.id || '',
      });
    } catch (error) {
      logger.error(`[ReadingSessionManager] 删除标注失败 (key: ${annotationKey}):`, error);
      throw error;
    }
  }

  /**
   * 通知监听器
   */
  private notifyAnnotationListeners(event: RealtimeAnnotationEvent): void {
    for (const listener of this.annotationListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('[ReadingSessionManager] 标注监听器错误:', error);
      }
    }
  }

  private notifyPresenceListeners(event: RealtimePresenceEvent): void {
    for (const listener of this.presenceListeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('[ReadingSessionManager] 在线状态监听器错误:', error);
      }
    }
  }

  private notifyMemberListeners(members: SessionMember[]): void {
    for (const listener of this.memberListeners) {
      try {
        listener(members);
      } catch (error) {
        logger.error('[ReadingSessionManager] 成员监听器错误:', error);
      }
    }
  }

  /**
   * Getter方法
   */
  public getCurrentSession(): ReadingSession | null {
    return this.currentSession;
  }

  public getCurrentMember(): SessionMember | null {
    return this.currentMember;
  }

  public isInSession(): boolean {
    return this.currentSession !== null && this.currentMember !== null;
  }

  /**
   * API请求辅助方法
   */
  private async apiRequest(endpoint: string, options: any = {}): Promise<any> {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    
    const defaultHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `API请求失败 [${response.status}]: ${errorText}`;
        logger.error(`[ReadingSessionManager] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`[ReadingSessionManager] API请求异常: ${error.message}`);
        throw error;
      }
      logger.error(`[ReadingSessionManager] API请求异常:`, error);
      throw new Error('API请求失败，请检查网络连接');
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    logger.log('[ReadingSessionManager] 清理资源');
    
    if (this.isInSession()) {
      await this.leaveSession();
    }

    this.stopHeartbeat();
    this.stopPolling();
    
    this.annotationListeners = [];
    this.presenceListeners = [];
    this.memberListeners = [];
    this.membersCache.clear();
    this.membersCacheExpiry.clear();
  }
}


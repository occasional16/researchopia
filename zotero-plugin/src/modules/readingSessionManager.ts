/**
 * 文献共读会话管理器
 * 负责创建、加入、管理文献共读会话，实现实时标注同步
 */

import { AuthManager } from './auth';
import { logger } from '../utils/logger';
import { SessionLogManager } from './sessionLogManager';
import { APIClient } from '../utils/apiClient';

// 从配置文件导入Supabase配置
import { config } from '../config/env';

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
  username?: string;
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
  private static instance: ReadingSessionManager;
  private apiClient: APIClient;
  private authManager: AuthManager;
  private logManager: SessionLogManager;

  private currentSession: ReadingSession | null = null;
  private currentMember: SessionMember | null = null;

  private membersCache: Map<string, SessionMember[]> = new Map();
  private membersCacheExpiry: Map<string, number> = new Map();
  
  private lastAnnotationCheck: Date = new Date();
  private lastMembersCheck: Date = new Date();
  private lastMemberSnapshot: string = '';

  private zoteroNotifierID: any = null;
  private heartbeatInterval: any = null;
  private pollingInterval: any = null;

  private annotationListeners: ((event: RealtimeAnnotationEvent) => void)[] = [];
  private presenceListeners: ((event: RealtimePresenceEvent) => void)[] = [];
  private memberListeners: ((members: SessionMember[]) => void)[] = [];

  private constructor() {
    this.apiClient = APIClient.getInstance();
    this.authManager = AuthManager.getInstance();
    this.logManager = SessionLogManager.getInstance();
    this.initialize();
  }

  public static getInstance(): ReadingSessionManager {
    if (!ReadingSessionManager.instance) {
      ReadingSessionManager.instance = new ReadingSessionManager();
    }
    return ReadingSessionManager.instance;
  }

  private initialize(): void {
    this.loadSavedSession().catch(error => {
      logger.error('[ReadingSessionManager] Failed to initialize and load session:', error);
    });
  }

  private saveSession(): void {
    try {
      if (this.currentSession) {
        Zotero.Prefs.set('extensions.zotero.researchopia.currentSession', JSON.stringify(this.currentSession), true);
        logger.log("[ReadingSessionManager] 💾 Session saved");
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] Failed to save session:", error);
    }
  }

  private async loadSavedSession(): Promise<void> {
    try {
      const savedSessionStr = Zotero.Prefs.get('extensions.zotero.researchopia.currentSession', true) as string;
      if (savedSessionStr) {
        const savedSession: ReadingSession = JSON.parse(savedSessionStr);
        
        if (savedSession.is_active) {
          try {
            const response = await this.apiClient.get<{ data: ReadingSession[] }>(`/api/proxy/reading-session/details?session_id=${savedSession.id}`);
            const sessionResult = response.data;

            if (sessionResult && sessionResult.length > 0) {
              this.currentSession = sessionResult[0];
              await this.rejoinSession();
              logger.log("[ReadingSessionManager] ✅ Session restored:", sessionResult[0].id);
            } else {
              this.clearSavedSession();
              logger.log("[ReadingSessionManager] ⚠️ Saved session is no longer valid.");
            }
          } catch (error) {
            logger.error("[ReadingSessionManager] Failed to restore session:", error);
            this.clearSavedSession();
          }
        } else {
          this.clearSavedSession();
        }
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] Failed to load saved session:", error);
    }
  }

  private clearSavedSession(): void {
    try {
      Zotero.Prefs.clear('extensions.zotero.researchopia.currentSession', true);
      this.currentSession = null;
      this.currentMember = null;
      logger.log("[ReadingSessionManager] 🧹 Cleared saved session.");
    } catch (error) {
      logger.error("[ReadingSessionManager] Failed to clear session:", error);
    }
  }

  private async rejoinSession(): Promise<void> {
    if (!this.currentSession) return;

    const user = this.authManager.getUser();
    if (!user) {
      this.clearSavedSession();
      return;
    }

    try {
      const response = await this.apiClient.get<{ data: SessionMember[] }>(`/api/proxy/reading-session/members?session_id=${this.currentSession.id}`);
      const members = response.data || [];
      const member = members.find(m => m.user_id === user.id);

      if (member) {
        this.currentMember = member;
        await this.initializeSession();
        logger.log("[ReadingSessionManager] ✅ Reconnected to session.");
      } else {
        this.clearSavedSession();
      }
    } catch (error) {
      logger.error("[ReadingSessionManager] Failed to rejoin session:", error);
      this.clearSavedSession();
    }
  }

  public async createSession(
    paperDOI: string,
    paperTitle: string,
    sessionType: 'public' | 'private' = 'private',
    maxParticipants: number = 10
  ): Promise<{ session: ReadingSession; inviteCode: string }> {
    logger.log(`[ReadingSessionManager] Creating session: ${paperTitle}`);
    
    try {
      const response = await this.apiClient.post<{
        data: { session: ReadingSession; member: SessionMember };
      }>('/api/proxy/reading-session/create', {
        paper_doi: paperDOI,
        paper_title: paperTitle,
        max_participants: maxParticipants,
        is_public: sessionType === 'public',
        description: null,
      });

      if (!response.data || !response.data.session) {
        throw new Error("API did not return a session object.");
      }

      const newSession: ReadingSession = response.data.session;
      const member: SessionMember = response.data.member;
      const inviteCode = newSession.invite_code || '';

      this.currentSession = newSession;
      this.currentMember = member;

      await this.initializeSession();
      
      logger.log(`[ReadingSessionManager] ✅ Session created successfully: ${newSession.id}`);
      return { session: newSession, inviteCode };
    } catch (error) {
      logger.error(`[ReadingSessionManager] Failed to create session:`, error);
      throw error;
    }
  }

  public async joinSessionByInviteCode(inviteCode: string): Promise<ReadingSession> {
    logger.log(`[ReadingSessionManager] Joining session with invite code: ${inviteCode}`);
    
    try {
      const response = await this.apiClient.post<{
        data: { session: ReadingSession; member: SessionMember };
      }>('/api/proxy/reading-session/join', {
        invite_code: inviteCode,
      });

      if (!response.data || !response.data.session) {
        throw new Error("API did not return a session object on join.");
      }

      const foundSession: ReadingSession = response.data.session;
      const member: SessionMember = response.data.member;

      this.currentSession = foundSession;
      this.currentMember = member;

      await this.initializeSession();
      
      logger.log(`[ReadingSessionManager] ✅ Successfully joined session: ${foundSession.id}`);
      return foundSession;
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to join session:', error);
      throw error;
    }
  }

  private async initializeSession(): Promise<void> {
    if (!this.currentSession || !this.currentMember) {
      logger.warn('[ReadingSessionManager] Cannot initialize session, session or member is missing.');
      return;
    }
    
    this.saveSession();
    await this.updateOnlineStatus(true);
    this.startHeartbeat();
    this.startPolling();
    this.registerZoteroAnnotationListener();
    await this.syncExistingAnnotations();

    this.notifyPresenceListeners({
      type: 'user_joined',
      user_id: this.currentMember.user_id,
      user_email: this.currentMember.user_email,
      member: this.currentMember,
    });

    try {
      await this.logManager.logEvent(this.currentSession.id, 'member_join', undefined, {
        role: this.currentMember.role,
        user_id: this.currentMember.user_id,
      });
    } catch (logError) {
      logger.error('[ReadingSessionManager] Failed to log member_join event:', logError);
    }
  }

  public getCurrentSession(): ReadingSession | null {
    return this.currentSession;
  }

  public getCurrentMember(): SessionMember | null {
    return this.currentMember;
  }

  public async enterSession(session: ReadingSession): Promise<void> {
    logger.log(`[ReadingSessionManager] Entering session: ${session.id}`);
    if (this.isInSession()) {
      await this.leaveSession();
    }
    
    const userId = this.authManager.getUser()?.id;
    if (!userId) {
      throw new Error("User not logged in, cannot enter session.");
    }

    this.currentSession = session;

    try {
      const response = await this.apiClient.get<{ data: SessionMember[] }>(`/api/proxy/reading-session/members?session_id=${session.id}`);
      const members = response.data || [];
      const member = members.find(m => m.user_id === userId);

      if (member) {
        this.currentMember = member;
        await this.initializeSession();
        logger.log(`[ReadingSessionManager] ✅ Successfully entered session: ${session.id}`);
      } else {
        // If not a member, try to join as a participant
        logger.log(`[ReadingSessionManager] Not a member, attempting to join session ${session.id}`);
        const joinResponse = await this.apiClient.post<{ data: { session: ReadingSession; member: SessionMember } }>('/api/proxy/reading-session/join-existing', { session_id: session.id });
        if (joinResponse.data && joinResponse.data.member) {
          this.currentMember = joinResponse.data.member;
          await this.initializeSession();
          logger.log(`[ReadingSessionManager] ✅ Successfully joined and entered session: ${session.id}`);
        } else {
          throw new Error(`Failed to join session ${session.id} as a new member.`);
        }
      }
    } catch (error) {
      this.currentSession = null;
      this.currentMember = null;
      logger.error(`[ReadingSessionManager] Failed to enter session ${session.id}:`, error);
      throw error;
    }
  }

  public isInSession(): boolean {
    return !!this.currentSession;
  }

  public async leaveSession(): Promise<void> {
    if (!this.currentSession || !this.currentMember) {
      logger.warn('[ReadingSessionManager] No active session to leave.');
      return;
    }

    logger.log(`[ReadingSessionManager] Leaving session: ${this.currentSession.id}`);
    const sessionIdToLog = this.currentSession.id;
    const userIdToLog = this.currentMember.user_id;
    const userEmailToLog = this.currentMember.user_email;

    try {
      this.stopHeartbeat();
      this.stopPolling();
      this.unregisterZoteroAnnotationListener();
      
      await this.updateOnlineStatus(false);
      
      this.notifyPresenceListeners({
        type: 'user_left',
        user_id: userIdToLog,
        user_email: userEmailToLog,
      });

      try {
        await this.logManager.logEvent(sessionIdToLog, 'member_leave', undefined, {
          user_id: userIdToLog,
        });
      } catch (logError) {
        logger.error('[ReadingSessionManager] Failed to log member_leave event:', logError);
      }
    } catch (error) {
      logger.error('[ReadingSessionManager] Error during leave session pre-cleanup:', error);
    } finally {
      this.currentSession = null;
      this.currentMember = null;
      this.clearSavedSession();
      logger.log('[ReadingSessionManager] ✅ Session left.');
    }
  }

  public async handleUserLogout(): Promise<void> {
    if (this.currentSession) {
      logger.log("[ReadingSessionManager] 🚪 Handling user logout, cleaning up session...");
      await this.leaveSession();
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    logger.log(`[ReadingSessionManager] Deleting session: ${sessionId}`);
    try {
      await this.apiClient.delete(`/api/proxy/reading-session/delete?session_id=${sessionId}`);
      if (this.currentSession?.id === sessionId) {
        await this.leaveSession();
      }
      logger.log('[ReadingSessionManager] ✅ Session deleted.');
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to delete session:', error);
      throw error;
    }
  }

  private async deleteAnnotationByKey(zoteroKey: string): Promise<void> {
    if (!this.currentSession) return;
    try {
      const params = new URLSearchParams({
        session_id: this.currentSession.id,
        zotero_key: zoteroKey,
      });
      await this.apiClient.delete(`/api/proxy/annotations/delete_by_key?${params.toString()}`);
      this.notifyAnnotationsChanged();
    } catch (error) {
      logger.error(`[ReadingSessionManager] Failed to delete annotation by key ${zoteroKey}:`, error);
    }
  }

  private notifyAnnotationsChanged(): void {
    for (const listener of this.annotationListeners) {
      try {
        // This is a generic signal, specific data is not critical
        listener({ type: 'annotation_deleted', annotation: {} as any, user_id: '' });
      } catch (error) {
        logger.error("[ReadingSessionManager] Error notifying annotation listener:", error);
      }
    }
  }

  public async getMyCreatedSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] Getting my created sessions');
    try {
      const response = await this.apiClient.get<{ data: ReadingSession[] }>(`/api/proxy/reading-session/list?type=created`);
      return response.data || [];
    } catch (error) {
      logger.error(`[ReadingSessionManager] Failed to get created sessions:`, error);
      return [];
    }
  }

  public async getMyJoinedSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] Getting my joined sessions');
    try {
      const response = await this.apiClient.get<{ data: ReadingSession[] }>(`/api/proxy/reading-session/list?type=joined`);
      return response.data || [];
    } catch (error) {
      logger.error(`[ReadingSessionManager] Failed to get joined sessions:`, error);
      return [];
    }
  }

  public async getPublicSessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] Getting public sessions');
    try {
      const response = await this.apiClient.get<{ data: ReadingSession[] }>(`/api/proxy/reading-session/list?type=public`);
      return response.data || [];
    } catch (error) {
      logger.error(`[ReadingSessionManager] Failed to get public sessions:`, error);
      return [];
    }
  }

  public async getMySessions(): Promise<ReadingSession[]> {
    logger.log('[ReadingSessionManager] Getting my sessions');
    try {
      const response = await this.apiClient.get<{ data: ReadingSession[] }>(`/api/proxy/reading-session/list?type=my`);
      return response.data || [];
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to get my sessions:', error);
      return [];
    }
  }

  public async getSessionMembers(sessionId: string, useCache: boolean = true): Promise<SessionMember[]> {
    if (useCache) {
      const cached = this.membersCache.get(sessionId);
      const expiry = this.membersCacheExpiry.get(sessionId);
      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }
    }
    try {
      const response = await this.apiClient.get<{ data: SessionMember[] }>(`/api/proxy/reading-session/members?session_id=${sessionId}`);
      const members = response.data || [];
      this.membersCache.set(sessionId, members);
      this.membersCacheExpiry.set(sessionId, Date.now() + 5000);
      return members;
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to get session members:', error);
      throw error;
    }
  }

  public async getSessionAnnotations(sessionId: string, page: number = 1, pageSize: number = 50): Promise<SessionAnnotation[]> {
    try {
      const params = new URLSearchParams({ session_id: sessionId, page: String(page), limit: String(pageSize) });
      const response = await this.apiClient.get<{ annotations: SessionAnnotation[] }>(`/api/proxy/annotations/list?${params.toString()}`);
      return (response.annotations || []).map((a: any) => ({
        ...a,
        username: a.users?.username,
        user_email: a.users?.email,
        user_name: a.users?.username || a.users?.email,
        avatar_url: a.users?.avatar_url,
      }));
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to get session annotations:', error);
      throw error;
    }
  }

  public async createAnnotation(annotationData: Omit<SessionAnnotation, 'id' | 'created_at' | 'updated_at' | 'username' | 'user_email' | 'user_name' | 'avatar_url'>): Promise<SessionAnnotation> {
    try {
      const response = await this.apiClient.post<{ annotation: SessionAnnotation }>(`/api/proxy/annotations/create`, annotationData);
      return response.annotation;
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to create annotation:', error);
      throw error;
    }
  }

  public async updateCurrentPage(pageNumber: number): Promise<void> {
    if (!this.currentMember || !this.currentSession) return;
    try {
      await this.apiClient.patch(`/api/proxy/reading-session/update-member`, {
        session_id: this.currentSession.id,
        page_number: pageNumber,
      });
      this.currentMember.current_page = pageNumber;
      this.notifyPresenceListeners({
        type: 'user_page_changed',
        user_id: this.currentMember.user_id,
        current_page: pageNumber,
      });
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to update page number:', error);
    }
  }

  private async updateOnlineStatus(isOnline: boolean): Promise<void> {
    if (!this.currentMember || !this.currentSession) return;
    try {
      await this.apiClient.patch(`/api/proxy/reading-session/update-member`, {
        session_id: this.currentSession.id,
        is_online: isOnline,
      });
      this.currentMember.is_online = isOnline;
    } catch (error) {
      logger.error('[ReadingSessionManager] Failed to update online status:', error);
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return;
    logger.log('[ReadingSessionManager] Starting polling.');
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollAnnotations();
        await this.pollMembers();
      } catch (error) {
        logger.error('[ReadingSessionManager] Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.log('[ReadingSessionManager] Polling stopped.');
    }
  }

  private async pollAnnotations(): Promise<void> {
    if (!this.currentSession) return;
    try {
      const params = new URLSearchParams({
        session_id: this.currentSession.id,
        since: this.lastAnnotationCheck.toISOString(),
      });
      const response = await this.apiClient.get<{ annotations: SessionAnnotation[] }>(`/api/proxy/annotations/list?${params.toString()}`);
      const newAnnotations = response.annotations || [];

      if (newAnnotations.length > 0) {
        for (const annotation of newAnnotations) {
          this.notifyAnnotationListeners({
            type: 'annotation_created',
            annotation,
            user_id: annotation.user_id,
          });
        }
        this.lastAnnotationCheck = new Date();
      }
    } catch (error) {
      // Silent fail for polling
    }
  }

  private async pollMembers(): Promise<void> {
    if (!this.currentSession) return;
    try {
      const members = await this.getSessionMembers(this.currentSession.id, false);
      const currentSnapshot = JSON.stringify(members.map(m => ({ id: m.user_id, online: m.is_online, page: m.current_page })));
      
      if (currentSnapshot !== this.lastMemberSnapshot) {
        this.lastMemberSnapshot = currentSnapshot;
        this.notifyMemberListeners(members);
      }
    } catch (error) {
      // Silent fail for polling
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    logger.log('[ReadingSessionManager] Starting heartbeat.');
    this.heartbeatInterval = setInterval(() => {
      this.updateOnlineStatus(true).catch(err => logger.error('[ReadingSessionManager] Heartbeat failed:', err));
    }, 60000); // Heartbeat every 1 minute
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.log('[ReadingSessionManager] Heartbeat stopped.');
    }
  }

  public onAnnotation(callback: (event: RealtimeAnnotationEvent) => void): void { this.annotationListeners.push(callback); }
  public onPresence(callback: (event: RealtimePresenceEvent) => void): void { this.presenceListeners.push(callback); }
  public onMembersChange(callback: (members: SessionMember[]) => void): void { this.memberListeners.push(callback); }

  private notifyAnnotationListeners(event: RealtimeAnnotationEvent) { this.annotationListeners.forEach(cb => cb(event)); }
  private notifyPresenceListeners(event: RealtimePresenceEvent) { this.presenceListeners.forEach(cb => cb(event)); }
  private notifyMemberListeners(members: SessionMember[]) { this.memberListeners.forEach(cb => cb(members)); }

  private registerZoteroAnnotationListener(): void {
    if (this.zoteroNotifierID) {
      (Zotero as any).Notifier.unregisterObserver(this.zoteroNotifierID);
    }
    const notifierCallback = {
      notify: async (event: string, type: string, ids: any[], extraData: any) => {
        if (!this.currentSession) return;
        if (event === 'delete' && type === 'item') {
          for (const id of ids) {
            const key = extraData?.[id]?.key;
            if (key) await this.deleteAnnotationByKey(key);
          }
        } else if (event === 'add' && type === 'item') {
          for (const id of ids) {
            try {
              const item = await (Zotero.Items as any).getAsync(id);
              if (!item || !item.isAnnotation()) continue;
              const pdfAttachment = item.parentItem;
              if (!pdfAttachment) continue;
              const paperItem = pdfAttachment.parentItem;
              if (!paperItem) continue;
              const doi = paperItem.getField('DOI');
              if (doi !== this.currentSession.paper_doi) continue;

              const user = this.authManager.getUser();
              if (!user) continue;

              const annotationPayload = {
                session_id: this.currentSession.id,
                user_id: user.id,
                paper_doi: this.currentSession.paper_doi,
                zotero_key: item.key,
                annotation_data: {
                  type: item.annotationType,
                  text: item.annotationText || '',
                  comment: item.annotationComment || '',
                  color: item.annotationColor || '',
                  position: item.annotationPosition || null,
                  tags: item.getTags().map((t: any) => t.tag),
                },
                page_number: parseInt(item.annotationPageLabel || '1') || 1,
              };
              await this.createAnnotation(annotationPayload);
            } catch (error) {
              logger.error('[ReadingSessionManager] Failed to sync new annotation:', error);
            }
          }
        }
      }
    };
    this.zoteroNotifierID = (Zotero as any).Notifier.registerObserver(notifierCallback, ['item']);
    logger.log('[ReadingSessionManager] ✅ Zotero annotation listener registered.');
  }

  private unregisterZoteroAnnotationListener(): void {
    if (this.zoteroNotifierID) {
      (Zotero as any).Notifier.unregisterObserver(this.zoteroNotifierID);
      this.zoteroNotifierID = null;
      logger.log('[ReadingSessionManager] ✅ Zotero annotation listener unregistered.');
    }
  }

  private async syncExistingAnnotations(): Promise<void> {
    if (!this.currentSession) return;
    logger.log('[ReadingSessionManager] 🔄 Starting sync of existing annotations...');
    try {
      const allItems = await (Zotero.Items as any).getAll((Zotero as any).Libraries.userLibraryID);
      let syncCount = 0;
      for (const item of allItems) {
        if (item.isRegularItem() && item.getField('DOI') === this.currentSession.paper_doi) {
          const attachments = item.getAttachments();
          for (const attachmentID of attachments) {
            const attachment = await (Zotero.Items as any).getAsync(attachmentID);
            if (attachment.attachmentContentType === 'application/pdf') {
              const annotations = attachment.getAnnotations();
              for (const annotation of annotations) {
                try {
                  const user = this.authManager.getUser();
                  if (!user) continue;

                  const annotationPayload = {
                    session_id: this.currentSession.id,
                    user_id: user.id,
                    paper_doi: this.currentSession.paper_doi,
                    zotero_key: annotation.key,
                    annotation_data: {
                      type: annotation.annotationType,
                      text: annotation.annotationText || '',
                      comment: annotation.annotationComment || '',
                      color: annotation.annotationColor || '',
                      position: annotation.annotationPosition || null,
                      tags: annotation.getTags().map((t: any) => t.tag),
                    },
                    page_number: parseInt(annotation.annotationPageLabel || '1') || 1,
                  };
                  await this.createAnnotation(annotationPayload);
                  syncCount++;
                } catch (error) {
                  // Ignore errors for existing annotations, likely duplicates
                }
              }
            }
          }
          logger.log(`[ReadingSessionManager] ✅ Synced ${syncCount} existing annotations for ${item.getField('title')}`);
          break; 
        }
      }
    } catch (error) {
      logger.error('[ReadingSessionManager] ❌ Error during sync of existing annotations:', error);
    }
  }
}


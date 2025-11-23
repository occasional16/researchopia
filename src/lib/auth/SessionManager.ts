/**
 * SessionManager - 会话管理类
 * 负责本地存储的session持久化
 */

import type { Session } from './types';

const SESSION_KEY = 'researchopia_session';
const SESSION_EXPIRY_KEY = 'researchopia_session_expiry';

export class SessionManager {
  /**
   * 保存会话到localStorage
   */
  static saveSession(session: Session): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(SESSION_EXPIRY_KEY, session.expires_at.toString());
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * 从localStorage加载会话
   */
  static loadSession(): Session | null {
    if (typeof window === 'undefined') return null;

    try {
      const sessionData = localStorage.getItem(SESSION_KEY);
      const expiryData = localStorage.getItem(SESSION_EXPIRY_KEY);

      if (!sessionData || !expiryData) {
        return null;
      }

      const expiresAt = parseInt(expiryData, 10);
      
      // 检查是否过期
      if (Date.now() >= expiresAt) {
        this.clearSession();
        return null;
      }

      return JSON.parse(sessionData) as Session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * 清除会话
   */
  static clearSession(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * 检查会话是否有效
   */
  static isSessionValid(): boolean {
    const session = this.loadSession();
    return session !== null;
  }

  /**
   * 获取访问令牌
   */
  static getAccessToken(): string | null {
    const session = this.loadSession();
    return session?.access_token || null;
  }

  /**
   * 更新会话过期时间
   */
  static updateExpiry(expiresAt: number): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(SESSION_EXPIRY_KEY, expiresAt.toString());
      
      const session = this.loadSession();
      if (session) {
        session.expires_at = expiresAt;
        this.saveSession(session);
      }
    } catch (error) {
      console.error('Failed to update session expiry:', error);
    }
  }
}

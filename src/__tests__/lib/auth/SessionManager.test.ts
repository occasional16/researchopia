/**
 * SessionManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '@/lib/auth/SessionManager';
import type { Session } from '@/lib/auth/types';

describe('SessionManager', () => {
  const mockSession: Session = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    expires_at: Date.now() + 3600000, // 1小时后过期
    user: {
      id: 'user123',
      email: 'test@example.com',
      display_name: 'Test User',
      created_at: new Date().toISOString(),
    },
  };

  beforeEach(() => {
    // 清空localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveSession', () => {
    it('应该成功保存会话到localStorage', () => {
      SessionManager.saveSession(mockSession);
      const stored = localStorage.getItem('researchopia_session');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.access_token).toBe(mockSession.access_token);
      expect(parsed.user.email).toBe(mockSession.user.email);
    });
  });

  describe('loadSession', () => {
    it('应该成功加载已保存的会话', () => {
      SessionManager.saveSession(mockSession);
      const loaded = SessionManager.loadSession();
      expect(loaded).toBeTruthy();
      expect(loaded?.access_token).toBe(mockSession.access_token);
      expect(loaded?.user.email).toBe(mockSession.user.email);
    });

    it('会话不存在时应返回null', () => {
      const loaded = SessionManager.loadSession();
      expect(loaded).toBeNull();
    });

    it('localStorage数据损坏时应返回null', () => {
      localStorage.setItem('researchopia_session', 'invalid json');
      const loaded = SessionManager.loadSession();
      expect(loaded).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('应该成功清空会话', () => {
      SessionManager.saveSession(mockSession);
      expect(localStorage.getItem('researchopia_session')).toBeTruthy();
      
      SessionManager.clearSession();
      expect(localStorage.getItem('researchopia_session')).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('有效会话应返回true', () => {
      SessionManager.saveSession(mockSession);
      expect(SessionManager.isSessionValid()).toBe(true);
    });

    it('会话不存在时应返回false', () => {
      expect(SessionManager.isSessionValid()).toBe(false);
    });

    it('过期会话应返回false', () => {
      const expiredSession: Session = {
        ...mockSession,
        expires_at: Date.now() - 1000, // 1秒前过期
      };
      SessionManager.saveSession(expiredSession);
      expect(SessionManager.isSessionValid()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('应该成功获取访问令牌', () => {
      SessionManager.saveSession(mockSession);
      const token = SessionManager.getAccessToken();
      expect(token).toBe(mockSession.access_token);
    });

    it('会话不存在时应返回null', () => {
      const token = SessionManager.getAccessToken();
      expect(token).toBeNull();
    });

    it('会话过期时应返回null', () => {
      const expiredSession: Session = {
        ...mockSession,
        expires_at: Date.now() - 1000,
      };
      SessionManager.saveSession(expiredSession);
      const token = SessionManager.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('updateExpiry', () => {
    it('应该成功更新会话过期时间', () => {
      SessionManager.saveSession(mockSession);
      const oldExpiry = mockSession.expires_at;

      const newExpiry = Date.now() + 7200000; // 2小时后
      SessionManager.updateExpiry(newExpiry);

      const updated = SessionManager.loadSession();
      expect(updated?.expires_at).toBe(newExpiry);
      expect(updated?.expires_at).not.toBe(oldExpiry);
    });

    it('会话不存在时应该不抛出错误', () => {
      expect(() => {
        SessionManager.updateExpiry(Date.now() + 3600000);
      }).not.toThrow();
    });
  });
});

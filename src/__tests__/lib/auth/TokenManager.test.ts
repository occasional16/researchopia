/**
 * TokenManager 单元测试
 */

import { describe, it, expect } from 'vitest';
import { TokenManager } from '@/lib/auth/TokenManager';

describe('TokenManager', () => {
  // 创建一个模拟的JWT token (Base64编码的payload)
  const createMockToken = (payload: any) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = 'mock_signature';
    return `${header}.${encodedPayload}.${signature}`;
  };

  describe('parseJWT', () => {
    it('应该成功解析有效的JWT', () => {
      const payload = { sub: 'user123', email: 'test@example.com', exp: 1234567890 };
      const token = createMockToken(payload);
      
      const parsed = TokenManager.parseJWT(token);
      expect(parsed).toEqual(payload);
    });

    it('无效JWT应返回null', () => {
      expect(TokenManager.parseJWT('invalid_token')).toBeNull();
      expect(TokenManager.parseJWT('')).toBeNull();
      expect(TokenManager.parseJWT('only.two.parts')).toBeNull();
    });

    it('payload解析失败应返回null', () => {
      const invalidToken = 'header.invalid_base64.signature';
      expect(TokenManager.parseJWT(invalidToken)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('未过期的token应返回false', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
      const token = createMockToken({ exp: futureTime });
      expect(TokenManager.isTokenExpired(token)).toBe(false);
    });

    it('已过期的token应返回true', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1小时前
      const token = createMockToken({ exp: pastTime });
      expect(TokenManager.isTokenExpired(token)).toBe(true);
    });

    it('无exp字段的token应返回true', () => {
      const token = createMockToken({ sub: 'user123' });
      expect(TokenManager.isTokenExpired(token)).toBe(true);
    });

    it('无效token应返回true', () => {
      expect(TokenManager.isTokenExpired('invalid_token')).toBe(true);
    });
  });

  describe('getTokenExpiry', () => {
    it('应该返回正确的过期时间戳', () => {
      const expTime = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({ exp: expTime });
      
      const expiry = TokenManager.getTokenExpiry(token);
      expect(expiry).toBe(expTime * 1000); // 返回毫秒
    });

    it('无效token应返回null', () => {
      expect(TokenManager.getTokenExpiry('invalid_token')).toBeNull();
    });

    it('无exp字段应返回null', () => {
      const token = createMockToken({ sub: 'user123' });
      expect(TokenManager.getTokenExpiry(token)).toBeNull();
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('即将过期的token应返回true', () => {
      const soonTime = Math.floor(Date.now() / 1000) + 240; // 4分钟后
      const token = createMockToken({ exp: soonTime });
      expect(TokenManager.isTokenExpiringSoon(token)).toBe(true);
    });

    it('不会很快过期的token应返回false', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后
      const token = createMockToken({ exp: futureTime });
      expect(TokenManager.isTokenExpiringSoon(token)).toBe(false);
    });

    it('自定义阈值应该生效', () => {
      const time = Math.floor(Date.now() / 1000) + 600; // 10分钟后
      const token = createMockToken({ exp: time });
      
      // 默认5分钟阈值
      expect(TokenManager.isTokenExpiringSoon(token)).toBe(false);
      
      // 自定义15分钟阈值
      expect(TokenManager.isTokenExpiringSoon(token, 15 * 60 * 1000)).toBe(true);
    });

    it('无效token应返回true', () => {
      expect(TokenManager.isTokenExpiringSoon('invalid_token')).toBe(true);
    });
  });

  describe('validateTokenFormat', () => {
    it('有效格式应返回true', () => {
      const token = createMockToken({ sub: 'user123', exp: 1234567890 });
      expect(TokenManager.validateTokenFormat(token)).toBe(true);
    });

    it('无效格式应返回false', () => {
      expect(TokenManager.validateTokenFormat('')).toBe(false);
      expect(TokenManager.validateTokenFormat('only.two')).toBe(false);
      expect(TokenManager.validateTokenFormat('invalid_token')).toBe(false);
      expect(TokenManager.validateTokenFormat('a.b.c.d')).toBe(false);
    });
  });
});

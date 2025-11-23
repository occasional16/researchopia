/**
 * TokenManager - JWT Token管理类
 * 负责token验证、解析和刷新
 */

export class TokenManager {
  /**
   * 解析JWT token（不验证签名）
   */
  static parseJWT(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Failed to parse JWT:', error);
      return null;
    }
  }

  /**
   * 检查token是否过期
   * @param token JWT token字符串
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.parseJWT(token);
    if (!payload || typeof payload.exp !== 'number') {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return now >= payload.exp;
  }

  /**
   * 从token中提取过期时间（毫秒）
   */
  static getTokenExpiry(token: string): number | null {
    const payload = this.parseJWT(token);
    if (!payload || typeof payload.exp !== 'number') {
      return null;
    }
    
    return payload.exp * 1000; // 转换为毫秒
  }

  /**
   * 检查token是否即将过期
   * @param token JWT token字符串
   * @param thresholdMs 阈值（毫秒），默认5分钟
   */
  static isTokenExpiringSoon(token: string, thresholdMs: number = 5 * 60 * 1000): boolean {
    const expiryMs = this.getTokenExpiry(token);
    if (!expiryMs) {
      return true;
    }

    const now = Date.now();
    return expiryMs - now < thresholdMs;
  }

  /**
   * 验证token格式
   */
  static validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    return parts.length === 3;
  }
}

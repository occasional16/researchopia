/**
 * 安全工具函数
 * 提供速率限制、安全头部等功能
 */

// 速率限制器
class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  /**
   * 检查是否允许请求
   * @param identifier - 客户端标识符（如IP）
   * @param maxRequests - 最大请求数
   * @param windowMs - 时间窗口（毫秒）
   */
  isAllowed(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(identifier) || []
    
    // 过滤掉时间窗口外的请求
    const validTimestamps = timestamps.filter(time => now - time < windowMs)
    
    if (validTimestamps.length >= maxRequests) {
      this.requests.set(identifier, validTimestamps)
      return false
    }
    
    validTimestamps.push(now)
    this.requests.set(identifier, validTimestamps)
    return true
  }

  /**
   * 获取剩余时间（毫秒）
   */
  getRemainingTime(identifier: string): number {
    const timestamps = this.requests.get(identifier) || []
    if (timestamps.length === 0) return 0
    
    const oldest = timestamps[0]
    const windowMs = 60000 // 1分钟
    return Math.max(0, windowMs - (Date.now() - oldest))
  }

  /**
   * 清理过期的记录
   */
  cleanup(): void {
    const now = Date.now()
    const windowMs = 60000
    
    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(time => now - time < windowMs)
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, validTimestamps)
      }
    }
  }
}

export const rateLimiter = new RateLimiter()

// 定期清理速率限制器（每5分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000)
}

/**
 * 基础安全头部
 */
export const SecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}

/**
 * 获取动态安全头部
 * @param pathname - 请求路径
 */
export function getSecurityHeaders(pathname: string): Record<string, string> {
  const headers = { ...SecurityHeaders }
  
  // API路由使用更严格的CSP
  if (pathname.startsWith('/api/')) {
    headers['Content-Security-Policy'] = "default-src 'self'; frame-ancestors 'none';"
  } else {
    // 页面路由使用相对宽松的CSP
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'self'"
    ].join('; ')
  }
  
  return headers
}

/**
 * 验证输入字符串
 */
export function validateString(value: any, minLength = 1, maxLength = 1000): { isValid: boolean; message?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, message: '必须是字符串' }
  }
  if (value.length < minLength) {
    return { isValid: false, message: `长度不能少于${minLength}个字符` }
  }
  if (value.length > maxLength) {
    return { isValid: false, message: `长度不能超过${maxLength}个字符` }
  }
  return { isValid: true }
}

/**
 * 验证邮箱
 */
export function validateEmail(value: any): { isValid: boolean; message?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, message: '必须是字符串' }
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return { isValid: false, message: '邮箱格式不正确' }
  }
  return { isValid: true }
}

/**
 * 验证URL
 */
export function validateUrl(value: any): { isValid: boolean; message?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, message: '必须是字符串' }
  }
  try {
    new URL(value)
    return { isValid: true }
  } catch {
    return { isValid: false, message: 'URL格式不正确' }
  }
}

/**
 * 验证UUID
 */
export function validateUUID(value: any): { isValid: boolean; message?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, message: '必须是字符串' }
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(value)) {
    return { isValid: false, message: 'UUID格式不正确' }
  }
  return { isValid: true }
}

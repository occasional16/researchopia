// 输入验证和清理工具

// 基础验证规则
export const ValidationRules = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  doi: /^10\.\d{4,}\/[-._;()\/:A-Za-z0-9]+$/,
  url: /^https?:\/\/.+/,
}

// 输入清理函数
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // 移除危险字符
  return input
    .trim()
    .replace(/[<>\"']/g, '') // 移除HTML危险字符
    .replace(/javascript:/gi, '') // 移除JavaScript协议
    .replace(/data:/gi, '') // 移除data协议
    .substring(0, 1000) // 限制长度
}

// 简单的HTML清理（基础版本）
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''
  
  // 移除脚本标签和危险属性
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=/gi, '') // 移除事件处理器
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim()
}

// 验证函数
export function validateEmail(email: string): { isValid: boolean; message?: string } {
  if (!email) return { isValid: false, message: '邮箱不能为空' }
  if (!ValidationRules.email.test(email)) {
    return { isValid: false, message: '邮箱格式不正确' }
  }
  return { isValid: true }
}

export function validateUsername(username: string): { isValid: boolean; message?: string } {
  if (!username) return { isValid: false, message: '用户名不能为空' }
  if (username.length < 3) return { isValid: false, message: '用户名至少3个字符' }
  if (username.length > 20) return { isValid: false, message: '用户名最多20个字符' }
  if (!ValidationRules.username.test(username)) {
    return { isValid: false, message: '用户名只能包含字母、数字和下划线' }
  }
  return { isValid: true }
}

export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password) return { isValid: false, message: '密码不能为空' }
  if (password.length < 8) return { isValid: false, message: '密码至少8个字符' }
  if (!ValidationRules.password.test(password)) {
    return { 
      isValid: false, 
      message: '密码必须包含大小写字母和数字' 
    }
  }
  return { isValid: true }
}

export function validateDOI(doi: string): { isValid: boolean; message?: string } {
  if (!doi) return { isValid: false, message: 'DOI不能为空' }
  if (!ValidationRules.doi.test(doi)) {
    return { isValid: false, message: 'DOI格式不正确' }
  }
  return { isValid: true }
}

// 通用表单验证
export function validateForm<T extends Record<string, any>>(
  data: T,
  rules: Record<keyof T, (value: any) => { isValid: boolean; message?: string }>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {}
  let isValid = true

  for (const field in rules) {
    const validation = rules[field](data[field])
    if (!validation.isValid) {
      errors[field] = validation.message
      isValid = false
    }
  }

  return { isValid, errors }
}

// 速率限制工具
class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  isAllowed(key: string, maxRequests: number = 10, timeWindow: number = 60000): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // 清理过期的请求记录
    const validRequests = requests.filter(time => now - time < timeWindow)
    
    if (validRequests.length >= maxRequests) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(key, validRequests)
    
    return true
  }
  
  getRemainingTime(key: string, timeWindow: number = 60000): number {
    const requests = this.requests.get(key) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    const remaining = timeWindow - (Date.now() - oldestRequest)
    
    return Math.max(0, remaining)
  }
}

export const rateLimiter = new RateLimiter()

// 安全Headers
export const SecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

// 获取动态安全Headers（支持插件认证页面）
export function getSecurityHeaders(pathname?: string) {
  const headers = { ...SecurityHeaders }

  // 允许插件认证页面被iframe嵌入
  if (pathname && pathname.startsWith('/plugin/auth')) {
    headers['X-Frame-Options'] = 'SAMEORIGIN'
  }

  return headers
}

// 认证安全配置和工具
import { supabase } from '@/lib/supabase'

export interface SecurityConfig {
  // Session 配置
  sessionTimeout: number // 会话超时时间（毫秒）
  refreshThreshold: number // 刷新阈值（毫秒）
  maxInactiveTime: number // 最大非活跃时间（毫秒）
  
  // 安全选项
  requireReauthForSensitive: boolean // 敏感操作需要重新认证
  logoutOnBrowserClose: boolean // 浏览器关闭时登出
  enableActivityTracking: boolean // 启用活动跟踪
}

// 默认安全配置
export const defaultSecurityConfig: SecurityConfig = {
  sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
  refreshThreshold: 60 * 60 * 1000, // 1小时
  maxInactiveTime: 2 * 60 * 60 * 1000, // 2小时非活跃自动登出
  requireReauthForSensitive: true,
  logoutOnBrowserClose: false, // 可以设为true增强安全性
  enableActivityTracking: true
}

// 活动跟踪
class ActivityTracker {
  private lastActivity: number = Date.now()
  private activityTimer: NodeJS.Timeout | null = null
  private config: SecurityConfig

  constructor(config: SecurityConfig = defaultSecurityConfig) {
    this.config = config
    this.startTracking()
  }

  // 开始跟踪用户活动
  startTracking() {
    if (!this.config.enableActivityTracking) return

    // 监听用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const updateActivity = () => {
      this.lastActivity = Date.now()
    }

    events.forEach(event => {
      document.addEventListener(event, updateActivity, true)
    })

    // 定期检查非活跃时间
    this.activityTimer = setInterval(() => {
      this.checkInactivity()
    }, 60000) // 每分钟检查一次
  }

  // 检查非活跃时间
  private async checkInactivity() {
    const inactiveTime = Date.now() - this.lastActivity
    
    if (inactiveTime > this.config.maxInactiveTime) {
      console.log('🔒 User inactive for too long, logging out...')
      await this.forceLogout('非活跃时间过长，已自动登出')
    }
  }

  // 强制登出
  private async forceLogout(reason: string) {
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
      
      // 清除本地存储
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.clear()
      
      // 显示提示并刷新页面
      alert(reason)
      window.location.href = '/'
    } catch (error) {
      console.error('Force logout error:', error)
    }
  }

  // 停止跟踪
  stopTracking() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer)
      this.activityTimer = null
    }
  }

  // 获取最后活动时间
  getLastActivity(): number {
    return this.lastActivity
  }
}

// Session 管理器
export class SessionManager {
  private config: SecurityConfig
  private activityTracker: ActivityTracker | null = null

  constructor(config: SecurityConfig = defaultSecurityConfig) {
    this.config = config
    this.initializeSessionSecurity()
  }

  // 初始化会话安全
  private initializeSessionSecurity() {
    // 启用活动跟踪
    if (this.config.enableActivityTracking) {
      this.activityTracker = new ActivityTracker(this.config)
    }

    // 浏览器关闭时登出
    if (this.config.logoutOnBrowserClose) {
      window.addEventListener('beforeunload', this.handleBrowserClose.bind(this))
    }

    // 定期检查会话状态
    setInterval(() => {
      this.checkSessionValidity()
    }, 5 * 60 * 1000) // 每5分钟检查一次
  }

  // 处理浏览器关闭
  private async handleBrowserClose() {
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
    } catch (error) {
      console.error('Browser close logout error:', error)
    }
  }

  // 检查会话有效性
  private async checkSessionValidity() {
    try {
      if (!supabase) return

      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        console.log('🔒 Invalid session detected, redirecting to login')
        window.location.href = '/'
        return
      }

      // 检查会话是否即将过期
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      const now = Date.now()
      const timeUntilExpiry = expiresAt - now

      if (timeUntilExpiry < this.config.refreshThreshold) {
        console.log('🔄 Session expiring soon, refreshing...')
        await this.refreshSession()
      }

    } catch (error) {
      console.error('Session validity check error:', error)
    }
  }

  // 刷新会话
  private async refreshSession() {
    try {
      if (!supabase) return

      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Session refresh failed:', error)
        window.location.href = '/'
      } else {
        console.log('✅ Session refreshed successfully')
      }
    } catch (error) {
      console.error('Session refresh error:', error)
    }
  }

  // 验证敏感操作
  async validateSensitiveOperation(): Promise<boolean> {
    if (!this.config.requireReauthForSensitive) {
      return true
    }

    try {
      if (!supabase) return false

      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        return false
      }

      // 检查最近是否进行过认证（例如最近5分钟内）
      const recentAuthThreshold = 5 * 60 * 1000 // 5分钟
      const sessionAge = Date.now() - (session.expires_at ? (session.expires_at * 1000 - 3600000) : 0)

      if (sessionAge > recentAuthThreshold) {
        // 需要重新认证 - 使用API验证而不是直接登录
        const password = prompt('为了安全，请输入您的密码以确认此操作：')
        if (!password) return false

        // 通过API验证密码而不是重新登录
        try {
          const response = await fetch('/api/auth/verify-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ password })
          })

          const result = await response.json()
          return result.success
        } catch (apiError) {
          console.error('Password verification API error:', apiError)
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Sensitive operation validation error:', error)
      return false
    }
  }

  // 安全登出
  async secureLogout() {
    try {
      // 停止活动跟踪
      if (this.activityTracker) {
        this.activityTracker.stopTracking()
      }

      // 登出
      if (supabase) {
        await supabase.auth.signOut()
      }

      // 清除所有本地数据
      localStorage.clear()
      sessionStorage.clear()

      // 重定向到首页
      window.location.href = '/'
    } catch (error) {
      console.error('Secure logout error:', error)
    }
  }
}

// 全局会话管理器实例
export const sessionManager = new SessionManager()

// 工具函数：检查是否需要重新认证
export async function requireReauth(): Promise<boolean> {
  return await sessionManager.validateSensitiveOperation()
}

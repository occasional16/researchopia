/**
 * Mock authentication system for development/testing
 * This provides a fallback when Supabase is not configured
 */

export interface MockUser {
  id: string
  email: string
  username: string
  role: 'user' | 'admin' | 'moderator'
  created_at: string
}

const MOCK_USERS_KEY = 'academic_rating_mock_users'
const CURRENT_USER_KEY = 'academic_rating_current_user'

// Default admin user for testing
const DEFAULT_ADMIN: MockUser = {
  id: 'mock-admin-001',
  email: 'admin@test.edu.cn',
  username: 'admin',
  role: 'admin',
  created_at: new Date().toISOString()
}

// Default demo user for easy testing
const DEFAULT_DEMO: MockUser = {
  id: 'mock-demo-001',
  email: 'demo@test.edu.cn',
  username: 'demo',
  role: 'user',
  created_at: new Date().toISOString()
}

export class MockAuthService {
  private static instance: MockAuthService
  
  static getInstance(): MockAuthService {
    if (!MockAuthService.instance) {
      MockAuthService.instance = new MockAuthService()
    }
    return MockAuthService.instance
  }

  private getUsers(): MockUser[] {
    if (typeof window === 'undefined') return []
    
    const stored = localStorage.getItem(MOCK_USERS_KEY)
    if (!stored) {
      // Initialize with default users
      const users = [DEFAULT_ADMIN, DEFAULT_DEMO]
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
      return users
    }
    return JSON.parse(stored)
  }

  private saveUsers(users: MockUser[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
  }

  private generateId(): string {
    return 'mock-user-' + Math.random().toString(36).substr(2, 9)
  }

  async signUp(email: string, password: string, username: string): Promise<{ user: MockUser | null, error: string | null }> {
    try {
      // 特殊处理admin账号
      if (email === 'admin@test.edu.cn') {
        const users = this.getUsers()
        
        // 检查admin是否已存在
        const existingAdmin = users.find(u => u.email === email)
        if (existingAdmin) {
          return { user: null, error: '管理员账号已存在，请直接登录' }
        }

        // 创建admin用户
        const adminUser: MockUser = {
          id: 'mock-admin-001',
          email: 'admin@test.edu.cn',
          username: 'admin',
          role: 'admin',
          created_at: new Date().toISOString()
        }

        users.push(adminUser)
        this.saveUsers(users)
        return { user: adminUser, error: null }
      }

      // 验证其他邮箱的教育机构域名
      const eduDomains = ['.edu', '.edu.cn', '.ac.uk', '.ac.jp', '.edu.au']
      const isEduEmail = eduDomains.some(domain => email.toLowerCase().includes(domain))
      
      if (!isEduEmail) {
        return { user: null, error: '请使用教育机构邮箱注册' }
      }

      const users = this.getUsers()
      
      // Check if user already exists
      if (users.find(u => u.email === email)) {
        return { user: null, error: '该邮箱已被注册' }
      }

      if (users.find(u => u.username === username)) {
        return { user: null, error: '该用户名已被使用' }
      }

      // Create new user
      const newUser: MockUser = {
        id: this.generateId(),
        email,
        username,
        role: 'user',
        created_at: new Date().toISOString()
      }

      users.push(newUser)
      this.saveUsers(users)

      return { user: newUser, error: null }
    } catch (error) {
      return { user: null, error: '注册失败，请重试' }
    }
  }

  async signIn(email: string, password: string): Promise<{ user: MockUser | null, error: string | null }> {
    try {
      const users = this.getUsers()
      const user = users.find(u => u.email === email)
      
      if (!user) {
        return { user: null, error: '用户不存在' }
      }

      // In mock mode, any password works for testing
      return { user, error: null }
    } catch (error) {
      return { user: null, error: '登录失败，请重试' }
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CURRENT_USER_KEY)
      }
      return { error: null }
    } catch (error) {
      return { error: '退出登录失败' }
    }
  }

  getCurrentUser(): MockUser | null {
    if (typeof window === 'undefined') return null
    
    const stored = localStorage.getItem(CURRENT_USER_KEY)
    return stored ? JSON.parse(stored) : null
  }

  getUserById(id: string): MockUser | null {
    const users = this.getUsers()
    return users.find(u => u.id === id) || null
  }

  getUserByEmail(email: string): MockUser | null {
    const users = this.getUsers()
    return users.find(u => u.email === email) || null
  }

  setCurrentUser(user: MockUser | null): void {
    if (typeof window === 'undefined') return
    
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(CURRENT_USER_KEY)
    }
  }

  async updateProfile(userId: string, updates: Partial<MockUser>): Promise<{ user: MockUser | null, error: string | null }> {
    try {
      const users = this.getUsers()
      const userIndex = users.findIndex(u => u.id === userId)
      
      if (userIndex === -1) {
        return { user: null, error: '用户不存在' }
      }

      users[userIndex] = { ...users[userIndex], ...updates }
      this.saveUsers(users)

      return { user: users[userIndex], error: null }
    } catch (error) {
      return { user: null, error: '更新失败，请重试' }
    }
  }

  // 检查是否应该使用Mock认证（当Supabase未配置时）
  static shouldUseMockAuth(): boolean {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // 如果Supabase配置完整，使用Supabase；否则使用Mock
    return !supabaseUrl || 
           !supabaseKey || 
           supabaseUrl.includes('your-project') || 
           supabaseKey.includes('your-anon-key')
  }
}

export const mockAuth = MockAuthService.getInstance()

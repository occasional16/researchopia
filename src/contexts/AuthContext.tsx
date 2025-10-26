'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { safeSignOut } from '@/lib/auth-utils'
import { sessionManager } from '@/lib/auth-security'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'

// 应用用户类型定义
export interface User {
  id: string
  email: string
  username: string
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
  avatar_url?: string
}

interface AuthContextType {
  user: User | null
  profile: User | null
  loading: boolean
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signOut: () => Promise<void>
  setProfile: (profile: User | null) => void
  setUser: (user: User | null) => void
  fetchProfile: (userId: string, force?: boolean) => Promise<void>
  refreshSession: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 状态管理
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const mountedRef = useRef(true)
  const initializingRef = useRef(false)
  const sessionCheckedRef = useRef(false)

  // 获取用户资料
  const fetchProfile = async (userId: string, force: boolean = false) => {
    if (!userId || !mountedRef.current || !supabase) return
    
    try {
      setIsLoading(true)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 用户不存在，创建新记录
          await createUserProfile(userId)
        } else {
          console.error('❌ Error fetching profile:', error)
        }
        return
      }

      if (data && mountedRef.current) {
        console.log('✅ Profile loaded:', (data as any).email)
        setProfile(data)
      }
    } catch (error) {
      console.error('❌ Profile fetch failed:', error)
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }

  // 创建用户资料记录
  const createUserProfile = async (userId: string, authUser?: SupabaseUser | null) => {
    if (!supabase) return
    
    try {
      // 如果没有传入authUser，尝试获取当前会话
      if (!authUser) {
        const { data: { user: sessionUser } } = await supabase.auth.getUser()
        authUser = sessionUser
      }
      
      if (!authUser || !authUser.email) {
        console.error('❌ Cannot create user profile: no user data')
        return
      }

      const { data, error } = await (supabase as any)
        .from('users')
        .insert({
          id: userId,
          email: authUser.email,
          username: authUser.user_metadata?.username || authUser.email.split('@')[0],
          role: authUser.email === 'admin@test.edu.cn' ? 'admin' : 'user'
        })
        .select()
        .single()

      if (error) throw error

      if (data && mountedRef.current) {
        console.log('✅ User profile created:', data)
        setProfile(data)
      }
    } catch (error) {
      console.error('❌ Failed to create user profile:', error)
    }
  }

  // 刷新会话
  const refreshSession = async () => {
    if (!supabase) return

    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()

      if (error) {
        console.error('❌ Session refresh failed:', error)
        return
      }

      if (session?.user && mountedRef.current) {
        console.log('✅ Session refreshed')
        await handleAuthUser(session.user)
      }
    } catch (error) {
      console.error('❌ Session refresh error:', error)
    }
  }

  // 获取访问令牌
  const getAccessToken = async (): Promise<string | null> => {
    if (!supabase) return null

    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('❌ Failed to get session:', error)
        return null
      }

      return session?.access_token || null
    } catch (error) {
      console.error('❌ Get access token error:', error)
      return null
    }
  }

  // 处理认证用户
  const handleAuthUser = async (authUser: SupabaseUser) => {
    if (!mountedRef.current) return

    // 先用默认role创建用户对象,立即更新UI
    const tempUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'User',
      role: 'user',  // 临时默认值
      created_at: authUser.created_at,
      updated_at: authUser.updated_at || authUser.created_at,
      avatar_url: authUser.user_metadata?.avatar_url
    }

    console.log('🔄 Setting authenticated user (temp):', tempUser.email, 'with role:', tempUser.role)
    
    // 立即更新认证状态,不阻塞UI
    setUser(tempUser)
    setIsAuthenticated(true)
    
    // 🆕 异步获取真实role,不阻塞登录流程
    const fetchRole = async () => {
      try {
        if (supabase) {
          console.log('🔍 Fetching user role from database for:', authUser.id)
          const { data: userData, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', authUser.id)
            .single()
          
          if (roleError) {
            console.error('❌ Error fetching user role:', roleError)
          } else if (userData && userData.role) {
            console.log('✅ User role fetched from database:', userData.role)
            
            // 更新user对象的role
            if (mountedRef.current) {
              const updatedUser: User = {
                ...tempUser,
                role: userData.role
              }
              console.log('🔄 Updating user with role:', userData.role)
              setUser(updatedUser)
            }
          } else {
            console.warn('⚠️ No role found in database, keeping default')
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch user role:', error)
      }
    }
    
    // 异步获取role
    fetchRole()
    
    // 异步获取用户资料
    setTimeout(() => {
      fetchProfile(authUser.id)
    }, 100)
  }

  // 登录
  const signIn = async (email: string, password: string) => {
    console.log('🔄 Attempting sign in for:', email)

    try {
      setLoading(true)

      // 使用自定义登录API
      const loginResponse = await fetch('/api/auth/custom-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const loginResult = await loginResponse.json()

      if (!loginResponse.ok) {
        throw new Error(loginResult.error || '登录失败')
      }

      const { data, error } = loginResult

      if (error) {
        console.error('❌ Sign in error:', error)
        throw new Error(error.message || '登录失败')
      }

      if (data.user && data.session) {
        console.log('✅ Sign in successful:', email)

        // 设置会话到本地Supabase客户端
        if (supabase) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          })
        }

        await handleAuthUser(data.user)
      } else {
        throw new Error('登录失败：未能获取用户信息')
      }
    } catch (error) {
      console.error('❌ Sign in failed:', error)
      throw error
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  // 注册
  const signUp = async (email: string, password: string, username: string) => {
    if (!supabase) {
      throw new Error('数据库连接不可用')
    }

    console.log('🔄 Attempting sign up for:', email)

    try {
      setLoading(true)

      // 使用自定义API注册，完全绕过Supabase邮件发送
      const registrationResponse = await fetch('/api/auth/custom-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      })

      const registrationResult = await registrationResponse.json()

      if (!registrationResponse.ok) {
        throw new Error(registrationResult.error || '注册失败')
      }

      const { data, error, resend } = registrationResult
      
      // 如果是重新发送验证邮件的情况
      if (resend) {
        console.log('📧 Resending verification email for existing unverified user')
      }
      
      if (error) {
        console.error('❌ Sign up error:', error)
        // 提供更友好的错误信息
        if (error.message.includes('Database error saving new user')) {
          throw new Error('用户数据保存失败，请稍后重试或联系管理员')
        } else if (error.message.includes('User already registered')) {
          throw new Error('该邮箱已经注册，请直接登录或使用其他邮箱')
        } else if (error.message.includes('Password should be at least')) {
          throw new Error('密码长度至少需要6位')
        } else if (error.message.includes('Invalid email format') || error.message.includes('is invalid')) {
          throw new Error('该系统目前仅支持教育机构邮箱（如：.edu.cn, .edu）注册，请使用学校邮箱')
        } else if (error.message.includes('Signup is disabled')) {
          throw new Error('注册功能暂时关闭，请联系管理员')
        } else {
          throw new Error(error.message || '注册失败，请重试')
        }
      }

      if (data.user) {
        console.log('✅ Sign up successful:', email)

        // 如果需要邮箱验证，使用自定义邮件服务
        if (!data.user.email_confirmed_at) {
          console.log('📧 Sending custom verification email for:', email)

          try {
            // 生成验证URL（自动适配开发和生产环境）
            const baseUrl = process.env.NODE_ENV === 'production'
              ? 'https://www.researchopia.com'
              : window.location.origin
            const verificationUrl = `${baseUrl}/auth/verify?token=${data.user.id}&email=${encodeURIComponent(email)}`

            const emailResponse = await fetch('/api/auth/send-verification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, verificationUrl })
            })

            const emailResult = await emailResponse.json()

            if (emailResult.success) {
              console.log('✅ Custom verification email sent successfully')
              const message = resend 
                ? '验证邮件已重新发送！请检查您的邮箱（包括垃圾邮件文件夹）并点击验证链接。'
                : '注册成功！我们已向您的邮箱发送验证链接，请查收并点击验证。'
              throw new Error(message)
            } else if (emailResult.fallback) {
              // 如果自定义邮件服务不可用，使用Supabase默认服务
              console.log('📧 Falling back to Supabase email service')
              throw new Error('注册成功！邮件服务暂时不可用，我们会尽快处理。请稍后查看您的邮箱或联系管理员。')
            } else {
              console.warn('Custom email service failed:', emailResult.error)
              // 提供更详细的错误信息
              const errorMsg = resend
                ? `验证邮件发送失败（${emailResult.error}）。请稍后重试或联系管理员。`
                : `注册成功但邮件发送失败（${emailResult.error}）。请稍后重试发送验证邮件或联系管理员。`
              throw new Error(errorMsg)
            }
          } catch (emailError: any) {
            console.error('Custom email service error:', emailError)
            // 区分是预期的成功消息还是真正的错误
            if (emailError.message?.includes('注册成功') || emailError.message?.includes('验证邮件')) {
              throw emailError // 重新抛出成功/提示消息
            }
            // 真正的错误
            throw new Error('注册成功但邮件服务异常，请稍后重试或联系管理员')
          }
        }

        await handleAuthUser(data.user)
      } else {
        throw new Error('注册成功但未能获取用户信息，请尝试登录')
      }
    } catch (error) {
      console.error('❌ Sign up failed:', error)
      throw error
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  // 登出
  const signOut = async () => {
    console.log('🔄 Signing out...')
    
    try {
      setLoading(true)
      
      // 清理本地状态（优先执行）
      if (mountedRef.current) {
        setUser(null)
        setProfile(null)
        setIsAuthenticated(false)
      }
      
      // 尝试服务器端登出
      const serverSignOutSuccess = await safeSignOut()
      
      if (serverSignOutSuccess) {
        console.log('✅ Sign out completed successfully')
      } else {
        console.log('✅ Sign out completed with local cleanup (server cleanup failed)')
      }
    } catch (error) {
      console.error('❌ Sign out failed:', error)
      // 即使出错也要确保本地状态被清理
      if (mountedRef.current) {
        setUser(null)
        setProfile(null)
        setIsAuthenticated(false)
      }
      throw error
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }

  // 初始化认证状态
  useEffect(() => {
    if (!supabase || initializingRef.current) return

    initializingRef.current = true
    console.log('🔄 Initializing auth...')

    // 检查当前会话
    const checkSession = async () => {
      try {
        if (!supabase) {
          setIsAuthenticated(false)
          setLoading(false)
          return
        }

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('❌ Session check error:', error)
          setIsAuthenticated(false)
        } else if (session?.user) {
          // 验证session是否真的有效
          const isValid = await validateSession(session)
          if (isValid) {
            console.log('✅ Valid existing session found:', session.user.email)
            await handleAuthUser(session.user)
          } else {
            console.log('❌ Invalid session detected, clearing...')
            // 清除无效session
            await supabase.auth.signOut()
            setIsAuthenticated(false)
          }
        } else {
          console.log('ℹ️ No existing session')
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('❌ Session initialization error:', error)
        setIsAuthenticated(false)
      } finally {
        if (mountedRef.current) {
          sessionCheckedRef.current = true
          setLoading(false)
        }
      }
    }

    // 验证session有效性
    const validateSession = async (session: any): Promise<boolean> => {
      try {
        if (!supabase) {
          console.log('❌ Supabase client not available')
          return false
        }

        // 检查token是否过期
        if (session.expires_at && session.expires_at * 1000 < Date.now()) {
          console.log('❌ Session expired')
          return false
        }

        // 尝试获取用户信息来验证session
        const { data: user, error } = await supabase.auth.getUser()
        if (error || !user.user) {
          console.log('❌ Session validation failed:', error?.message)
          return false
        }

        return true
      } catch (error) {
        console.log('❌ Session validation error:', error)
        return false
      }
    }

    checkSession()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email)
        
        // 只有在初始会话检查完成后才处理状态变化
        if (!sessionCheckedRef.current && event !== 'INITIAL_SESSION') {
          return
        }
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user && mountedRef.current) {
              await handleAuthUser(session.user)
            }
            break
            
          case 'SIGNED_OUT':
            if (mountedRef.current) {
              console.log('🔄 User signed out')
              setUser(null)
              setProfile(null)
              setIsAuthenticated(false)
            }
            break
            
          case 'TOKEN_REFRESHED':
            if (session?.user && mountedRef.current) {
              console.log('🔄 Token refreshed')
              await handleAuthUser(session.user)
            }
            break
        }
        
        if (mountedRef.current && sessionCheckedRef.current) {
          setLoading(false)
        }
      }
    )

    // 清理函数
    return () => {
      subscription.unsubscribe()
      initializingRef.current = false
    }
  }, [])

  // 组件卸载清理
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isLoading,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    setProfile,
    setUser,
    fetchProfile,
    refreshSession,
    getAccessToken
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { safeSignOut } from '@/lib/auth-utils'
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
        console.log('✅ Profile loaded:', data.email)
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

      const { data, error } = await supabase
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

  // 处理认证用户
  const handleAuthUser = async (authUser: SupabaseUser) => {
    if (!mountedRef.current) return

    const appUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'User',
      role: authUser.email === 'admin@test.edu.cn' ? 'admin' : 'user',
      created_at: authUser.created_at,
      updated_at: authUser.updated_at || authUser.created_at,
      avatar_url: authUser.user_metadata?.avatar_url
    }

    console.log('🔄 Setting authenticated user:', appUser.email)
    
    // 原子性地更新所有认证状态
    setUser(appUser)
    setIsAuthenticated(true)
    
    // 异步获取用户资料，但不阻塞认证状态
    setTimeout(() => {
      fetchProfile(authUser.id)
    }, 100)
  }

  // 登录
  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('数据库连接不可用')
    }

    console.log('🔄 Attempting sign in for:', email)
    
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      })
      
      if (error) {
        console.error('❌ Sign in error:', error)
        // 提供更友好的错误信息
        if (error.message === 'Invalid login credentials') {
          throw new Error('登录失败：邮箱或密码错误。请检查邮箱和密码是否正确，或联系管理员重置密码。')
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('请先验证您的邮箱，检查邮件并点击验证链接')
        } else if (error.message.includes('Too many requests')) {
          throw new Error('登录尝试次数过多，请稍后再试')
        } else if (error.message.includes('Account not found')) {
          throw new Error('账户不存在，请先注册或检查邮箱地址')
        } else {
          throw new Error(error.message || '登录失败，请重试')
        }
      }

      if (data.user) {
        console.log('✅ Sign in successful:', email)
        await handleAuthUser(data.user)
      } else {
        throw new Error('登录异常，请重试')
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
      
      // 首先尝试注册
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: username
          }
        }
      })
      
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
        
        // 如果需要邮箱验证
        if (!data.user.email_confirmed_at) {
          console.log('📧 Email confirmation required for:', email)
          throw new Error('注册成功！请检查您的邮箱并点击验证链接完成注册。')
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
        } else if (session?.user) {
          console.log('✅ Existing session found:', session.user.email)
          await handleAuthUser(session.user)
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

    checkSession()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
    refreshSession
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

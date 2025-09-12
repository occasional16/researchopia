/**
 * 认证工具函数
 * 提供健壮的会话管理和错误处理
 */

import { supabase } from '@/lib/supabase'

/**
 * 安全地获取当前会话
 * @returns 会话信息或null
 */
export async function getSafeSession() {
  if (!supabase) {
    console.warn('Supabase client not available')
    return null
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.warn('Session check error:', error.message)
      return null
    }
    
    return session
  } catch (error) {
    console.warn('Failed to get session:', error)
    return null
  }
}

/**
 * 安全地获取当前用户
 * @returns 用户信息或null
 */
export async function getSafeUser() {
  if (!supabase) {
    console.warn('Supabase client not available')
    return null
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.warn('User check error:', error.message)
      return null
    }
    
    return user
  } catch (error) {
    console.warn('Failed to get user:', error)
    return null
  }
}

/**
 * 安全地执行登出操作
 * @returns 是否成功登出
 */
export async function safeSignOut(): Promise<boolean> {
  if (!supabase) {
    console.warn('Supabase client not available, only local cleanup')
    return true // 认为本地清理就算成功
  }

  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.warn('Server sign out error:', error.message)
      return false
    }
    
    return true
  } catch (error) {
    console.warn('Failed to sign out:', error)
    return false
  }
}

/**
 * 检查用户是否有有效的认证会话
 * @returns 布尔值表示是否已认证
 */
export async function isValidSession(): Promise<boolean> {
  const session = await getSafeSession()
  return session !== null && session.access_token !== undefined
}
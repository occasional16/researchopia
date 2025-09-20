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
    // 清除本地存储
    clearLocalAuthData()
    return true // 认为本地清理就算成功
  }

  try {
    // 强制登出所有会话
    const { error } = await supabase.auth.signOut({ scope: 'global' })

    if (error) {
      console.warn('Server sign out error:', error.message)
    }

    // 无论服务器登出是否成功，都要清除本地数据
    clearLocalAuthData()

    // 强制刷新页面以确保状态完全清除（可选）
    if (typeof window !== 'undefined') {
      // 清除所有相关的localStorage和sessionStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
            localStorage.removeItem(key)
          }
        })
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
            sessionStorage.removeItem(key)
          }
        })
      } catch (storageError) {
        console.warn('Failed to clear storage:', storageError)
      }
    }

    return true
  } catch (error) {
    console.warn('Failed to sign out:', error)
    // 即使出错也要清除本地数据
    clearLocalAuthData()
    return false
  }
}

/**
 * 清除本地认证数据
 */
function clearLocalAuthData() {
  if (typeof window !== 'undefined') {
    try {
      // 清除Supabase相关的存储
      localStorage.removeItem('supabase.auth.token')
      sessionStorage.removeItem('supabase.auth.token')

      // 清除所有包含认证信息的存储项
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))

      // 清除sessionStorage中的认证数据
      const sessionKeysToRemove = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          sessionKeysToRemove.push(key)
        }
      }
      sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key))

      console.log('✅ Local auth data cleared')
    } catch (error) {
      console.warn('Failed to clear local auth data:', error)
    }
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
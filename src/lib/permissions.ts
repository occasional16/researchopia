import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export interface UserPermissions {
  isAuthenticated: boolean
  isAdmin: boolean
  userId?: string
  username?: string
}

/**
 * 获取用户权限信息
 */
export async function getUserPermissions(request: NextRequest): Promise<UserPermissions> {
  try {
    // 尝试从请求头获取认证信息
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !supabase) {
      // 开发模式：直接返回未认证状态，不给予管理员权限
      return {
        isAuthenticated: false,
        isAdmin: false,
        userId: 'anonymous',
        username: '匿名用户'
      }
    }

    // 从JWT token获取用户信息
    const token = authHeader.replace('Bearer ', '')
    
    // 验证token并获取用户信息
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return {
        isAuthenticated: false,
        isAdmin: false
      }
    }

    // 从数据库获取用户详细信息，包括角色
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Failed to fetch user role:', userError)
      // 如果无法获取角色，默认为普通用户
      return {
        isAuthenticated: true,
        isAdmin: false,
        userId: user.id,
        username: user.email?.split('@')[0] || '用户'
      }
    }

    // 检查用户是否为管理员
    const isAdmin = (userData as any)?.role === 'admin'

    return {
      isAuthenticated: true,
      isAdmin,
      userId: user.id,
      username: (userData as any)?.username || user.email?.split('@')[0] || '用户'
    }
    
  } catch (error) {
    console.error('Permission check error:', error)
    return {
      isAuthenticated: false,
      isAdmin: false
    }
  }
}

/**
 * 检查用户是否可以编辑指定报道
 */
export async function canUserEditReport(
  reportId: string, 
  userPermissions: UserPermissions
): Promise<boolean> {
  if (!userPermissions.isAuthenticated) {
    return false
  }

  // 管理员可以编辑所有报道
  if (userPermissions.isAdmin) {
    return true
  }

  if (!supabase || !userPermissions.userId) {
    // 没有数据库连接或用户ID时，拒绝操作
    return false
  }

  try {
    // 检查报道是否由当前用户创建
    const { data: report, error } = await supabase
      .from('paper_reports')
      .select('created_by')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return false
    }

    return (report as any).created_by === userPermissions.userId
  } catch (error) {
    console.error('Edit permission check error:', error)
    return false
  }
}

/**
 * 检查用户是否可以删除指定报道
 */
export async function canUserDeleteReport(
  reportId: string, 
  userPermissions: UserPermissions
): Promise<boolean> {
  // 删除权限与编辑权限相同
  return canUserEditReport(reportId, userPermissions)
}
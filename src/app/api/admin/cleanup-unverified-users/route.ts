import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 管理员权限检查
async function checkAdminAuth(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return { isAdmin: false, user: null }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let accessToken = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    if (!accessToken) {
      const cookieHeader = request.headers.get('cookie') || ''
      const sessionMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)
      if (sessionMatch) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(sessionMatch[1]))
          accessToken = sessionData.access_token
        } catch {}
      }
    }

    if (!accessToken) {
      return { isAdmin: false, user: null }
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    if (error || !user) {
      return { isAdmin: false, user: null }
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    return {
      isAdmin: (profile as any)?.role === 'admin',
      user
    }
  } catch {
    return { isAdmin: false, user: null }
  }
}

/**
 * 清理未验证邮箱的用户
 * 删除超过指定天数未验证的用户
 */
export async function POST(request: NextRequest) {
  try {
    // 检查管理员权限
    const { isAdmin } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '需要管理员权限' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: '服务器配置错误' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取请求参数
    const body = await request.json().catch(() => ({}))
    const daysOld = body.daysOld || 7 // 默认删除7天前未验证的用户
    const dryRun = body.dryRun !== false // 默认为测试模式

    // 计算截止时间
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    const cutoffISOString = cutoffDate.toISOString()

    console.log(`🔍 查找 ${daysOld} 天前未验证的用户 (截止: ${cutoffISOString})`)

    // 1. 从 auth.users 获取未验证用户列表
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('获取用户列表失败:', authError)
      return NextResponse.json(
        { success: false, message: '获取用户列表失败' },
        { status: 500 }
      )
    }

    // 过滤出未验证且超过指定天数的用户
    const unverifiedUsers = authUsers.users.filter(user => {
      const isUnverified = !user.email_confirmed_at
      const isOld = new Date(user.created_at) < cutoffDate
      return isUnverified && isOld
    })

    console.log(`📊 找到 ${unverifiedUsers.length} 个待清理的未验证用户`)

    if (unverifiedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要清理的用户',
        deletedCount: 0,
        dryRun
      })
    }

    // 如果是测试模式，只返回统计信息
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `测试模式：发现 ${unverifiedUsers.length} 个可清理的用户`,
        users: unverifiedUsers.map(u => ({
          id: u.id,
          email: u.email,
          createdAt: u.created_at
        })),
        deletedCount: 0,
        dryRun: true
      })
    }

    // 2. 实际删除用户
    let deletedCount = 0
    const errors: any[] = []

    for (const user of unverifiedUsers) {
      try {
        // 删除用户（会级联删除 public.users 中的记录）
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)

        if (deleteError) {
          console.error(`❌ 删除用户失败 ${user.email}:`, deleteError)
          errors.push({ userId: user.id, email: user.email, error: deleteError.message })
        } else {
          console.log(`✅ 已删除未验证用户: ${user.email}`)
          deletedCount++
        }
      } catch (error) {
        console.error(`❌ 删除用户异常 ${user.email}:`, error)
        errors.push({ userId: user.id, email: user.email, error: String(error) })
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功清理 ${deletedCount} 个未验证用户`,
      deletedCount,
      totalFound: unverifiedUsers.length,
      errors: errors.length > 0 ? errors : undefined,
      dryRun: false
    })

  } catch (error) {
    console.error('清理未验证用户失败:', error)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * 获取未验证用户统计信息
 */
export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const { isAdmin } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: '需要管理员权限' },
        { status: 403 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: '服务器配置错误' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取所有用户
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('获取用户列表失败:', authError)
      return NextResponse.json(
        { success: false, message: '获取用户列表失败' },
        { status: 500 }
      )
    }

    // 统计未验证用户
    const now = new Date()
    const stats = {
      total: authUsers.users.length,
      verified: 0,
      unverified: 0,
      unverifiedOld: 0, // 超过7天未验证
      unverifiedDetails: [] as any[]
    }

    authUsers.users.forEach(user => {
      if (user.email_confirmed_at) {
        stats.verified++
      } else {
        stats.unverified++
        const daysSinceCreation = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSinceCreation > 7) {
          stats.unverifiedOld++
        }

        stats.unverifiedDetails.push({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          daysSinceCreation
        })
      }
    })

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('获取统计信息失败:', error)
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 检查用户是否为管理员
async function checkAdminAuth(request: NextRequest) {
  try {
    if (!supabase) {
      return { isAdmin: false, user: null }
    }

    let accessToken = null

    // 方法1: 从Authorization header获取token
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7)
    }

    // 方法2: 从cookie中获取Supabase session
    if (!accessToken) {
      const cookieHeader = request.headers.get('cookie') || ''
      const sessionMatch = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/)

      if (sessionMatch) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(sessionMatch[1]))
          accessToken = sessionData.access_token
        } catch (parseError) {
          console.log('Failed to parse session cookie:', parseError)
        }
      }
    }

    if (!accessToken) {
      return { isAdmin: false, user: null }
    }

    // 验证token并获取用户信息
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)
    if (error || !user) {
      console.log('Token validation failed:', error?.message)
      return { isAdmin: false, user: null }
    }

    // 从users表获取用户角色
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, username')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.log('Profile fetch failed:', profileError?.message)
      return { isAdmin: false, user: null }
    }

    return {
      isAdmin: (profile as any).role === 'admin',
      user: {
        id: user.id,
        username: (profile as any).username,
        email: user.email
      }
    }
  } catch (error) {
    console.error('Admin auth check failed:', error)
    return { isAdmin: false, user: null }
  }
}

// 默认公告数据（仅在Supabase不可用时使用）
const defaultAnnouncements = [
  {
    id: '1',
    title: '欢迎使用研学港！',
    content: '研学港是一个开放的学术交流平台，致力于突破传统的信息获取方式，实现用户之间随时随地的分享和交流！',
    type: 'info',
    is_active: true,
    created_by: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    title: '系统维护通知',
    content: '系统将于本周日凌晨2:00-4:00进行例行维护，期间可能会影响部分功能的使用，请提前做好准备。',
    type: 'warning',
    is_active: true,
    created_by: 'admin',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString()
  }
]

// GET - 获取公告列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10')

    // 优先使用Supabase
    if (supabase) {
      try {
        let query = supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })

        if (activeOnly) {
          query = query.eq('is_active', true)
        }

        if (limit > 0) {
          query = query.limit(limit)
        }

        const { data, error } = await query

        if (!error && data) {
          return NextResponse.json({
            success: true,
            data: data,
            source: 'supabase'
          }, {
            headers: {
              // 公告数据变化不频繁,使用较长缓存时间
              'Cache-Control': 'public, s-maxage=1800, max-age=600, stale-while-revalidate=3600',
              'CDN-Cache-Control': 'public, s-maxage=3600'
            }
          })
        }

        console.log('Supabase query failed:', error)
      } catch (supabaseError) {
        console.log('Supabase connection failed:', supabaseError)
      }
    }

    // 回退到默认公告数据
    let filteredAnnouncements = [...defaultAnnouncements]

    // 过滤激活状态
    if (activeOnly) {
      filteredAnnouncements = filteredAnnouncements.filter(a => a.is_active)
    }

    // 按创建时间排序（最新的在前）
    filteredAnnouncements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 限制数量
    if (limit > 0) {
      filteredAnnouncements = filteredAnnouncements.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      data: filteredAnnouncements,
      source: 'fallback'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, max-age=600, stale-while-revalidate=3600',
        'CDN-Cache-Control': 'public, s-maxage=3600'
      }
    })
  } catch (error) {
    console.error('Error in GET /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - 创建新公告（仅管理员）
export async function POST(request: NextRequest) {
  try {
    // 检查管理员权限
    const { isAdmin, user } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, content, type = 'info', is_active = true } = body

    // 验证必填字段
    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: 'Title and content are required' },
        { status: 400 }
      )
    }

    // 验证类型
    const validTypes = ['info', 'warning', 'success', 'error']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid announcement type' },
        { status: 400 }
      )
    }

    // 创建新公告数据
    const newAnnouncementData = {
      title: title.trim(),
      content: content.trim(),
      type,
      is_active,
      created_by: user?.username || 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 优先使用Supabase
    if (supabase) {
      try {
        const { data, error } = await (supabase as any)
          .from('announcements')
          .insert([newAnnouncementData])
          .select()
          .single()

        if (!error && data) {
          return NextResponse.json({
            success: true,
            data: data,
            message: 'Announcement created successfully',
            source: 'supabase'
          })
        }

        console.log('Supabase insert failed:', error)
      } catch (supabaseError) {
        console.log('Supabase connection failed:', supabaseError)
      }
    }

    // 如果Supabase不可用，返回错误（不允许在内存中创建）
    return NextResponse.json(
      { success: false, message: 'Database unavailable. Cannot create announcement.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Error in POST /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - 更新公告（仅管理员）
export async function PUT(request: NextRequest) {
  try {
    // 检查管理员权限
    const { isAdmin } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, title, content, type, is_active } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Announcement ID is required' },
        { status: 400 }
      )
    }

    // 准备更新数据
    const updates: any = {
      updated_at: new Date().toISOString()
    }
    if (title !== undefined) updates.title = title.trim()
    if (content !== undefined) updates.content = content.trim()
    if (type !== undefined) updates.type = type
    if (is_active !== undefined) updates.is_active = is_active

    // 优先使用Supabase
    if (supabase) {
      try {
        const { data, error } = await (supabase as any)
          .from('announcements')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (!error && data) {
          return NextResponse.json({
            success: true,
            data: data,
            message: 'Announcement updated successfully',
            source: 'supabase'
          })
        }

        if (error && error.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, message: 'Announcement not found' },
            { status: 404 }
          )
        }

        console.log('Supabase update failed:', error)
      } catch (supabaseError) {
        console.log('Supabase connection failed:', supabaseError)
      }
    }

    // 如果Supabase不可用，返回错误
    return NextResponse.json(
      { success: false, message: 'Database unavailable. Cannot update announcement.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Error in PUT /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - 删除公告（仅管理员）
export async function DELETE(request: NextRequest) {
  try {
    // 检查管理员权限
    const { isAdmin } = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Announcement ID is required' },
        { status: 400 }
      )
    }

    // 优先使用Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('announcements')
          .delete()
          .eq('id', id)

        if (!error) {
          return NextResponse.json({
            success: true,
            message: 'Announcement deleted successfully',
            source: 'supabase'
          })
        }

        if (error && error.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, message: 'Announcement not found' },
            { status: 404 }
          )
        }

        console.log('Supabase delete failed:', error)
      } catch (supabaseError) {
        console.log('Supabase connection failed:', supabaseError)
      }
    }

    // 如果Supabase不可用，返回错误
    return NextResponse.json(
      { success: false, message: 'Database unavailable. Cannot delete announcement.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Error in DELETE /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

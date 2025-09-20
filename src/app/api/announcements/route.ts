import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase: any = null
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey)
}

// 临时内存存储，用于本地开发
let announcements = [
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
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1天前
    updated_at: new Date(Date.now() - 86400000).toISOString()
  }
]

// GET - 获取公告列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const limit = parseInt(searchParams.get('limit') || '10')

    // 尝试使用Supabase，如果失败则使用内存存储
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
            data: data
          })
        }

        console.log('Supabase query failed, falling back to memory storage:', error)
      } catch (supabaseError) {
        console.log('Supabase connection failed, using memory storage:', supabaseError)
      }
    }

    // 回退到内存存储
    let filteredAnnouncements = [...announcements]

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
      data: filteredAnnouncements
    })
  } catch (error) {
    console.error('Error in GET /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - 创建新公告
export async function POST(request: NextRequest) {
  try {
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

    // 创建新公告
    const newAnnouncement = {
      id: Date.now().toString(), // 简单的ID生成
      title: title.trim(),
      content: content.trim(),
      type,
      is_active,
      created_by: 'admin', // 临时硬编码
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // 添加到内存存储
    announcements.unshift(newAnnouncement) // 添加到开头

    return NextResponse.json({
      success: true,
      data: newAnnouncement,
      message: 'Announcement created successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - 更新公告
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, title, content, type, is_active } = body

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Announcement ID is required' },
        { status: 400 }
      )
    }

    // 查找并更新公告
    const announcementIndex = announcements.findIndex(a => a.id === id)
    if (announcementIndex === -1) {
      return NextResponse.json(
        { success: false, message: 'Announcement not found' },
        { status: 404 }
      )
    }

    const announcement = announcements[announcementIndex]

    // 更新字段
    if (title !== undefined) announcement.title = title.trim()
    if (content !== undefined) announcement.content = content.trim()
    if (type !== undefined) announcement.type = type
    if (is_active !== undefined) announcement.is_active = is_active
    announcement.updated_at = new Date().toISOString()

    return NextResponse.json({
      success: true,
      data: announcement,
      message: 'Announcement updated successfully'
    })
  } catch (error) {
    console.error('Error in PUT /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - 删除公告
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Announcement ID is required' },
        { status: 400 }
      )
    }

    // 查找并删除公告
    const announcementIndex = announcements.findIndex(a => a.id === id)
    if (announcementIndex === -1) {
      return NextResponse.json(
        { success: false, message: 'Announcement not found' },
        { status: 404 }
      )
    }

    announcements.splice(announcementIndex, 1)

    return NextResponse.json({
      success: true,
      message: 'Announcement deleted successfully'
    })
  } catch (error) {
    console.error('Error in DELETE /api/announcements:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

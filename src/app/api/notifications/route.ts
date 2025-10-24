import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/notifications
 * 获取当前用户的通知列表
 * 
 * Query参数:
 * - type: 通知类型过滤 (可选)
 * - is_read: 是否已读过滤 (可选)
 * - limit: 返回数量限制 (默认20)
 * - offset: 分页偏移量 (默认0)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isRead = searchParams.get('is_read')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 构建查询
    let query = supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id(
          id,
          username,
          avatar_url,
          real_name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 应用过滤
    if (type) {
      query = query.eq('type', type)
    }
    if (isRead !== null) {
      query = query.eq('is_read', isRead === 'true')
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Get notifications error:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // 获取未读数量
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({
      notifications,
      unread_count: unreadCount || 0
    }, {
      headers: {
        // 缓存策略: 用户特定数据,较短缓存时间
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=180',
        // Vary头确保不同用户不会获取到缓存的其他用户数据
        'Vary': 'Authorization'
      }
    })
  } catch (error: any) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications
 * 批量标记通知为已读
 * 
 * Body:
 * - notification_ids: 通知ID数组 (可选，不提供则标记全部为已读)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { notification_ids } = body

    let query = supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    // 如果提供了特定的通知ID，只更新这些通知
    if (notification_ids && Array.isArray(notification_ids)) {
      query = query.in('id', notification_ids)
    }

    const { error } = await query

    if (error) {
      console.error('Mark notifications as read error:', error)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Mark notifications as read error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


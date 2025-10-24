import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/users/[username]/activities
 * 获取指定用户的动态
 *
 * Query params:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - type: 活动类型过滤（可选）
 *
 * 返回: { activities: Activity[], total: number, page: number, limit: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // 可选的类型过滤
    const offset = (page - 1) * limit

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取目标用户
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取当前用户（如果已登录）
    let currentUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: currentUser } } = await supabase.auth.getUser(token)
      currentUserId = currentUser?.id || null
    }

    // 判断可见性权限
    const isOwner = currentUserId === targetUser.id
    let visibilityFilter: string[] = ['public']

    if (isOwner) {
      // 本人可以看到所有动态
      visibilityFilter = ['public', 'followers', 'private']
    } else if (currentUserId) {
      // 检查是否是关注者
      const { data: followData } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUser.id)
        .single()

      if (followData) {
        // 关注者可以看到public和followers动态
        visibilityFilter = ['public', 'followers']
      }
    }

    // 构建查询
    let query = supabase
      .from('user_activities')
      .select(`
        *,
        user:users!user_activities_user_id_fkey(
          id,
          username,
          real_name,
          avatar_url,
          institution,
          position
        ),
        paper:papers(
          id,
          title,
          doi,
          publication_year,
          authors
        ),
        target_user:users!user_activities_target_user_id_fkey(
          id,
          username,
          real_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('user_id', targetUser.id)
      .in('visibility', visibilityFilter)
      .order('created_at', { ascending: false })

    // 如果指定了类型过滤
    if (type) {
      query = query.eq('activity_type', type)
    }

    // 分页
    query = query.range(offset, offset + limit - 1)

    const { data: activities, error: activitiesError, count } = await query

    if (activitiesError) {
      throw activitiesError
    }

    return NextResponse.json({
      activities: activities || [],
      total: count || 0,
      page,
      limit
    })

  } catch (error) {
    console.error('Get user activities error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/activities/feed
 * 获取动态流
 *
 * Query params:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - type: 活动类型过滤（可选）
 * - mode: 模式（following/recommended/trending，默认following）
 *
 * 返回: { activities: Activity[], total: number, page: number, limit: number }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') // 可选的类型过滤
    const mode = searchParams.get('mode') || 'following' // following/recommended/trending
    const offset = (page - 1) * limit

    // 获取当前用户
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 验证token并获取当前用户
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // 根据模式构建不同的查询
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
          publication_date,
          authors
        ),
        target_user:users!user_activities_target_user_id_fkey(
          id,
          username,
          real_name,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('visibility', 'public')

    // 根据模式应用不同的过滤
    if (mode === 'following') {
      // 关注模式：只显示关注用户的动态
      const { data: followingData } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)

      const followingIds = followingData?.map(f => f.following_id) || []

      if (followingIds.length === 0) {
        return NextResponse.json({
          activities: [],
          total: 0,
          page,
          limit
        })
      }

      query = query.in('user_id', followingIds)
    } else if (mode === 'recommended') {
      // 推荐模式：基于用户的研究领域推荐
      // 获取当前用户的研究领域
      const { data: userData } = await supabase
        .from('users')
        .select('research_fields')
        .eq('id', currentUser.id)
        .single()

      if (userData?.research_fields && userData.research_fields.length > 0) {
        // 查找有相同研究领域的用户
        const { data: similarUsers } = await supabase
          .from('users')
          .select('id')
          .overlaps('research_fields', userData.research_fields)
          .neq('id', currentUser.id)
          .limit(50)

        const similarUserIds = similarUsers?.map(u => u.id) || []

        if (similarUserIds.length > 0) {
          query = query.in('user_id', similarUserIds)
        }
      }
    } else if (mode === 'trending') {
      // 热门模式：显示最近7天内的所有公开动态，按时间排序
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      query = query.gte('created_at', sevenDaysAgo.toISOString())
    }

    // 如果指定了类型过滤
    if (type) {
      query = query.eq('activity_type', type)
    }

    // 排序和分页
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

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

  } catch (error: any) {
    console.error('Get feed error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


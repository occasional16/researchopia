import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/users/[username]/following
 * 获取用户关注的人列表
 *
 * Query params:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 *
 * 返回: { following: User[], total: number, page: number, limit: number }
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

    // 获取关注列表（查询follower_id = targetUser.id的记录）
    const { data: followsData, error: followsError } = await supabase
      .from('user_follows')
      .select(`
        following_id,
        created_at,
        following:users!user_follows_following_id_fkey(
          id,
          username,
          email,
          real_name,
          avatar_url,
          institution,
          position,
          bio,
          followers_count,
          following_count
        )
      `)
      .eq('follower_id', targetUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (followsError) {
      throw followsError
    }

    // 获取总数
    const { count, error: countError } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUser.id)

    if (countError) {
      throw countError
    }

    // 格式化返回数据
    const following = followsData?.map((follow: any) => ({
      ...follow.following,
      followed_at: follow.created_at
    })) || []

    return NextResponse.json({
      following,
      total: count || 0,
      page,
      limit
    })

  } catch (error) {
    console.error('Get following error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


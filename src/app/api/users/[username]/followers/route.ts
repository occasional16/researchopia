import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

/**
 * GET /api/users/[username]/followers
 * 获取用户的关注者列表
 *
 * Query params:
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 *
 * 返回: { followers: User[], total: number, page: number, limit: number }
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

    const supabase = getSupabaseAdmin()

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

    // 获取关注者列表（查询following_id = targetUser.id的记录）
    const { data: followsData, error: followsError } = await supabase
      .from('user_follows')
      .select(`
        follower_id,
        created_at,
        follower:users!user_follows_follower_id_fkey(
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
      .eq('following_id', targetUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (followsError) {
      throw followsError
    }

    // 获取总数
    const { count, error: countError } = await supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUser.id)

    if (countError) {
      throw countError
    }

    // 格式化返回数据
    const followers = followsData?.map((follow: any) => ({
      ...follow.follower,
      followed_at: follow.created_at
    })) || []

    return NextResponse.json({
      followers,
      total: count || 0,
      page,
      limit
    })

  } catch (error) {
    console.error('Get followers error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


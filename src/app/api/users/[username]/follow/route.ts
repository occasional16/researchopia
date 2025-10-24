import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/users/[username]/follow
 * 关注或取消关注用户
 * 
 * Body: { action: 'follow' | 'unfollow' }
 * 
 * 返回: { success: true, isFollowing: boolean, followersCount: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const { action } = await request.json()

    // 验证action参数
    if (!action || !['follow', 'unfollow'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "follow" or "unfollow"' },
        { status: 400 }
      )
    }

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

    // 不能关注自己
    if (currentUser.id === targetUser.id) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      )
    }

    if (action === 'follow') {
      // 关注用户
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({
          follower_id: currentUser.id,
          following_id: targetUser.id
        })

      if (followError) {
        // 如果已经关注，返回错误
        if (followError.code === '23505') { // unique violation
          return NextResponse.json(
            { error: 'Already following this user' },
            { status: 400 }
          )
        }
        throw followError
      }

      // 获取更新后的粉丝数
      const { data: updatedUser } = await supabase
        .from('users')
        .select('followers_count')
        .eq('id', targetUser.id)
        .single()

      return NextResponse.json({
        success: true,
        isFollowing: true,
        followersCount: updatedUser?.followers_count || 0
      })

    } else {
      // 取消关注
      const { error: unfollowError } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', targetUser.id)

      if (unfollowError) {
        throw unfollowError
      }

      // 获取更新后的粉丝数
      const { data: updatedUser } = await supabase
        .from('users')
        .select('followers_count')
        .eq('id', targetUser.id)
        .single()

      return NextResponse.json({
        success: true,
        isFollowing: false,
        followersCount: updatedUser?.followers_count || 0
      })
    }

  } catch (error) {
    console.error('Follow/Unfollow error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

// 🔥 优化: 用户资料缓存5分钟 - 个人信息不频繁更新
export const revalidate = 300;

// GET /api/users/[username]/profile - 获取用户资料
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    
    // 使用service role key以绕过RLS
    const supabase = getSupabaseAdmin()

    // 获取用户基本信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取统计信息
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('username', username)
      .single()

    // 检查当前用户身份
    const authHeader = request.headers.get('authorization')
    let currentUserId: string | null = null
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: currentUser } } = await supabase.auth.getUser(token)
      currentUserId = currentUser?.id || null
    }

    // 判断是否是本人
    const isOwner = currentUserId === user.id

    // 根据隐私设置过滤数据
    const isPublic = user.profile_visibility === 'public'
    
    if (!isPublic && !isOwner) {
      // 检查是否是关注者
      if (user.profile_visibility === 'followers' && currentUserId) {
        const { data: followData } = await supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', user.id)
          .single()
        
        if (!followData) {
          return NextResponse.json(
            { error: 'Profile is private' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Profile is private' },
          { status: 403 }
        )
      }
    }

    // 检查是否关注
    let isFollowing = false
    if (currentUserId && currentUserId !== user.id) {
      const { data: followData } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', user.id)
        .single()
      
      isFollowing = !!followData
    }

    // 过滤敏感信息
    const profile = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at,
      
      // 学术身份
      real_name: user.real_name,
      institution: user.show_institution || isOwner ? user.institution : null,
      department: user.department,
      position: user.position,
      research_fields: user.research_fields || [],
      
      // 学术标识
      orcid: user.orcid,
      google_scholar_id: user.google_scholar_id,
      researchgate_id: user.researchgate_id,
      
      // 个人信息
      bio: user.bio,
      website: user.website,
      location: user.location,
      
      // 隐私设置（只有本人可见）
      email: user.show_email || isOwner ? user.email : null,
      profile_visibility: isOwner ? user.profile_visibility : null,
      show_email: isOwner ? user.show_email : null,
      show_institution: isOwner ? user.show_institution : null,
      
      // 统计信息 - 确保所有字段都有默认值
      stats: {
        papers_count: stats?.papers_count ?? 0,
        annotations_count: stats?.annotations_count ?? 0,
        comments_count: stats?.comments_count ?? 0,
        ratings_count: stats?.ratings_count ?? 0,
        favorites_count: stats?.favorites_count ?? 0,
        followers_count: stats?.followers_count ?? user.followers_count ?? 0,
        following_count: stats?.following_count ?? user.following_count ?? 0,
        avg_rating: stats?.avg_rating ?? 0,
        quality_annotations_count: stats?.quality_annotations_count ?? 0
      },
      
      // 关系状态
      isOwner,
      isFollowing
    }

    return NextResponse.json({ 
      success: true, 
      profile 
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/users/[username]/profile - 更新用户资料
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = getSupabaseAdmin()

    // 验证用户身份
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取目标用户
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 验证是否是本人
    if (currentUser.id !== targetUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 解析请求体
    const body = await request.json()
    const {
      real_name,
      institution,
      department,
      position,
      research_fields,
      orcid,
      google_scholar_id,
      researchgate_id,
      bio,
      website,
      location,
      profile_visibility,
      show_email,
      show_institution
    } = body

    // 构建更新对象（只更新提供的字段）
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (real_name !== undefined) updateData.real_name = real_name
    if (institution !== undefined) updateData.institution = institution
    if (department !== undefined) updateData.department = department
    if (position !== undefined) updateData.position = position
    if (research_fields !== undefined) updateData.research_fields = research_fields
    if (orcid !== undefined) updateData.orcid = orcid
    if (google_scholar_id !== undefined) updateData.google_scholar_id = google_scholar_id
    if (researchgate_id !== undefined) updateData.researchgate_id = researchgate_id
    if (bio !== undefined) updateData.bio = bio
    if (website !== undefined) updateData.website = website
    if (location !== undefined) updateData.location = location
    if (profile_visibility !== undefined) updateData.profile_visibility = profile_visibility
    if (show_email !== undefined) updateData.show_email = show_email
    if (show_institution !== undefined) updateData.show_institution = show_institution

    // 更新用户资料
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', currentUser.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      profile: updatedUser 
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


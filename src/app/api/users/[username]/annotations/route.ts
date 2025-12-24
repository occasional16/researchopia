import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

/**
 * GET /api/users/[username]/annotations
 * 获取用户的标注
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, annotations: Annotation[], total: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = getSupabaseAdmin()
    
    // 获取当前登录用户
    const authHeader = request.headers.get('Authorization')
    let currentUserId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user: authUser } } = await supabase.auth.getUser(token)
      currentUserId = authUser?.id || null
    }

    // 获取目标用户ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // 判断是否查询自己的标注
    const isOwnProfile = currentUserId === user.id

    // 获取用户的标注（通过documents关联到papers）
    let annotationsQuery = supabase
      .from('annotations')
      .select(`
        id,
        content,
        comment,
        position,
        color,
        tags,
        visibility,
        show_author_name,
        created_at,
        updated_at,
        user_id,
        users!inner (
          id,
          username,
          display_name
        ),
        documents (
          id,
          doi,
          title,
          authors,
          journal,
          paper_id,
          papers (
            id,
            doi,
            title,
            authors,
            journal
          )
        )
      `)
      .eq('user_id', user.id)
    
    // 如果不是查询自己,只返回public标注
    if (!isOwnProfile) {
      annotationsQuery = annotationsQuery.eq('visibility', 'public')
    }
    
    const { data: annotations, error: annotationsError } = await annotationsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (annotationsError) {
      throw annotationsError
    }

    // 获取总数
    let countQuery = supabase
      .from('annotations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    
    if (!isOwnProfile) {
      countQuery = countQuery.eq('visibility', 'public')
    }
    
    const { count } = await countQuery

    return NextResponse.json({
      success: true,
      annotations: annotations || [],
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching user annotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

/**
 * GET /api/users/[username]/annotation-comments
 * 获取用户的标注评论
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, comments: AnnotationComment[], total: number }
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

    // 获取用户ID
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

    // 获取用户的标注评论
    const { data: comments, error: commentsError } = await supabase
      .from('annotation_comments')
      .select(`
        id,
        annotation_id,
        parent_id,
        content,
        is_anonymous,
        created_at,
        updated_at,
        annotations (
          id,
          content,
          comment,
          type,
          document_id,
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
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (commentsError) {
      throw commentsError
    }

    // 获取总数
    const { count } = await supabase
      .from('annotation_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      comments: comments || [],
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching annotation comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


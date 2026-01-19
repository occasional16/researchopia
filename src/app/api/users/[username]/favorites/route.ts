import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

/**
 * GET /api/users/[username]/favorites
 * 获取用户收藏的论文
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, favorites: Paper[], total: number }
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

    // 获取用户收藏的论文
    const { data: favorites, error: favoritesError } = await supabase
      .from('paper_bookmark_items')
      .select(`
        id,
        created_at,
        papers (
          id,
          doi,
          title,
          authors,
          abstract,
          publication_date,
          journal,
          keywords,
          view_count,
          comments_count,
          ratings_count,
          average_rating,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (favoritesError) {
      throw favoritesError
    }

    // 提取论文数据
    const papers = favorites?.map(f => ({
      ...f.papers,
      favorited_at: f.created_at
    })) || []

    // 获取总数
    const { count } = await supabase
      .from('paper_bookmark_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      favorites: papers,
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching user favorites:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


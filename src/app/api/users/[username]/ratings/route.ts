import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/users/[username]/ratings
 * 获取用户的评分
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, ratings: Rating[], total: number }
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    // 获取用户的评分
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select(`
        id,
        paper_id,
        innovation_score,
        methodology_score,
        practicality_score,
        overall_score,
        is_anonymous,
        show_username,
        created_at,
        updated_at,
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
          average_rating
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (ratingsError) {
      throw ratingsError
    }

    // 获取总数
    const { count } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      ratings: ratings || [],
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching user ratings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'

/**
 * GET /api/users/[username]/papers
 * 获取用户相关的论文（评分过的、评论过的、收藏的）
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, papers: Paper[], total: number }
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
      .select('id')
      .eq('username', username)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取用户评分过的论文
    const { data: ratedPapers, error: ratedError } = await supabase
      .from('ratings')
      .select(`
        paper_id,
        score,
        created_at,
        papers (
          id,
          doi,
          title,
          authors,
          abstract,
          publication_date,
          journal,
          citations_count,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (ratedError) {
      throw ratedError
    }

    // 提取论文数据并添加评分信息
    const papersData = ratedPapers
      ?.map(r => ({
        ...r.papers,
        user_rating: r.score,
        rated_at: r.created_at
      }))
      .filter(p => p !== null) || []

    // 获取总数
    const { count } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      papers: papersData,
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching user papers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


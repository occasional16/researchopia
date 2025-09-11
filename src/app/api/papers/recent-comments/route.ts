import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 获取最新评论，并包含论文信息
    const { data: recentComments, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        paper_id,
        papers!inner (
          id,
          title,
          authors,
          doi,
          journal,
          created_at
        ),
        users (
          username
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit * 3) // 获取更多数据以防某些论文重复

    if (error) {
      console.error('Error fetching recent comments:', error)
      return NextResponse.json({ 
        error: 'Database error' 
      }, { status: 500 })
    }

    // 去重：每个论文只保留最新的一条评论
    const uniquePapers = new Map()
    const result = []

    for (const comment of recentComments || []) {
      if (!uniquePapers.has(comment.paper_id) && result.length < limit) {
        uniquePapers.set(comment.paper_id, true)
        
        // 获取该论文的评论数量
        const { count: commentCount } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('paper_id', comment.paper_id)

        // 获取该论文的评分统计
        const { data: ratings } = await supabase
          .from('ratings')
          .select('overall_score')
          .eq('paper_id', comment.paper_id)

        let averageRating = 0
        if (ratings && ratings.length > 0) {
          const totalScore = ratings.reduce((sum, rating) => sum + rating.overall_score, 0)
          averageRating = Math.round((totalScore / ratings.length) * 10) / 10
        }

        result.push({
          ...comment.papers,
          latest_comment: {
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            user: comment.users
          },
          comment_count: commentCount || 0,
          rating_count: ratings?.length || 0,
          average_rating: averageRating
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error fetching papers with recent comments:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch papers with recent comments',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

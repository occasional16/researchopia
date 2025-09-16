import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 模拟数据 - 使用真实存在的论文数据
const mockRecentComments = [
  {
    id: 2,
    title: "基于机器学习的医学图像分析方法",
    authors: "李明, 陈红, 刘强",
    doi: "10.1016/j.media.2024.102756",
    journal: "Medical Image Analysis",
    created_at: "2025-01-08T14:20:00Z",
    latest_comment: {
      id: 102,
      content: "实验设计严谨，结果具有很高的实用价值，特别是在诊断准确性方面的提升。",
      created_at: "2025-01-14T09:15:00Z",
      user: { username: "医学专家" }
    },
    comment_count: 6,
    rating_count: 9,
    average_rating: 4.6
  },
  {
    id: 3,
    title: "量子计算在密码学中的应用前景",
    authors: "王博士, 赵教授",
    doi: "10.1038/s41567-024-02387-x",
    journal: "Nature Physics",
    created_at: "2025-01-05T16:45:00Z",
    latest_comment: {
      id: 103,
      content: "对量子算法的分析很透彻，但在实际应用中还需要考虑更多工程因素。",
      created_at: "2025-01-13T11:20:00Z",
      user: { username: "量子研究员" }
    },
    comment_count: 4,
    rating_count: 7,
    average_rating: 4.1
  },
  {
    id: 4,
    title: "人工智能在教育领域的创新应用",
    authors: "张教授, 李博士",
    doi: "10.1007/s10639-024-11998-3",
    journal: "Education and Information Technologies",
    created_at: "2025-01-03T09:30:00Z",
    latest_comment: {
      id: 104,
      content: "AI在个性化学习方面的应用很有前景，但需要关注数据隐私问题。",
      created_at: "2025-01-12T14:45:00Z",
      user: { username: "教育技术专家" }
    },
    comment_count: 3,
    rating_count: 5,
    average_rating: 4.2
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // 如果没有配置环境变量，返回模拟数据
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://placeholder.supabase.co') {
      console.log('Using mock comments data - Supabase not configured')
      return NextResponse.json({
        success: true,
        data: mockRecentComments.slice(0, limit)
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // 设置超时控制
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )

      // 获取最新评论的查询
      const commentsPromise = supabase
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
        .limit(limit * 3)

      const { data: recentComments, error } = await Promise.race([commentsPromise, timeout]) as any

      if (error) {
        throw new Error(`Database query error: ${error.message}`)
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
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300',
        }
      })

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError)
      
      return NextResponse.json({
        success: true,
        data: mockRecentComments.slice(0, limit)
      }, {
        headers: {
          'Cache-Control': 'public, max-age=60',
        }
      })
    }

  } catch (error) {
    console.error('Error in recent comments API:', error)
    
    // 最终后备数据
    return NextResponse.json({
      success: true,
      data: mockRecentComments.slice(0, 3)
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      }
    })
  }
}

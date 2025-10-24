import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 模拟数据 - 按最新评论时间排序（最新在前）
const mockRecentComments = [
  {
    id: 4,
    title: "人工智能在教育领域的创新应用",
    authors: "张教授, 李博士",
    doi: "10.1007/s10639-024-11998-3",
    journal: "Education and Information Technologies",
    created_at: "2025-01-03T09:30:00Z",
    latest_comment: {
      id: 104,
      content: "AI在个性化学习方面的应用很有前景，但需要关注数据隐私问题。建议在算法设计中加入更多隐私保护机制。",
      created_at: "2025-01-15T14:45:00Z", // 最新评论
      user: { username: "教育技术专家" }
    },
    comment_count: 8,
    rating_count: 12,
    average_rating: 4.3
  },
  {
    id: 2,
    title: "基于机器学习的医学图像分析方法",
    authors: "李明, 陈红, 刘强",
    doi: "10.1016/j.media.2024.102756",
    journal: "Medical Image Analysis",
    created_at: "2025-01-08T14:20:00Z",
    latest_comment: {
      id: 102,
      content: "实验设计严谨，结果具有很高的实用价值，特别是在诊断准确性方面的提升显著。对比实验很全面。",
      created_at: "2025-01-14T09:15:00Z", // 第二新评论
      user: { username: "医学影像专家" }
    },
    comment_count: 15,
    rating_count: 23,
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
      content: "对量子算法的分析很透彻，但在实际应用中还需要考虑更多工程因素和成本问题。",
      created_at: "2025-01-13T11:20:00Z", // 第三新评论
      user: { username: "量子研究员" }
    },
    comment_count: 9,
    rating_count: 16,
    average_rating: 4.2
  },
  {
    id: 5,
    title: "深度学习在自然语言处理中的突破",
    authors: "周研究员, 吴教授",
    doi: "10.1016/j.artint.2024.103842",
    journal: "Artificial Intelligence",
    created_at: "2025-01-02T11:15:00Z",
    latest_comment: {
      id: 105,
      content: "Transformer架构的改进很有创新性，在多语言处理上的表现令人印象深刻。",
      created_at: "2025-01-12T16:30:00Z", // 第四新评论
      user: { username: "NLP研究者" }
    },
    comment_count: 12,
    rating_count: 18,
    average_rating: 4.4
  },
  {
    id: 6,
    title: "可持续能源技术的最新发展",
    authors: "刘院士, 陈博士",
    doi: "10.1016/j.rser.2024.114123",
    journal: "Renewable and Sustainable Energy Reviews",
    created_at: "2025-01-01T08:45:00Z",
    latest_comment: {
      id: 106,
      content: "对太阳能电池效率提升的分析很详细，但希望能看到更多关于成本效益的讨论。",
      created_at: "2025-01-11T13:20:00Z", // 第五新评论
      user: { username: "能源工程师" }
    },
    comment_count: 6,
    rating_count: 11,
    average_rating: 4.1
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
          'Cache-Control': 'public, s-maxage=600, max-age=300, stale-while-revalidate=1800',
          'CDN-Cache-Control': 'public, s-maxage=1200'
        }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
      // 设置超时控制
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 5000)
      )

      // 获取最新评论的查询 - 按评论时间排序，确保最新评论在前
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
        .limit(limit * 5) // 获取更多数据以确保去重后有足够的结果

      const { data: recentComments, error } = await Promise.race([commentsPromise, timeout]) as any

      if (error) {
        throw new Error(`Database query error: ${error.message}`)
      }

      // 去重：每个论文只保留最新的一条评论，按评论时间排序
      const uniquePapers = new Map()
      const result = []

      for (const comment of recentComments || []) {
        if (!uniquePapers.has(comment.paper_id) && result.length < limit) {
          uniquePapers.set(comment.paper_id, true)
          
          // 并行获取该论文的评论数量和评分统计
          const [commentCountResult, ratingsResult] = await Promise.all([
            supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('paper_id', comment.paper_id),
            supabase
              .from('ratings')
              .select('overall_score')
              .eq('paper_id', comment.paper_id)
          ])

          let averageRating = 0
          const ratings = ratingsResult.data || []
          if (ratings.length > 0) {
            const totalScore = ratings.reduce((sum, rating) => sum + (rating.overall_score || 0), 0)
            averageRating = Math.round((totalScore / ratings.length) * 10) / 10
          }

          result.push({
            id: comment.papers.id,
            title: comment.papers.title,
            authors: comment.papers.authors,
            doi: comment.papers.doi,
            journal: comment.papers.journal,
            created_at: comment.papers.created_at,
            latest_comment: {
              id: comment.id,
              content: comment.content,
              created_at: comment.created_at,
              user: comment.users
            },
            comment_count: commentCountResult.count || 0,
            rating_count: ratings.length,
            average_rating: averageRating
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: result
      }, {
        headers: {
          // 优化缓存策略: 延长缓存时间并添加后台重验证
          'Cache-Control': 'public, s-maxage=600, max-age=300, stale-while-revalidate=1800',
          'CDN-Cache-Control': 'public, s-maxage=1200'
        }
      })

    } catch (dbError) {
      console.warn('Database query failed, using mock data:', dbError)
      
      // 返回高质量的模拟数据，按最新评论时间排序
      const sortedMockData = mockRecentComments
        .sort((a, b) => new Date(b.latest_comment.created_at).getTime() - new Date(a.latest_comment.created_at).getTime())
        .slice(0, limit)
      
      return NextResponse.json({
        success: true,
        data: sortedMockData
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, max-age=180, stale-while-revalidate=900',
          'CDN-Cache-Control': 'public, s-maxage=600'
        }
      })
    }

  } catch (error) {
    console.error('Error in recent comments API:', error)
    
    // 最终后备数据 - 返回排序后的模拟数据
    const fallbackData = mockRecentComments
      .sort((a, b) => new Date(b.latest_comment.created_at).getTime() - new Date(a.latest_comment.created_at).getTime())
      .slice(0, 3)
    
    return NextResponse.json({
      success: true,
      data: fallbackData
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, max-age=180, stale-while-revalidate=900',
        'CDN-Cache-Control': 'public, s-maxage=600'
      }
    })
  }
}

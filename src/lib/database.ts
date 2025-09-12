import { fetchPaperByDOI } from './crossref'
import type { Paper, Rating, Comment } from './supabase'
import { supabase } from './supabase'

// Extended type for papers with statistics
interface PaperWithStats extends Paper {
  average_rating?: number
  rating_count?: number
  ratings?: Rating[]
  comments?: Comment[]
}

export async function getPapers(limit: number = 10, offset: number = 0): Promise<PaperWithStats[]> {
  return getPapersWithSort(limit, offset, 'newest')
}

export async function getPapersWithSort(
  limit: number = 10, 
  offset: number = 0, 
  sortBy: string = 'recent_comments'
): Promise<PaperWithStats[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  try {
    let query = supabase
      .from('papers')
      .select(`
        *,
        ratings(*),
        comments(*),
        paper_favorites(*)
      `)

    // 对于所有排序方式，我们都需要获取完整数据来进行内存排序
    // 这是因为 Supabase 不支持直接按计算字段（如平均评分、评论数量）排序

    const { data, error } = await query

    if (error) {
      console.error('Error fetching papers:', error)
      throw error
    }
      
    // Calculate stats for each paper
    let papersWithStats = (data || []).map((paper: any) => {
      const ratings = paper.ratings || []
      const comments = Array.isArray(paper.comments) ? paper.comments : []
      const favoriteCount = Array.isArray(paper.paper_favorites) ? paper.paper_favorites.length : 0
      
      let averageRating = 0
      if (ratings.length > 0) {
        const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
        averageRating = totalScore / ratings.length
      }

      // 获取最新评论时间
      const latestCommentTime = comments.length > 0 
        ? Math.max(...comments.map((c: any) => new Date(c.created_at).getTime()))
        : 0

      return {
        ...paper,
        ratings,
        rating_count: ratings.length,
        comment_count: comments.length,
        favorite_count: favoriteCount,
        average_rating: Math.round(averageRating * 10) / 10,
        latest_comment_time: latestCommentTime
      }
    })

    // 根据排序类型进行排序
    switch (sortBy) {
      case 'rating':
        // 评分最高：按平均评分降序，评分相同时按评分数量降序
        papersWithStats.sort((a, b) => {
          if (b.average_rating !== a.average_rating) {
            return b.average_rating - a.average_rating
          }
          return b.rating_count - a.rating_count
        })
        break
      case 'comments':
        // 评论最多：按评论数量降序，评论数相同时按最新评论时间降序
        papersWithStats.sort((a, b) => {
          if (b.comment_count !== a.comment_count) {
            return b.comment_count - a.comment_count
          }
          return b.latest_comment_time - a.latest_comment_time
        })
        break
      case 'recent_comments':
        // 最新评论：按最新评论时间降序，没有评论的论文按创建时间降序排在后面
        papersWithStats.sort((a, b) => {
          // 如果都有评论，按最新评论时间排序
          if (a.latest_comment_time > 0 && b.latest_comment_time > 0) {
            return b.latest_comment_time - a.latest_comment_time
          }
          // 如果只有一个有评论，有评论的排在前面
          if (a.latest_comment_time > 0 && b.latest_comment_time === 0) {
            return -1
          }
          if (a.latest_comment_time === 0 && b.latest_comment_time > 0) {
            return 1
          }
          // 如果都没有评论，按创建时间降序排序
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        break
      default:
        // 默认按最新评论排序
        papersWithStats.sort((a, b) => {
          if (a.latest_comment_time > 0 && b.latest_comment_time > 0) {
            return b.latest_comment_time - a.latest_comment_time
          }
          if (a.latest_comment_time > 0 && b.latest_comment_time === 0) {
            return -1
          }
          if (a.latest_comment_time === 0 && b.latest_comment_time > 0) {
            return 1
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
    }

    // 应用分页
    papersWithStats = papersWithStats.slice(offset, offset + limit)

    return papersWithStats
  } catch (error) {
    console.error('Error in getPapersWithSort:', error)
    
    // 如果paper_favorites查询失败，尝试不包含favorites的查询
    try {
      let fallbackQuery = supabase
        .from('papers')
        .select(`
          *,
          ratings(*),
          comments(*)
        `)

      const { data: fallbackData, error: fallbackError } = await fallbackQuery

      if (fallbackError) throw fallbackError

      console.warn('⚠️ Using fallback query without favorites')
      
      let papersWithStats = (fallbackData || []).map((paper: any) => {
        const ratings = paper.ratings || []
        const comments = Array.isArray(paper.comments) ? paper.comments : []
        
        let averageRating = 0
        if (ratings.length > 0) {
          const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
          averageRating = totalScore / ratings.length
        }

        const latestCommentTime = comments.length > 0 
          ? Math.max(...comments.map((c: any) => new Date(c.created_at).getTime()))
          : 0

        return {
          ...paper,
          ratings,
          rating_count: ratings.length,
          comment_count: comments.length,
          favorite_count: 0, // fallback时没有收藏数据
          average_rating: Math.round(averageRating * 10) / 10,
          latest_comment_time: latestCommentTime
        }
      })

      // 应用相同的排序逻辑
      switch (sortBy) {
        case 'rating':
          papersWithStats.sort((a, b) => {
            if (b.average_rating !== a.average_rating) {
              return b.average_rating - a.average_rating
            }
            return b.rating_count - a.rating_count
          })
          break
        case 'comments':
          papersWithStats.sort((a, b) => {
            if (b.comment_count !== a.comment_count) {
              return b.comment_count - a.comment_count
            }
            return b.latest_comment_time - a.latest_comment_time
          })
          break
        case 'recent_comments':
          papersWithStats.sort((a, b) => {
            if (a.latest_comment_time > 0 && b.latest_comment_time > 0) {
              return b.latest_comment_time - a.latest_comment_time
            }
            if (a.latest_comment_time > 0 && b.latest_comment_time === 0) {
              return -1
            }
            if (a.latest_comment_time === 0 && b.latest_comment_time > 0) {
              return 1
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          break
        default:
          papersWithStats.sort((a, b) => {
            if (a.latest_comment_time > 0 && b.latest_comment_time > 0) {
              return b.latest_comment_time - a.latest_comment_time
            }
            if (a.latest_comment_time > 0 && b.latest_comment_time === 0) {
              return -1
            }
            if (a.latest_comment_time === 0 && b.latest_comment_time > 0) {
              return 1
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
      }

      // 应用分页
      return papersWithStats.slice(offset, offset + limit)
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError)
      throw error // 抛出原始错误
    }
  }
}

export async function getPaperById(id: string): Promise<PaperWithStats | null> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data: paper, error } = await supabase
    .from('papers')
    .select(`
      *,
      ratings(*),
      comments(*),
      paper_favorites(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching paper:', error)
    throw error
  }

  if (!paper) {
    return null
  }

  const ratings = paper.ratings || []
  const commentCount = Array.isArray(paper.comments) ? paper.comments.length : 0
  const favoriteCount = Array.isArray(paper.paper_favorites) ? paper.paper_favorites.length : 0
  
  let averageRating = 0
  if (ratings.length > 0) {
    const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
    averageRating = totalScore / ratings.length
  }

  return {
    ...paper,
    ratings,
    rating_count: ratings.length,
    comment_count: commentCount,
    favorite_count: favoriteCount,
    average_rating: Math.round(averageRating * 10) / 10
  }
}

export async function searchPapers(query: string, limit: number = 10): Promise<PaperWithStats[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('papers')
    .select(`
      *,
      ratings(*),
      comments(*),
      paper_favorites(*)
    `)
    .or(`title.ilike.%${query}%,abstract.ilike.%${query}%,doi.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error searching papers:', error)
    throw error
  }

  // Calculate stats for each paper
  const papersWithStats = (data || []).map((paper: any) => {
    const ratings = paper.ratings || []
    const commentCount = Array.isArray(paper.comments) ? paper.comments.length : 0
    const favoriteCount = Array.isArray(paper.paper_favorites) ? paper.paper_favorites.length : 0
    
    let averageRating = 0
    if (ratings.length > 0) {
      const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
      averageRating = totalScore / ratings.length
    }

    return {
      ...paper,
      ratings,
      rating_count: ratings.length,
      comment_count: commentCount,
      favorite_count: favoriteCount,
      average_rating: Math.round(averageRating * 10) / 10
    }
  })

  return papersWithStats
}

export async function searchPaperByDOI(doi: string): Promise<Paper[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('doi', doi)

  if (error) {
    console.error('Error searching paper by DOI:', error)
    throw error
  }

  return data || []
}

export async function createPaper(paperData: Omit<Paper, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<Paper> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('papers')
    .insert([{
      ...paperData,
      created_by: userId
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating paper:', error)
    throw error
  }

  return data
}

export async function createPaperFromDOI(doi: string, userId: string): Promise<Paper[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  // Check if paper already exists
  const existingPapers = await searchPaperByDOI(doi)
  if (existingPapers.length > 0) {
    return existingPapers
  }

  // Fetch from CrossRef
  const crossRefData = await fetchPaperByDOI(doi)
  
  if (!crossRefData) {
    throw new Error('无法从CrossRef获取论文信息')
  }
  
  const newPaper = {
    title: crossRefData.title,
    authors: crossRefData.authors,
    abstract: crossRefData.abstract || '',
    doi: crossRefData.doi,
    journal: crossRefData.journal,
    publication_date: crossRefData.publication_date,
    url: crossRefData.url,
    keywords: crossRefData.keywords || [],
    created_by: userId
  }

  const { data, error } = await supabase
    .from('papers')
    .insert([newPaper])
    .select()

  if (error) {
    console.error('Error creating paper from DOI:', error)
    throw error
  }

  return data || []
}

export async function createRating(
  paperId: string, 
  userId: string, 
  ratingData: {
    innovation_score: number
    methodology_score: number
    practicality_score: number
    overall_score: number
  }
): Promise<Rating> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('ratings')
    .insert([{
      paper_id: paperId,
      user_id: userId,
      ...ratingData
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating rating:', error)
    throw error
  }

  return data
}

export async function getUserRating(paperId: string, userId: string): Promise<Rating | null> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('paper_id', paperId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user rating:', error)
    throw error
  }

  return data || null
}

export async function updateRating(
  ratingId: string,
  ratingData: {
    innovation_score: number
    methodology_score: number
    practicality_score: number
    overall_score: number
  }
): Promise<Rating> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('ratings')
    .update(ratingData)
    .eq('id', ratingId)
    .select()
    .single()

  if (error) {
    console.error('Error updating rating:', error)
    throw error
  }

  return data
}

export async function createComment(
  paperId: string, 
  userId: string, 
  content: string
): Promise<Comment> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('comments')
    .insert([{
      paper_id: paperId,
      user_id: userId,
      content
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating comment:', error)
    throw error
  }

  return data
}

export async function getComments(paperId: string): Promise<Comment[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      user:users(id, username, email)
    `)
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching comments:', error)
    throw error
  }

  return data || []
}

export async function toggleFavorite(paperId: string, userId: string): Promise<boolean> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  // Check if favorite already exists
  const { data: existing } = await supabase
    .from('paper_favorites')
    .select('id')
    .eq('paper_id', paperId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('paper_favorites')
      .delete()
      .eq('paper_id', paperId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing favorite:', error)
      throw error
    }
    return false
  } else {
    // Add favorite
    const { error } = await supabase
      .from('paper_favorites')
      .insert([{
        paper_id: paperId,
        user_id: userId
      }])

    if (error) {
      console.error('Error adding favorite:', error)
      throw error
    }
    return true
  }
}

export async function getUserFavorites(userId: string): Promise<PaperWithStats[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('paper_favorites')
    .select(`
      paper:papers(
        *,
        ratings(*),
        comments(*),
        paper_favorites(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user favorites:', error)
    throw error
  }

  // Calculate stats for each paper
  const papersWithStats = (data || []).map((favorite: any) => {
    const paper = favorite.paper
    const ratings = paper.ratings || []
    const commentCount = Array.isArray(paper.comments) ? paper.comments.length : 0
    const favoriteCount = Array.isArray(paper.paper_favorites) ? paper.paper_favorites.length : 0
    
    let averageRating = 0
    if (ratings.length > 0) {
      const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
      averageRating = totalScore / ratings.length
    }

    return {
      ...paper,
      ratings,
      rating_count: ratings.length,
      comment_count: commentCount,
      favorite_count: favoriteCount,
      average_rating: Math.round(averageRating * 10) / 10
    }
  })

  return papersWithStats
}

export async function getUserRatings(userId: string): Promise<(Rating & { paper: Paper })[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('ratings')
    .select(`
      *,
      paper:papers(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user ratings:', error)
    throw error
  }

  return data || []
}

export async function getUserComments(userId: string): Promise<(Comment & { paper: Paper })[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      paper:papers(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user comments:', error)
    throw error
  }

  return data || []
}

// Additional functions for compatibility
export async function getPaper(id: string): Promise<PaperWithStats | null> {
  return await getPaperById(id)
}

export async function updatePaper(id: string, paperData: Partial<Paper>): Promise<Paper> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('papers')
    .update(paperData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating paper:', error)
    throw error
  }

  return data
}

export async function deletePaper(id: string): Promise<boolean> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { error } = await supabase
    .from('papers')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting paper:', error)
    throw error
  }

  return true
}

export async function searchOrCreatePaperByDOI(doi: string): Promise<Paper[]> {
  // First check if paper already exists
  const existingPapers = await searchPaperByDOI(doi)
  if (existingPapers.length > 0) {
    return existingPapers
  }

  // If not found, create from CrossRef data
  const crossRefData = await fetchPaperByDOI(doi)
  if (!crossRefData) {
    throw new Error('无法从CrossRef获取论文信息')
  }

  const newPaper = {
    title: crossRefData.title,
    authors: crossRefData.authors,
    abstract: crossRefData.abstract || '',
    doi: crossRefData.doi,
    journal: crossRefData.journal,
    publication_date: crossRefData.publication_date,
    keywords: crossRefData.keywords || [],
    created_by: '00000000-0000-0000-0000-000000000000' // System user UUID
  }

  const { data, error } = await supabase!
    .from('papers')
    .insert([newPaper])
    .select()

  if (error) {
    console.error('Error creating paper from DOI:', error)
    throw error
  }

  return data || []
}

export async function createOrUpdateRating(
  ratingData: {
    paper_id: string
    user_id: string
    innovation_score: number
    methodology_score: number
    practicality_score: number
    overall_score: number
  }
): Promise<Rating> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  // Check if rating already exists
  const existingRating = await getUserRating(ratingData.paper_id, ratingData.user_id)

  if (existingRating) {
    // Update existing rating
    return await updateRating(existingRating.id, {
      innovation_score: ratingData.innovation_score,
      methodology_score: ratingData.methodology_score,
      practicality_score: ratingData.practicality_score,
      overall_score: ratingData.overall_score
    })
  } else {
    // Create new rating
    return await createRating(ratingData.paper_id, ratingData.user_id, {
      innovation_score: ratingData.innovation_score,
      methodology_score: ratingData.methodology_score,
      practicality_score: ratingData.practicality_score,
      overall_score: ratingData.overall_score
    })
  }
}

export function calculateAverageRating(ratings: Rating[]) {
  if (ratings.length === 0) return null

  const totals = ratings.reduce(
    (acc, rating) => ({
      innovation: acc.innovation + rating.innovation_score,
      methodology: acc.methodology + rating.methodology_score,
      practicality: acc.practicality + rating.practicality_score,
      overall: acc.overall + rating.overall_score,
    }),
    { innovation: 0, methodology: 0, practicality: 0, overall: 0 }
  )

  const count = ratings.length
  return {
    innovation: Math.round((totals.innovation / count) * 10) / 10,
    methodology: Math.round((totals.methodology / count) * 10) / 10,
    practicality: Math.round((totals.practicality / count) * 10) / 10,
    overall: Math.round((totals.overall / count) * 10) / 10,
    count
  }
}

// Alias functions for backward compatibility
export async function getPaperRatings(paperId: string): Promise<Rating[]> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching paper ratings:', error)
    throw error
  }

  return data || []
}

export async function getPaperComments(paperId: string): Promise<Comment[]> {
  return await getComments(paperId)
}

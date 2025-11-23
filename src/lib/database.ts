import { fetchPaperByDOI } from './crossref'
import type { Paper, Rating, Comment } from './supabase'
import { supabase } from './supabase'

// Extended type for papers with statistics
export interface PaperWithStats extends Paper {
  average_rating?: number
  rating_count?: number
  comment_count?: number
  favorite_count?: number
  ratings?: Rating[]
  comments?: Comment[]
  latest_comment_time?: number
}

export async function getPapers(limit: number = 10, offset: number = 0): Promise<PaperWithStats[]> {
  return getPapersWithSort(limit, offset, 'newest')
}

export async function getTotalPapersCount(): Promise<number> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  try {
    const { count, error } = await supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Error getting papers count:', error)
      throw error
    }

    return count || 0
  } catch (error) {
    console.error('Error in getTotalPapersCount:', error)
    throw error
  }
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
    // 1) 取出所有论文的基础信息（数量目前较小，便于在服务端完成统计与排序）
    const { data: allPapers, error: papersError } = await supabase
      .from('papers')
      .select('*')

    if (papersError) {
      console.error('Error fetching papers:', papersError)
      throw papersError
    }

    const papers = (allPapers || []) as any[]
    const paperIds = papers.map(p => p.id).filter(Boolean)

    // 无数据直接返回
    if (paperIds.length === 0) return []

    // 2) 聚合拉取评分与评论（在Node侧做聚合，避免PostgREST group语法限制）
    const [ratingsRes, commentsRes] = await Promise.all([
      supabase.from('ratings').select('paper_id, overall_score').in('paper_id', paperIds),
      supabase.from('comments').select('paper_id, created_at').in('paper_id', paperIds)
    ])

    if (ratingsRes.error) throw ratingsRes.error
    if (commentsRes.error) throw commentsRes.error

    // 3) 统计映射
    const ratingMap = new Map<string, { count: number; sum: number }>()
    for (const r of ratingsRes.data || []) {
      const key = (r as any).paper_id as string
      const score = Number((r as any).overall_score) || 0
      const prev = ratingMap.get(key) || { count: 0, sum: 0 }
      ratingMap.set(key, { count: prev.count + 1, sum: prev.sum + score })
    }

    const commentMap = new Map<string, { count: number; latest: number }>()
    for (const c of commentsRes.data || []) {
      const key = (c as any).paper_id as string
      const ts = new Date((c as any).created_at).getTime()
      const prev = commentMap.get(key) || { count: 0, latest: 0 }
      commentMap.set(key, { count: prev.count + 1, latest: Math.max(prev.latest, ts) })
    }

    // 4) 合成统计字段
    const enriched = papers.map(p => {
      const r = ratingMap.get(p.id) || { count: 0, sum: 0 }
      const c = commentMap.get(p.id) || { count: 0, latest: 0 }
      const avg = r.count > 0 ? Math.round((r.sum / r.count) * 10) / 10 : 0
      return {
        ...p,
        ratings: [],
        rating_count: r.count,
        comment_count: c.count,
        favorite_count: 0,
        average_rating: avg,
        latest_comment_time: c.latest
      } as PaperWithStats
    })

    // 5) 根据 sortBy 排序
    const sortKey = (sortBy || 'recent_comments') as string
    enriched.sort((a, b) => {
      if (sortKey === 'rating') {
        // 评分最高优先，其次评分次数，其次发布时间
        if ((b.average_rating || 0) !== (a.average_rating || 0)) {
          return (b.average_rating || 0) - (a.average_rating || 0)
        }
        if ((b.rating_count || 0) !== (a.rating_count || 0)) {
          return (b.rating_count || 0) - (a.rating_count || 0)
        }
        return new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime()
      }
      if (sortKey === 'comments') {
        // 评论最多优先
        if ((b.comment_count || 0) !== (a.comment_count || 0)) {
          return (b.comment_count || 0) - (a.comment_count || 0)
        }
        return new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime()
      }
      // 默认：最新评论优先（没有评论时按创建时间降序）
      const lb = (b.latest_comment_time || 0)
      const la = (a.latest_comment_time || 0)
      if (lb !== la) return lb - la
      return new Date(b.created_at as any).getTime() - new Date(a.created_at as any).getTime()
    })

    // 6) 分页切片
    const slice = enriched.slice(offset, offset + limit)
    return slice
  } catch (error) {
    console.error('Error in getPapersWithSort:', error)
    throw error
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
      comments(*)
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

  const ratings = (paper as any).ratings || []
  const commentCount = Array.isArray((paper as any).comments) ? (paper as any).comments.length : 0
  const favoriteCount = 0 // 暂时设为0，避免权限问题
  
  let averageRating = 0
  if (ratings.length > 0) {
    const totalScore = ratings.reduce((sum: number, rating: any) => sum + rating.overall_score, 0)
    averageRating = totalScore / ratings.length
  }

  return {
    ...(paper as any),
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
      comments(*)
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
    const favoriteCount = 0 // 暂时设为0，避免权限问题
    
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

  const { data, error } = await (supabase as any)
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

  const { data, error } = await (supabase as any)
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
    is_anonymous?: boolean // 🆕
    show_username?: boolean // 🆕
  }
): Promise<Rating> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await (supabase as any)
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
    is_anonymous?: boolean // 🆕
    show_username?: boolean // 🆕
  }
): Promise<Rating> {
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await (supabase as any)
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

  const { data, error } = await (supabase as any)
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
  // 暂时禁用收藏功能，避免权限问题
  console.warn('toggleFavorite temporarily disabled due to RLS issues')
  return false
}

export async function getUserFavorites(userId: string): Promise<PaperWithStats[]> {
  // 暂时禁用收藏功能，避免权限问题
  console.warn('getUserFavorites temporarily disabled due to RLS issues')
  return []
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

  const { data, error } = await (supabase as any)
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

  const { data, error } = await (supabase as any)!
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
    is_anonymous?: boolean // 🆕 匿名选项
    show_username?: boolean // 🆕 显示用户名选项
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
      overall_score: ratingData.overall_score,
      is_anonymous: ratingData.is_anonymous, // 🆕
      show_username: ratingData.show_username, // 🆕
    })
  } else {
    // Create new rating
    return await createRating(ratingData.paper_id, ratingData.user_id, {
      innovation_score: ratingData.innovation_score,
      methodology_score: ratingData.methodology_score,
      practicality_score: ratingData.practicality_score,
      overall_score: ratingData.overall_score,
      is_anonymous: ratingData.is_anonymous, // 🆕
      show_username: ratingData.show_username, // 🆕
    })
  }
}

export function calculateAverageRating(ratings: Rating[]) {
  if (ratings.length === 0) return null

  const totals = ratings.reduce(
    (acc, rating) => ({
      innovation: acc.innovation + (rating.innovation_score || 0),
      methodology: acc.methodology + (rating.methodology_score || 0),
      practicality: acc.practicality + (rating.practicality_score || 0),
      overall: acc.overall + (rating.overall_score || 0),
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

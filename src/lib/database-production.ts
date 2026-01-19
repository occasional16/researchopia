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
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  const { data, error } = await supabase
    .from('papers')
    .select(`
      *,
      ratings(*),
      comments(*),
      favorites(*)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching papers:', error)
    throw error
  }
    
  // Calculate stats for each paper
  const papersWithStats = (data || []).map((paper: any) => {
    const ratings = paper.ratings || []
    const commentCount = Array.isArray(paper.comments) ? paper.comments.length : 0
    const favoriteCount = Array.isArray(paper.favorites) ? paper.favorites.length : 0
    
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
      favorites(*)
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
  const favoriteCount = Array.isArray((paper as any).favorites) ? (paper as any).favorites.length : 0
  
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
      comments(*),
      favorites(*)
    `)
    .or(`title.ilike.%${query}%,authors.ilike.%${query}%,abstract.ilike.%${query}%`)
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
    const favoriteCount = Array.isArray(paper.favorites) ? paper.favorites.length : 0
    
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
  if (!supabase) {
    throw new Error('Supabase is not available')
  }

  // Check if favorite already exists
  const { data: existing } = await supabase
    .from('paper_bookmark_items')
    .select('id')
    .eq('paper_id', paperId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    // Remove favorite
    const { error } = await supabase
      .from('paper_bookmark_items')
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
    const { error } = await (supabase as any)
      .from('paper_bookmark_items')
      .insert([{
        paper_id: paperId,
        user_id: userId,
        position: 0
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
    .from('paper_bookmark_items')
    .select(`
      paper:papers(
        *,
        ratings(*),
        comments(*)
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
    const favoriteCount = Array.isArray(paper.favorites) ? paper.favorites.length : 0
    
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

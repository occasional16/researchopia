import { supabase } from './supabase'
import type { Paper, Rating, Comment } from './supabase'

export interface UserRatingWithPaper extends Rating {
  papers: Paper
}

export interface UserCommentWithPaper extends Comment {
  papers: Paper
}

export interface UserStats {
  total_ratings: number
  total_comments: number
  total_favorites: number
  avg_rating: number
}

export interface UserActivity {
  ratings: UserRatingWithPaper[]
  comments: UserCommentWithPaper[]
  stats: UserStats
}



/**
 * Get user's ratings with paper information
 */
export async function getUserRatings(userId: string): Promise<UserRatingWithPaper[]> {
  try {

    if (!supabase) return []

    const { data, error } = await supabase
      .from('ratings')
      .select(`
        *,
        papers (
          id,
          title,
          authors,
          doi,
          journal,
          publication_date
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user ratings:', error)
    return []
  }
}

/**
 * Get user's comments with paper information
 */
export async function getUserComments(userId: string): Promise<UserCommentWithPaper[]> {
  try {

    if (!supabase) return []

    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        papers (
          id,
          title,
          authors,
          doi,
          journal,
          publication_date
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user comments:', error)
    return []
  }
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  try {

    if (!supabase) return {
      total_ratings: 0,
      avg_rating: 0,
      total_comments: 0,
      total_favorites: 0
    }

    const [ratingsResult, commentsResult, favoritesResult] = await Promise.all([
      supabase
        .from('ratings')
        .select('overall_score', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('paper_bookmark_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ])

    const ratings = ratingsResult.data || []
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum: any, r: any) => sum + r.overall_score, 0) / ratings.length
      : 0

    return {
      total_ratings: ratingsResult.count || 0,
      total_comments: commentsResult.count || 0,
      total_favorites: favoritesResult.count || 0,
      avg_rating: avgRating
    }
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return {
      total_ratings: 0,
      total_comments: 0,
      total_favorites: 0,
      avg_rating: 0
    }
  }
}

/**
 * Delete user's rating
 */
export async function deleteUserRating(ratingId: string): Promise<boolean> {
  try {
    

    if (!supabase) throw new Error('Database not available')

    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('id', ratingId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting rating:', error)
    return false
  }
}

/**
 * Delete user's comment
 */
export async function deleteUserComment(commentId: string): Promise<boolean> {
  try {
    

    if (!supabase) throw new Error('Database not available')

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    return false
  }
}

/**
 * Get user's complete activity data
 */
export async function getUserActivity(userId: string): Promise<UserActivity> {
  try {
    const [ratings, comments, stats] = await Promise.all([
      getUserRatings(userId),
      getUserComments(userId),
      getUserStats(userId)
    ])

    return {
      ratings,
      comments,
      stats
    }
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return {
      ratings: [],
      comments: [],
      stats: {
        total_ratings: 0,
        total_comments: 0,
        total_favorites: 0,
        avg_rating: 0
      }
    }
  }
}

/**
 * Get user's vote history on comments
 */
export async function getUserVoteHistory(userId: string) {
  try {
    

    if (!supabase) return []

    const { data, error } = await supabase
      .from('comment_votes')
      .select(`
        *,
        comments (
          id,
          content,
          papers (
            id,
            title
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching user vote history:', error)
    return []
  }
}

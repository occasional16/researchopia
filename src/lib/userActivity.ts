import { supabase } from './supabase'
import { MockAuthService } from './mockAuth'
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

// Mock storage for user activity
const MOCK_RATINGS_KEY = 'academic_rating_mock_ratings'
const MOCK_COMMENTS_KEY = 'academic_rating_mock_comments'

class MockUserActivityService {
  private getRatings(): Rating[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_RATINGS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private getComments(): Comment[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_COMMENTS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private getPapers(): Paper[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('academic_rating_mock_papers')
    return stored ? JSON.parse(stored) : []
  }

  async getUserRatings(userId: string): Promise<UserRatingWithPaper[]> {
    const ratings = this.getRatings().filter(r => r.user_id === userId)
    const papers = this.getPapers()

    return ratings.map(rating => ({
      ...rating,
      papers: papers.find(p => p.id === rating.paper_id) || {
        id: rating.paper_id,
        title: 'Unknown Paper',
        authors: [],
        doi: '',
        abstract: '',
        keywords: [],
        journal: '',
        publication_date: '',
        created_at: '',
        updated_at: '',
        created_by: 'system',
        ratings: []
      }
    }))
  }

  async getUserComments(userId: string): Promise<UserCommentWithPaper[]> {
    const comments = this.getComments().filter(c => c.user_id === userId)
    const papers = this.getPapers()

    return comments.map(comment => ({
      ...comment,
      papers: papers.find(p => p.id === comment.paper_id) || {
        id: comment.paper_id,
        title: 'Unknown Paper',
        authors: [],
        doi: '',
        abstract: '',
        keywords: [],
        journal: '',
        publication_date: '',
        created_at: '',
        updated_at: '',
        created_by: 'system',
        ratings: []
      }
    }))
  }

  async getUserStats(userId: string): Promise<UserStats> {
    const ratings = this.getRatings().filter(r => r.user_id === userId)
    const comments = this.getComments().filter(c => c.user_id === userId)
    const favorites = this.getFavorites().filter(f => f.user_id === userId)

    const avgRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.overall_score, 0) / ratings.length
      : 0

    return {
      total_ratings: ratings.length,
      total_comments: comments.length,
      total_favorites: favorites.length,
      avg_rating: avgRating
    }
  }

  private getFavorites(): any[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('academic_rating_mock_favorites')
    return stored ? JSON.parse(stored) : []
  }
}

const mockUserActivity = new MockUserActivityService()

/**
 * Get user's ratings with paper information
 */
export async function getUserRatings(userId: string): Promise<UserRatingWithPaper[]> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockUserActivity.getUserRatings(userId)
    }

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
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockUserActivity.getUserComments(userId)
    }

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
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockUserActivity.getUserStats(userId)
    }

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
        .from('paper_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ])

    const ratings = ratingsResult.data || []
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.overall_score, 0) / ratings.length 
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
    if (MockAuthService.shouldUseMockAuth()) {
      // Mock implementation
      return true
    }

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
    if (MockAuthService.shouldUseMockAuth()) {
      // Mock implementation
      return true
    }

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
    if (MockAuthService.shouldUseMockAuth()) {
      return []
    }

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

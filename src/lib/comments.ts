import { supabase } from './supabase'
import { MockAuthService } from './mockAuth'

export interface CommentVote {
  id: string
  user_id: string
  comment_id: string
  vote_type: 'like' | 'dislike'
  created_at: string
}

export interface CommentWithVotes {
  id: string
  user_id: string
  paper_id: string
  content: string
  likes_count: number
  dislikes_count: number
  created_at: string
  updated_at: string
  users: {
    username: string
    avatar_url?: string
  }
  user_vote?: 'like' | 'dislike' | null
}

// Mock comment functions
function getMockComments(): CommentWithVotes[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem('academic_rating_mock_comments')
  return stored ? JSON.parse(stored) : []
}

function saveMockComments(comments: CommentWithVotes[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('academic_rating_mock_comments', JSON.stringify(comments))
}

function getMockUsers(): any[] {
  if (typeof window === 'undefined') return []
  const stored = localStorage.getItem('academic_rating_mock_users')
  return stored ? JSON.parse(stored) : []
}

/**
 * Get comments for a paper with vote counts and user's vote
 */
export async function getCommentsWithVotes(paperId: string, userId?: string): Promise<CommentWithVotes[]> {
  if (MockAuthService.shouldUseMockAuth()) {
    const comments = getMockComments().filter(c => c.paper_id === paperId)

    // Get votes from localStorage
    const voteKey = 'academic_rating_mock_comment_votes'
    let votes: any[] = []

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(voteKey)
      votes = stored ? JSON.parse(stored) : []
    }

    // 确保返回正确的格式，包含实时投票数据
    return comments.map(comment => {
      const commentVotes = votes.filter(v => v.comment_id === comment.id)
      const likesCount = commentVotes.filter(v => v.vote_type === 'like').length
      const dislikesCount = commentVotes.filter(v => v.vote_type === 'dislike').length
      const userVote = userId ? commentVotes.find(v => v.user_id === userId) : null

      return {
        id: comment.id,
        user_id: comment.user_id,
        paper_id: comment.paper_id,
        content: comment.content,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        users: comment.users || { username: 'Unknown User' },
        user_vote: userVote ? userVote.vote_type : null
      }
    })
  }
  try {
    if (!supabase) return []

    const query = supabase
      .from('comments')
      .select(`
        *,
        users (
          id,
          username
        )
      `)
      .eq('paper_id', paperId)
      .order('created_at', { ascending: false })

    const { data: comments, error } = await query

    if (error) throw error

    if (!comments) return []

    // If user is logged in, get their votes
    if (userId && supabase) {
      const { data: userVotes } = await supabase
        .from('comment_votes')
        .select('comment_id, vote_type')
        .eq('user_id', userId)
        .in('comment_id', (comments as any).map((c: any) => c.id))

      const voteMap = new Map((userVotes as any)?.map((v: any) => [v.comment_id, v.vote_type]) || [])

      return (comments as any).map((comment: any) => ({
        ...comment,
        user_vote: voteMap.get(comment.id) || null
      }))
    }

    return (comments as any).map((comment: any) => ({
      ...comment,
      user_vote: null
    }))
  } catch (error) {
    console.error('Error fetching comments with votes:', error)
    return []
  }
}

/**
 * Vote on a comment (like or dislike)
 */
export async function voteOnComment(
  commentId: string,
  userId: string,
  voteType: 'like' | 'dislike'
): Promise<boolean> {
  if (MockAuthService.shouldUseMockAuth()) {
    // Mock implementation - store votes in localStorage
    const voteKey = 'academic_rating_mock_comment_votes'
    let votes: any[] = []

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(voteKey)
      votes = stored ? JSON.parse(stored) : []
    }

    // Check if user already voted
    const existingVoteIndex = votes.findIndex(v =>
      v.user_id === userId && v.comment_id === commentId
    )

    if (existingVoteIndex >= 0) {
      const existingVote = votes[existingVoteIndex]
      if (existingVote.vote_type === voteType) {
        // Remove vote if clicking the same vote type
        votes.splice(existingVoteIndex, 1)
      } else {
        // Update vote type
        votes[existingVoteIndex].vote_type = voteType
      }
    } else {
      // Add new vote
      votes.push({
        id: 'mock-vote-' + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        comment_id: commentId,
        vote_type: voteType,
        created_at: new Date().toISOString()
      })
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(voteKey, JSON.stringify(votes))
    }

    console.log(`Mock vote: ${voteType} on comment ${commentId} by user ${userId}`)
    return true
  }

  try {
    if (!supabase) return false

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('comment_votes')
      .select('*')
      .eq('user_id', userId)
      .eq('comment_id', commentId)
      .single()

    if (existingVote) {
      if ((existingVote as any).vote_type === voteType) {
        // Remove vote if clicking the same vote type
        const { error } = await (supabase as any)
          .from('comment_votes')
          .delete()
          .eq('id', (existingVote as any).id)
        
        if (error) throw error
      } else {
        // Update vote type
        const { error } = await (supabase as any)
          .from('comment_votes')
          .update({ vote_type: voteType })
          .eq('id', (existingVote as any).id)
        
        if (error) throw error
      }
    } else {
      // Create new vote
      const { error } = await (supabase as any)
        .from('comment_votes')
        .insert({
          user_id: userId,
          comment_id: commentId,
          vote_type: voteType
        })
      
      if (error) throw error
    }

    return true
  } catch (error) {
    console.error('Error voting on comment:', error)
    return false
  }
}

/**
 * Add a new comment
 */
export async function addComment(
  paperId: string,
  userId: string,
  content: string
): Promise<boolean> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      const comments = getMockComments()
      const users = getMockUsers()

      const newComment: CommentWithVotes = {
        id: 'mock-comment-' + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        paper_id: paperId,
        content: content.trim(),
        likes_count: 0,
        dislikes_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        users: users.find(u => u.id === userId) || { username: 'Unknown User' },
        user_vote: null
      }

      comments.push(newComment)
      saveMockComments(comments)
      return true
    }

    if (!supabase) return false

    const { error } = await (supabase as any)
      .from('comments')
      .insert({
        paper_id: paperId,
        user_id: userId,
        content: content.trim()
      })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error adding comment:', error)
    return false
  }
}

/**
 * Delete a comment (user's own or admin)
 */
export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      // Mock implementation - remove comment from localStorage
      const comments = getMockComments()
      const filteredComments = comments.filter(c => c.id !== commentId)

      if (typeof window !== 'undefined') {
        localStorage.setItem('academic_rating_mock_comments', JSON.stringify(filteredComments))
      }

      console.log(`Mock: Deleted comment ${commentId}`)
      return true
    }

    if (!supabase) return false

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
 * Get comment statistics
 */
export async function getCommentStats(paperId: string) {
  try {
    if (!supabase) return { count: 0 }

    const { data, error } = await supabase
      .from('comments')
      .select('id')
      .eq('paper_id', paperId)

    if (error) throw error
    
    return {
      total_comments: data?.length || 0
    }
  } catch (error) {
    console.error('Error getting comment stats:', error)
    return {
      total_comments: 0
    }
  }
}

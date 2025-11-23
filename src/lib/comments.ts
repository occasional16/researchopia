import { supabase } from './supabase'

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



/**
 * Get comments for a paper with vote counts and user's vote
 */
export async function getCommentsWithVotes(paperId: string, userId?: string): Promise<CommentWithVotes[]> {
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
  content: string,
  isAnonymous: boolean = false // 🆕 匿名参数
): Promise<boolean> {
  try {
    if (!supabase) return false

    const { error } = await (supabase as any)
      .from('comments')
      .insert({
        paper_id: paperId,
        user_id: userId,
        content: content.trim(),
        is_anonymous: isAnonymous // 🆕 插入匿名标志
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

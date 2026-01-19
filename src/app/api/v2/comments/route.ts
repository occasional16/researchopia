/**
 * Unified Comments API v2
 * 
 * POST   /api/v2/comments - Create comment
 * GET    /api/v2/comments - Get comments for a target
 * PATCH  /api/v2/comments/[id] - Update comment
 * DELETE /api/v2/comments/[id] - Delete comment
 * 
 * Supports both papers and webpages via targetType parameter
 * Supports both Cookie and Bearer Token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest, requireAuth, AuthError } from '@/lib/api-auth';

// ============================================================================
// Types
// ============================================================================

type TargetType = 'paper' | 'webpage';

// ============================================================================
// GET - Get comments for a target
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType') as TargetType;
    const targetId = searchParams.get('targetId');
    const nested = searchParams.get('nested') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (!['paper', 'webpage'].includes(targetType)) {
      return NextResponse.json(
        { error: 'targetType must be "paper" or "webpage"' },
        { status: 400 }
      );
    }

    const { supabase, user } = await getAuthFromRequest(request);

    if (targetType === 'paper') {
      return getPaperComments(supabase, targetId, nested, limit, offset, user?.id);
    } else {
      return getWebpageComments(supabase, targetId, nested, limit, offset, user?.id);
    }
  } catch (error) {
    console.error('GET /api/v2/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// POST - Create comment
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);

    const body = await request.json();
    const { targetType, targetId, content, parentId, isAnonymous, url, title } = body as {
      targetType: TargetType;
      targetId: string;
      content: string;
      parentId?: string;
      isAnonymous?: boolean;
      url?: string;
      title?: string;
    };

    // Validation
    if (!targetType || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: 'content is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    if (targetType === 'paper') {
      return createPaperComment(supabase, user.id, targetId, content.trim(), parentId, isAnonymous);
    } else {
      return createWebpageComment(supabase, user.id, targetId, content.trim(), parentId, isAnonymous, url, title);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/v2/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete comment
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType') as TargetType;
    const targetId = searchParams.get('targetId');
    const commentId = searchParams.get('commentId');

    if (!targetType || !targetId || !commentId) {
      return NextResponse.json(
        { error: 'targetType, targetId, and commentId are required' },
        { status: 400 }
      );
    }

    const tableName = targetType === 'paper' ? 'comments' : 'webpage_comments';
    const idField = targetType === 'paper' ? 'paper_id' : 'webpage_id';

    // Fetch comment to check ownership
    const { data: comment, error: fetchError } = await supabase
      .from(tableName)
      .select('id, user_id')
      .eq('id', commentId)
      .eq(idField, targetId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = userData?.role === 'admin';
    const isOwner = comment.user_id === user.id;

    // Only allow deleting own comments OR admin can delete any
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/v2/comments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// Paper Comments
// ============================================================================

async function getPaperComments(
  supabase: any,
  paperId: string,
  nested: boolean,
  limit: number,
  offset: number,
  currentUserId?: string
) {
  // Get comments with user info
  const { data: comments, error, count } = await supabase
    .from('comments')
    .select(`
      *,
      user:users(id, username, email, avatar_url)
    `, { count: 'exact' })
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching paper comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }

  // Get comment IDs for vote lookup
  const commentIds = (comments || []).map((c: any) => c.id);
  
  // Get vote counts
  const { data: voteCounts } = await supabase
    .from('comment_votes')
    .select('comment_id')
    .eq('vote_type', 'like')
    .in('comment_id', commentIds);
  
  const voteCountMap = new Map<string, number>();
  (voteCounts || []).forEach((vote: any) => {
    voteCountMap.set(vote.comment_id, (voteCountMap.get(vote.comment_id) || 0) + 1);
  });
  
  // Get current user's votes
  const userVoteSet = new Set<string>();
  if (currentUserId && commentIds.length > 0) {
    const { data: userVotes } = await supabase
      .from('comment_votes')
      .select('comment_id')
      .eq('user_id', currentUserId)
      .eq('vote_type', 'like')
      .in('comment_id', commentIds);
    
    (userVotes || []).forEach((vote: any) => {
      userVoteSet.add(vote.comment_id);
    });
  }

  const normalizedComments = (comments || []).map((c: any) => ({
    ...normalizeComment(c, 'paper'),
    likesCount: voteCountMap.get(c.id) || 0,
    hasLiked: userVoteSet.has(c.id),
  }));
  
  // Build nested structure if requested, then mark own comments
  let result = nested ? buildCommentTree(normalizedComments) : normalizedComments;
  result = markOwnComments(result, currentUserId);

  return NextResponse.json({
    comments: result,
    total: count || 0,
    hasMore: (offset + limit) < (count || 0),
  });
}

async function createPaperComment(
  supabase: any,
  userId: string,
  paperId: string,
  content: string,
  parentId?: string,
  isAnonymous?: boolean
) {
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      paper_id: paperId,
      user_id: userId,
      content,
      parent_id: parentId || null,
      is_anonymous: isAnonymous ?? false,
    })
    .select(`
      *,
      user:users(id, username, email, avatar_url)
    `)
    .single();

  if (error) {
    console.error('Error creating paper comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }

  return NextResponse.json({
    comment: normalizeComment(comment, 'paper'),
  }, { status: 201 });
}

// ============================================================================
// Webpage Comments
// ============================================================================

async function getWebpageComments(
  supabase: any,
  targetId: string,
  nested: boolean,
  limit: number,
  offset: number,
  currentUserId?: string
) {
  // targetId might be urlHash or UUID
  let webpageId = targetId;
  const isUrlHash = /^[a-f0-9]{16}$/.test(targetId);

  if (isUrlHash) {
    const { data: webpage } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', targetId)
      .single();

    if (!webpage) {
      return NextResponse.json({
        comments: [],
        total: 0,
        hasMore: false,
      });
    }
    webpageId = webpage.id;
  }

  // Fetch comments without JOIN (webpage_comments.user_id references auth.users, not public.users)
  const { data: comments, error, count } = await supabase
    .from('webpage_comments')
    .select('*', { count: 'exact' })
    .eq('webpage_id', webpageId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching webpage comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }

  // Fetch user info separately
  const userIds = [...new Set((comments || []).map((c: any) => c.user_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, username, email, avatar_url')
    .in('id', userIds);

  const userMap = new Map((users || []).map((u: any) => [u.id, u]));

  // Get comment IDs for vote lookup
  const commentIds = (comments || []).map((c: any) => c.id);
  
  // Get vote counts (using webpage_comment_votes if exists, otherwise empty)
  let voteCountMap = new Map<string, number>();
  let userVoteSet = new Set<string>();
  
  // Try to get votes from webpage_comment_votes table
  try {
    if (commentIds.length > 0) {
      const { data: voteCounts } = await supabase
        .from('webpage_comment_votes')
        .select('comment_id')
        .eq('vote_type', 'like')
        .in('comment_id', commentIds);
      
      (voteCounts || []).forEach((vote: any) => {
        voteCountMap.set(vote.comment_id, (voteCountMap.get(vote.comment_id) || 0) + 1);
      });
      
      // Get current user's votes
      if (currentUserId) {
        const { data: userVotes } = await supabase
          .from('webpage_comment_votes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .eq('vote_type', 'like')
          .in('comment_id', commentIds);
        
        (userVotes || []).forEach((vote: any) => {
          userVoteSet.add(vote.comment_id);
        });
      }
    }
  } catch {
    // Table might not exist yet, continue without votes
  }

  const commentsWithUsers = (comments || []).map((c: any) => ({
    ...c,
    user: userMap.get(c.user_id) || null,
  }));

  const normalizedComments = commentsWithUsers.map((c: any) => ({
    ...normalizeComment(c, 'webpage'),
    likesCount: voteCountMap.get(c.id) || 0,
    hasLiked: userVoteSet.has(c.id),
  }));
  
  // Build nested structure if requested, then mark own comments
  let result = nested ? buildCommentTree(normalizedComments) : normalizedComments;
  result = markOwnComments(result, currentUserId);

  return NextResponse.json({
    comments: result,
    total: count || 0,
    hasMore: (offset + limit) < (count || 0),
  });
}

async function createWebpageComment(
  supabase: any,
  userId: string,
  targetId: string,
  content: string,
  parentId?: string,
  isAnonymous?: boolean,
  url?: string,
  title?: string
) {
  // Get webpage ID from urlHash
  let webpageId = targetId;
  const isUrlHash = /^[a-f0-9]{16}$/.test(targetId);

  if (isUrlHash) {
    const { data: webpage } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', targetId)
      .single();

    if (!webpage) {
      // Auto-create webpage if url is provided
      if (url) {
        const { data: newWebpage, error: createError } = await supabase
          .from('webpages')
          .insert({
            url_hash: targetId,
            url: url,
            title: title || url,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Error creating webpage:', createError);
          return NextResponse.json(
            { error: 'Failed to create webpage record' },
            { status: 500 }
          );
        }
        webpageId = newWebpage.id;
      } else {
        return NextResponse.json(
          { error: 'Webpage not found. Provide url parameter to auto-create.' },
          { status: 404 }
        );
      }
    } else {
      webpageId = webpage.id;
    }
  }

  // Insert comment (without JOIN since webpage_comments.user_id references auth.users, not public.users)
  const { data: comment, error } = await supabase
    .from('webpage_comments')
    .insert({
      webpage_id: webpageId,
      user_id: userId,
      content,
      parent_id: parentId || null,
      is_anonymous: isAnonymous ?? false,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating webpage comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }

  // Fetch user info separately
  const { data: user } = await supabase
    .from('users')
    .select('id, username, email, avatar_url')
    .eq('id', userId)
    .single();

  const normalizedComment = normalizeComment({ ...comment, user }, 'webpage');

  return NextResponse.json({
    comment: normalizedComment,
  }, { status: 201 });
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeComment(comment: any, targetType: TargetType) {
  return {
    id: comment.id,
    targetType,
    targetId: targetType === 'paper' ? comment.paper_id : comment.webpage_id,
    userId: comment.user_id,
    parentId: comment.parent_id,
    content: comment.content,
    isAnonymous: comment.is_anonymous,
    likesCount: comment.likes_count || 0,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    user: comment.user ? {
      id: comment.user.id,
      username: comment.user.username,
      email: comment.user.email,
      avatarUrl: comment.user.avatar_url,
    } : undefined,
    children: [],
  };
}

// Add isOwnComment marker to comments
function markOwnComments(comments: any[], currentUserId?: string): any[] {
  return comments.map(c => ({
    ...c,
    isOwnComment: currentUserId ? c.userId === currentUserId : false,
    children: c.children ? markOwnComments(c.children, currentUserId) : [],
  }));
}

function buildCommentTree(comments: any[]) {
  const map = new Map();
  const roots: any[] = [];

  // Create map
  comments.forEach(c => {
    c.children = [];
    map.set(c.id, c);
  });

  // Build tree
  comments.forEach(c => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).children.push(c);
    } else {
      roots.push(c);
    }
  });

  return roots;
}

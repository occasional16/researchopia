/**
 * Unified Comments Vote API v2
 * 
 * POST /api/v2/comments/vote - Toggle like on a comment
 * 
 * Supports both paper comments and webpage comments
 * Supports both Cookie and Bearer Token authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/api-auth';

type TargetType = 'paper' | 'webpage';

interface VoteRequest {
  targetType: TargetType;
  commentId: string;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);

    const body: VoteRequest = await request.json();
    const { targetType, commentId } = body;

    if (!targetType || !commentId) {
      return NextResponse.json(
        { error: 'targetType and commentId are required' },
        { status: 400 }
      );
    }

    if (!['paper', 'webpage'].includes(targetType)) {
      return NextResponse.json(
        { error: 'targetType must be "paper" or "webpage"' },
        { status: 400 }
      );
    }

    const voteTable = targetType === 'paper' ? 'comment_votes' : 'webpage_comment_votes';

    // Check if vote exists
    const { data: existingVote, error: fetchError } = await supabase
      .from(voteTable)
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('vote_type', 'like')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching vote:', fetchError);
      return NextResponse.json({ error: 'Failed to check vote status' }, { status: 500 });
    }

    let action: 'added' | 'removed';

    if (existingVote) {
      // Remove vote
      const { error: deleteError } = await supabase
        .from(voteTable)
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        console.error('Error removing vote:', deleteError);
        return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 });
      }
      action = 'removed';
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from(voteTable)
        .insert({
          comment_id: commentId,
          user_id: user.id,
          vote_type: 'like',
        });

      if (insertError) {
        console.error('Error adding vote:', insertError);
        return NextResponse.json({ error: 'Failed to add vote' }, { status: 500 });
      }
      action = 'added';
    }

    // Get updated like count
    const { count } = await supabase
      .from(voteTable)
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
      .eq('vote_type', 'like');

    return NextResponse.json({
      success: true,
      action,
      likeCount: count || 0,
      hasLiked: action === 'added',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/v2/comments/vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

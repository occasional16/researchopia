import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/paper-comments/vote
 * Vote on a comment (like)
 */
export async function POST(request: Request) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing token' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.split(' ')[1];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const { commentId } = await request.json();
    
    if (!commentId) {
      return NextResponse.json(
        { error: 'Missing commentId' },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { data: existingVote, error: checkError } = await supabase
      .from('comment_votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('comment_id', commentId)
      .maybeSingle();

    if (checkError) {
      console.error('[API] Error checking existing vote:', checkError);
      return NextResponse.json(
        { error: 'Failed to check vote status' },
        { status: 500 }
      );
    }

    let action: 'added' | 'removed';
    
    if (existingVote) {
      // Remove vote (toggle off)
      const { error: deleteError } = await supabase
        .from('comment_votes')
        .delete()
        .eq('id', existingVote.id);

      if (deleteError) {
        console.error('[API] Error removing vote:', deleteError);
        return NextResponse.json(
          { error: 'Failed to remove vote' },
          { status: 500 }
        );
      }
      action = 'removed';
    } else {
      // Add vote
      const { error: insertError } = await supabase
        .from('comment_votes')
        .insert({
          user_id: user.id,
          comment_id: commentId,
          vote_type: 'like'
        });

      if (insertError) {
        console.error('[API] Error adding vote:', insertError);
        return NextResponse.json(
          { error: 'Failed to add vote' },
          { status: 500 }
        );
      }
      action = 'added';
    }

    // Get updated vote count
    const { count, error: countError } = await supabase
      .from('comment_votes')
      .select('*', { count: 'exact', head: true })
      .eq('comment_id', commentId)
      .eq('vote_type', 'like');

    return NextResponse.json({
      success: true,
      action,
      likeCount: count || 0,
      hasLiked: action === 'added'
    });

  } catch (error) {
    console.error('[API] Unexpected error in vote endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

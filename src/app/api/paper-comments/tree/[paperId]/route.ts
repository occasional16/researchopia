import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 由于 has_liked 是用户相关的，必须动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/paper-comments/tree/[paperId]
 * 获取论文的嵌套评论树结构
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from Authorization header (optional)
    const authHeader = request.headers.get('Authorization');
    let currentUserId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const accessToken = authHeader.split(' ')[1];
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      currentUserId = user?.id || null;
    }

    // 调用数据库函数获取评论树
    const { data: commentTree, error } = await supabase
      .rpc('get_paper_comment_tree', {
        p_paper_id: paperId
      });

    if (error) {
      console.error('[API] Error fetching comment tree:', error);
      
      // 如果RPC失败,尝试直接查询
      const { data: flatComments, error: flatError } = await supabase
        .from('comments')
        .select(`
          *,
          user:user_id (
            username,
            avatar_url
          )
        `)
        .eq('paper_id', paperId)
        .order('created_at', { ascending: true });

      if (flatError) {
        return NextResponse.json(
          { error: 'Failed to fetch comments', details: flatError.message },
          { status: 500 }
        );
      }

      // 在客户端构建树结构
      const formattedComments = (flatComments || []).map(comment => ({
        ...comment,
        username: comment.user?.username || 'Anonymous',
        avatar_url: comment.user?.avatar_url || null,
        like_count: 0,
        has_liked: false
      }));

      return NextResponse.json({
        success: true,
        comments: formattedComments,
        isTree: false,
        message: 'Returned flat comments (RPC not available)'
      });
    }

    // Get comment IDs for vote lookup
    const commentIds = extractCommentIds(commentTree || []);
    
    // Get vote counts for all comments
    const { data: voteCounts } = await supabase
      .from('comment_votes')
      .select('comment_id')
      .eq('vote_type', 'like')
      .in('comment_id', commentIds);
    
    // Count votes per comment
    const voteCountMap = new Map<string, number>();
    (voteCounts || []).forEach((vote: { comment_id: string }) => {
      voteCountMap.set(vote.comment_id, (voteCountMap.get(vote.comment_id) || 0) + 1);
    });
    
    // Get current user's votes
    const userVoteSet = new Set<string>();
    if (currentUserId) {
      const { data: userVotes } = await supabase
        .from('comment_votes')
        .select('comment_id')
        .eq('user_id', currentUserId)
        .eq('vote_type', 'like')
        .in('comment_id', commentIds);
      
      (userVotes || []).forEach((vote: { comment_id: string }) => {
        userVoteSet.add(vote.comment_id);
      });
    }

    // 格式化返回数据，添加点赞信息
    const formattedTree = addVotesToTree(commentTree || [], voteCountMap, userVoteSet);

    return NextResponse.json({
      success: true,
      comments: formattedTree,
      isTree: true
    });

  } catch (error) {
    console.error('[API] Unexpected error in comment tree endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: Extract all comment IDs from nested tree
function extractCommentIds(comments: any[]): string[] {
  const ids: string[] = [];
  function traverse(comments: any[]) {
    for (const comment of comments) {
      ids.push(comment.id);
      if (comment.children?.length > 0) {
        traverse(comment.children);
      }
    }
  }
  traverse(comments);
  return ids;
}

// Helper: Add vote info to tree
function addVotesToTree(
  comments: any[], 
  voteCountMap: Map<string, number>, 
  userVoteSet: Set<string>
): any[] {
  return comments.map(comment => ({
    ...comment,
    username: comment.username || 'Anonymous',
    like_count: voteCountMap.get(comment.id) || 0,
    has_liked: userVoteSet.has(comment.id),
    children: comment.children?.length > 0 
      ? addVotesToTree(comment.children, voteCountMap, userVoteSet)
      : []
  }));
}

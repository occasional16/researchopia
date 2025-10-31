import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🔥 优化: 评论树可以缓存2分钟
export const revalidate = 120;

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
        avatar_url: comment.user?.avatar_url || null
      }));

      return NextResponse.json({
        success: true,
        comments: formattedComments,
        isTree: false,
        message: 'Returned flat comments (RPC not available)'
      });
    }

    // 格式化返回数据
    const formattedTree = (commentTree || []).map((comment: any) => ({
      ...comment,
      username: comment.username || 'Anonymous',
      children: comment.children || []
    }));

    return NextResponse.json({
      success: true,
      comments: formattedTree,
      isTree: true
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
      }
    });

  } catch (error) {
    console.error('[API] Unexpected error in comment tree endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/annotation-comments/tree/[annotationId]
 * 获取标注的嵌套评论树结构
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  try {
    const { annotationId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 调用数据库函数获取评论树
    const { data: commentTree, error } = await supabase
      .rpc('get_annotation_comment_tree', {
        p_annotation_id: annotationId
      });

    if (error) {
      console.error('[API] Error fetching comment tree:', error);
      
      // 如果RPC失败,尝试直接查询
      const { data: flatComments, error: flatError } = await supabase
        .from('annotation_comments')
        .select(`
          *,
          users:user_id (
            username,
            avatar_url
          )
        `)
        .eq('annotation_id', annotationId)
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
        username: comment.users?.username || 'Anonymous',
        avatar_url: comment.users?.avatar_url || null
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
    });

  } catch (error) {
    console.error('[API] Unexpected error in comment tree endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

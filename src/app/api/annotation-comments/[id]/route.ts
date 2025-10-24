import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * PATCH /api/annotation-comments/[id]
 * 编辑标注评论
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 从请求头获取认证token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // 🔑 创建带auth header的客户端(用于RLS策略)
    const supabaseWithAuth = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      );
    }
    
    // 解析请求体
    const body = await request.json();
    const { content, isAnonymous } = body; // 🆕 添加isAnonymous参数

    // 验证必需参数
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: content' },
        { status: 400 }
      );
    }

    // 验证评论所有权
    const { data: comment, error: fetchError } = await supabaseWithAuth
      .from('annotation_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (comment.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only edit your own comments' },
        { status: 403 }
      );
    }

    // 更新评论
    const { data: updatedComment, error: updateError } = await supabaseWithAuth
      .from('annotation_comments')
      .update({
        content: content.trim(),
        is_anonymous: isAnonymous !== undefined ? isAnonymous : false, // 🆕 更新匿名状态
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
      .single();

    if (updateError) {
      console.error('[API] Error updating comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: {
        ...updatedComment,
        username: updatedComment.users?.username || 'Anonymous',
        avatar_url: updatedComment.users?.avatar_url || null
      }
    });

  } catch (error) {
    console.error('[API] Unexpected error in update comment endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/annotation-comments/[id]
 * 删除标注评论 (级联删除所有子评论)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 从请求头获取认证token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // 🔑 创建带auth header的客户端(用于RLS策略)
    const supabaseWithAuth = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      );
    }

    // 获取用户角色
    const { data: userData, error: userError } = await supabaseWithAuth
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userData?.role === 'admin';

    // 验证评论所有权
    const { data: comment, error: fetchError } = await supabaseWithAuth
      .from('annotation_comments')
      .select('user_id, annotation_id, parent_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // 🔑 管理员可以删除任意评论,普通用户只能删除自己的
    if (!isAdmin && comment.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own comments' },
        { status: 403 }
      );
    }

    // 删除评论 (数据库会自动级联删除子评论)
    const { error: deleteError } = await supabaseWithAuth
      .from('annotation_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('[API] Error deleting comment:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete comment', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comment and all its replies deleted successfully'
    });

  } catch (error) {
    console.error('[API] Unexpected error in delete comment endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

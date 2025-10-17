import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/annotation-comments/reply
 * 回复标注评论 (创建嵌套评论)
 */
export async function POST(request: Request) {
  try {
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
    
    // 🔑 创建带有用户token的认证客户端(用于RLS策略检查)
    const supabaseWithAuth = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    
    // 验证token并获取用户
    const { data: { user }, error: authError } = await supabaseWithAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { annotationId, parentId, content, isAnonymous } = body; // 🆕 添加isAnonymous

    // 验证必需参数
    if (!annotationId || !content || !content.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: annotationId and content' },
        { status: 400 }
      );
    }

    // 创建回复评论 - 使用带auth的客户端
    const { data: newComment, error: insertError } = await supabaseWithAuth
      .from('annotation_comments')
      .insert({
        annotation_id: annotationId,
        parent_id: parentId || null, // null表示顶级评论
        user_id: user.id,
        content: content.trim(),
        is_anonymous: isAnonymous || false // 🆕 添加匿名标志
      })
      .select(`
        *,
        users:user_id (
          username,
          avatar_url
        )
      `)
      .single();

    if (insertError) {
      console.error('[API] Error creating comment reply:', insertError);
      return NextResponse.json(
        { error: 'Failed to create comment reply', details: insertError.message },
        { status: 500 }
      );
    }

    // 格式化返回数据 - 🆕 匿名时隐藏用户信息
    const formattedComment = {
      ...newComment,
      username: newComment.is_anonymous ? '匿名用户' : (newComment.users?.username || 'Anonymous'),
      avatar_url: newComment.is_anonymous ? null : (newComment.users?.avatar_url || null),
      reply_count: 0,
      children: []
    };

    return NextResponse.json({
      success: true,
      comment: formattedComment
    });

  } catch (error) {
    console.error('[API] Unexpected error in reply endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

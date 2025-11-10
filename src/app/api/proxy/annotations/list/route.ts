import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken } from '@/lib/supabase-server';

// 创建admin客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClientWithToken(token);
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const since = searchParams.get('since');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!sessionId) {
      return NextResponse.json({ message: 'Session ID is required' }, { status: 400 });
    }

    // 🆕 从annotation_shares JOIN annotations获取共享标注
    // annotation_shares: annotation_id, session_id, user_id (共享者)
    // annotations: id, content, visibility, show_author_name, original_id(zotero_key), user_id (标注作者)
    let query = supabaseAdmin
      .from('annotation_shares')
      .select(`
        annotation_id,
        user_id,
        created_at,
        annotations!inner(
          id,
          document_id,
          content,
          comment,
          color,
          position,
          tags,
          visibility,
          show_author_name,
          original_id,
          created_at,
          updated_at,
          type,
          user_id
        )
      `)
      .eq('session_id', sessionId);

    if (since) {
      query = query.gt('created_at', since);
    }

    // Order by creation time BEFORE pagination
    query = query.order('created_at', { ascending: false});

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: shares, error } = await query;

    if (error) {
      console.error('Error fetching annotation shares:', error);
      return NextResponse.json({ message: 'Failed to fetch annotations', error: error.message }, { status: 500 });
    }

    // 批量获取用户信息(根据annotations.user_id)
    const userIds = [...new Set((shares || []).map((s: any) => s.annotations.user_id))];
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, username, email, avatar_url')
      .in('id', userIds);
    
    const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

    // 批量获取点赞数和评论数
    const annotationIds = (shares || []).map((s: any) => s.annotation_id);
    
    // 获取点赞数
    const { data: likesData } = await supabaseAdmin
      .from('annotation_likes')
      .select('annotation_id')
      .in('annotation_id', annotationIds);
    
    const likesMap = new Map<string, number>();
    (likesData || []).forEach((like: any) => {
      likesMap.set(like.annotation_id, (likesMap.get(like.annotation_id) || 0) + 1);
    });

    // 获取评论数
    const { data: commentsData } = await supabaseAdmin
      .from('annotation_comments')
      .select('annotation_id')
      .in('annotation_id', annotationIds);
    
    const commentsMap = new Map<string, number>();
    (commentsData || []).forEach((comment: any) => {
      commentsMap.set(comment.annotation_id, (commentsMap.get(comment.annotation_id) || 0) + 1);
    });

    // 转换为session_annotations格式(兼容现有前端代码)
    const annotations = (shares || []).map((share: any) => {
      const position = share.annotations.position;
      const pageNumber = position?.pageIndex !== undefined ? position.pageIndex + 1 : undefined;
      const annotationId = share.annotation_id;
      
      return {
        id: annotationId,
        user_id: share.annotations.user_id,
        created_at: share.annotations.created_at,
        updated_at: share.annotations.updated_at,
        visibility: share.annotations.visibility,
        show_author_name: share.annotations.show_author_name,
        page_number: pageNumber, // 从position.pageIndex提取(0-based -> 1-based)
        likes_count: likesMap.get(annotationId) || 0,
        comments_count: commentsMap.get(annotationId) || 0,
        annotation_data: {
          type: share.annotations.type,
          text: share.annotations.content,
          comment: share.annotations.comment,
          color: share.annotations.color,
          position: share.annotations.position,
          tags: share.annotations.tags,
          zotero_key: share.annotations.original_id
        },
        users: usersMap.get(share.annotations.user_id) || null
      };
    });

    return NextResponse.json({ success: true, annotations });
  } catch (error) {
    console.error('Error processing GET request for annotations:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

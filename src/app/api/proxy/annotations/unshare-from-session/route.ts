/**
 * 取消共享标注 API
 * POST /api/proxy/annotations/unshare-from-session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { annotation_id, session_id } = await request.json();

    console.log('[API] Unshare annotation from session request:', { annotation_id, session_id });

    // 验证用户登录
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查annotation_id是否提供
    if (!annotation_id) {
      return NextResponse.json(
        { error: 'annotation_id is required' },
        { status: 400 }
      );
    }

    // 构建删除查询
    let query = supabase
      .from('annotation_shares')
      .delete()
      .eq('annotation_id', annotation_id)
      .eq('user_id', user.id);

    // 如果提供了session_id,则删除特定会话的共享
    if (session_id !== undefined) {
      if (session_id === null) {
        query = query.is('session_id', null);
      } else {
        query = query.eq('session_id', session_id);
      }
    }
    // 如果没有提供session_id,则删除所有该annotation的共享记录

    const { error: deleteError } = await query;

    if (deleteError) {
      console.error('[API] Error deleting annotation share:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    console.log('[API] Annotation unshared successfully');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[API] Unexpected error in unshare-from-session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

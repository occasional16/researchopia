import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 查询标注的共享状态
 * GET /api/proxy/annotations/get-share-status?annotation_id=xxx&session_id=yyy
 * 
 * 返回:
 * {
 *   is_shared: boolean,
 *   share_scope: 'none' | 'session' | 'global',
 *   shared_sessions: string[] // 共享到的会话ID列表
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const annotation_id = searchParams.get('annotation_id');
    const session_id = searchParams.get('session_id') || null;

    if (!annotation_id) {
      return NextResponse.json(
        { error: 'annotation_id is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 查询该标注的所有共享记录
    const { data: shares, error } = await supabase
      .from('annotation_shares')
      .select('session_id')
      .eq('annotation_id', annotation_id);

    if (error) {
      console.error('[get-share-status] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 分析共享状态
    const shared_sessions = shares
      .filter(s => s.session_id !== null)
      .map(s => s.session_id);
    
    const has_global_share = shares.some(s => s.session_id === null);
    
    let share_scope: 'none' | 'session' | 'global' = 'none';
    let is_shared = false;

    if (has_global_share) {
      share_scope = 'global';
      is_shared = true;
    } else if (shared_sessions.length > 0) {
      share_scope = 'session';
      is_shared = true;
    }

    // 判断是否共享到当前会话
    const shared_to_current_session = session_id
      ? shared_sessions.includes(session_id)
      : false;

    return NextResponse.json({
      is_shared,
      share_scope,
      shared_sessions,
      shared_to_current_session,
    });

  } catch (err) {
    console.error('[get-share-status] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

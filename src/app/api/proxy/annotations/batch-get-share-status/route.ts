import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 批量查询多个标注的共享状态
 * POST /api/proxy/annotations/batch-get-share-status
 * Body: {
 *   annotation_ids: string[],
 *   session_id?: string | null
 * }
 * 
 * 返回:
 * {
 *   [annotation_id]: {
 *     is_shared: boolean,
 *     share_scope: 'none' | 'session' | 'global',
 *     shared_to_current_session: boolean
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { annotation_ids, session_id = null } = body;

    if (!annotation_ids || !Array.isArray(annotation_ids) || annotation_ids.length === 0) {
      return NextResponse.json(
        { error: 'annotation_ids array is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 批量查询所有标注的共享记录
    const { data: shares, error } = await supabase
      .from('annotation_shares')
      .select('annotation_id, session_id')
      .in('annotation_id', annotation_ids);

    if (error) {
      console.error('[batch-get-share-status] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 按annotation_id分组处理
    const result: Record<string, any> = {};

    annotation_ids.forEach(ann_id => {
      const ann_shares = shares.filter(s => s.annotation_id === ann_id);
      
      const has_global_share = ann_shares.some(s => s.session_id === null);
      const shared_sessions = ann_shares
        .filter(s => s.session_id !== null)
        .map(s => s.session_id);

      let share_scope: 'none' | 'session' | 'global' = 'none';
      let is_shared = false;

      if (has_global_share) {
        share_scope = 'global';
        is_shared = true;
      } else if (shared_sessions.length > 0) {
        share_scope = 'session';
        is_shared = true;
      }

      const shared_to_current_session = session_id
        ? shared_sessions.includes(session_id)
        : false;

      result[ann_id] = {
        is_shared,
        share_scope,
        shared_to_current_session,
      };
    });

    return NextResponse.json(result);

  } catch (err) {
    console.error('[batch-get-share-status] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

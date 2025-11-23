/**
 * 共享标注到会话 API
 * POST /api/proxy/annotations/share-to-session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClientWithToken, createAdminClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    // 支持Bearer token认证(用于Zotero插件)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let supabase;
    if (token) {
      supabase = createClientWithToken(token);
    } else {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabase = createClient(supabaseUrl, supabaseKey);
    }
    const { annotation_id, session_id } = await request.json();

    console.log('[API] Share annotation to session request:', { annotation_id, session_id });

    // 验证用户登录
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API] Authenticated user:', { id: user.id, email: user.email });

    // 检查annotation_id和session_id是否提供
    if (!annotation_id) {
      return NextResponse.json(
        { error: 'annotation_id is required' },
        { status: 400 }
      );
    }

    // session_id可以为null(全局共享)或UUID(会话内共享)
    
    // 检查是否已经存在该条共享记录
    let existingQuery = supabase
      .from('annotation_shares')
      .select('id, session_id')
      .eq('annotation_id', annotation_id)
      .eq('user_id', user.id);
    
    // 根据session_id是否为null进行过滤
    if (session_id === null || session_id === undefined) {
      existingQuery = existingQuery.is('session_id', null);
    } else {
      existingQuery = existingQuery.eq('session_id', session_id);
    }
    
    const { data: existing, error: checkError } = await existingQuery;

    if (checkError) {
      console.error('[API] Error checking existing share:', checkError);
    }

    if (existing && existing.length > 0) {
      console.log('[API] Annotation already shared to this session:', existing[0].id);
      return NextResponse.json(
        { message: 'Annotation already shared to this session', share_id: existing[0].id },
        { status: 200 }
      );
    }

    // 插入新的共享记录
    // 使用admin client绕过RLS policy,因为user authentication已在上面验证过
    console.log('[API] Attempting to insert share:', {
      annotation_id,
      user_id: user.id,
      session_id: session_id || null
    });

    const adminClient = createAdminClient();
    const { data: shareData, error: insertError } = await adminClient
      .from('annotation_shares')
      .insert({
        annotation_id,
        user_id: user.id,
        session_id: session_id || null, // null表示全局共享
      })
      .select()
      .single();

    if (insertError) {
      // 如果是唯一性约束冲突,说明已存在,返回成功
      if (insertError.code === '23505') {
        console.log('[API] Annotation already shared (caught by insert):', insertError.message);
        // 再次查询获取已存在的share_id
        const { data: existingShare } = await existingQuery;
        return NextResponse.json(
          { message: 'Annotation already shared to this session', share_id: existingShare?.[0]?.id },
          { status: 200 }
        );
      }
      
      console.error('[API] Error inserting annotation share:', insertError);
      console.error('[API] Insert details:', {
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        message: insertError.message
      });
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    console.log('[API] Annotation shared successfully:', shareData.id);

    return NextResponse.json({
      success: true,
      share_id: shareData.id,
    });
  } catch (error) {
    console.error('[API] Unexpected error in share-to-session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

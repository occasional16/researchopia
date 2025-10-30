import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken, createAdminClient } from '@/lib/supabase-server';

/**
 * 获取会话事件日志
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!sessionId) {
      return NextResponse.json({ success: false, message: '缺少session_id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 验证用户身份
    const userClient = createClientWithToken(token);
    const { error: authError } = await userClient.auth.getUser();
    if (authError) {
      return NextResponse.json({ success: false, message: '身份验证失败' }, { status: 401 });
    }

    // 使用admin权限查询日志
    const adminClient = createAdminClient();
    const { data: logs, error, count } = await adminClient
      .from('session_logs')
      .select('*', { count: 'exact' })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('[Session Logs API] Error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error: any) {
    console.error('[Session Logs API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '获取日志失败'
    }, { status: 500 });
  }
}

/**
 * 创建事件日志(内部使用)
 * 使用service role权限绕过RLS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, event_type, actor_id, actor_name, target_id, metadata } = body;

    if (!session_id || !event_type || !actor_id) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必填字段: session_id, event_type, actor_id' 
      }, { status: 400 });
    }

    // 验证用户身份（确保actor_id与token匹配）
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 使用带token的客户端验证身份
    const userClient = createClientWithToken(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user || user.id !== actor_id) {
      return NextResponse.json({ success: false, message: '身份验证失败' }, { status: 401 });
    }

    // 使用admin权限插入日志（绕过RLS）
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('session_logs')
      .insert({
        session_id,
        event_type,
        actor_id,
        actor_name,
        target_id,
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('[Session Logs API] Error creating log:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('[Session Logs API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '创建日志失败'
    }, { status: 500 });
  }
}

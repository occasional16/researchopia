import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken, createAdminClient } from '@/lib/supabase-server';

/**
 * 获取会话聊天消息
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const since = searchParams.get('since'); // 用于轮询,获取某个时间之后的消息

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

    // 使用admin权限查询消息
    const adminClient = createAdminClient();
    
    // 构建查询
    let queryBuilder = adminClient
      .from('session_chat')
      .select('*', { count: 'exact', head: false })
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }); // 聊天按时间正序

    // 如果提供since参数,只获取之后的消息(用于轮询)
    if (since) {
      queryBuilder = queryBuilder.gt('created_at', since);
    }
    
    // 应用分页
    const offset = (page - 1) * limit;
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
    
    console.log(`[Session Chat API] Querying session ${sessionId}, page=${page}, limit=${limit}, offset=${offset}, since=${since || 'null'}`);
    
    const query = queryBuilder;

    const { data: messages, error, count } = await query;

    if (error) {
      console.error('[Session Chat API] Error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    console.log(`[Session Chat API] GET returning ${(messages || []).length} messages for session ${sessionId}`);

    return NextResponse.json({
      success: true,
      data: messages || [],
      pagination: since ? undefined : {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error: any) {
    console.error('[Session Chat API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '获取消息失败'
    }, { status: 500 });
  }
}

/**
 * 发送聊天消息
 * 使用service role权限绕过RLS
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, message, message_type = 'text', metadata } = body;

    if (!session_id || !message) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必填字段: session_id, message' 
      }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 验证用户身份并获取用户信息
    const userClient = createClientWithToken(token);
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, message: '无效的token' }, { status: 401 });
    }

    // 获取用户详细信息（使用admin权限）
    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('username, email')
      .eq('id', user.id)
      .single();

    // 插入消息（使用admin权限绕过RLS）
    const { data, error } = await adminClient
      .from('session_chat')
      .insert({
        session_id,
        user_id: user.id,
        user_name: userData?.username || user.email || '未知用户',
        user_email: userData?.email || user.email,
        message,
        message_type,
        metadata
      })
      .select()
      .single();

    if (error) {
      console.error('[Session Chat API] Error sending message:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error: any) {
    console.error('[Session Chat API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '发送消息失败'
    }, { status: 500 });
  }
}

/**
 * 删除消息(仅自己的消息或会话主持人)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('message_id');

    if (!messageId) {
      return NextResponse.json({ success: false, message: '缺少message_id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, message: '未授权' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 验证用户身份
    const userClient = createClientWithToken(token);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: '身份验证失败' }, { status: 401 });
    }

    // 使用admin权限删除消息（RLS已通过验证检查）
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('session_chat')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id); // 只能删除自己的消息

    if (error) {
      console.error('[Session Chat API] Error deleting message:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '消息已删除'
    });

  } catch (error: any) {
    console.error('[Session Chat API] Error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '删除消息失败'
    }, { status: 500 });
  }
}

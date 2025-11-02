import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken, createAdminClient } from '@/lib/supabase-server';

// 禁用此API路由的缓存，确保实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    
    const isSinceQuery = Boolean(since);

    const selectOptions = isSinceQuery
      ? { head: false as const }
      : { count: 'exact' as const, head: false as const };

    // 构建基础查询
    let queryBuilder = adminClient
      .from('session_chat')
      .select('*', selectOptions)
      .eq('session_id', sessionId);

    if (isSinceQuery) {
      // since 查询始终按时间正序返回最新消息
      queryBuilder = queryBuilder
        .gt('created_at', since as string)
        .order('created_at', { ascending: true })
        .limit(limit);
    } else {
      // 默认获取最新消息,确保最新发送的消息一定在第一页
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    }
    
    const offsetLabel = isSinceQuery ? 'since-query' : `${(page - 1) * limit}`;
    console.log(`[Session Chat API] 🔍 GET: Querying session ${sessionId}, page=${page}, limit=${limit}, offset=${offsetLabel}, since=${since || 'null'}`);
    
    const query = queryBuilder;

    const { data: messages, error, count } = await query;

    if (error) {
      console.error('[Session Chat API] ❌ GET Error:', error);
      console.error('[Session Chat API] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details
      });
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const normalizedMessages = messages
      ? isSinceQuery
        ? messages
        : [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      : [];

    console.log(`[Session Chat API] ✅ GET: Returning ${normalizedMessages.length} messages for session ${sessionId}`,
      normalizedMessages.length > 0
        ? `First: ${normalizedMessages[0].id}, Last: ${normalizedMessages[normalizedMessages.length - 1].id}`
        : 'No messages');

    return NextResponse.json({
      success: true,
      data: normalizedMessages,
      pagination: isSinceQuery ? undefined : {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
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
    console.log('[Session Chat API] 💬 Inserting message:', {
      session_id,
      user_id: user.id,
      user_name: userData?.username || user.email || '未知用户',
      message: message.substring(0, 50),
      message_type
    });
    
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
      console.error('[Session Chat API] ❌ Error sending message:', error);
      console.error('[Session Chat API] Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    console.log('[Session Chat API] ✅ Message inserted successfully:', {
      id: data?.id,
      user_id: data?.user_id,
      message: data?.message?.substring(0, 50)
    });

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

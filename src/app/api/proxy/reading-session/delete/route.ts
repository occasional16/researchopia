import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken } from '@/lib/supabase-server';

// 禁用缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE /api/proxy/reading-session/delete
 * 删除会话
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '需要登录'
      }, { status: 401 });
    }

    const supabase = createClientWithToken(token);
    
    // 验证用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '无效的认证token'
      }, { status: 401 });
    }

    // 获取请求参数
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少 session_id 参数'
      }, { status: 400 });
    }

    // 检查会话是否存在且用户是创建者
    const { data: session, error: sessionError } = await supabase
      .from('reading_sessions')
      .select('id, creator_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: '会话不存在'
      }, { status: 404 });
    }

    if (session.creator_id !== user.id) {
      return NextResponse.json({
        success: false,
        error: '只有创建者可以删除会话'
      }, { status: 403 });
    }

    // 删除会话(级联删除相关数据)
    const { error: deleteError } = await supabase
      .from('reading_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      console.error('[API] Delete session error:', deleteError);
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { session_id: sessionId }
    });

  } catch (error) {
    console.error('[API] Delete session error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken } from '@/lib/supabase-server';

/**
 * GET /api/proxy/reading-session/members?session_id=xxx
 * 获取会话成员列表
 */
export async function GET(request: NextRequest) {
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

    // 获取成员列表,关联用户信息
    const { data: members, error: membersError } = await supabase
      .from('session_members')
      .select(`
        *,
        users:user_id (
          email,
          username,
          avatar_url
        )
      `)
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('[API] Get members error:', membersError);
      return NextResponse.json({
        success: false,
        error: membersError.message
      }, { status: 500 });
    }

    // 格式化成员数据
    const formattedMembers = (members || []).map(m => ({
      ...m,
      user_email: m.users?.email,
      user_name: m.users?.username || m.users?.email,
      avatar_url: m.users?.avatar_url,
    }));

    return NextResponse.json({
      success: true,
      data: formattedMembers
    });

  } catch (error) {
    console.error('[API] Get members error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器错误'
    }, { status: 500 });
  }
}

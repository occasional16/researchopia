/**
 * 会话管理API代理 - 获取会话列表
 * 支持查询公开会话、我的会话、我创建的会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken, createAnonClient } from '@/lib/supabase-server';

// 🔥 优化: 启用3分钟缓存 - 会话列表不需要秒级实时性
// 生产环境启用3分钟缓存
export const revalidate = 180;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'public'; // public, my, created
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabase = token ? createClientWithToken(token) : createAnonClient();
    
    let query = supabase
      .from('reading_sessions')
      .select(`
        *,
        creator:users!reading_sessions_creator_id_fkey(username, email)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (type === 'public') {
      // 公开会话
      query = query.eq('session_type', 'public');
    } else if (type === 'my' || type === 'created') {
      // 需要认证
      if (!token) {
        return NextResponse.json({
          success: false,
          error: '需要登录'
        }, { status: 401 });
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({
          success: false,
          error: '无效的认证token'
        }, { status: 401 });
      }

      if (type === 'created') {
        // 我创建的会话
        query = query.eq('creator_id', user.id);
      } else {
        // 我参与的会话
        const { data: memberSessions } = await supabase
          .from('session_members')
          .select('session_id')
          .eq('user_id', user.id);

        if (memberSessions && memberSessions.length > 0) {
          const sessionIds = memberSessions.map(m => m.session_id);
          query = query.in('id', sessionIds);
        } else {
          // 没有参与任何会话
          return NextResponse.json({
            success: true,
            data: []
          });
        }
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Session API] List sessions error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '获取会话列表失败'
      }, { status: 400 });
    }

    // 🔥 优化: 返回响应并设置缓存
    return NextResponse.json({
      success: true,
      data: data || []
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=360',
      }
    });

  } catch (error) {
    console.error('[Session API] List sessions failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

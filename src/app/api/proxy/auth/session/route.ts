/**
 * 认证API代理 - 验证Session
 * 为Zotero插件提供统一的session验证接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '未提供认证token'
      }, { status: 401 });
    }

    const supabase = createClientWithToken(token);

    // 获取当前用户
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      console.error('[Auth API] Session validation error:', error);
      return NextResponse.json({
        success: false,
        error: '会话已失效'
      }, { status: 401 });
    }

    // 获取用户详细信息
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, username, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[Auth API] Get user data error:', userError);
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: userData?.username || user.email?.split('@')[0],
          role: userData?.role || 'user',
          avatar_url: userData?.avatar_url,
          created_at: user.created_at,
          email_confirmed_at: user.email_confirmed_at,
          last_sign_in_at: user.last_sign_in_at
        }
      }
    });

  } catch (error) {
    console.error('[Auth API] Session validation failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

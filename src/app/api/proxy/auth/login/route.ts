/**
 * 认证API代理 - 登录
 * 为Zotero插件提供统一的登录接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: '邮箱和密码不能为空'
      }, { status: 400 });
    }

    const supabase = createAnonClient();

    // 登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[Auth API] Login error:', error);
      
      return NextResponse.json({
        success: false,
        error: error.message === 'Invalid login credentials' 
          ? '邮箱或密码错误' 
          : error.message
      }, { status: 401 });
    }

    if (!data.user || !data.session) {
      return NextResponse.json({
        success: false,
        error: '登录失败：未能获取用户信息'
      }, { status: 500 });
    }

    // 获取用户详细信息(role, username等)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, username, role, avatar_url')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      console.error('[Auth API] Get user data error:', userError);
    }

    console.log('[Auth API] ✅ Login successful:', data.user.email);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          username: userData?.username || data.user.email?.split('@')[0],
          role: userData?.role || 'user',
          avatar_url: userData?.avatar_url,
          created_at: data.user.created_at,
          email_confirmed_at: data.user.email_confirmed_at,
          last_sign_in_at: data.user.last_sign_in_at
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type
        }
      }
    });

  } catch (error) {
    console.error('[Auth API] Login failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

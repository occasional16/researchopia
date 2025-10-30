/**
 * 认证API代理 - 刷新Token
 * 为Zotero插件提供统一的token刷新接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json({
        success: false,
        error: 'refresh_token不能为空'
      }, { status: 400 });
    }

    const supabase = createAnonClient();

    // 刷新token
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('[Auth API] Refresh token error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || 'Token刷新失败'
      }, { status: 401 });
    }

    if (!data.session) {
      return NextResponse.json({
        success: false,
        error: 'Token刷新失败：未能获取新session'
      }, { status: 500 });
    }

    console.log('[Auth API] ✅ Token refreshed successfully');

    return NextResponse.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type
        },
        user: data.user
      }
    });

  } catch (error) {
    console.error('[Auth API] Refresh token failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

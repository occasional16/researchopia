/**
 * 认证API代理 - 登出
 * 为Zotero插件提供统一的登出接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
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

    // 登出
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[Auth API] Logout error:', error);
      // 即使登出失败也返回成功,因为客户端会清除本地session
    }

    console.log('[Auth API] ✅ Logout successful');

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('[Auth API] Logout failed:', error);
    // 登出失败不影响客户端,返回成功
    return NextResponse.json({
      success: true
    });
  }
}

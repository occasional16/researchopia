/**
 * 认证API代理 - 注册
 * 为Zotero插件提供统一的注册接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: '邮箱和密码不能为空'
      }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 创建用户
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        username: username || email.split('@')[0],
        full_name: username || email.split('@')[0]
      },
      email_confirm: false, // Zotero插件环境不需要邮箱验证
      phone_confirm: false
    });

    if (error) {
      console.error('[Auth API] Register error:', error);
      
      if (error.message?.includes('already been registered') || 
          error.message?.includes('already exists')) {
        return NextResponse.json({
          success: false,
          error: '该邮箱已被注册'
        }, { status: 400 });
      }
      
      return NextResponse.json({
        success: false,
        error: error.message || '注册失败'
      }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({
        success: false,
        error: '注册失败：未能创建用户'
      }, { status: 500 });
    }

    // 创建用户档案
    const { error: profileError } = await supabase
      .from('users')
      .insert([{
        id: data.user.id,
        email: data.user.email,
        username: username || email.split('@')[0],
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (profileError) {
      console.error('[Auth API] Profile creation error:', profileError);
    }

    console.log('[Auth API] ✅ Register successful:', data.user.email);

    return NextResponse.json({
      success: true,
      data: {
        user: data.user
      }
    });

  } catch (error) {
    console.error('[Auth API] Register failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

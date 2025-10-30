/**
 * 会话管理API代理 - 加入会话
 * 为Zotero插件提供统一的加入会话接口
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

    const { invite_code, session_id } = await request.json();

    if (!invite_code && !session_id) {
      return NextResponse.json({
        success: false,
        error: '邀请码或会话ID不能为空'
      }, { status: 400 });
    }

    const supabase = createClientWithToken(token);

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '无效的认证token'
      }, { status: 401 });
    }

    // 查询会话
    console.log('[Session API] Join request:', { invite_code, session_id });
    
    let query = supabase
      .from('reading_sessions')
      .select('*')
      .eq('is_active', true);

    if (invite_code) {
      query = query.eq('invite_code', invite_code);
    } else {
      query = query.eq('id', session_id);
    }

    const { data: sessionData, error: sessionError } = await query.single();

    console.log('[Session API] Query result:', { sessionData, sessionError });

    if (sessionError || !sessionData) {
      return NextResponse.json({
        success: false,
        error: '无效的邀请码或会话已结束'
      }, { status: 404 });
    }

    // 检查是否已经是成员
    const { data: existingMember } = await supabase
      .from('session_members')
      .select('*')
      .eq('session_id', sessionData.id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // 已经是成员,更新在线状态
      await supabase
        .from('session_members')
        .update({ is_online: true })
        .eq('id', existingMember.id);

      return NextResponse.json({
        success: true,
        data: {
          session: sessionData,
          member: existingMember
        },
        message: '已在会话中'
      });
    }

    // 检查是否满员
    const { count: memberCount } = await supabase
      .from('session_members')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionData.id);

    if (memberCount && memberCount >= sessionData.max_participants) {
      return NextResponse.json({
        success: false,
        error: '会话已满员'
      }, { status: 400 });
    }

    // 加入会话
    const { data: memberData, error: memberError } = await supabase
      .from('session_members')
      .insert([{
        session_id: sessionData.id,
        user_id: user.id,
        role: 'participant',
        is_online: true,
        current_page: 1,
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (memberError) {
      console.error('[Session API] Join session error:', memberError);
      return NextResponse.json({
        success: false,
        error: memberError.message || '加入会话失败'
      }, { status: 400 });
    }

    console.log('[Session API] ✅ Joined session:', sessionData.id);

    return NextResponse.json({
      success: true,
      data: {
        session: sessionData,
        member: memberData
      }
    });

  } catch (error) {
    console.error('[Session API] Join session failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

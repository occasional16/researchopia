/**
 * 会话管理API代理 - 创建会话
 * 为Zotero插件提供统一的创建会话接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken } from '@/lib/supabase-server';

// POST请求默认不缓存
export const dynamic = 'force-dynamic';

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

    const { paper_doi, paper_title, max_participants, is_public, description } = await request.json();

    if (!paper_doi || !paper_title) {
      return NextResponse.json({
        success: false,
        error: '论文DOI和标题不能为空'
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

    // 判断会话类型
    const sessionType = is_public ? 'public' : 'private';
    
    // 仅为私密会话生成邀请码
    const inviteCode = sessionType === 'private' 
      ? Math.random().toString(36).substring(2, 8).toUpperCase()
      : null;

    // 创建会话(公共会话不记录创建者和邀请码)
    const sessionData_insert: any = {
      paper_doi,
      paper_title,
      max_participants: null, // 完全取消人数限制
      session_type: sessionType,
      is_active: true,
      settings: {},
      created_at: new Date().toISOString()
    };
    
    // 仅私密会话记录创建者和邀请码
    if (sessionType === 'private') {
      sessionData_insert.creator_id = user.id;
      sessionData_insert.invite_code = inviteCode;
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('reading_sessions')
      .insert([sessionData_insert])
      .select()
      .single();

    if (sessionError) {
      console.error('[Session API] Create session error:', sessionError);
      return NextResponse.json({
        success: false,
        error: sessionError.message || '创建会话失败'
      }, { status: 400 });
    }

    // 自动加入会话(公共会话无host,都是participant)
    const memberRole = sessionType === 'private' ? 'host' : 'participant';
    const { data: memberData, error: memberError } = await supabase
      .from('session_members')
      .insert([{
        session_id: sessionData.id,
        user_id: user.id,
        role: memberRole,
        is_online: true,
        current_page: 1,
        joined_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (memberError) {
      console.error('[Session API] Add member error:', memberError);
    }

    console.log('[Session API] ✅ Session created:', sessionData.id);

    return NextResponse.json({
      success: true,
      data: {
        session: sessionData,
        member: memberData
      }
    });

  } catch (error) {
    console.error('[Session API] Create session failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

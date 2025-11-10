/**
 * 会话管理API代理 - 获取会话列表
 * 支持查询公开会话、我的会话、我创建的会话
 */

import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { createClientWithToken, createAnonClient, createAdminClient } from '@/lib/supabase-server';

// 强制动态渲染,禁用缓存确保实时性
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // 🔥 关键修复: 禁用Next.js Data Cache
  noStore();
  
  console.log('[Session List API] noStore() called - bypassing Data Cache');
  console.log('[Session List API] Request URL:', request.url);
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'public'; // public, my, created
    console.log(`[Session List API] Request type: ${type}`);
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    console.log('[Session List API] Has auth token:', !!token, token ? `(${token.substring(0, 10)}...)` : '');

    // 先判断是否需要认证，获取用户信息
    let userId: string | null = null;
    if (type === 'joined' || type === 'my' || type === 'created') {
      if (!token) {
        return NextResponse.json({
          success: false,
          error: '需要登录'
        }, { status: 401 });
      }

      // 使用 token client 获取用户信息
      const authClient = createClientWithToken(token);
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) {
        console.error('[Session List API] Auth error:', userError);
        return NextResponse.json({
          success: false,
          error: '无效的认证token'
        }, { status: 401 });
      }
      userId = user.id;
      console.log('[Session List API] Authenticated user:', userId.substring(0, 8));
    }

    // 🔥 关键修复: 对于 public 和 joined 查询，使用 Admin Client 绕过 RLS
    // 原因: RLS 策略会让用户看到自己创建的所有会话，导致应用层过滤失效
    const supabase = (type === 'public' || type === 'joined' || type === 'my') 
      ? createAdminClient() 
      : (token ? createClientWithToken(token) : createAnonClient());
    
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
      console.log('[Session List API] Querying public sessions with filter: session_type=public, is_active=true');
      query = query.eq('session_type', 'public');
    } else if (type === 'joined' || type === 'my' || type === 'created') {
      if (type === 'created') {
        // 我创建的会话
        console.log('[Session List API] Querying created sessions for user:', userId!.substring(0, 8));
        query = query.eq('creator_id', userId!);
      } else {
        // 我加入的会话 (参与但不是创建者) - type=joined 或 type=my
        console.log('[Session List API] Querying joined sessions for user:', userId!.substring(0, 8));
        
        const { data: memberSessions } = await supabase
          .from('session_members')
          .select('session_id')
          .eq('user_id', userId!);

        console.log('[Session List API] User is member of', memberSessions?.length || 0, 'sessions');

        if (memberSessions && memberSessions.length > 0) {
          const sessionIds = memberSessions.map(m => m.session_id);
          console.log('[Session List API] Filtering to exclude sessions created by user:', userId!.substring(0, 8));
          // 🔥 关键修复: 排除自己创建的私密会话,但包含公共会话(creator_id为NULL)
          query = query
            .in('id', sessionIds)
            .or(`creator_id.neq.${userId!},creator_id.is.null`);
          
          console.log('[Session List API] Filter chain:', {
            sessionIdsCount: sessionIds.length,
            willExcludeCreator: userId!.substring(0, 8),
            includePublicSessions: true
          });
        } else {
          // 没有参与任何会话
          console.log('[Session List API] User is not a member of any sessions');
          return NextResponse.json({
            success: true,
            data: []
          });
        }
      }
    }

    const { data, error } = await query;
    
    console.log(`[Session List API] Query result for type=${type}:`, {
      dataCount: data?.length || 0,
      hasError: !!error,
      sessionIds: data?.map(s => s.id.substring(0, 8)) || [],
      firstSession: data && data.length > 0 ? {
        id: data[0].id.substring(0, 8),
        type: data[0].session_type,
        active: data[0].is_active
      } : null
    });

    if (error) {
      console.error('[Session API] List sessions error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '获取会话列表失败'
      }, { status: 400 });
    }

    // 为每个会话添加成员数和在线人数统计
    const sessionsWithCounts = await Promise.all((data || []).map(async (session) => {
      // 查询总成员数
      const { count: memberCount } = await supabase
        .from('session_members')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id);

      // 查询在线成员数
      const { count: onlineCount } = await supabase
        .from('session_members')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('is_online', true);

      return {
        ...session,
        member_count: memberCount || 0,
        online_count: onlineCount || 0
      };
    }));

    // 🔥 优化: 返回响应并设置强制禁用缓存
    return NextResponse.json({
      success: true,
      data: sessionsWithCounts
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
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


 
 
 

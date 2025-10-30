/**
 * 标注管理API代理 - 统一处理CRUD操作
 * 支持: GET(list/shared), POST(create), PATCH(update), DELETE(delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientWithToken, createAnonClient } from '@/lib/supabase-server';

// GET - 获取标注列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const document_id = searchParams.get('document_id');
    const type = searchParams.get('type') || 'all'; // all, shared, my
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!document_id) {
      return NextResponse.json({
        success: false,
        error: 'document_id不能为空'
      }, { status: 400 });
    }

    const supabase = token ? createClientWithToken(token) : createAnonClient();

    let query = supabase
      .from('annotations')
      .select(`
        *,
        user:users(username, email, avatar_url)
      `)
      .eq('document_id', document_id)
      .order('created_at', { ascending: false });

    if (type === 'shared') {
      query = query.in('visibility', ['public', 'shared']);
    } else if (type === 'my' && token) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        query = query.eq('user_id', user.id);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Annotations API] Get annotations error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '获取标注失败'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('[Annotations API] Get annotations failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

// POST - 创建标注
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '需要登录'
      }, { status: 401 });
    }

    const annotationData = await request.json();
    const { document_id, type, content, comment, color, position, tags, visibility } = annotationData;

    if (!document_id) {
      return NextResponse.json({
        success: false,
        error: 'document_id不能为空'
      }, { status: 400 });
    }

    const supabase = createClientWithToken(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '无效的认证token'
      }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('annotations')
      .insert([{
        document_id,
        user_id: user.id,
        type: type || 'highlight',
        content: content || null,
        comment: comment || null,
        color: color || '#ffd400',
        position: position || {},
        tags: tags || [],
        visibility: visibility || 'private',
        show_author_name: true,
        platform: 'zotero',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('[Annotations API] Create annotation error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '创建标注失败'
      }, { status: 400 });
    }

    console.log('[Annotations API] ✅ Annotation created:', data.id);

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[Annotations API] Create annotation failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

// PATCH - 更新标注
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '需要登录'
      }, { status: 401 });
    }

    const { id, ...updateData } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'annotation id不能为空'
      }, { status: 400 });
    }

    const supabase = createClientWithToken(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '无效的认证token'
      }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('annotations')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id) // 只能更新自己的标注
      .select()
      .single();

    if (error) {
      console.error('[Annotations API] Update annotation error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '更新标注失败'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[Annotations API] Update annotation failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

// DELETE - 删除标注
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '需要登录'
      }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'annotation id不能为空'
      }, { status: 400 });
    }

    const supabase = createClientWithToken(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '无效的认证token'
      }, { status: 401 });
    }

    const { error } = await supabase
      .from('annotations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // 只能删除自己的标注

    if (error) {
      console.error('[Annotations API] Delete annotation error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '删除标注失败'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('[Annotations API] Delete annotation failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

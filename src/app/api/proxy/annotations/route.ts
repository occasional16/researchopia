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
    let orderParam = searchParams.get('order') || 'created_at.desc'; // 🔥 使用let允许重新赋值
    const filter = searchParams.get('filter') || 'all'; // 新增: all, others, followed
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!document_id) {
      return NextResponse.json({
        success: false,
        error: 'document_id不能为空'
      }, { status: 400 });
    }

    const supabase = token ? createClientWithToken(token) : createAnonClient();

    // 🔧 JSONB字段特殊处理: position.pageIndex.asc/desc
    let needsClientSort = false;
    let clientSortField = '';
    let clientSortAscending = false;
    
    if (orderParam.startsWith('position.pageIndex.')) {
      // position.pageIndex.asc/desc → 在前端排序
      needsClientSort = true;
      clientSortField = 'pageIndex';
      clientSortAscending = orderParam.endsWith('.asc'); // 🔥 从完整参数提取方向
      // 后端先按created_at降序获取数据
      orderParam = 'created_at.desc';
    }
    
    // 🔧 解析排序参数 (格式: "field.asc" 或 "field.desc")
    const parts = orderParam.split('.');
    let orderField = parts[0] || 'created_at';
    let orderDirection = parts[1] || 'desc';

    // 🔧 验证排序字段 (防止SQL注入)
    const allowedFields = ['created_at', 'updated_at', 'likes_count', 'comments_count'];
    const finalOrderField = allowedFields.includes(orderField) ? orderField : 'created_at';
    const finalAscending = orderDirection === 'asc';

    let query = supabase
      .from('annotations')
      .select(`
        *,
        user:users(username, email, avatar_url)
      `)
      .eq('document_id', document_id)
      .order(finalOrderField, { ascending: finalAscending });

    // 🔧 获取当前用户ID (用于筛选逻辑)
    let currentUserId: string | null = null;
    if (token) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        currentUserId = user.id;
      }
    }

    if (type === 'shared') {
      query = query.in('visibility', ['public', 'shared']);
    } else if (type === 'my' && token && currentUserId) {
      query = query.eq('user_id', currentUserId);
    }

    // 🔧 新筛选逻辑: all/others/followed
    if (filter === 'all') {
      // 所有按钮: 他人的public/anonymous + 自己的所有(含private)
      if (!currentUserId) {
        // 未登录: 仅显示public/anonymous
        query = query.in('visibility', ['public', 'anonymous']);
      }
      // 已登录: 不添加额外筛选,后端合并数据 (见下方特殊处理)
    } else if (filter === 'others') {
      // 他人按钮: 排除自己,仅public/anonymous
      query = query.in('visibility', ['public', 'anonymous']);
      if (currentUserId) {
        query = query.neq('user_id', currentUserId);
      }
    } else if (filter === 'followed') {
      // 关注按钮: 仅关注用户的public(不含anonymous)
      if (!currentUserId) {
        // 未登录返回空
        return NextResponse.json({
          success: true,
          data: []
        });
      }
      
      // 获取关注列表
      const { data: follows } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      
      if (follows && follows.length > 0) {
        const followedIds = follows.map(f => f.following_id);
        query = query.in('user_id', followedIds).eq('visibility', 'public');
      } else {
        // 未关注任何人返回空
        return NextResponse.json({
          success: true,
          data: []
        });
      }
    }

    // 🔧 filter=all 特殊处理: 需要合并两次查询
    let finalData: any[] = [];
    
    if (filter === 'all' && currentUserId) {
      // 查询1: 他人的public/anonymous
      const query1 = supabase
        .from('annotations')
        .select(`*, user:users(username, email, avatar_url)`)
        .eq('document_id', document_id)
        .neq('user_id', currentUserId)
        .in('visibility', ['public', 'anonymous'])
        .order(finalOrderField, { ascending: finalAscending });
      
      // 查询2: 自己的所有(含private)
      const query2 = supabase
        .from('annotations')
        .select(`*, user:users(username, email, avatar_url)`)
        .eq('document_id', document_id)
        .eq('user_id', currentUserId)
        .order(finalOrderField, { ascending: finalAscending });
      
      const [result1, result2] = await Promise.all([query1, query2]);
      
      if (result1.error || result2.error) {
        console.error('[Annotations API] Get annotations error:', result1.error || result2.error);
        return NextResponse.json({
          success: false,
          error: '获取标注失败'
        }, { status: 400 });
      }
      
      // 合并结果
      finalData = [...(result1.data || []), ...(result2.data || [])];
      
      // 需要重新排序 (因为合并后顺序被打乱)
      if (!needsClientSort) {
        finalData.sort((a, b) => {
          const valA = a[finalOrderField];
          const valB = b[finalOrderField];
          if (finalAscending) {
            return valA > valB ? 1 : -1;
          } else {
            return valA < valB ? 1 : -1;
          }
        });
      }
    } else {
      // 其他filter直接查询
      const { data, error } = await query;

      if (error) {
        console.error('[Annotations API] Get annotations error:', error);
        return NextResponse.json({
          success: false,
          error: error.message || '获取标注失败'
        }, { status: 400 });
      }

      finalData = data || [];
    }

    // 🔧 前端排序 (JSONB字段)
    if (needsClientSort && clientSortField === 'pageIndex') {
      finalData = finalData.sort((a, b) => {
        const pageA = a.position?.pageIndex ?? -1;
        const pageB = b.position?.pageIndex ?? -1;
        return clientSortAscending ? pageA - pageB : pageB - pageA; // 🔥 使用保存的排序方向
      });
    }

    return NextResponse.json({
      success: true,
      data: finalData
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
    const { document_id, type, content, comment, color, position, tags, visibility, original_id, show_author_name } = annotationData;

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
        show_author_name: show_author_name !== undefined ? show_author_name : true,
        original_id: original_id || null,
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

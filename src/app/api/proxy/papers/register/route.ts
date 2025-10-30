/**
 * 论文注册API代理
 * 为Zotero插件提供统一的论文注册接口
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

    const { doi, title, authors, abstract, publication_date, journal } = await request.json();

    if (!doi && !title) {
      return NextResponse.json({
        success: false,
        error: 'DOI或标题至少提供一个'
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

    // 检查论文是否已存在
    if (doi) {
      const { data: existingPaper } = await supabase
        .from('papers')
        .select('*')
        .eq('doi', doi)
        .single();

      if (existingPaper) {
        return NextResponse.json({
          success: true,
          data: { paper: existingPaper },
          message: '论文已存在'
        });
      }
    }

    // 创建论文记录
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .insert([{
        doi: doi || null,
        title,
        authors: authors || null,
        abstract: abstract || null,
        publication_date: publication_date || null,
        journal: journal || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (paperError) {
      console.error('[Papers API] Register paper error:', paperError);
      return NextResponse.json({
        success: false,
        error: paperError.message || '注册论文失败'
      }, { status: 400 });
    }

    console.log('[Papers API] ✅ Paper registered:', paperData.id);

    return NextResponse.json({
      success: true,
      data: { paper: paperData }
    });

  } catch (error) {
    console.error('[Papers API] Register paper failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 });
  }
}

/**
 * 论文检查API代理
 * 检查论文是否已注册
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doi = searchParams.get('doi');
    const title = searchParams.get('title');

    if (!doi && !title) {
      return NextResponse.json({
        success: false,
        error: 'DOI或标题至少提供一个'
      }, { status: 400 });
    }

    const supabase = createAnonClient();

    let query = supabase
      .from('papers')
      .select('id, doi, title');

    if (doi) {
      query = query.eq('doi', doi);
    } else if (title) {
      query = query.eq('title', title);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return NextResponse.json({
          success: true,
          exists: false,
          data: null
        });
      }
      
      console.error('[Papers API] Check paper error:', error);
      return NextResponse.json({
        success: false,
        error: error.message || '检查论文失败'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      data
    });

  } catch (error) {
    console.error('[Papers API] Check paper failed:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

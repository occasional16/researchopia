import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/proxy/papers/reading-history
 * 记录用户打开论文的历史
 * 
 * Body参数:
 * - doi: 论文的DOI
 * 
 * 功能:
 * - 如果是首次阅读，创建新记录
 * - 如果已存在，更新last_read_at和read_count
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { doi } = body;

    if (!doi) {
      return NextResponse.json(
        { success: false, message: 'DOI is required' },
        { status: 400 }
      );
    }

    // 从请求头获取token并创建客户端
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : undefined
    });
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Reading History API] Recording for user:', user.id, 'DOI:', doi);

    // 先查询是否已存在记录
    const { data: existingRecord } = await supabase
      .from('paper_reading_history')
      .select('id, read_count')
      .eq('paper_doi', doi)
      .eq('user_id', user.id)
      .maybeSingle();

    let recordId: string;

    if (existingRecord) {
      // 如果存在，更新last_read_at和增加read_count
      const { data: updated, error: updateError } = await supabase
        .from('paper_reading_history')
        .update({
          last_read_at: new Date().toISOString(),
          read_count: (existingRecord.read_count || 1) + 1,
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Reading History API] Update error:', updateError);
        return NextResponse.json(
          { success: false, message: updateError.message },
          { status: 500 }
        );
      }

      recordId = updated.id;
      console.log('[Reading History API] Updated existing record:', recordId);
    } else {
      // 如果不存在，插入新记录
      const { data: inserted, error: insertError } = await supabase
        .from('paper_reading_history')
        .insert({
          paper_doi: doi,
          user_id: user.id,
          first_read_at: new Date().toISOString(),
          last_read_at: new Date().toISOString(),
          read_count: 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Reading History API] Insert error:', insertError);
        return NextResponse.json(
          { success: false, message: insertError.message },
          { status: 500 }
        );
      }

      recordId = inserted.id;
      console.log('[Reading History API] Created new record:', recordId);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Reading history recorded',
        id: recordId,
      }
    });
  } catch (error) {
    console.error('[Reading History API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/proxy/papers/reading-history?doi=xxx
 * 删除用户的论文阅读历史
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doi = searchParams.get('doi');

    if (!doi) {
      return NextResponse.json(
        { success: false, message: 'DOI is required' },
        { status: 400 }
      );
    }

    // 从请求头获取token并创建客户端
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: token ? {
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : undefined
    });
    
    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Reading History API] Deleting for user:', user.id, 'DOI:', doi);

    const { error } = await supabase
      .from('paper_reading_history')
      .delete()
      .eq('paper_doi', doi)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Reading History API] Delete error:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    console.log('[Reading History API] Delete success');

    return NextResponse.json({
      success: true,
      data: {
        message: 'Reading history deleted',
      }
    });
  } catch (error) {
    console.error('[Reading History API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

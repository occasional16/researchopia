import { NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase-server';

/**
 * GET /api/proxy/papers/stats
 * 获取论文的全局统计数据（总阅读人数和当前在线人数）
 * 
 * Query参数:
 * - doi: 论文的DOI
 * 
 * 返回:
 * - total_readers: 读过此论文的总人数
 * - online_readers: 当前正在阅读此论文的人数
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const doi = searchParams.get('doi');

    console.log('[Papers Stats API] Request for DOI:', doi);

    if (!doi) {
      return NextResponse.json(
        { message: 'DOI parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAnonClient();

    // 1. 获取论文ID
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('id')
      .eq('doi', doi)
      .single();

    console.log('[Papers Stats API] Paper query result:', { paper, paperError });

    if (paperError || !paper) {
      // 论文不存在，返回0
      console.log('[Papers Stats API] Paper not found, returning 0');
      return NextResponse.json({
        success: true,
        data: {
          doi,
          total_readers: 0,
          online_readers: 0,
        }
      });
    }

    // 2. 统计总阅读人数（从paper_reading_history表统计不同用户）
    const { count, error: countError } = await supabase
      .from('paper_reading_history')
      .select('*', { count: 'exact', head: true })
      .eq('paper_doi', doi);

    console.log('[Papers Stats API] Reading history count result:', {
      count,
      error: countError,
    });

    const total_readers = count || 0;
    console.log('[Papers Stats API] Total readers found:', total_readers);

    // 3. 统计在线人数（最近5分钟内阅读过的用户）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: onlineCount, error: onlineError } = await supabase
      .from('paper_reading_history')
      .select('*', { count: 'exact', head: true })
      .eq('paper_doi', doi)
      .gte('last_read_at', fiveMinutesAgo);

    console.log('[Papers Stats API] Online readers query result:', {
      count: onlineCount,
      error: onlineError,
      threshold: fiveMinutesAgo,
    });

    const online_readers = onlineCount || 0;

    const result = {
      success: true,
      data: {
        doi,
        total_readers,
        online_readers, // 需要客户端通过WebSocket订阅获取
      }
    };
    
    console.log('[Papers Stats API] Returning result:', result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Papers Stats API] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

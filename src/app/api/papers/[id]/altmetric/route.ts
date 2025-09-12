import { NextRequest, NextResponse } from 'next/server'
import { altmetricService } from '@/lib/altmetric-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const doi = searchParams.get('doi')

    if (!doi) {
      return NextResponse.json(
        { error: 'DOI参数是必需的' },
        { status: 400 }
      )
    }

    console.log(`📊 获取论文的Altmetric数据: ${doi}`)

    // 获取新闻和博客提及
    const mentions = await altmetricService.getNewsAndBlogMentions(doi)
    
    // 获取统计信息
    const stats = await altmetricService.getMentionStats(doi)

    return NextResponse.json({
      success: true,
      paper_id: id,
      doi: doi,
      stats: stats,
      mentions: mentions,
      message: mentions.length > 0 
        ? `找到 ${mentions.length} 条新闻和博客报道` 
        : '未找到相关报道'
    })

  } catch (error: any) {
    console.error('获取Altmetric数据失败:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: '获取数据失败',
        details: error?.message || String(error),
        mentions: [],
        stats: {
          news_count: 0,
          blog_count: 0,
          total_mentions: 0,
          altmetric_score: 0
        }
      },
      { status: 500 }
    )
  }
}
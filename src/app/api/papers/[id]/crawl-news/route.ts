import { NextRequest, NextResponse } from 'next/server'
import { simpleCrawlerService } from '@/lib/simple-crawler-service'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title, doi } = await request.json()

    if (!title) {
      return NextResponse.json(
        { error: '论文标题是必需的' },
        { status: 400 }
      )
    }

    console.log(`🔍 开始爬取论文相关新闻: ${title}`)

    // 构建搜索查询
    let searchQuery = title
    if (doi) {
      searchQuery += ` ${doi}`
    }

    // 执行爬虫搜索
    const crawledArticles = await simpleCrawlerService.searchNews(searchQuery, 15)

    if (crawledArticles.length === 0) {
      return NextResponse.json({
        success: true,
        found: 0,
        added: 0,
        message: '未找到相关新闻报道',
        reports: []
      })
    }

    // 将爬取到的文章保存到数据库
    let addedCount = 0
    const savedReports: any[] = []

    for (const article of crawledArticles) {
      try {
        const reportData = {
          paper_id: id,
          title: article.title,
          url: article.url,
          source: 'news', // 统一标记为新闻来源
          author: article.author || article.source,
          publish_date: article.publishDate || null,
          description: article.description || '',
          view_count: 0
        }

        const { data, error } = await (supabase as any)!
          .from('paper_reports')
          .insert([reportData])
          .select()

        if (error) {
          if (error.code === '23505') {
            // URL重复，跳过
            console.log(`⚠️ 重复报道已跳过: ${article.title}`)
            continue
          }
          throw error
        }

        if (data && data[0]) {
          savedReports.push(data[0])
          addedCount++
          console.log(`✅ 已保存: ${article.title}`)
        }

      } catch (error) {
        console.error(`❌ 保存报道失败: ${article.title}`, error)
        continue
      }
    }

    return NextResponse.json({
      success: true,
      found: crawledArticles.length,
      added: addedCount,
      message: addedCount > 0 
        ? `成功爬取 ${crawledArticles.length} 条相关报道，新增 ${addedCount} 条` 
        : `找到 ${crawledArticles.length} 条报道，但都已存在`,
      reports: savedReports,
      crawlDetails: {
        totalCrawled: crawledArticles.length,
        newArticles: addedCount,
        duplicates: crawledArticles.length - addedCount,
        sources: [...new Set(crawledArticles.map(a => a.source))]
      }
    })

  } catch (error: any) {
    console.error('爬虫搜索失败:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: '爬取新闻失败',
        details: error?.message || String(error),
        found: 0,
        added: 0,
        reports: []
      },
      { status: 500 }
    )
  }
}
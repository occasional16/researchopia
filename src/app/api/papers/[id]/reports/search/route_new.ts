import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { wechatSearchService } from '@/lib/wechat-search'

// POST - 搜索微信公众号文章
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    const body = await request.json()
    const { query, source = 'wechat' } = body
    
    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 开始搜索论文相关报道: "${query}"`)

    // 使用微信搜索服务
    const searchResults = await wechatSearchService.searchArticles(query.trim())
    
    let addedCount = 0
    const newReports = []

    for (const result of searchResults) {
      try {
        if (!supabase) {
          // Mock mode - just return the search results
          newReports.push(result)
          addedCount++
          continue
        }

        // 检查是否已存在相同URL的报道
        const { data: existingReport } = await supabase
          .from('paper_reports')
          .select('id')
          .eq('paper_id', paperId)
          .eq('url', result.url)
          .single()

        if (!existingReport) {
          const { data: newReport, error } = await (supabase as any)
            .from('paper_reports')
            .insert({
              paper_id: paperId,
              title: result.title,
              url: result.url,
              source: result.source,
              author: result.author,
              publish_date: result.publish_date,
              description: result.description,
              thumbnail_url: result.thumbnail_url,
              created_by: null // TODO: 添加用户认证后设置实际用户ID
            })
            .select()
            .single()

          if (!error) {
            newReports.push(newReport)
            addedCount++
          } else {
            console.error('插入报道失败:', error)
          }
        } else {
          console.log(`📝 报道已存在，跳过: ${result.title}`)
        }
      } catch (error) {
        console.error('Error adding search result:', error)
      }
    }

    console.log(`✅ 搜索完成: 找到${searchResults.length}条，新增${addedCount}条`)

    return NextResponse.json({
      success: true,
      found: searchResults.length,
      added: addedCount,
      reports: newReports,
      message: addedCount > 0 
        ? `成功添加 ${addedCount} 条新报道` 
        : searchResults.length > 0 
          ? '找到相关报道，但都已存在' 
          : '未找到相关报道'
    })
    
  } catch (error) {
    console.error('Search API Error:', error)
    return NextResponse.json(
      { 
        error: 'Search failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
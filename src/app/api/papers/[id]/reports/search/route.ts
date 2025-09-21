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

// 实现真实的微信公众号文章搜索功能
async function searchWeChatArticlesReal(query: string) {
  try {
    console.log('🔍 开始搜索微信文章:', query)
    
    // 方法1: 使用搜索引擎API搜索微信公众号文章
    const searchResults = await searchWithBingAPI(query)
    if (searchResults.length > 0) {
      return searchResults
    }

    // 方法2: 使用微信公众号平台搜索
    const wechatResults = await searchWeChatPlatform(query)
    if (wechatResults.length > 0) {
      return wechatResults
    }

    // 方法3: 使用第三方聚合搜索API
    const aggregatedResults = await searchWithAggregatedAPI(query)
    return aggregatedResults

  } catch (error) {
    console.error('真实搜索出错，使用模拟数据:', error)
    return await searchWeChatArticlesMock(query)
  }
}

// 使用Bing搜索API搜索微信公众号文章
async function searchWithBingAPI(query: string) {
  try {
    // 构建专门搜索微信公众号的查询
    const searchQuery = `site:mp.weixin.qq.com "${query}" OR "${query}" 论文 研究`
    
    // 注意：这需要Bing Search API的订阅密钥
    const bingApiKey = process.env.BING_SEARCH_API_KEY
    if (!bingApiKey) {
      console.log('⚠️ 未配置Bing搜索API密钥')
      return []
    }

    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=10&mkt=zh-CN`, {
      headers: {
        'Ocp-Apim-Subscription-Key': bingApiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Bing API error: ${response.status}`)
    }

    const data = await response.json()
    const results = []

    for (const item of data.webPages?.value || []) {
      if (item.url.includes('mp.weixin.qq.com')) {
        results.push({
          title: item.name,
          url: item.url,
          source: 'wechat' as const,
          author: extractWeChatAuthor(item.snippet),
          publish_date: extractDateFromSnippet(item.snippet),
          description: item.snippet?.slice(0, 200),
          thumbnail_url: null,
          view_count: 0
        })
      }
    }

    console.log(`✅ Bing搜索找到 ${results.length} 条微信文章`)
    return results

  } catch (error) {
    console.error('Bing搜索失败:', error)
    return []
  }
}

// 使用微信公众号平台搜索 (需要access_token)
async function searchWeChatPlatform(query: string) {
  try {
    const accessToken = process.env.WECHAT_ACCESS_TOKEN
    if (!accessToken) {
      console.log('⚠️ 未配置微信平台访问令牌')
      return []
    }

    // 微信公众号文章搜索API
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/freepublishapi/batchget?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        offset: 0,
        count: 10,
        no_content: 0
      })
    })

    const data = await response.json()
    const results = []

    for (const item of data.item || []) {
      const content = item.content
      if (content.news_item) {
        for (const article of content.news_item) {
          if (article.title.includes(query) || article.digest.includes(query)) {
            results.push({
              title: article.title,
              url: article.url,
              source: 'wechat' as const,
              author: article.author,
              publish_date: new Date(item.update_time * 1000).toISOString().split('T')[0],
              description: article.digest,
              thumbnail_url: article.thumb_url,
              view_count: 0
            })
          }
        }
      }
    }

    console.log(`✅ 微信平台搜索找到 ${results.length} 条文章`)
    return results

  } catch (error) {
    console.error('微信平台搜索失败:', error)
    return []
  }
}

// 使用第三方聚合搜索API
async function searchWithAggregatedAPI(query: string) {
  try {
    // 这里可以集成如神箭手、八爪鱼等第三方数据服务
    // 示例使用一个虚拟的第三方API
    const apiKey = process.env.THIRD_PARTY_SEARCH_API_KEY
    if (!apiKey) {
      console.log('⚠️ 未配置第三方搜索API密钥')
      return []
    }

    const response = await fetch('https://api.example-search-service.com/wechat/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        platform: 'wechat',
        limit: 10
      })
    })

    if (!response.ok) {
      throw new Error(`第三方API错误: ${response.status}`)
    }

    const data = await response.json()
    const results = data.results?.map((item: any) => ({
      title: item.title,
      url: item.url,
      source: 'wechat' as const,
      author: item.author,
      publish_date: item.publish_date,
      description: item.description,
      thumbnail_url: item.thumbnail,
      view_count: item.view_count || 0
    })) || []

    console.log(`✅ 第三方API搜索找到 ${results.length} 条文章`)
    return results

  } catch (error) {
    console.error('第三方API搜索失败:', error)
    return []
  }
}

// 智能模拟搜索 - 基于关键词生成更真实的结果
async function searchWeChatArticlesMock(query: string) {
  console.log('🎭 使用智能模拟搜索:', query)
  
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // 基于查询词生成更相关的结果
  const keywords = query.split(/\s+/).filter(word => word.length > 1)
  const relevantTerms = [
    '研究', '论文', '科学', '发现', '突破', '进展', '创新', '技术',
    '学者', '团队', '实验', '分析', '方法', '理论', '应用', '前景'
  ]
  
  // 生成多样化的公众号名称
  const wechatAccounts = [
    '科学前沿', '学术资讯', '研究动态', '科技日报', '自然科学',
    '前沿科技', '学术圈', '科研进展', '创新中国', '科学探索',
    '学术头条', '研究前沿', '科技创新', '学术观察', '科学发现'
  ]
  
  const mockResults = []
  const resultCount = Math.floor(Math.random() * 4) + 2 // 2-5个结果
  
  for (let i = 0; i < resultCount; i++) {
    const randomAccount = wechatAccounts[Math.floor(Math.random() * wechatAccounts.length)]
    const randomTerm = relevantTerms[Math.floor(Math.random() * relevantTerms.length)]
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)] || query
    
    // 生成更真实的标题
    const titleTemplates = [
      `重大${randomTerm}！关于"${randomKeyword}"的最新发现`,
      `深度解析：${randomKeyword}${randomTerm}的科学价值`,
      `${randomTerm}突破：${randomKeyword}领域取得重要进展`,
      `专家解读：${randomKeyword}${randomTerm}的影响与意义`,
      `前沿追踪：${randomKeyword}${randomTerm}引发学术关注`
    ]
    
    const title = titleTemplates[Math.floor(Math.random() * titleTemplates.length)]
    
    mockResults.push({
      title: title,
      url: `https://mp.weixin.qq.com/s/${generateMockArticleId()}`,
      source: 'wechat' as const,
      author: randomAccount,
      publish_date: generateRecentDate(),
      description: `这篇文章深入分析了关于"${randomKeyword}"的最新${randomTerm}成果，从多个角度探讨了其科学价值和应用前景，为读者提供了全面而深入的解读...`,
      thumbnail_url: null,
      view_count: Math.floor(Math.random() * 8000) + 500
    })
  }
  
  console.log(`✅ 智能模拟搜索生成 ${mockResults.length} 条相关结果`)
  return mockResults
}

// 辅助函数
function generateMockArticleId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function generateRecentDate(): string {
  const now = new Date()
  const daysAgo = Math.floor(Math.random() * 90) // 过去90天内
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  return date.toISOString().split('T')[0]
}

function extractWeChatAuthor(snippet: string): string {
  // 尝试从摘要中提取公众号名称
  const patterns = [
    /公众号[：:]([^，。\s]+)/,
    /来源[：:]([^，。\s]+)/,
    /作者[：:]([^，。\s]+)/
  ]
  
  for (const pattern of patterns) {
    const match = snippet.match(pattern)
    if (match) return match[1]
  }
  
  return '未知公众号'
}

function extractDateFromSnippet(snippet: string): string {
  // 尝试从摘要中提取日期
  const datePattern = /(\d{4}[-年]\d{1,2}[-月]\d{1,2})/
  const match = snippet.match(datePattern)
  if (match) {
    return match[1].replace(/[年月]/g, '-').replace(/日$/, '')
  }
  
  return generateRecentDate()
}

// 原有的模拟搜索函数保持兼容
async function searchWeChatArticles(query: string) {
  return await searchWeChatArticlesMock(query)
}

// 实际应用中可能用到的真实搜索实现示例（注释掉的代码）
/*
async function searchWeChatArticlesReal(query: string) {
  try {
    // 方法1: 使用微信公众号搜索API（需要申请接入）
    // const response = await fetch('https://api.weixin.qq.com/...', {...})
    
    // 方法2: 使用第三方搜索服务
    // const response = await fetch('https://third-party-search-api.com/wechat', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ query, platform: 'wechat' })
    // })
    
    // 方法3: 使用搜索引擎API (如百度、必应)
    const searchQuery = `site:mp.weixin.qq.com ${query}`
    // const response = await fetch(`https://api.bing.com/search?q=${encodeURIComponent(searchQuery)}`, {...})
    
    // 处理返回的搜索结果并转换为统一格式
    return []
  } catch (error) {
    console.error('Real search error:', error)
    return []
  }
}
*/
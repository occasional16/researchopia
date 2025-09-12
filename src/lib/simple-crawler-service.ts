// 轻量级网页爬虫服务 - 无需Puppeteer，基于fetch和cheerio
// 适合爬取静态内容，成本低，部署简单

export interface CrawledArticle {
  title: string
  url: string
  source: string
  description?: string
  publishDate?: string
  author?: string
  relevanceScore?: number
}

export interface NewsSource {
  name: string
  searchUrl: string
  headers?: Record<string, string>
  parseMethod: 'rss' | 'html' | 'api'
  selectors?: {
    articles: string
    title: string
    link: string
    description?: string
    date?: string
    author?: string
  }
  rateLimit: number
}

// 预定义的新闻源（RSS feeds和开放API）
const NEWS_SOURCES: NewsSource[] = [
  {
    name: 'Science Daily RSS',
    searchUrl: 'https://www.sciencedaily.com/rss/all.xml',
    parseMethod: 'rss',
    rateLimit: 2000
  },
  {
    name: 'Nature News RSS', 
    searchUrl: 'https://www.nature.com/nature.rss',
    parseMethod: 'rss',
    rateLimit: 1500
  },
  {
    name: 'Science Magazine RSS',
    searchUrl: 'https://science.org/rss/news_current.xml',
    parseMethod: 'rss',
    rateLimit: 1500
  },
  {
    name: 'MIT News RSS',
    searchUrl: 'https://news.mit.edu/rss/feed',
    parseMethod: 'rss',
    rateLimit: 2000
  },
  {
    name: 'Phys.org RSS',
    searchUrl: 'https://phys.org/rss-feed/',
    parseMethod: 'rss',
    rateLimit: 2000
  }
]

export class SimpleCrawlerService {
  private cache = new Map<string, { data: CrawledArticle[], timestamp: number }>()
  private cacheMinutes = 30

  async searchNews(query: string, maxResults = 20): Promise<CrawledArticle[]> {
    const cacheKey = `search:${query}:${maxResults}`
    
    // 检查缓存
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      console.log('💾 使用缓存结果')
      return cached
    }

    const allArticles: CrawledArticle[] = []

    for (const source of NEWS_SOURCES) {
      try {
        console.log(`📡 正在获取 ${source.name}...`)
        const articles = await this.crawlFromSource(source, query)
        console.log(`  └─ ${source.name} 返回 ${articles.length} 篇文章`)
        allArticles.push(...articles)
        
        if (allArticles.length >= maxResults) break
        
        // 限制请求频率
        await this.sleep(source.rateLimit)
        
      } catch (error) {
        console.error(`❌ ${source.name} 数据获取失败:`, error)
        continue
      }
    }

    // 去重和质量过滤
    const deduplicatedArticles = this.deduplicateArticles(allArticles)
    const qualityFiltered = this.filterHighQuality(deduplicatedArticles, query)
    
    // 按相关性排序并添加调试信息
    const sortedArticles = this.rankByRelevance(qualityFiltered, query)
    const results = sortedArticles.slice(0, maxResults)
    
    // 添加调试日志
    if (results.length > 0) {
      console.log('🎯 相关性评分详情:')
      results.forEach((article, index) => {
        const score = article.relevanceScore || 0
        console.log(`  ${index + 1}. [${score}分] ${article.title.substring(0, 60)}...`)
        console.log(`     来源: ${article.source} | ${article.url}`)
      })
      console.log(`📊 质量过滤: ${allArticles.length} → ${deduplicatedArticles.length} → ${qualityFiltered.length} → ${results.length}`)
    } else {
      console.log(`❌ 没有找到符合要求的文章`)
      console.log(`📊 质量过滤: ${allArticles.length} → ${deduplicatedArticles.length} → ${qualityFiltered.length} → ${results.length}`)
      console.log(`🔍 查询词: "${query}"`)
    }
    
    // 缓存结果
    this.saveToCache(cacheKey, results)
    
    console.log(`✅ 搜索完成，共找到 ${results.length} 篇相关文章`)
    return results
  }

  private async crawlFromSource(source: NewsSource, query: string): Promise<CrawledArticle[]> {
    try {
      const response = await fetch(source.searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Academic-Rating-Bot/1.0)',
          ...source.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const content = await response.text()

      switch (source.parseMethod) {
        case 'rss':
          return this.parseRSS(content, source.name, query)
        case 'api':
          return this.parseAPI(content, source.name, query)
        default:
          return []
      }
    } catch (error) {
      throw error
    }
  }

  private parseRSS(xml: string, sourceName: string, query: string): CrawledArticle[] {
    const articles: CrawledArticle[] = []
    
    try {
      // 简单的XML解析 - 提取item元素
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
      const items = xml.match(itemRegex) || []
      
      for (const item of items.slice(0, 20)) { // 限制每个源最多20篇
        const title = this.extractXMLTag(item, 'title')
        const link = this.extractXMLTag(item, 'link')
        const description = this.extractXMLTag(item, 'description')
        const pubDate = this.extractXMLTag(item, 'pubDate')
        const author = this.extractXMLTag(item, 'author') || this.extractXMLTag(item, 'dc:creator')
        
        if (title && link) {
          const content = title + ' ' + (description || '')
          if (this.isRelevant(content, query)) {
            articles.push({
              title: this.cleanText(title),
              url: link,
              source: sourceName,
              description: description ? this.cleanText(description) : undefined,
              publishDate: pubDate ? this.normalizeDate(pubDate) : undefined,
              author: author ? this.cleanText(author) : undefined,
              relevanceScore: this.calculateRelevance(content, query)
            })
          }
        }
      }
    } catch (error) {
      console.error('RSS解析失败:', error)
    }
    
    return articles
  }

  private parseAPI(json: string, sourceName: string, query: string): CrawledArticle[] {
    const articles: CrawledArticle[] = []
    
    try {
      const data = JSON.parse(json)
      
      // 根据不同API格式处理
      if (Array.isArray(data.articles)) {
        // NewsAPI格式
        for (const item of data.articles.slice(0, 10)) {
          if (this.isRelevant(item.title + ' ' + (item.description || ''), query)) {
            articles.push({
              title: this.cleanText(item.title),
              url: item.url,
              source: sourceName,
              description: item.description ? this.cleanText(item.description) : undefined,
              publishDate: item.publishedAt ? this.normalizeDate(item.publishedAt) : undefined,
              author: item.author || item.source?.name,
              relevanceScore: this.calculateRelevance(item.title + ' ' + (item.description || ''), query)
            })
          }
        }
      }
    } catch (error) {
      console.error('JSON解析失败:', error)
    }
    
    return articles
  }

  // 工具方法
  private extractXMLTag(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i')
    const match = xml.match(regex)
    return match ? match[1].trim() : undefined
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/&[^;]+;/g, ' ') // 移除HTML实体
      .replace(/\s+/g, ' ') // 标准化空白
      .trim()
      .substring(0, 500) // 限制长度
  }

  private normalizeDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      return dateString.substring(0, 10)
    }
  }

  private isRelevant(content: string, query: string): boolean {
    const relevanceScore = this.calculateRelevance(content, query)
    // 只有得分>0的才会在终端显示
    if (relevanceScore > 0) {
      console.log(`🔍 相关性检查: "${content.substring(0, 50)}..." 得分: ${relevanceScore}`)
    }
    return relevanceScore >= 1
  }

  private calculateRelevance(content: string, query: string): number {
    const contentLower = content.toLowerCase()
    const queryLower = query.toLowerCase()
    
    // 简化：直接分割查询词，不过滤常见词
    const queryWords = queryLower.split(/\s+/)
      .filter(word => word.length > 2)
    
    if (queryWords.length === 0) return 0
    
    let totalScore = 0
    
    // 1. 完整查询匹配
    if (contentLower.includes(queryLower)) {
      totalScore += 50
    }
    
    // 2. 简单的单词包含检查（不用正则）
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        let wordScore = 10 // 基础分数
        
        // 长词加权
        if (word.length > 6) wordScore *= 1.5
        
        // 专业术语加权
        if (this.isTechnicalTerm(word)) {
          wordScore *= 2
        }
        
        totalScore += wordScore
      }
    }
    
    // 3. 科学内容加权
    if (this.containsScientificContent(contentLower)) {
      totalScore *= 1.2
    }
    
    return Math.round(totalScore)
  }
  
  private extractPhrases(query: string): string[] {
    const words = query.split(/\s+/)
    const phrases: string[] = []
    
    // 提取2-4词组合
    for (let len = 2; len <= Math.min(4, words.length); len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ')
        if (phrase.length > 8) {
          phrases.push(phrase)
        }
      }
    }
    
    return phrases
  }
  
  private isTechnicalTerm(word: string): boolean {
    const technicalKeywords = [
      'research', 'study', 'analysis', 'method', 'technique', 'algorithm',
      'experiment', 'data', 'result', 'finding', 'discovery', 'breakthrough',
      'technology', 'innovation', 'development', 'application', 'material',
      'protein', 'cell', 'molecule', 'chemical', 'biological', 'physical',
      'quantum', 'nano', 'micro', 'macro', 'synthesis', 'characterization',
      'simulation', 'modeling', 'computational', 'theoretical', 'experimental',
      'ion', 'exchange', 'atomic', 'thin', 'clays', 'micas', 'hydration', 'solids'
    ]
    
    return technicalKeywords.some(term => word.includes(term) || term.includes(word))
  }
  
  private containsScientificContent(content: string): boolean {
    const scientificIndicators = [
      'nature', 'science', 'research', 'study', 'journal', 'paper', 'published',
      'university', 'laboratory', 'experiment', 'analysis', 'discovery',
      'breakthrough', 'innovation', 'technology', 'scientific', 'academic',
      'professor', 'researcher', 'scientist', 'phd', 'doi', 'arxiv'
    ]
    
    return scientificIndicators.some(indicator => content.includes(indicator))
  }
  
  private containsIrrelevantContent(content: string): boolean {
    const irrelevantIndicators = [
      'advertisement', 'promotion', 'sale', 'discount', 'buy now', 'click here',
      'celebrity', 'entertainment', 'gossip', 'sports score', 'weather',
      'horoscope', 'lottery', 'casino', 'betting', 'fashion', 'beauty tips',
      'recipe', 'cooking', 'travel deal', 'hotel', 'restaurant review'
    ]
    
    return irrelevantIndicators.some(indicator => content.includes(indicator))
  }
  
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private rankByRelevance(articles: CrawledArticle[], query: string): CrawledArticle[] {
    return articles.sort((a, b) => {
      const scoreA = a.relevanceScore || this.calculateRelevance(a.title + ' ' + (a.description || ''), query)
      const scoreB = b.relevanceScore || this.calculateRelevance(b.title + ' ' + (b.description || ''), query)
      return scoreB - scoreA
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 去重方法
  private deduplicateArticles(articles: CrawledArticle[]): CrawledArticle[] {
    const seen = new Set<string>()
    const deduped: CrawledArticle[] = []
    
    for (const article of articles) {
      // 使用标题和URL的组合作为唯一标识
      const key = `${article.title.toLowerCase().replace(/\s+/g, ' ').trim()}|${article.url}`
      
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(article)
      }
    }
    
    return deduped
  }
  
  // 高质量内容过滤
  private filterHighQuality(articles: CrawledArticle[], query: string): CrawledArticle[] {
    return articles.filter(article => {
      // 1. 基本质量检查
      if (!article.title || article.title.length < 10) return false
      if (!article.url || !article.url.startsWith('http')) return false
      
      // 2. 标题质量检查
      const title = article.title.toLowerCase()
      
      // 过滤明显无关的内容
      const blacklistTerms = [
        'advertisement', 'sponsored', 'promo', 'sale', 'discount',
        'celebrity', 'gossip', 'entertainment', 'sports', 'weather',
        'horoscope', 'astrology', 'lottery', 'casino', 'betting',
        'fashion', 'beauty', 'makeup', 'recipe', 'cooking',
        'travel', 'hotel', 'restaurant', 'menu', 'diet'
      ]
      
      if (blacklistTerms.some(term => title.includes(term))) {
        return false
      }
      
      // 3. 相关性检查
      const relevanceScore = this.calculateRelevance(article.title + ' ' + (article.description || ''), query)
      article.relevanceScore = relevanceScore
      
      return relevanceScore >= 1 // 最低相关性要求降低到1分
    })
  }

  // 缓存管理
  private getFromCache(key: string): CrawledArticle[] | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    const ageMinutes = (now - cached.timestamp) / (1000 * 60)
    
    if (ageMinutes > this.cacheMinutes) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  private saveToCache(key: string, data: CrawledArticle[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  public clearCache(): void {
    this.cache.clear()
  }
}

// 单例实例
export const simpleCrawlerService = new SimpleCrawlerService()

// 定期清理缓存
if (typeof window === 'undefined') {
  setInterval(() => {
    simpleCrawlerService.clearCache()
  }, 30 * 60 * 1000) // 每30分钟清理一次
}
// Altmetric API服务 - 获取学术文章的在线提及数据
// 实现类似Nature "Mentions in news and blogs"的功能

export interface AltmetricMention {
  title: string
  url: string
  source: 'news' | 'blogs' | 'twitter' | 'reddit' | 'facebook' | 'other'
  author?: string
  publish_date?: string
  description?: string
  summary?: string
  journal?: string
  language?: string
}

export interface AltmetricData {
  altmetric_id?: number
  doi?: string
  pmid?: string
  title?: string
  journal?: string
  authors?: string[]
  published_on?: string
  url?: string
  
  // 计数数据
  score?: number
  cited_by_accounts_count?: number
  cited_by_posts_count?: number
  
  // 分类计数
  cited_by_msm_count?: number        // 主流媒体
  cited_by_blogs_count?: number      // 博客
  cited_by_tweeters_count?: number   // Twitter
  cited_by_facebook_count?: number   // Facebook
  cited_by_reddit_count?: number     // Reddit
  cited_by_wikipedia_count?: number  // Wikipedia
  
  // 详细提及数据
  posts?: Array<{
    title: string
    url: string
    posted_on: string
    author: string
    summary: string
    source: string
  }>
}

export class AltmetricService {
  private apiKey?: string
  private baseUrl = 'https://api.altmetric.com/v1'
  private cacheMap = new Map<string, { data: AltmetricData, timestamp: number }>()
  private cacheMinutes = 60 // 缓存1小时

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ALTMETRIC_API_KEY
  }

  /**
   * 根据DOI获取Altmetric数据
   */
  async getDataByDOI(doi: string): Promise<AltmetricData | null> {
    const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, '')
    const cacheKey = `doi:${cleanDoi}`
    
    // 检查缓存
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      console.log(`📊 使用缓存的Altmetric数据: ${cleanDoi}`)
      return cached
    }

    try {
      const url = `${this.baseUrl}/doi/${encodeURIComponent(cleanDoi)}`
      const response = await this.makeRequest(url)
      
      if (response) {
        this.setCachedData(cacheKey, response)
        console.log(`📊 获取Altmetric数据成功: ${cleanDoi} (Score: ${response.score})`)
        return response
      }
    } catch (error) {
      console.error(`获取Altmetric数据失败 (DOI: ${cleanDoi}):`, error)
    }

    return null
  }

  /**
   * 根据PubMed ID获取数据
   */
  async getDataByPMID(pmid: string): Promise<AltmetricData | null> {
    const cacheKey = `pmid:${pmid}`
    
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const url = `${this.baseUrl}/pmid/${pmid}`
      const response = await this.makeRequest(url)
      
      if (response) {
        this.setCachedData(cacheKey, response)
        return response
      }
    } catch (error) {
      console.error(`获取Altmetric数据失败 (PMID: ${pmid}):`, error)
    }

    return null
  }

  /**
   * 获取新闻和博客提及（核心功能）
   */
  async getNewsAndBlogMentions(doi: string): Promise<AltmetricMention[]> {
    const data = await this.getDataByDOI(doi)
    if (!data) return []

    const mentions: AltmetricMention[] = []

    // 处理详细的提及数据
    if (data.posts && data.posts.length > 0) {
      for (const post of data.posts) {
        const mention: AltmetricMention = {
          title: this.cleanText(post.title),
          url: post.url,
          source: this.mapSourceType(post.source),
          author: post.author || undefined,
          publish_date: post.posted_on ? 
            new Date(Number(post.posted_on) * 1000).toISOString().split('T')[0] : 
            undefined,
          description: this.cleanText(post.summary),
          summary: this.generateSummary(post.summary, post.source)
        }

        // 过滤新闻和博客类型
        if (mention.source === 'news' || mention.source === 'blogs') {
          mentions.push(mention)
        }
      }
    }

    console.log(`📰 找到 ${mentions.length} 条新闻和博客提及`)
    return mentions.slice(0, 20) // 限制返回数量
  }

  /**
   * 获取简化的统计信息
   */
  async getMentionStats(doi: string): Promise<{
    news_count: number
    blog_count: number
    total_mentions: number
    altmetric_score: number
  }> {
    const data = await this.getDataByDOI(doi)
    
    if (!data) {
      return {
        news_count: 0,
        blog_count: 0,
        total_mentions: 0,
        altmetric_score: 0
      }
    }

    return {
      news_count: data.cited_by_msm_count || 0,
      blog_count: data.cited_by_blogs_count || 0,
      total_mentions: data.cited_by_posts_count || 0,
      altmetric_score: data.score || 0
    }
  }

  /**
   * 发起API请求
   */
  private async makeRequest(url: string): Promise<AltmetricData | null> {
    const headers: HeadersInit = {
      'User-Agent': 'Academic-Rating-Platform/1.0'
    }

    // 如果有API密钥，添加到请求头
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        headers
      })

      if (response.status === 404) {
        // 文章未找到，这是正常情况
        return null
      }

      if (response.status === 420) {
        // API限制，稍后重试
        console.warn('Altmetric API请求过于频繁，请稍后重试')
        throw new Error('API rate limit exceeded')
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as AltmetricData

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时')
      }
      throw error
    }
  }

  /**
   * 映射来源类型
   */
  private mapSourceType(source: string): AltmetricMention['source'] {
    const lowerSource = source.toLowerCase()
    
    if (lowerSource.includes('news') || lowerSource.includes('msm')) {
      return 'news'
    }
    if (lowerSource.includes('blog')) {
      return 'blogs'
    }
    if (lowerSource.includes('twitter') || lowerSource.includes('tweet')) {
      return 'twitter'
    }
    if (lowerSource.includes('reddit')) {
      return 'reddit'
    }
    if (lowerSource.includes('facebook')) {
      return 'facebook'
    }
    
    return 'other'
  }

  /**
   * 清理文本内容
   */
  private cleanText(text: string): string {
    if (!text) return ''
    return text
      .replace(/<[^>]*>/g, '') // 移除HTML标签
      .replace(/\s+/g, ' ')    // 标准化空白字符
      .trim()
      .substring(0, 500)       // 限制长度
  }

  /**
   * 生成摘要
   */
  private generateSummary(content: string, source: string): string {
    if (!content) return `来自${source}的报道`
    
    const cleaned = this.cleanText(content)
    if (cleaned.length <= 200) return cleaned
    
    // 截取前200字符并在句子边界处截断
    const truncated = cleaned.substring(0, 200)
    const lastSentence = truncated.lastIndexOf('.')
    const lastExclamation = truncated.lastIndexOf('!')
    const lastQuestion = truncated.lastIndexOf('?')
    
    const breakPoint = Math.max(lastSentence, lastExclamation, lastQuestion)
    
    if (breakPoint > 100) {
      return truncated.substring(0, breakPoint + 1)
    }
    
    return truncated + '...'
  }

  // 缓存管理方法
  private getCachedData(key: string): AltmetricData | null {
    const cached = this.cacheMap.get(key)
    if (!cached) return null
    
    const now = Date.now()
    const ageMinutes = (now - cached.timestamp) / (1000 * 60)
    
    if (ageMinutes > this.cacheMinutes) {
      this.cacheMap.delete(key)
      return null
    }
    
    return cached.data
  }

  private setCachedData(key: string, data: AltmetricData): void {
    this.cacheMap.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  public clearCache(): void {
    this.cacheMap.clear()
  }
}

// 创建单例实例
export const altmetricService = new AltmetricService()

// 在服务端定期清理缓存
if (typeof window === 'undefined') {
  setInterval(() => {
    altmetricService.clearCache()
  }, 30 * 60 * 1000) // 每30分钟清理一次
}
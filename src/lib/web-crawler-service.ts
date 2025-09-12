// 自建爬虫服务 - 从多个新闻网站抓取论文相关报道
// 使用Puppeteer进行网页爬取，支持JavaScript渲染的页面

import puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'

export interface CrawledArticle {
  title: string
  url: string
  source: string
  description?: string
  publishDate?: string
  author?: string
  content?: string
}

export interface CrawlTarget {
  name: string
  baseUrl: string
  searchUrl: string
  selectors: {
    articleLinks: string
    title: string
    description?: string
    date?: string
    author?: string
    content?: string
  }
  rateLimit: number // 请求间隔(毫秒)
}

// 预定义的爬取目标网站
const CRAWL_TARGETS: CrawlTarget[] = [
  {
    name: 'Science Daily',
    baseUrl: 'https://www.sciencedaily.com',
    searchUrl: 'https://www.sciencedaily.com/search/?keyword={{QUERY}}',
    selectors: {
      articleLinks: '.search-result h3 a',
      title: 'h1',
      description: '.summary',
      date: '.date',
      author: '.author',
      content: '.story-content'
    },
    rateLimit: 2000
  },
  {
    name: 'EurekAlert',
    baseUrl: 'https://www.eurekalert.org',
    searchUrl: 'https://www.eurekalert.org/search?keywords={{QUERY}}',
    selectors: {
      articleLinks: '.release-title a',
      title: 'h1',
      description: '.release-summary',
      date: '.release-date',
      author: '.organization',
      content: '.release-content'
    },
    rateLimit: 1500
  },
  {
    name: 'Phys.org',
    baseUrl: 'https://phys.org',
    searchUrl: 'https://phys.org/search/?search={{QUERY}}',
    selectors: {
      articleLinks: '.news-link',
      title: 'h1.news-story-title',
      description: '.article-main p:first-of-type',
      date: '.article-byline time',
      author: '.article-byline .author',
      content: '.article-main'
    },
    rateLimit: 2500
  }
]

export class WebCrawlerService {
  private browser?: puppeteer.Browser
  private isInitialized = false

  async initialize() {
    if (this.isInitialized) return

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      })
      this.isInitialized = true
      console.log('🚀 网页爬虫已启动')
    } catch (error) {
      console.error('❌ 爬虫启动失败:', error)
      throw new Error('爬虫初始化失败')
    }
  }

  async crawlArticles(query: string, maxResults = 20): Promise<CrawledArticle[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const allArticles: CrawledArticle[] = []
    
    for (const target of CRAWL_TARGETS) {
      try {
        console.log(`🔍 正在搜索 ${target.name}...`)
        const articles = await this.crawlFromSite(target, query, maxResults - allArticles.length)
        allArticles.push(...articles)
        
        // 达到最大结果数就停止
        if (allArticles.length >= maxResults) break
        
        // 请求间隔，避免被封
        await this.sleep(target.rateLimit)
        
      } catch (error) {
        console.error(`⚠️ ${target.name} 爬取失败:`, error)
        continue
      }
    }

    console.log(`✅ 爬取完成，共找到 ${allArticles.length} 篇相关文章`)
    return allArticles
  }

  private async crawlFromSite(target: CrawlTarget, query: string, maxResults: number): Promise<CrawledArticle[]> {
    if (!this.browser) throw new Error('浏览器未初始化')

    const page = await this.browser.newPage()
    const articles: CrawledArticle[] = []

    try {
      // 设置用户代理，模拟真实浏览器
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      
      // 访问搜索页面
      const searchUrl = target.searchUrl.replace('{{QUERY}}', encodeURIComponent(query))
      console.log(`📡 访问: ${searchUrl}`)
      
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      })

      // 等待内容加载
      await page.waitForTimeout(3000)

      // 获取文章链接
      const articleLinks = await page.evaluate((selector, baseUrl) => {
        const links = Array.from(document.querySelectorAll(selector))
        return links.map((link: any) => {
          const href = link.href || link.getAttribute('href')
          return href?.startsWith('http') ? href : baseUrl + href
        }).filter(Boolean).slice(0, 10) // 限制链接数量
      }, target.selectors.articleLinks, target.baseUrl)

      console.log(`🔗 找到 ${articleLinks.length} 个文章链接`)

      // 爬取每个文章的详细内容
      for (const articleUrl of articleLinks.slice(0, maxResults)) {
        try {
          const article = await this.crawlArticleDetails(page, target, articleUrl)
          if (article && this.isRelevant(article.title, query)) {
            articles.push(article)
          }
          
          // 文章间隔
          await this.sleep(1000)
          
        } catch (error) {
          console.error(`⚠️ 文章爬取失败 ${articleUrl}:`, error)
          continue
        }
      }

    } finally {
      await page.close()
    }

    return articles
  }

  private async crawlArticleDetails(page: puppeteer.Page, target: CrawlTarget, url: string): Promise<CrawledArticle | null> {
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 20000 
      })

      await page.waitForTimeout(2000)

      const article = await page.evaluate((selectors, sourceName, articleUrl) => {
        const getText = (selector: string) => {
          const element = document.querySelector(selector)
          return element?.textContent?.trim() || ''
        }

        const title = getText(selectors.title)
        if (!title) return null

        return {
          title,
          url: articleUrl,
          source: sourceName,
          description: selectors.description ? getText(selectors.description) : '',
          publishDate: selectors.date ? getText(selectors.date) : '',
          author: selectors.author ? getText(selectors.author) : '',
          content: selectors.content ? getText(selectors.content).substring(0, 1000) : ''
        }
      }, target.selectors, target.name, url)

      if (article) {
        console.log(`📄 爬取成功: ${article.title.substring(0, 50)}...`)
      }

      return article
      
    } catch (error) {
      console.error(`❌ 爬取文章详情失败 ${url}:`, error)
      return null
    }
  }

  // 检查文章标题与查询的相关性
  private isRelevant(title: string, query: string): boolean {
    const titleWords = title.toLowerCase().split(/\s+/)
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    
    let matches = 0
    for (const queryWord of queryWords) {
      if (titleWords.some(titleWord => titleWord.includes(queryWord) || queryWord.includes(titleWord))) {
        matches++
      }
    }
    
    // 至少匹配一个关键词
    return matches > 0
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close()
      this.isInitialized = false
      console.log('🛑 爬虫已关闭')
    }
  }
}

// 单例实例
export const webCrawlerService = new WebCrawlerService()

// 进程退出时清理资源
if (typeof window === 'undefined') {
  process.on('exit', () => webCrawlerService.cleanup())
  process.on('SIGINT', () => webCrawlerService.cleanup())
  process.on('SIGTERM', () => webCrawlerService.cleanup())
}
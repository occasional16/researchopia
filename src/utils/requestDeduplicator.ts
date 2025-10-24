/**
 * 请求去重工具
 * 防止短时间内重复请求同一个API
 * 
 * 使用示例:
 * ```ts
 * const data = await deduplicatedFetch('/api/site/statistics')
 * ```
 */

interface PendingRequest {
  promise: Promise<any>
  timestamp: number
}

class RequestDeduplicator {
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  
  // 默认配置
  private readonly DEFAULT_DEDUPE_TIME = 1000 // 1秒内的重复请求会被去重
  private readonly DEFAULT_CACHE_TIME = 5000 // 5秒缓存时间
  
  /**
   * 去重的fetch请求
   * @param url API URL
   * @param options Fetch配置
   * @param dedupeTime 去重时间窗口(ms),默认1秒
   * @param cacheTime 缓存时间(ms),默认5秒
   */
  async fetch<T = any>(
    url: string,
    options?: RequestInit,
    dedupeTime: number = this.DEFAULT_DEDUPE_TIME,
    cacheTime: number = this.DEFAULT_CACHE_TIME
  ): Promise<T> {
    const cacheKey = this.getCacheKey(url, options)
    const now = Date.now()
    
    // 1. 检查缓存
    const cached = this.cache.get(cacheKey)
    if (cached && (now - cached.timestamp) < cacheTime) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [Dedup] 使用缓存: ${url}`)
      }
      return cached.data
    }
    
    // 2. 检查是否有正在进行的相同请求
    const pending = this.pendingRequests.get(cacheKey)
    if (pending && (now - pending.timestamp) < dedupeTime) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏳ [Dedup] 合并请求: ${url}`)
      }
      return pending.promise
    }
    
    // 3. 发起新请求
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [Dedup] 新请求: ${url}`)
    }
    
    const requestPromise = fetch(url, options)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        // 存入缓存
        this.cache.set(cacheKey, { data, timestamp: Date.now() })
        
        // 清理pending
        this.pendingRequests.delete(cacheKey)
        
        return data
      })
      .catch((error) => {
        // 清理pending
        this.pendingRequests.delete(cacheKey)
        throw error
      })
    
    // 记录pending请求
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise,
      timestamp: now
    })
    
    return requestPromise
  }
  
  /**
   * 清除特定URL的缓存
   */
  clearCache(url: string, options?: RequestInit) {
    const cacheKey = this.getCacheKey(url, options)
    this.cache.delete(cacheKey)
    this.pendingRequests.delete(cacheKey)
  }
  
  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.cache.clear()
    this.pendingRequests.clear()
  }
  
  /**
   * 获取缓存状态统计
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size
    }
  }
  
  private getCacheKey(url: string, options?: RequestInit): string {
    // 简单的key生成：URL + method + 部分headers
    const method = options?.method || 'GET'
    const headers = options?.headers ? JSON.stringify(options.headers) : ''
    return `${method}:${url}:${headers}`
  }
}

// 导出单例
export const requestDeduplicator = new RequestDeduplicator()

/**
 * 便捷方法：去重的fetch
 */
export async function deduplicatedFetch<T = any>(
  url: string,
  options?: RequestInit,
  dedupeTime?: number,
  cacheTime?: number
): Promise<T> {
  return requestDeduplicator.fetch<T>(url, options, dedupeTime, cacheTime)
}

/**
 * 便捷方法：清除缓存
 */
export function clearRequestCache(url?: string, options?: RequestInit) {
  if (url) {
    requestDeduplicator.clearCache(url, options)
  } else {
    requestDeduplicator.clearAllCache()
  }
}

/**
 * 便捷方法：获取缓存统计
 */
export function getRequestStats() {
  return requestDeduplicator.getStats()
}

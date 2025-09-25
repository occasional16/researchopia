import { useState, useEffect, useCallback, useRef } from 'react'

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
    hasPrevious: boolean
    nextPage: number | null
    previousPage: number | null
  }
}

interface UseInfiniteScrollOptions {
  limit?: number
  search?: string
  sortBy?: string
  enabled?: boolean
  threshold?: number // 距离底部多少像素时开始加载
}

export function useInfiniteScroll<T>(
  endpoint: string,
  options: UseInfiniteScrollOptions = {}
) {
  const {
    limit = 10,
    search = '',
    sortBy = '',
    enabled = true,
    threshold = 1000
  } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadingRef = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 重置状态
  const reset = useCallback(() => {
    setData([])
    setPage(1)
    setHasMore(true)
    setError(null)
    setTotalCount(0)
  }, [])

  // 加载数据
  const loadData = useCallback(async (pageNum: number, isReset = false) => {
    if (loadingRef.current || !enabled) return

    try {
      loadingRef.current = true
      setLoading(true)
      setError(null)

      const searchParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(sortBy && { sortBy })
      })

      const response = await fetch(`${endpoint}?${searchParams}` , {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: PaginatedResponse<T> = await response.json()

      setData(prevData => {
        if (isReset || pageNum === 1) {
          return result.data
        }
        // 避免重复数据
        const existingIds = new Set(
          prevData.map((item: any) => item.id).filter(Boolean)
        )
        const newData = result.data.filter(
          (item: any) => !existingIds.has(item.id)
        )
        return [...prevData, ...newData]
      })

      //  :  hasMore 
      // API total 
      const clientHasMore = result.pagination?.hasMore || (Array.isArray(result.data) && result.data.length >= limit)
      setHasMore(clientHasMore)
      setTotalCount(result.pagination.total)
      setPage(result.pagination.page)

    } catch (err) {
      let errorMessage = err instanceof Error ? err.message : '加载数据失败'
      if (typeof errorMessage === 'string' && /Failed to fetch|NetworkError/i.test(errorMessage)) {
        errorMessage = '网络请求失败，请确认开发服务器已启动且端口可访问'
      }
      console.error('无限滚动加载错误:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [endpoint, limit, search, sortBy, enabled])

  // 加载下一页
  const loadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) {
      loadData(page + 1)
    }
  }, [hasMore, page, loadData])

  // 刷新数据
  const refresh = useCallback(() => {
    reset()
    loadData(1, true)
  }, [reset, loadData])

  // 搜索变化时重置并重新加载
  useEffect(() => {
    console.log('useInfiniteScroll useEffect triggered - sortBy:', sortBy, 'search:', search, 'enabled:', enabled)
    reset()
    if (enabled) {
      loadData(1, true)
    }
  }, [search, sortBy, enabled, loadData, reset])

  // 设置交叉观察器
  useEffect(() => {
    if (!enabled || !hasMore) return

    const options = {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0.1
    }

    observerRef.current = new IntersectionObserver((entries) => {
      const [entry] = entries
      console.log('🔍 无限滚动检测:', {
        isIntersecting: entry.isIntersecting,
        hasMore,
        loading: loadingRef.current,
        page,
        dataLength: data.length
      })
      if (entry.isIntersecting && hasMore && !loadingRef.current) {
        console.log('🚀 触发加载更多数据')
        loadMore()
      }
    }, options)

    const currentSentinel = sentinelRef.current
    if (currentSentinel) {
      observerRef.current.observe(currentSentinel)
    }

    return () => {
      if (observerRef.current && currentSentinel) {
        observerRef.current.unobserve(currentSentinel)
      }
    }
  }, [hasMore, loadMore, enabled, threshold])

  // 内容不足一屏时，自动预取下一页，确保“无限滚动”在初始渲染后也能继续加载
  useEffect(() => {
    if (!enabled || !hasMore) return
    if (loadingRef.current) return
    if (typeof window === 'undefined') return

    const docHeight = document.documentElement.scrollHeight
    const winHeight = window.innerHeight

    if (docHeight <= winHeight + threshold) {
      // 预取一页数据以填满视口
      loadMore()
    }
  }, [data.length, hasMore, enabled, threshold, loadMore])


  // : 
  useEffect(() => {
    if (!enabled || !hasMore) return

    const onScrollOrResize = () => {
      if (loadingRef.current) return
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold
      if (nearBottom) {
        loadMore()
      }
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    // 
    onScrollOrResize()

    return () => {
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [enabled, hasMore, threshold, loadMore])


  // 清理观察器
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [])

  return {
    data,
    loading,
    error,
    hasMore,
    page,
    totalCount,
    loadMore,
    refresh,
    reset,
    sentinelRef
  }
}

// 简化版本，用于基本列表
export function useSimpleInfiniteScroll<T>(
  endpoint: string,
  limit: number = 10
) {
  return useInfiniteScroll<T>(endpoint, { limit })
}

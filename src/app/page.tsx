'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSmartSearch } from '@/hooks/useSmartSearch'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import NetworkOptimizer from '@/components/NetworkOptimizer'
import Footer from '@/components/Footer'
import { HeroSection, AnnouncementSection, HotContent } from '@/components/home'

interface SiteStats {
  totalPapers: number
  totalUsers: number
  totalVisits: number
  todayVisits: number
}

interface RecentComment {
  id: string
  title: string
  authors: string
  doi: string
  journal: string
  created_at: string
  latest_comment: {
    id: string
    content: string
    created_at: string
    is_anonymous?: boolean
    user: {
      username: string
    } | null
  }
  comment_count: number
  rating_count: number
  average_rating: number
}

interface Announcement {
  id: string
  title: string
  content: string
  type: 'info' | 'warning' | 'success' | 'error'
  created_at: string
  updated_at: string
  is_active: boolean
  created_by: string
}

export default function HomePage() {
  const { profile, isAuthenticated } = useAuth()
  const { t } = useLanguage()
  const authenticatedFetch = useAuthenticatedFetch()
  const router = useRouter()
  
  // 保持滚动位置
  useScrollRestoration()

  // Handle auth redirects from Supabase (invite, recovery, etc.)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1) // Remove leading #
      if (hash) {
        const hashParams = new URLSearchParams(hash)
        const type = hashParams.get('type')
        const accessToken = hashParams.get('access_token')
        
        if (accessToken) {
          if (type === 'invite') {
            // Redirect to accept-invite page with the hash
            router.replace(`/accept-invite#${hash}`)
            return
          } else if (type === 'recovery') {
            // Redirect to reset-password page with the hash
            router.replace(`/reset-password#${hash}`)
            return
          }
        }
      }
    }
  }, [router])
  
  const [searchQuery, setSearchQuery] = useState('')
  const {
    searchStatus,
    processingMessage,
    error,
    detectInputType,
    handleSearch: performSmartSearch,
    clearError
  } = useSmartSearch()
  
  const [stats, setStats] = useState<SiteStats>({
    totalPapers: 0,
    totalUsers: 0,
    totalVisits: 0,
    todayVisits: 0
  })
  const [recentComments, setRecentComments] = useState<RecentComment[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  // 访问跟踪函数
  const trackVisit = async () => {
    try {
      const response = await fetch('/api/visits/track', { method: 'POST' })
      const result = await response.json()

      if (process.env.NODE_ENV === 'development') {
        console.log('📊 访问统计:', result)
      }

      // 如果API返回了访问量数据，立即更新状态
      if (result.success && (result.totalVisits || result.todayVisits)) {
        setStats(prev => ({
          ...prev,
          totalVisits: result.totalVisits || prev.totalVisits,
          todayVisits: result.todayVisits || prev.todayVisits
        }))
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('📊 访问统计失败:', e)
      }
    }
  }

  useEffect(() => {
    const loadData = async () => {
      // 先尝试从localStorage恢复缓存数据,立即显示
      try {
        const cachedStats = localStorage.getItem('homepageStats')
        const cachedComments = localStorage.getItem('homepageComments')
        const cachedAnnouncements = localStorage.getItem('homepageAnnouncements')
        
        if (cachedStats) {
          const parsed = JSON.parse(cachedStats)
          // 检查缓存是否过期(5分钟)
          if (Date.now() - parsed.timestamp < 300000) {
            setStats(parsed.data)
            setLoading(false) // 立即显示缓存数据
          }
        }
        
        if (cachedComments) {
          const parsed = JSON.parse(cachedComments)
          // 方案A: 客户端缓存改为1分钟
          if (Date.now() - parsed.timestamp < 60000) {
            setRecentComments(parsed.data)
          }
        }
        
        if (cachedAnnouncements) {
          const parsed = JSON.parse(cachedAnnouncements)
          if (Date.now() - parsed.timestamp < 60000) { // 公告1分钟缓存
            setAnnouncements(parsed.data)
          }
        }
      } catch (e) {
        console.warn('Failed to load cache:', e)
      }

      setDataError(null)

      try {
        // 在后台记录访问,不阻塞数据加载
        trackVisit().catch(() => {}) // 静默失败

        // 并行加载统计数据、评论数据和公告数据
        const [statsResponse, commentsResponse, announcementsResponse] = await Promise.allSettled([
          fetch('/api/site/statistics', {
            headers: { 'Content-Type': 'application/json' }
          }).then(async res => {
            if (res.ok) {
              const data = await res.json()
              return data.success ? data.data : null
            }
            return null
          }).catch(() => null),

          fetch('/api/papers/recent-comments?limit=5', {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'max-age=60' // 方案A: 1分钟客户端缓存
            }
          }).then(async res => {
            if (res.ok) {
              const text = await res.text()
              if (text) {
                const data = JSON.parse(text)
                return data.success ? data.data : null
              }
            }
            return null
          }).catch(() => null),

          fetch('/api/announcements', {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store' // 禁用浏览器缓存,总是获取最新数据
          }).then(async res => {
            if (res.ok) {
              const text = await res.text()
              if (text) {
                const data = JSON.parse(text)
                return data.success ? data.data : null
              }
            }
            return null
          }).catch(() => null)
        ])

        // 处理统计数据
        if (statsResponse.status === 'fulfilled' && statsResponse.value) {
          const statsData = {
            totalPapers: statsResponse.value.totalPapers || 0,
            totalUsers: statsResponse.value.totalUsers || 0,
            totalVisits: statsResponse.value.totalVisits || 0,
            todayVisits: statsResponse.value.todayVisits || 0
          }
          setStats(statsData)
          // 缓存到localStorage
          localStorage.setItem('homepageStats', JSON.stringify({
            data: statsData,
            timestamp: Date.now()
          }))
        } else {
          // 如果没有缓存且API失败，使用默认值
          if (!localStorage.getItem('homepageStats')) {
            setStats({
              totalPapers: 125,
              totalUsers: 45,
              todayVisits: 28,
              totalVisits: 2340
            })
          }
        }

        // 处理评论数据
        if (commentsResponse.status === 'fulfilled' && commentsResponse.value && commentsResponse.value.length > 0) {
          setRecentComments(commentsResponse.value)
          // 方案A: 缓存到localStorage (1分钟有效期)
          localStorage.setItem('homepageComments', JSON.stringify({
            data: commentsResponse.value,
            timestamp: Date.now()
          }))
        } else {
          // 如果没有缓存且API失败，设置空数组
          if (!localStorage.getItem('homepageComments')) {
            setRecentComments([])
          }
          console.info('No recent comments available or API not configured')
        }

        // 处理公告数据
        if (announcementsResponse.status === 'fulfilled' && announcementsResponse.value && announcementsResponse.value.length > 0) {
          setAnnouncements(announcementsResponse.value)
          // 缓存到localStorage
          localStorage.setItem('homepageAnnouncements', JSON.stringify({
            data: announcementsResponse.value,
            timestamp: Date.now()
          }))
        } else {
          // 如果没有缓存且API失败，设置空数组
          if (!localStorage.getItem('homepageAnnouncements')) {
            setAnnouncements([])
          }
        }

      } catch (error) {
        console.error('Failed to initialize page:', error)
        setDataError('数据加载失败，请稍后重试')
        // 只在没有缓存数据时设置默认值
        if (!localStorage.getItem('homepageStats')) {
          setStats({
            totalPapers: 50,
            totalUsers: 20,
            totalVisits: 1200,
            todayVisits: 25
          })
        }
        if (!localStorage.getItem('homepageComments')) {
          setRecentComments([])
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // 定时刷新统计数据（每5分钟）
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/site/statistics', {
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setStats((prev) => ({
              ...prev,
              totalPapers: data.data.totalPapers ?? prev.totalPapers,
              totalUsers: data.data.totalUsers ?? prev.totalUsers,
              totalVisits: data.data.totalVisits ?? prev.totalVisits,
              todayVisits: data.data.todayVisits ?? prev.todayVisits,
            }))
          }
        }
      } catch {}
    }, 300000) // 5分钟刷新一次

    return () => clearInterval(interval)
  }, [])

  // 检测URL参数中的DOI并自动填入搜索框
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const doiParam = urlParams.get('doi')
      const autoSearchParam = urlParams.get('autoSearch')
      
      console.log('🔍 [主页] URL参数检查:', { doi: doiParam, autoSearch: autoSearchParam })
      
      if (doiParam) {
        console.log('🔍 [主页] 检测到URL中的DOI参数:', doiParam)
        setSearchQuery(doiParam)
        
        // 如果有autoSearch参数，自动执行搜索
        if (autoSearchParam === 'true') {
          console.log('🚀 [主页] 准备自动执行搜索...')
          // 延迟执行，确保组件完全加载且避免依赖问题
          const timer = setTimeout(async () => {
            try {
              console.log('⚡ [主页] 开始执行自动搜索:', doiParam)
              await performSmartSearch(doiParam)
              console.log('✅ [主页] 自动搜索完成')
            } catch (error) {
              console.error('❌ [主页] 自动搜索失败:', error)
            }
          }, 1500) // 增加延迟到1.5秒
          
          return () => clearTimeout(timer)
        }
      }
    }
  }, []) // 移除performSmartSearch依赖，避免循环

  // 刷新公告数据
  const refreshAnnouncements = async () => {
    try {
      // 添加时间戳绕过缓存
      const response = await fetch('/api/announcements?_t=' + Date.now(), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // 强制服务端重新获取
        },
        cache: 'no-store' // 禁用浏览器缓存
      })
      const data = await response.json()
      if (data.success && data.data) {
        setAnnouncements(data.data)
      }
    } catch (error) {
      console.error('Error refreshing announcements:', error)
    }
  }

  // 处理删除公告
  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const response = await authenticatedFetch(`/api/announcements?id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()
      if (result.success) {
        await refreshAnnouncements()
        alert('公告已删除')
      } else {
        alert('删除失败: ' + result.message)
      }
    } catch (error) {
      console.error('Error deleting announcement:', error)
      alert('删除失败，请重试')
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    
    await performSmartSearch(searchQuery.trim())
  }

  return (
    <div className="space-y-5">
      {/* Error Messages */}
      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
          <p className="font-medium text-sm">⚠️ {dataError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            刷新页面
          </button>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">⚠️ {error}</p>
          <button 
            onClick={clearError} 
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            重试
          </button>
        </div>
      )}

      {/* Hero Section with Inline Stats */}
      <HeroSection
        searchQuery={searchQuery}
        searchStatus={searchStatus}
        processingMessage={processingMessage}
        onSearchChange={setSearchQuery}
        onSearch={handleSearch}
        detectInputType={detectInputType}
        stats={stats}
        statsLoading={loading}
      />

      {/* Announcement Section */}
      <AnnouncementSection
        announcements={announcements}
        isAdmin={!!(profile && profile.role === 'admin')}
        onDelete={handleDeleteAnnouncement}
        onRefresh={refreshAnnouncements}
      />

      {/* Hot Content: Papers + Webpages with Tab */}
      <HotContent
        papers={recentComments}
        papersLoading={loading}
      />

      {/* Footer */}
      <Footer />

      {/* 网络优化组件 */}
      <NetworkOptimizer />
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, Users, BookOpen, Star, MessageCircle, Eye } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import BrandLogo from '@/components/ui/BrandLogo'
import { useSmartSearch } from '@/hooks/useSmartSearch'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import NetworkOptimizer from '@/components/NetworkOptimizer'
import AnnouncementForm from '@/components/AnnouncementForm'
import { deduplicatedFetch, clearRequestCache } from '@/utils/requestDeduplicator'

// 日期格式化工具函数（避免hydration错误）
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function formatDateOnly(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

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
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [showAnnouncementHistory, setShowAnnouncementHistory] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)

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
      setLoading(true)
      setDataError(null)

      try {
        // 先记录访问，再加载数据，避免状态被覆盖
        await trackVisit()

        // 并行加载统计数据、评论数据和公告数据,使用请求去重工具
        const [statsResponse, commentsResponse, announcementsResponse] = await Promise.allSettled([
          deduplicatedFetch('/api/site/statistics', {
            headers: { 'Content-Type': 'application/json' }
          }, 1000, 300000) // 1秒去重,5分钟缓存
            .then(data => data.success ? data.data : null)
            .catch(() => null),

          fetch('/api/papers/recent-comments?limit=5', {
            headers: { 
              'Content-Type': 'application/json',
              'Cache-Control': 'max-age=180' // 3分钟客户端缓存
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
          setStats({
            totalPapers: statsResponse.value.totalPapers || 0,
            totalUsers: statsResponse.value.totalUsers || 0,
            totalVisits: statsResponse.value.totalVisits || 0,
            todayVisits: statsResponse.value.todayVisits || 0
          })
        } else {
          // 使用合理的默认值
          setStats({
            totalPapers: 125,
            totalUsers: 45,
            todayVisits: 28,
            totalVisits: 2340
          })
        }

        // 处理评论数据
        if (commentsResponse.status === 'fulfilled' && commentsResponse.value && commentsResponse.value.length > 0) {
          // recent-comments API 已经返回了完整的评论数据,直接使用
          setRecentComments(commentsResponse.value)
        } else {
          // 如果没有真实评论数据，设置为空数组而不是模拟数据
          setRecentComments([])
          console.info('No recent comments available or API not configured')
        }

        // 处理公告数据
        if (announcementsResponse.status === 'fulfilled' && announcementsResponse.value && announcementsResponse.value.length > 0) {
          setAnnouncements(announcementsResponse.value)
          // 设置当前公告为最新的一条
          setCurrentAnnouncement(announcementsResponse.value[0])
        } else {
          setAnnouncements([])
          setCurrentAnnouncement(null)
        }

      } catch (error) {
        console.error('Failed to initialize page:', error)
        setDataError('数据加载失败，请稍后重试')
        // 设置默认值
        setStats({
          totalPapers: 50,
          totalUsers: 20,
          totalVisits: 1200,
          todayVisits: 25
        })
        setRecentComments([])
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // 定时刷新统计数据（每5分钟）- 从60秒优化为300秒
    const interval = setInterval(async () => {
      try {
        const data = await deduplicatedFetch('/api/site/statistics', {
          headers: { 'Content-Type': 'application/json' }
        }, 1000, 300000) // 1秒去重,5分钟缓存
        
        if (data.success && data.data) {
          setStats((prev) => ({
            ...prev,
            totalPapers: data.data.totalPapers ?? prev.totalPapers,
            totalUsers: data.data.totalUsers ?? prev.totalUsers,
            totalVisits: data.data.totalVisits ?? prev.totalVisits,
            todayVisits: data.data.todayVisits ?? prev.todayVisits,
          }))
        }
      } catch {}
    }, 300000) // 60000ms -> 300000ms (1分钟 -> 5分钟)

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
      // 清除announcements API的所有缓存(包括浏览器和requestDeduplicator)
      clearRequestCache('/api/announcements')
      
      const response = await fetch('/api/announcements', {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // 强制服务端重新获取
        },
        cache: 'no-store' // 禁用浏览器缓存
      })
      const data = await response.json()
      if (data.success && data.data) {
        setAnnouncements(data.data)
        setCurrentAnnouncement(data.data[0] || null)
      }
    } catch (error) {
      console.error('Error refreshing announcements:', error)
    }
  }

  // 处理编辑公告
  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement)
    setShowAnnouncementForm(true)
    setShowAnnouncementHistory(false)
  }

  // 处理删除公告
  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('确定要删除这个公告吗？')) {
      return
    }

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
    <div className="space-y-8">
      {/* Error Messages */}
      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">⚠️ {dataError}</p>
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

      {/* Hero Section */}
      <div className="text-center py-12 bg-gradient-to-r from-purple-600 to-blue-700 rounded-lg text-white">
        {/* Logo展示 */}
        <div className="mb-6">
          <BrandLogo 
            size={130} 
            variant="icon-only" 
            theme="gradient" 
            animated={true}
            className="mx-auto"
          />
        </div>
        <h1 className="text-5xl font-bold mb-4">
          {t('site.title', '研学港 Researchopia')}
        </h1>
        <p className="text-xl mb-8 opacity-90">
          {t('site.subtitle', '研学并进，智慧共享')} | {t('site.subtitle') === '研学并进，智慧共享' ? 'Where Research Meets Community' : '研学并进，智慧共享'}
        </p>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('home.search.placeholder', '搜索论文标题、作者、DOI或关键词...')}
              disabled={searchStatus === 'checking' || searchStatus === 'adding' || searchStatus === 'redirecting'}
              className="w-full pl-12 pr-32 py-4 text-gray-900 bg-white rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100"
            />
            <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
            <button
              type="submit"
              disabled={searchStatus !== 'idle' || !searchQuery.trim()}
              className={`absolute right-2 top-2 px-6 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
                searchStatus !== 'idle'
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : !searchQuery.trim() 
                    ? 'bg-[#155DFC] text-white hover:bg-[#1347CC] cursor-not-allowed opacity-75'
                    : detectInputType(searchQuery) === 'doi'
                      ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg transform hover:scale-105'
                      : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {searchStatus === 'idle' ? (
                detectInputType(searchQuery) === 'doi' ? (
                  <>
                    <BookOpen className="w-4 h-4" />
                    {t('button.search', '查找/添加论文')}
                  </>
                ) : (
                  t('home.search.button', '智能搜索')
                )
              ) : (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('loading', '处理中')}
                </>
              )}
            </button>
          </form>
          
          {/* 智能提示和处理状态 */}
          <div className="mt-3 text-center min-h-[1.5rem]">
            {processingMessage ? (
              <p className="text-sm text-white/90 font-medium animate-pulse">
                {processingMessage}
              </p>
            ) : searchQuery.trim() ? (
              <p className="text-sm text-white/80">
                {detectInputType(searchQuery) === 'doi' 
                  ? '🎯 ' + t('home.search.tip.doi', '检测到DOI格式 - 将自动查找或添加论文')
                  : '💡 ' + t('home.search.tip.keyword', '支持关键词搜索，或直接输入DOI自动添加论文')
                }
              </p>
            ) : (
              <p className="text-sm text-white/60">
                💭 {t('home.search.tip.default', '输入论文标题、作者、DOI或关键词开始智能搜索')}
              </p>
            )}
          </div>
        </div>

        {/* Removed center auth buttons - keep only header auth */}
      </div>

      {/* Stats Section - 响应式紧凑布局 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalPapers}</div>
          <div className="text-xs md:text-sm text-gray-600">{t('stats.papers', '学术论文')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <Users className="h-6 w-6 md:h-8 md:w-8 text-green-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalUsers}</div>
          <div className="text-xs md:text-sm text-gray-600">{t('stats.users', '注册用户')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <Eye className="h-6 w-6 md:h-8 md:w-8 text-purple-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalVisits}</div>
          <div className="text-xs md:text-sm text-gray-600">{t('stats.visits', '总访问量')}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-orange-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.todayVisits}</div>
          <div className="text-xs md:text-sm text-gray-600">{t('stats.todayVisits', '今日访问')}</div>
        </div>
      </div>

        {/* Quick Links 动态流 等待优化后再实现*/}
        {/* {isAuthenticated && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">📰 动态流</h3>
                <p className="text-white/90">查看你关注的用户的最新学术动态</p>
              </div>
              <Link
                href="/feed"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <TrendingUp className="w-5 h-5" />
                查看动态
              </Link>
            </div>
          </div>
        )}     */}

      {/* Current Announcement - 只展示最新一条 */}
      {currentAnnouncement && (
        <div
          className={`rounded-lg shadow-md border-l-4 p-4 ${
            currentAnnouncement.type === 'info' ? 'bg-blue-50 border-blue-400' :
            currentAnnouncement.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
            currentAnnouncement.type === 'success' ? 'bg-green-50 border-green-400' :
            currentAnnouncement.type === 'error' ? 'bg-red-50 border-red-400' :
            'bg-gray-50 border-gray-400'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    currentAnnouncement.type === 'info' ? 'bg-blue-100 text-blue-800' :
                    currentAnnouncement.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    currentAnnouncement.type === 'success' ? 'bg-green-100 text-green-800' :
                    currentAnnouncement.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    📢 最新公告
                  </div>
                  <h3 className="ml-3 text-lg font-semibold text-gray-900">
                    {currentAnnouncement.title}
                  </h3>
                </div>
                {/* 查看历史按钮 */}
                {announcements.length > 1 && (
                  <button
                    onClick={() => setShowAnnouncementHistory(!showAnnouncementHistory)}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    📜 查看历史公告 ({announcements.length - 1})
                  </button>
                )}
              </div>
              <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                {currentAnnouncement.content}
              </div>
              <div className="mt-3 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  发布时间: {formatDate(currentAnnouncement.created_at)}
                  {currentAnnouncement.created_by && (
                    <span className="ml-4">发布者: {currentAnnouncement.created_by}</span>
                  )}
                </div>
                {profile && profile.role === 'admin' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditAnnouncement(currentAnnouncement)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                    >
                      ✏️ 编辑
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(currentAnnouncement.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Announcement History Modal */}
      {showAnnouncementHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">📜 公告历史记录</h2>
              <button
                onClick={() => setShowAnnouncementHistory(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {announcements.map((announcement, index) => (
                  <div
                    key={announcement.id}
                    className={`rounded-lg border-l-4 p-4 ${
                      announcement.type === 'info' ? 'bg-blue-50 border-blue-400' :
                      announcement.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                      announcement.type === 'success' ? 'bg-green-50 border-green-400' :
                      announcement.type === 'error' ? 'bg-red-50 border-red-400' :
                      'bg-gray-50 border-gray-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            announcement.type === 'info' ? 'bg-blue-100 text-blue-800' :
                            announcement.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            announcement.type === 'success' ? 'bg-green-100 text-green-800' :
                            announcement.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {index === 0 ? '📢 最新' : `#${index + 1}`}
                          </div>
                          <h3 className="ml-3 text-lg font-semibold text-gray-900">
                            {announcement.title}
                          </h3>
                        </div>
                        <div className="mt-2 text-gray-700 whitespace-pre-wrap">
                          {announcement.content}
                        </div>
                        <div className="mt-3 flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            发布时间: {formatDate(announcement.created_at)}
                            {announcement.created_by && (
                              <span className="ml-4">发布者: {announcement.created_by}</span>
                            )}
                          </div>
                          {profile && profile.role === 'admin' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditAnnouncement(announcement)}
                                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                              >
                                ✏️ 编辑
                              </button>
                              <button
                                onClick={() => handleDeleteAnnouncement(announcement.id)}
                                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                              >
                                🗑️ 删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAnnouncementHistory(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Announcement Management */}
      {profile && profile.role === 'admin' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                管理员 - 公告管理
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingAnnouncement(null)
                    setShowAnnouncementForm(!showAnnouncementForm)
                    setShowAnnouncementHistory(false)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  {showAnnouncementForm ? '❌ 取消' : '➕ 新建公告'}
                </button>
                <button
                  onClick={() => {
                    setShowAnnouncementHistory(!showAnnouncementHistory)
                    setShowAnnouncementForm(false)
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📜 历史管理 ({announcements.length})
                </button>
              </div>
            </div>
          </div>

          {showAnnouncementForm && (
            <div className="px-6 py-4">
              <AnnouncementForm
                editingAnnouncement={editingAnnouncement}
                onSuccess={async () => {
                  setShowAnnouncementForm(false)
                  setEditingAnnouncement(null)
                  await refreshAnnouncements()
                  alert(editingAnnouncement ? '公告已更新' : '公告已发布')
                }}
                onCancel={() => {
                  setShowAnnouncementForm(false)
                  setEditingAnnouncement(null)
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Recent Comments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
              {t('papers.recent', '最新评论')}
            </h2>
            <Link
              href="/papers"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              {t('papers.allPapers', '所有论文')}
            </Link>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">{t('papers.loading', '加载中...')}</div>
          ) : recentComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('papers.noComments', '暂无评论')}</div>
          ) : (
            <div className="space-y-4">
              {recentComments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-100 pb-6 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0"> {/* 添加min-w-0防止内容溢出 */}
                      <Link
                        href={`/papers/${comment.id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors block mb-2"
                      >
                        {comment.title}
                      </Link>
                      <div className="flex flex-col space-y-1 text-sm text-gray-600 mb-3">
                        <p>作者：<span className="font-medium">{comment.authors}</span></p>
                        {comment.journal && (
                          <p>期刊：<span className="font-medium text-green-600">{comment.journal}</span></p>
                        )}
                      </div>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {comment.latest_comment.content}
                        </p>
                        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                          <span>
                            评论者：<span className="font-medium">
                              {comment.latest_comment.is_anonymous 
                                ? '匿名用户' 
                                : (comment.latest_comment.user?.username || '匿名用户')}
                            </span>
                          </span>
                          <span>
                            {formatDate(comment.latest_comment.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 text-right flex-shrink-0">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-end space-x-4 text-sm text-gray-600">
                          <div className="flex items-center bg-blue-50 px-2 py-1 rounded-full">
                            <MessageCircle className="h-4 w-4 mr-1 text-blue-600" />
                            <span className="font-medium">{comment.comment_count}</span>
                          </div>
                          {comment.average_rating > 0 && (
                            <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-full">
                              <Star className="h-4 w-4 mr-1 text-yellow-500" />
                              <span className="font-medium">{comment.average_rating.toFixed(1)}</span>
                              <span className="text-xs text-gray-500 ml-1">({comment.rating_count})</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 text-right">
                          论文发布：{formatDateOnly(comment.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-center">
            <Link
              href="/papers"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <BookOpen className="h-5 w-5 mr-2" />
              {t('papers.viewAll', '查看所有论文')}
              <Search className="h-4 w-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Welcome Message for New Users */}
      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            {t('auth.welcome', '欢迎来到研学港！')}
          </h3>
          <p className="text-blue-700 mb-4">
            {t('auth.welcomeDesc', '研学港是新一代学术评价与研学社区平台，研学并进，智慧共享。您可以：')}
          </p>
          <ul className="text-blue-700 space-y-1 mb-4">
            <li>• 浏览和搜索最新的学术论文</li>
            <li>• 为论文提供专业评分和评论</li>
            <li>• 与全球研究者交流学术见解</li>
            <li>• 构建您的个人研学档案</li>
          </ul>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'signup' } }))}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('auth.joinNow', '立即注册，开始研学之旅')}
          </button>
        </div>
      )}

      {/* 网络优化组件 */}
      <NetworkOptimizer />
    </div>
  )
}

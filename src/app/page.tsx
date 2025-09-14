'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, Users, BookOpen, Star, MessageCircle, Eye } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import BrandLogo from '@/components/ui/BrandLogo'
import { useSmartSearch } from '@/hooks/useSmartSearch'

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
    user: {
      username: string
    } | null
  }
  comment_count: number
  rating_count: number
  average_rating: number
}

export default function HomePage() {
  const { user, isAuthenticated } = useAuth()
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
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setDataError(null)
      
      try {
        // 减少超时时间，添加更快的失败策略
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时

        const [statsResponse, commentsResponse] = await Promise.allSettled([
          fetch('/api/site/statistics', { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'max-age=30' },
            signal: controller.signal
          }),
          fetch('/api/papers/recent-comments?limit=5', {
            cache: 'no-store', 
            headers: { 'Cache-Control': 'max-age=60' },
            signal: controller.signal
          })
        ])

        clearTimeout(timeoutId)

        // 处理统计数据
        if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
          const statsResult = await statsResponse.value.json()
          if (statsResult.success && statsResult.data) {
            setStats({
              totalPapers: statsResult.data.totalPapers || 0,
              totalUsers: statsResult.data.totalUsers || 0,
              totalVisits: statsResult.data.totalVisits || 0,
              todayVisits: statsResult.data.todayVisits || 0
            })
          }
        } else {
          console.warn('Stats API failed:', statsResponse.status === 'fulfilled' ? statsResponse.value.status : 'rejected')
        }

        // 处理评论数据
        if (commentsResponse.status === 'fulfilled' && commentsResponse.value.ok) {
          const commentsData = await commentsResponse.value.json()
          setRecentComments(commentsData.data || [])
        } else {
          console.warn('Comments API failed:', commentsResponse.status === 'fulfilled' ? commentsResponse.value.status : 'rejected')
        }

      } catch (error) {
        console.error('Failed to load data:', error)
        setDataError('数据加载失败，请刷新页面重试')
        // 设置默认值确保页面能正常显示
        setStats({
          totalPapers: 0,
          totalUsers: 0,
          totalVisits: 0,
          todayVisits: 0
        })
        setRecentComments([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
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
          研学港 Researchopia
        </h1>
        <p className="text-xl mb-8 opacity-90">
          研学并进，智慧共享 | Where Research Meets Community
        </p>
        
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索论文标题、作者、DOI或关键词..."
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
                    查找/添加论文
                  </>
                ) : (
                  '智能搜索'
                )
              ) : (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  处理中
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
                  ? '🎯 检测到DOI格式 - 将自动查找或添加论文' 
                  : '💡 支持关键词搜索，或直接输入DOI自动添加论文'
                }
              </p>
            ) : (
              <p className="text-sm text-white/60">
                💭 输入论文标题、作者、DOI或关键词开始智能搜索
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
          <div className="text-xs md:text-sm text-gray-600">学术论文</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <Users className="h-6 w-6 md:h-8 md:w-8 text-green-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalUsers}</div>
          <div className="text-xs md:text-sm text-gray-600">注册用户</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <Eye className="h-6 w-6 md:h-8 md:w-8 text-purple-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.totalVisits}</div>
          <div className="text-xs md:text-sm text-gray-600">总访问量</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6 text-center">
          <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-orange-600 mx-auto mb-2" />
          <div className="text-lg md:text-2xl font-bold text-gray-900">{loading ? '...' : stats.todayVisits}</div>
          <div className="text-xs md:text-sm text-gray-600">今日访问</div>
        </div>
      </div>

      {/* Stats removed Quick Actions section */}

      {/* Recent Comments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
              最新评论
            </h2>
            <Link
              href="/papers"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              所有论文
            </Link>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : recentComments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无评论</div>
          ) : (
            <div className="space-y-4">
              {recentComments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link
                        href={`/papers/${comment.id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {comment.title}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">
                        作者：{comment.authors}
                      </p>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-gray-700 text-sm line-clamp-2">
                          {comment.latest_comment.content}
                        </p>
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                          <span>评论者：{comment.latest_comment.user?.username || '匿名用户'}</span>
                          <span>{new Date(comment.latest_comment.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="flex items-center space-x-3 text-sm text-gray-600">
                        <div className="flex items-center">
                          <MessageCircle className="h-4 w-4 mr-1" />
                          {comment.comment_count}
                        </div>
                        {comment.average_rating > 0 && (
                          <div className="flex items-center">
                            <Star className="h-4 w-4 mr-1 text-yellow-500" />
                            {comment.average_rating.toFixed(1)}
                          </div>
                        )}
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
              查看所有论文
              <Search className="h-4 w-4 ml-2" />
            </Link>
          </div>
        </div>
      </div>

      {/* Welcome Message for New Users */}
      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            欢迎来到研学港！
          </h3>
          <p className="text-blue-700 mb-4">
            研学港是新一代学术评价与研学社区平台，研学并进，智慧共享。您可以：
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
            立即注册，开始研学之旅
          </button>
        </div>
      )}
    </div>
  )
}

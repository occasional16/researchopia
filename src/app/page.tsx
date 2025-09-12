'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, Users, BookOpen, Star, MessageCircle, Eye } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import BrandLogo from '@/components/ui/BrandLogo'

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
  const [stats, setStats] = useState<SiteStats>({
    totalPapers: 0,
    totalUsers: 0,
    totalVisits: 0,
    todayVisits: 0
  })
  const [recentComments, setRecentComments] = useState<RecentComment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      try {
        // 并行加载统计数据和评论数据
        const [statsResponse, commentsResponse] = await Promise.all([
          fetch('/api/site/statistics', { 
            cache: 'no-store',
            headers: { 'Cache-Control': 'max-age=30' } // 30秒缓存
          }),
          fetch('/api/papers/recent-comments?limit=5', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'max-age=60' } // 60秒缓存
          })
        ])

        // 处理统计数据
        if (statsResponse.ok) {
          const statsResult = await statsResponse.json()
          if (statsResult.success && statsResult.data) {
            setStats({
              totalPapers: statsResult.data.totalPapers || 0,
              totalUsers: statsResult.data.totalUsers || 0,
              totalVisits: statsResult.data.totalVisits || 0,
              todayVisits: statsResult.data.todayVisits || 0
            })
          }
        }

        // 处理评论数据
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json()
          setRecentComments(commentsData.data || [])
        }

      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      const encodedQuery = encodeURIComponent(searchQuery.trim())
      window.location.href = `/search?q=${encodedQuery}`
    }
  }

  return (
    <div className="space-y-8">
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
              className="w-full pl-12 pr-32 py-4 text-gray-900 bg-white rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400" />
            <button
              type="submit"
              className="absolute right-2 top-2 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              搜索
            </button>
          </form>
        </div>

        {!isAuthenticated && (
          <div className="mt-8 space-x-4">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'signup' } }))}
              className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              立即注册
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'login' } }))}
              className="px-8 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors"
            >
              登录
            </button>
          </div>
        )}
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/papers"
          className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
        >
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">浏览论文</h3>
              <p className="text-gray-600">发现最新的学术研究成果</p>
            </div>
          </div>
        </Link>

        <Link
          href="/search"
          className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
        >
          <div className="flex items-center space-x-3">
            <Search className="h-8 w-8 text-purple-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">智能搜索</h3>
              <p className="text-gray-600">搜索论文或输入DOI自动添加</p>
            </div>
          </div>
        </Link>

        <Link
          href="/demo"
          className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 border-2 border-orange-200"
        >
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-orange-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">功能演示</h3>
              <p className="text-gray-600">体验编辑删除与PlumX集成</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Comments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
            最新评论
          </h2>
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
              className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              查看更多评论
              <Search className="h-4 w-4 ml-1" />
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import ActivityCard from '@/components/ActivityCard'
import { 
  Rss, Filter, BookOpen, FileText, MessageCircle, 
  Star, Heart, UserPlus 
} from 'lucide-react'

interface Activity {
  id: string
  user_id: string
  activity_type: string
  paper_id?: string
  annotation_id?: string
  comment_id?: string
  rating_id?: string
  target_user_id?: string
  content_preview?: string
  visibility: string
  created_at: string
  metadata?: any
  user: any
  paper?: any
  target_user?: any
}

export default function FeedPage() {
  const router = useRouter()
  const { user, getAccessToken, loading: authLoading } = useAuth()

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [feedMode, setFeedMode] = useState<'following' | 'recommended' | 'trending'>('following')
  const limit = 20

  useEffect(() => {
    // 等待认证加载完成
    if (authLoading) return

    if (!user) {
      // 不跳转，显示未登录提示
      setLoading(false)
      return
    }
    fetchFeed()
  }, [user, authLoading, page, selectedType, feedMode])

  const fetchFeed = async () => {
    const accessToken = await getAccessToken()
    if (!accessToken) return

    setLoading(true)
    try {
      let url = `/api/activities/feed?page=${page}&limit=${limit}&mode=${feedMode}`
      if (selectedType) {
        url += `&type=${selectedType}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Feed API error:', response.status, errorData)
        throw new Error(errorData.error || `Failed to fetch feed (${response.status})`)
      }

      const data = await response.json()
      setActivities(data.activities || [])
      setTotal(data.total || 0)
    } catch (error: any) {
      console.error('Error fetching feed:', error)
      // 显示错误提示
      alert(`加载动态失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const activityTypes = [
    { value: null, label: '全部', icon: Rss },
    { value: 'paper_added', label: '论文', icon: BookOpen },
    { value: 'annotation_added', label: '标注', icon: FileText },
    { value: 'comment_added', label: '评论', icon: MessageCircle },
    { value: 'rating_added', label: '评分', icon: Star },
    { value: 'paper_favorited', label: '收藏', icon: Heart },
    { value: 'user_followed', label: '关注', icon: UserPlus },
  ]

  const totalPages = Math.ceil(total / limit)

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Rss className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">动态流</h2>
          <p className="text-gray-600 mb-6">登录后查看你关注的用户的最新动态</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            动态流
          </h1>
          <p className="text-gray-600">
            {feedMode === 'following' && '查看你关注的人的最新学术动态'}
            {feedMode === 'recommended' && '基于你的兴趣为你推荐的学术动态'}
            {feedMode === 'trending' && '查看最热门的学术动态'}
          </p>
        </div>

        {/* Feed Mode Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex border-b">
            <button
              onClick={() => {
                setFeedMode('following')
                setPage(1)
              }}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                feedMode === 'following'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              关注
            </button>
            <button
              onClick={() => {
                setFeedMode('recommended')
                setPage(1)
              }}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                feedMode === 'recommended'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              推荐
            </button>
            <button
              onClick={() => {
                setFeedMode('trending')
                setPage(1)
              }}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                feedMode === 'trending'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              热门
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="font-medium text-gray-900">筛选动态类型</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activityTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value || 'all'}
                  onClick={() => {
                    setSelectedType(type.value)
                    setPage(1)
                  }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                    ${selectedType === type.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-600 hover:text-blue-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && activities.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Rss className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              暂无动态
            </h3>
            <p className="text-gray-600 mb-4">
              {selectedType 
                ? '没有找到该类型的动态'
                : '你关注的人还没有发布任何动态'}
            </p>
            {!selectedType && (
              <button
                onClick={() => router.push('/explore')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                去发现更多用户
              </button>
            )}
          </div>
        )}

        {/* Activities List */}
        {!loading && activities.length > 0 && (
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-4 py-2 text-gray-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        )}

        {/* Stats */}
        {!loading && total > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            共 {total} 条动态
          </div>
        )}
      </div>
    </div>
  )
}


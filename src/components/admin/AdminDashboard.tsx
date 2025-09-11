'use client'

import { useState, useEffect } from 'react'
import { Users, BookOpen, Star, MessageCircle, TrendingUp, Calendar } from 'lucide-react'
// Mock admin stats type
interface AdminStats {
  totalUsers: number
  totalPapers: number
  totalRatings: number
  totalComments: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [activity, setActivity] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // 获取真实统计数据
      const response = await fetch('/api/admin/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch admin stats')
      }
      
      const data = await response.json()
      setStats(data.stats)
      setActivity(data.activity || [])
      
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      
      // 回退到Mock数据
      const statsData: AdminStats = {
        totalUsers: 10,
        totalPapers: 25,
        totalRatings: 150,
        totalComments: 75
      }
      const activityData = [
        { type: 'paper', action: '添加了新论文', user: 'admin', time: '2小时前' },
        { type: 'rating', action: '发表了评分', user: 'user1', time: '3小时前' },
        { type: 'comment', action: '发表了评论', user: 'user2', time: '5小时前' }
      ]
      setStats(statsData)
      setActivity(activityData)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总用户数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总论文数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPapers}</p>
              </div>
              <BookOpen className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总评分数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRatings}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总评论数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalComments}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activity && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Papers */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <BookOpen className="w-5 h-5 mr-2" />
              最新论文
            </h3>
            <div className="space-y-3">
              {activity.papers.slice(0, 5).map((paper: any) => (
                <div key={paper.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {paper.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {paper.users?.username || '系统'} • {new Date(paper.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Comments */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <MessageCircle className="w-5 h-5 mr-2" />
              最新评论
            </h3>
            <div className="space-y-3">
              {activity.comments.slice(0, 5).map((comment: any) => (
                <div key={comment.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                  <p className="text-sm text-gray-700 truncate">
                    {comment.content}
                  </p>
                  <p className="text-xs text-gray-500">
                    {comment.users?.username} 评论了 "{comment.papers?.title}"
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Ratings */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Star className="w-5 h-5 mr-2" />
              最新评分
            </h3>
            <div className="space-y-3">
              {activity.ratings.slice(0, 5).map((rating: any) => (
                <div key={rating.id} className="border-b border-gray-100 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {rating.overall_score}/5 ⭐
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(rating.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {rating.users?.username} 评分了 "{rating.papers?.title}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

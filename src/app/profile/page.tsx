'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Settings, BookOpen, Star, MessageCircle, Heart, BarChart3 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserStats, type UserStats } from '@/lib/userActivity'
import UserRatings from '@/components/profile/UserRatings'
import UserComments from '@/components/profile/UserComments'
import UserFavorites from '@/components/profile/UserFavorites'

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<UserStats>({
    total_ratings: 0,
    total_comments: 0,
    total_favorites: 0,
    avg_rating: 0
  })

  useEffect(() => {
    if (user) {
      loadStats()
    }
  }, [user])

  const loadStats = async () => {
    if (!user) return

    try {
      const userStats = await getUserStats(user.id)
      setStats(userStats)
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-6 w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="h-6 bg-gray-200 rounded mb-4 w-1/4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/')
    return null
  }

  const tabs = [
    { id: 'overview', name: '概览', icon: BarChart3 },
    { id: 'account', name: '账户管理', icon: Settings },
    { id: 'papers', name: '论文管理', icon: BookOpen },
    { id: 'ratings', name: '我的评分', icon: Star },
    { id: 'comments', name: '我的评论', icon: MessageCircle },
    { id: 'favorites', name: '收藏夹', icon: Heart },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">个人中心</h1>
        <p className="text-gray-600">管理您的账户信息、论文收藏和评价记录</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* User Info Card */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {profile?.username || '用户'}
              </h3>
              <p className="text-sm text-gray-600 mb-2">{user.email}</p>
              {profile?.role === 'admin' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  管理员
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="bg-white rounded-lg shadow-sm border">
            <div className="p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border">
            {activeTab === 'overview' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">账户概览</h2>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Star className="w-8 h-8 text-blue-600 mr-3" />
                      <div>
                        <p className="text-2xl font-bold text-blue-900">{stats.total_ratings}</p>
                        <p className="text-sm text-blue-600">评分数量</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <MessageCircle className="w-8 h-8 text-green-600 mr-3" />
                      <div>
                        <p className="text-2xl font-bold text-green-900">{stats.total_comments}</p>
                        <p className="text-sm text-green-600">评论数量</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <Heart className="w-8 h-8 text-purple-600 mr-3" />
                      <div>
                        <p className="text-2xl font-bold text-purple-900">{stats.total_favorites}</p>
                        <p className="text-sm text-purple-600">收藏论文</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">最近活动</h3>
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无活动记录</p>
                    <p className="text-sm mt-1">开始评分和评论论文来查看活动记录</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">账户管理</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      邮箱地址
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">邮箱地址不可修改</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      用户名
                    </label>
                    <input
                      type="text"
                      value={profile?.username || ''}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      账户类型
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        profile?.role === 'admin' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {profile?.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      保存更改
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'papers' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">论文管理</h2>
                <div className="text-center py-12 text-gray-500">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">功能开发中</p>
                  <p className="text-sm">论文搜索记录功能正在开发中</p>
                </div>
              </div>
            )}

            {activeTab === 'ratings' && (
              <div className="p-6">
                <UserRatings />
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="p-6">
                <UserComments />
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="p-6">
                <UserFavorites />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

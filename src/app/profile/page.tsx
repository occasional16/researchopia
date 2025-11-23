'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  User, BookOpen, Star, MessageCircle, Heart, BarChart3, ExternalLink,
  FileText, Eye, EyeOff, MapPin, Building2, Briefcase, Mail, Link as LinkIcon,
  Edit, Save, X, Shield, Globe, Users, Plus
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserStats, type UserStats } from '@/lib/userActivity'
import UserRatings from '@/components/profile/UserRatings'
import UserComments from '@/components/profile/UserComments'
import UserFavorites from '@/components/profile/UserFavorites'
import AccountManagement from '@/components/profile/AccountManagement'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'

/**
 * /profile 页面 - 个人中心
 * 
 * 设计理念：
 * - 展示用户的个人基本学术信息、关注信息、论文相关信息、zotero共享标注相关信息
 * - 提供相应的管理（如设置是否公开）
 * - 整体页面布局根据实际进行调整
 */
export default function ProfilePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile, loading: authLoading, getAccessToken } = useAuth()
  
  // 保持滚动位置
  useScrollRestoration()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [papersSubTab, setPapersSubTab] = useState<'favorites' | 'ratings' | 'comments'>('favorites')
  const [annotationsSubTab, setAnnotationsSubTab] = useState<'shared' | 'comments'>('shared')
  const [stats, setStats] = useState<UserStats>({
    total_ratings: 0,
    total_comments: 0,
    total_favorites: 0,
    avg_rating: 0
  })
  const [userProfile, setUserProfile] = useState<any>(null)
  const [profileForm, setProfileForm] = useState<any>({})
  const [annotations, setAnnotations] = useState<any[]>([])
  const [annotationComments, setAnnotationComments] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [newField, setNewField] = useState('')

  useEffect(() => {
    if (user && profile?.username) {
      loadAllData()
    }
  }, [user, profile])

  // 处理 URL 查询参数，设置初始标签
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'academic-info', 'papers', 'annotations', 'account'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadAllData = async () => {
    await Promise.all([
      loadStats(),
      loadUserProfile(),
      loadAnnotations(),
      loadAnnotationComments(),
      loadRecentActivities()
    ])
  }

  const loadStats = async () => {
    if (!user) return
    try {
      const userStats = await getUserStats(user.id)
      setStats(userStats)
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const loadUserProfile = async () => {
    if (!user || !profile?.username) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/users/${profile.username}/profile`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.profile)
        setProfileForm(data.profile)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  const loadAnnotations = async () => {
    if (!user || !profile?.username) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/users/${profile.username}/annotations?limit=10`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAnnotations(data.annotations || [])
      }
    } catch (error) {
      console.error('Error loading annotations:', error)
    }
  }

  const loadAnnotationComments = async () => {
    if (!user || !profile?.username) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/users/${profile.username}/annotation-comments?limit=20`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAnnotationComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error loading annotation comments:', error)
    }
  }

  const loadRecentActivities = async () => {
    if (!user) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/activities/feed?limit=10&mode=following`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (response.ok) {
        const data = await response.json()
        setRecentActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error loading recent activities:', error)
    }
  }

  const saveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!user || !profile?.username) return
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/users/${profile.username}/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileForm)
      })

      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.profile)
        setSuccess(true)
        // 重新加载数据
        loadUserProfile()
      } else {
        setError('保存失败，请重试')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setError('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = () => {
    if (!newField.trim()) return
    const currentFields = profileForm.research_fields || []
    if (!currentFields.includes(newField.trim())) {
      setProfileForm({
        ...profileForm,
        research_fields: [...currentFields, newField.trim()]
      })
    }
    setNewField('')
  }

  const handleRemoveField = (field: string) => {
    setProfileForm({
      ...profileForm,
      research_fields: profileForm.research_fields?.filter((f: string) => f !== field) || []
    })
  }

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6 w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-4"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"></div>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
    { id: 'academic-info', name: '学术信息', icon: User },
    { id: 'papers', name: '论文相关', icon: BookOpen },
    { id: 'annotations', name: 'Zotero标注相关', icon: FileText },
    { id: 'account', name: '账户设置', icon: Shield },
  ]

  const username = profile?.username || '用户'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 学术主页入口横幅 */}
      <div className="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">👋 欢迎回来，@{username}！</h2>
            <p className="text-white/90">查看您的公开学术主页，展示您的研究成果</p>
          </div>
          <button
            onClick={() => router.push(`/profile/${username}`)}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-all font-semibold shadow-md hover:shadow-lg"
          >
            <User className="w-5 h-5" />
            查看学术主页
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">个人中心</h1>
        <p className="text-gray-600 dark:text-gray-400">管理您的学术信息、论文收藏和标注记录</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          {/* User Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {userProfile?.real_name || username}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">@{username}</p>
              {userProfile?.institution && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{userProfile.institution}</p>
              )}
              {profile?.role === 'admin' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                  <Shield className="w-3 h-3 mr-1" />
                  管理员
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-700 dark:border-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
            {/* 概览标签页 */}
            {activeTab === 'overview' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">概览</h2>

                {/* 统计卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <div className="flex flex-col">
                      <Star className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{stats.total_ratings}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400">论文评分</p>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="flex flex-col">
                      <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
                      <p className="text-2xl font-bold text-green-900 dark:text-green-300">{stats.total_comments}</p>
                      <p className="text-sm text-green-600 dark:text-green-400">论文评论</p>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                    <div className="flex flex-col">
                      <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{stats.total_favorites}</p>
                      <p className="text-sm text-purple-600 dark:text-purple-400">论文收藏</p>
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <div className="flex flex-col">
                      <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400 mb-2" />
                      <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">{annotations.length}</p>
                      <p className="text-sm text-orange-600 dark:text-orange-400">共享标注</p>
                    </div>
                  </div>
                </div>

                {/* 最近活动 */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">最近活动</h3>
                  {recentActivities.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivities.slice(0, 5).map((activity: any) => (
                        <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-shrink-0 mt-1">
                            {activity.activity_type === 'paper_added' && <BookOpen className="w-5 h-5 text-blue-600" />}
                            {activity.activity_type === 'annotation_added' && <FileText className="w-5 h-5 text-green-600" />}
                            {activity.activity_type === 'comment_added' && <MessageCircle className="w-5 h-5 text-purple-600" />}
                            {activity.activity_type === 'rating_added' && <Star className="w-5 h-5 text-yellow-600" />}
                            {activity.activity_type === 'paper_favorited' && <Heart className="w-5 h-5 text-red-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">
                              {activity.activity_type === 'paper_added' && '添加了论文'}
                              {activity.activity_type === 'annotation_added' && '分享了标注'}
                              {activity.activity_type === 'comment_added' && '发表了评论'}
                              {activity.activity_type === 'rating_added' && '评分了论文'}
                              {activity.activity_type === 'paper_favorited' && '收藏了论文'}
                            </p>
                            {activity.content_preview && (
                              <p className="text-sm text-gray-600 mt-1 truncate">{activity.content_preview}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>暂无活动记录</p>
                      <p className="text-sm mt-1">开始评分和评论论文来查看活动记录</p>
                    </div>
                  )}
                </div>

                {/* 最新标注预览 */}
                {annotations.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">最新标注</h3>
                      <button
                        onClick={() => setActiveTab('annotations')}
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        查看全部 <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {annotations.slice(0, 3).map((annotation: any) => (
                        <div key={annotation.id} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-900 line-clamp-2">{annotation.content}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(annotation.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 学术信息标签页 */}
            {activeTab === 'academic-info' && (
              <div className="p-6">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">编辑学术信息</h1>
                  <p className="text-gray-600 mt-1">完善你的学术档案，让其他研究者更好地了解你</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                    保存成功！
                  </div>
                )}

                <form onSubmit={saveProfile} className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
                  {/* 基本信息 */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          真实姓名
                        </label>
                        <input
                          type="text"
                          value={profileForm.real_name || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, real_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="张三"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          所在地
                        </label>
                        <input
                          type="text"
                          value={profileForm.location || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="北京, 中国"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          个人网站
                        </label>
                        <input
                          type="url"
                          value={profileForm.website || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="https://example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          个人简介
                        </label>
                        <textarea
                          value={profileForm.bio || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="介绍一下你的研究方向和学术兴趣..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* 学术身份 */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">学术身份</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          所属机构
                        </label>
                        <input
                          type="text"
                          value={profileForm.institution || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="清华大学"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          院系/部门
                        </label>
                        <input
                          type="text"
                          value={profileForm.department || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="计算机科学与技术系"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          职位/职称
                        </label>
                        <input
                          type="text"
                          value={profileForm.position || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="博士研究生 / 助理教授"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          研究领域
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={newField}
                            onChange={(e) => setNewField(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddField()
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="输入研究领域，按回车添加"
                          />
                          <button
                            type="button"
                            onClick={handleAddField}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profileForm.research_fields?.map((field: string, index: number) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                            >
                              #{field}
                              <button
                                type="button"
                                onClick={() => handleRemoveField(field)}
                                className="hover:text-blue-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 学术标识 */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">学术标识</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ORCID
                        </label>
                        <input
                          type="text"
                          value={profileForm.orcid || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, orcid: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0000-0000-0000-0000"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Google Scholar ID
                        </label>
                        <input
                          type="text"
                          value={profileForm.google_scholar_id || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, google_scholar_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="用户ID"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ResearchGate ID
                        </label>
                        <input
                          type="text"
                          value={profileForm.researchgate_id || ''}
                          onChange={(e) => setProfileForm({ ...profileForm, researchgate_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="用户ID"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 隐私设置 */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">隐私设置</h2>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          主页可见性
                        </label>
                        <select
                          value={profileForm.profile_visibility || 'public'}
                          onChange={(e) => setProfileForm({ ...profileForm, profile_visibility: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="public">公开 - 所有人可见</option>
                          <option value="followers">关注者可见</option>
                          <option value="private">私密 - 仅自己可见</option>
                        </select>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="show_email"
                          checked={profileForm.show_email || false}
                          onChange={(e) => setProfileForm({ ...profileForm, show_email: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show_email" className="ml-2 text-sm text-gray-700">
                          公开显示邮箱地址
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="show_institution"
                          checked={profileForm.show_institution || false}
                          onChange={(e) => setProfileForm({ ...profileForm, show_institution: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="show_institution" className="ml-2 text-sm text-gray-700">
                          公开显示所属机构
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => router.push('/profile')}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {loading ? '保存中...' : '保存更改'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 论文相关标签页 */}
            {activeTab === 'papers' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">论文相关</h2>

                {/* 子标签 */}
                <div className="flex gap-2 mb-6 border-b">
                  <button
                    onClick={() => setPapersSubTab('favorites')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      papersSubTab === 'favorites'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    收藏夹
                  </button>
                  <button
                    onClick={() => setPapersSubTab('ratings')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      papersSubTab === 'ratings'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    我的评分
                  </button>
                  <button
                    onClick={() => setPapersSubTab('comments')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      papersSubTab === 'comments'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    我的评论
                  </button>
                </div>

                {/* 子标签内容 */}
                {papersSubTab === 'favorites' && <UserFavorites />}
                {papersSubTab === 'ratings' && <UserRatings />}
                {papersSubTab === 'comments' && <UserComments />}
              </div>
            )}

            {/* Zotero标注相关标签页 */}
            {activeTab === 'annotations' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Zotero 标注相关</h2>

                {/* 子标签 */}
                <div className="flex gap-2 mb-6 border-b">
                  <button
                    onClick={() => setAnnotationsSubTab('shared')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      annotationsSubTab === 'shared'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    共享标注
                  </button>
                  <button
                    onClick={() => setAnnotationsSubTab('comments')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      annotationsSubTab === 'comments'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    标注评论
                  </button>
                </div>

                {/* 共享标注子标签 */}
                {annotationsSubTab === 'shared' && (
                  <div>
                    {annotations.length > 0 ? (
                      <div className="space-y-4">
                        {annotations.map((annotation: any) => (
                          <div key={annotation.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            {/* 标注内容 */}
                            {annotation.content && (
                              <div className="mb-3">
                                <div className="text-sm text-gray-500 mb-1">标注内容：</div>
                                <p className="text-gray-900 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                                  {annotation.content}
                                </p>
                              </div>
                            )}

                            {/* 笔记 */}
                            {annotation.comment && (
                              <div className="mb-3">
                                <div className="text-sm text-gray-500 mb-1">我的笔记：</div>
                                <p className="text-gray-700 bg-blue-50 p-2 rounded">
                                  {annotation.comment}
                                </p>
                              </div>
                            )}

                            {/* 元信息 */}
                            <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                {annotation.type === 'highlight' ? '高亮' : annotation.type === 'note' ? '笔记' : '文本'}
                              </span>
                              {/* 作者名显示:私密→"私密",匿名→"匿名用户",其他→真实用户名 */}
                              <span>
                                {annotation.visibility === 'private' ? (
                                  '私密'
                                ) : annotation.show_author_name === false ? (
                                  '匿名用户'
                                ) : (
                                  annotation.users?.display_name || annotation.users?.username || '未知用户'
                                )}
                              </span>
                              <span>•</span>
                              <span>{new Date(annotation.created_at).toLocaleString()}</span>
                              {/* 可见性+作者名显示 */}
                              {annotation.visibility === 'public' && annotation.show_author_name !== false ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Globe className="w-4 h-4" />
                                  公开
                                </span>
                              ) : annotation.visibility === 'public' && annotation.show_author_name === false ? (
                                <span className="flex items-center gap-1 text-orange-600">
                                  🎭
                                  匿名
                                </span>
                              ) : annotation.visibility === 'private' ? (
                                <span className="flex items-center gap-1 text-gray-600">
                                  🔒
                                  私密
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-gray-600">
                                  <Eye className="w-4 h-4" />
                                  {annotation.visibility || '未知'}
                                </span>
                              )}
                              {annotation.likes_count > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <Heart className="w-4 h-4" />
                                  {annotation.likes_count}
                                </span>
                              )}
                              {annotation.comments_count > 0 && (
                                <span className="flex items-center gap-1 text-blue-600">
                                  <MessageCircle className="w-4 h-4" />
                                  {annotation.comments_count}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">暂无共享标注</p>
                        <p className="text-sm">使用 Zotero 插件分享标注后将在这里显示</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 标注评论子标签 */}
                {annotationsSubTab === 'comments' && (
                  <div>
                    {annotationComments.length > 0 ? (
                      <div className="space-y-4">
                        {annotationComments.map((comment: any) => (
                          <div key={comment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                            {/* 评论内容 */}
                            <div className="mb-3">
                              <div className="text-sm text-gray-500 mb-1">我的评论：</div>
                              <p className="text-gray-900 bg-blue-50 p-3 rounded">
                                {comment.content}
                              </p>
                            </div>

                            {/* 关联的标注 */}
                            {comment.annotations && (
                              <div className="mb-3 pl-4 border-l-2 border-gray-200">
                                <div className="text-sm text-gray-500 mb-1">评论的标注：</div>
                                {comment.annotations.content && (
                                  <p className="text-gray-700 bg-yellow-50 p-2 rounded text-sm">
                                    {comment.annotations.content}
                                  </p>
                                )}
                                {comment.annotations.comment && (
                                  <p className="text-gray-600 text-sm mt-1">
                                    笔记：{comment.annotations.comment}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 关联的论文 */}
                            {comment.annotations?.documents?.papers && (
                              <div className="mb-3">
                                <div className="text-sm text-gray-500 mb-1">所属论文：</div>
                                <a
                                  href={`/papers/${comment.annotations.documents.papers.id}`}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  {comment.annotations.documents.papers.title}
                                </a>
                              </div>
                            )}

                            {/* 元信息 */}
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                {comment.parent_id ? '回复评论' : '顶级评论'}
                              </span>
                              <span>{new Date(comment.created_at).toLocaleString()}</span>
                              {comment.is_anonymous && (
                                <span className="flex items-center gap-1 text-purple-600">
                                  <User className="w-4 h-4" />
                                  匿名
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">暂无标注评论</p>
                        <p className="text-sm">您还没有在其他用户的标注下发表评论</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 账户设置标签页 */}
            {activeTab === 'account' && (
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">账户设置</h2>
                <AccountManagement user={user} profile={profile} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}


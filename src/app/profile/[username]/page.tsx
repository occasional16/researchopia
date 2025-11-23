'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, MapPin, Link as LinkIcon, Mail, Building2,
  BookOpen, FileText, MessageCircle, Star, Heart,
  Edit, ExternalLink, BarChart3, Eye, Globe
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile, type UserProfile, formatStatNumber } from '@/lib/profile'
import { getUserStats, type UserStats } from '@/lib/userActivity'
import FollowButton from '@/components/FollowButton'
import UserRatings from '@/components/profile/UserRatings'
import UserComments from '@/components/profile/UserComments'
import UserFavorites from '@/components/profile/UserFavorites'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'

/**
 * /profile/[username] 页面 - 个人学术主页（公开）
 *
 * 设计理念：
 * - 展示用户的公开学术信息
 * - 参考 /profile 页面的布局，但只显示公开内容
 * - 包含：概览、论文相关、Zotero标注相关
 * - 保留关注按钮
 */
export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user, getAccessToken } = useAuth()
  const username = params.username as string

  // 保持滚动位置
  useScrollRestoration()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [papersSubTab, setPapersSubTab] = useState<'favorites' | 'ratings' | 'comments'>('favorites')
  const [annotationsSubTab, setAnnotationsSubTab] = useState<'shared' | 'comments'>('shared')

  // 数据状态
  const [stats, setStats] = useState<UserStats>({
    total_ratings: 0,
    total_comments: 0,
    total_favorites: 0,
    avg_rating: 0
  })
  const [annotations, setAnnotations] = useState<any[]>([])
  const [annotationComments, setAnnotationComments] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [username]) // 只依赖username，不依赖user

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)

      const accessToken = await getAccessToken()
      const profileData = await getUserProfile(username, accessToken || undefined)

      if (!profileData) {
        setError('用户不存在')
        return
      }

      setProfile(profileData)

      // 加载用户统计数据
      if (profileData.id) {
        const userStats = await getUserStats(profileData.id)
        setStats(userStats)
      }

      // 加载初始数据
      await Promise.all([
        loadAnnotations(profileData.id),
        loadAnnotationComments(),
        loadRecentActivities()
      ])
    } catch (err) {
      console.error('Error loading profile:', err)
      setError('加载用户资料失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAnnotations = async (userId?: string) => {
    if (!username) return
    try {
      const response = await fetch(`/api/users/${username}/annotations?limit=10`)
      if (response.ok) {
        const data = await response.json()
        setAnnotations(data.annotations || [])
      }
    } catch (error) {
      console.error('Error loading annotations:', error)
    }
  }

  const loadAnnotationComments = async () => {
    if (!username) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/users/${username}/annotation-comments?limit=20`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
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
    if (!username) return
    try {
      const accessToken = await getAccessToken()
      const response = await fetch(`/api/activities/feed?limit=10&mode=following`, {
        headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
      })
      if (response.ok) {
        const data = await response.json()
        setRecentActivities(data.activities || [])
      }
    } catch (error) {
      console.error('Error loading recent activities:', error)
    }
  }

  const handleFollowChange = (isFollowing: boolean, followersCount: number) => {
    // 更新本地状态
    if (profile) {
      setProfile({
        ...profile,
        isFollowing,
        stats: {
          ...profile.stats,
          followers_count: followersCount
        }
      })
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || '用户不存在'}
          </h2>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: '概览', icon: BarChart3, count: undefined as number | undefined },
    { id: 'papers', name: '论文相关', icon: BookOpen, count: (stats.total_favorites + stats.total_ratings + stats.total_comments) || undefined },
    { id: 'annotations', name: 'Zotero标注相关', icon: FileText, count: (annotations.length + annotationComments.length) || undefined },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 个人信息卡片 */}
      <div className="bg-white rounded-lg shadow-sm border p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* 头像 */}
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {profile.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* 基本信息 */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {profile.real_name || profile.username}
                </h1>
                <p className="text-gray-600">@{profile.username}</p>
              </div>
              
              {/* 操作按钮 */}
              <div className="flex gap-2">
                {profile.isOwner ? (
                  <button
                    onClick={() => router.push('/profile')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    管理个人中心
                  </button>
                ) : (
                  <FollowButton
                    username={username}
                    initialIsFollowing={profile.isFollowing}
                    initialFollowersCount={profile.stats.followers_count}
                    onFollowChange={handleFollowChange}
                  />
                )}
              </div>
            </div>

            {/* 职位和机构 */}
            {(profile.position || profile.institution) && (
              <div className="flex items-center gap-2 text-gray-700 mb-3">
                <Building2 className="w-4 h-4" />
                <span>
                  {profile.position && <span className="font-medium">{profile.position}</span>}
                  {profile.position && profile.institution && <span className="mx-1">@</span>}
                  {profile.institution && <span>{profile.institution}</span>}
                </span>
              </div>
            )}

            {/* 位置和网站 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </div>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                  <LinkIcon className="w-4 h-4" />
                  个人网站
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {profile.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {profile.email}
                </div>
              )}
            </div>

            {/* 学术标识 */}
            {(profile.orcid || profile.google_scholar_id || profile.researchgate_id) && (
              <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
                {profile.orcid && (
                  <a
                    href={`https://orcid.org/${profile.orcid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <span className="font-semibold">🎓 ORCID</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.google_scholar_id && (
                  <a
                    href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <span className="font-semibold">📚 Google Scholar</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {profile.researchgate_id && (
                  <a
                    href={`https://www.researchgate.net/profile/${profile.researchgate_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 transition-colors"
                  >
                    <span className="font-semibold">🔬 ResearchGate</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {/* 研究领域 */}
            {profile.research_fields && profile.research_fields.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.research_fields.map((field, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    #{field}
                  </span>
                ))}
              </div>
            )}

            {/* 个人简介 */}
            {profile.bio && (
              <p className="text-gray-700 mb-4">{profile.bio}</p>
            )}

            {/* 统计数据 */}
            <div className="flex gap-6 text-sm">
              <Link
                href={`/profile/${username}/followers`}
                className="hover:text-blue-600 transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  {formatStatNumber(profile.stats.followers_count)}
                </span>
                <span className="text-gray-600 ml-1">关注者</span>
              </Link>
              <Link
                href={`/profile/${username}/following`}
                className="hover:text-blue-600 transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  {formatStatNumber(profile.stats.following_count)}
                </span>
                <span className="text-gray-600 ml-1">关注中</span>
              </Link>    
            </div>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="p-6">
          {tabLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">加载中...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* 学术统计 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 学术统计</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-blue-600 mb-1">论文数量</p>
                            <p className="text-2xl font-bold text-blue-900">{profile.stats.papers_count}</p>
                          </div>
                          <BookOpen className="w-8 h-8 text-blue-600" />
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-purple-600 mb-1">标注数量</p>
                            <p className="text-2xl font-bold text-purple-900">{profile.stats.annotations_count}</p>
                          </div>
                          <FileText className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-green-600 mb-1">评论数量</p>
                            <p className="text-2xl font-bold text-green-900">{profile.stats.comments_count}</p>
                          </div>
                          <MessageCircle className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-red-600 mb-1">收藏数量</p>
                            <p className="text-2xl font-bold text-red-900">{profile.stats.favorites_count}</p>
                          </div>
                          <Heart className="w-8 h-8 text-red-600" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 学术成就 */}
                  {(profile.stats.ratings_count > 0 || (profile.stats.quality_annotations_count && profile.stats.quality_annotations_count > 0)) && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 学术成就</h3>
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {profile.stats.avg_rating && (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-orange-600 mb-1">
                                {profile.stats.avg_rating.toFixed(1)}
                              </div>
                              <div className="text-sm text-gray-600">平均评分</div>
                            </div>
                          )}
                          {profile.stats.ratings_count > 0 && (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-yellow-600 mb-1">
                                {profile.stats.ratings_count}
                              </div>
                              <div className="text-sm text-gray-600">评分次数</div>
                            </div>
                          )}
                          {profile.stats.quality_annotations_count && profile.stats.quality_annotations_count > 0 && (
                            <div className="text-center">
                              <div className="text-3xl font-bold text-purple-600 mb-1">
                                {profile.stats.quality_annotations_count}
                              </div>
                              <div className="text-sm text-gray-600">优质标注</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}



                  {/* 热门标注 */}
                  {annotations.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">💡 热门标注</h3>
                        <button
                          onClick={() => setActiveTab('annotations')}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          查看全部
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {annotations.slice(0, 3).map((annotation: any) => {
                          const document = annotation.documents
                          const paper = document?.papers
                          return (
                            <div
                              key={annotation.id}
                              className="bg-gray-50 rounded-lg p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="w-1 h-full rounded min-h-[40px]"
                                  style={{ backgroundColor: annotation.color || '#ffd400' }}
                                />
                                <div className="flex-1">
                                  {annotation.content && (
                                    <p className="text-gray-900 mb-1 text-sm font-medium line-clamp-2">
                                      {annotation.content}
                                    </p>
                                  )}
                                  {paper && (
                                    <p className="text-xs text-gray-600 line-clamp-1">
                                      📄 {paper.title}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 如果没有任何内容 */}
                  {annotations.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>该用户还没有发布任何内容</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'papers' && (
                <div>
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
                  {papersSubTab === 'favorites' && <UserFavorites username={username} />}
                  {papersSubTab === 'ratings' && <UserRatings username={username} />}
                  {papersSubTab === 'comments' && <UserComments username={username} />}
                </div>
              )}

              {activeTab === 'annotations' && (
                <div>
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
                          {annotations.map((annotation: any) => {
                            const document = annotation.documents
                            const paper = document?.papers
                            return (
                              <div key={annotation.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                {/* 标注内容 */}
                                {annotation.content && (
                                  <div className={`p-3 rounded mb-3 ${
                                    annotation.type === 'highlight' ? 'bg-yellow-50' : 'bg-blue-50'
                                  }`}>
                                    <p className="text-gray-900">{annotation.content}</p>
                                  </div>
                                )}

                                {/* 笔记 */}
                                {annotation.comment && (
                                  <div className="mb-3">
                                    <p className="text-sm text-gray-500 mb-1">笔记：</p>
                                    <p className="text-gray-700">{annotation.comment}</p>
                                  </div>
                                )}

                                {/* 关联论文 */}
                                {paper && (
                                  <div className="mb-3">
                                    <Link
                                      href={`/papers/${paper.doi || paper.id}`}
                                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                      <FileText className="w-4 h-4" />
                                      {paper.title}
                                    </Link>
                                  </div>
                                )}

                                {/* 元信息 */}
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  {/* 作者名显示:私密→"私密",匿名→"匿名用户",其他→真实用户名 */}
                                  <span>
                                    {annotation.visibility === 'private' ? (
                                      '私密'
                                    ) : annotation.show_author_name === false ? (
                                      '匿名用户'
                                    ) : (
                                      annotation.users?.username || profile?.username || '未知用户'
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    {annotation.visibility === 'public' && annotation.show_author_name !== false ? (
                                      <>
                                        <Eye className="w-4 h-4" />
                                        公开
                                      </>
                                    ) : annotation.visibility === 'public' && annotation.show_author_name === false ? (
                                      <>
                                        🎭
                                        匿名
                                      </>
                                    ) : annotation.visibility === 'private' ? (
                                      <>
                                        🔒
                                        私密
                                      </>
                                    ) : (
                                      <>
                                        <Eye className="w-4 h-4" />
                                        {annotation.visibility || '未知'}
                                      </>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Heart className="w-4 h-4" />
                                    {annotation.likes_count || 0}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    {annotation.comments_count || 0}
                                  </span>
                                  <span>{new Date(annotation.created_at).toLocaleString()}</span>
                                  {annotation.tags && annotation.tags.length > 0 && (
                                    <div className="flex gap-1">
                                      {annotation.tags.map((tag: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                                          #{tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <p className="text-lg font-medium mb-2">暂无共享标注</p>
                          <p className="text-sm">该用户还没有公开分享任何标注</p>
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
                                <div className="text-sm text-gray-500 mb-1">评论：</div>
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
                                  <Link
                                    href={`/papers/${comment.annotations.documents.papers.id}`}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  >
                                    {comment.annotations.documents.papers.title}
                                  </Link>
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
                          <p className="text-sm">该用户还没有在其他用户的标注下发表评论</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


            </>
          )}
        </div>
      </div>
    </div>
  )
}


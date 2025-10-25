'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { User, MapPin, Building2, Users, ExternalLink, Mail, LinkIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import FollowButton from '@/components/FollowButton'
import { formatStatNumber } from '@/lib/profile'

interface UserHoverCardProps {
  username: string
  children: React.ReactNode
  delay?: number // hover延迟显示(ms)
}

interface UserPreviewData {
  username: string
  real_name?: string
  avatar_url?: string
  institution?: string
  position?: string
  bio?: string
  location?: string
  website?: string
  email?: string
  orcid?: string
  google_scholar_id?: string
  researchgate_id?: string
  research_fields?: string[]
  stats: {
    followers_count: number
    following_count: number
    papers_count: number
  }
  isFollowing: boolean
}

export default function UserHoverCard({ username, children, delay = 500 }: UserHoverCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const [userData, setUserData] = useState<UserPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  
  const { user, getAccessToken } = useAuth()
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHovering) {
      // 清除关闭延迟
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }

      // 设置显示延迟
      hoverTimeoutRef.current = setTimeout(() => {
        setShowCard(true)
        if (!userData) {
          loadUserData()
        }
      }, delay)
    } else {
      // 清除显示延迟
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
        hoverTimeoutRef.current = null
      }
      
      // 延迟关闭,给用户时间移动到卡片上
      closeTimeoutRef.current = setTimeout(() => {
        setShowCard(false)
      }, 200)
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [isHovering, delay])

  const loadUserData = async () => {
    if (loading || userData) return
    
    setLoading(true)
    try {
      const accessToken = await getAccessToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(`/api/users/${username}/profile`, { headers })
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const data = await response.json()
      // API返回的是 { success: true, profile: {...} }
      const profile = data.profile || data
      setUserData(profile)
      setIsFollowing(profile.isFollowing || false)
      setFollowersCount(profile.stats?.followers_count || 0)
    } catch (error) {
      console.error('Error loading user preview:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollowChange = (following: boolean, count: number) => {
    setIsFollowing(following)
    setFollowersCount(count)
    if (userData && userData.stats) {
      userData.isFollowing = following
      userData.stats.followers_count = count
    }
  }

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {children}

      {/* 悬浮卡片 */}
      {showCard && (
        <div
          ref={cardRef}
          className="absolute z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4 mt-2 left-0"
          style={{ top: '100%' }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {loading && !userData ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : userData ? (
            <div className="space-y-3">
              {/* 头像和基本信息 */}
              <div className="flex items-start gap-3">
                <Link href={`/profile/${username}`} className="flex-shrink-0">
                  {userData.avatar_url ? (
                    <img
                      src={userData.avatar_url}
                      alt={username}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link 
                    href={`/profile/${username}`}
                    className="font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate"
                  >
                    {userData.real_name || username}
                  </Link>
                  <p className="text-sm text-gray-600 truncate">@{username}</p>
                </div>
              </div>

              {/* 职位和机构 */}
              {(userData.position || userData.institution) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">
                    {userData.position && <span className="font-medium">{userData.position}</span>}
                    {userData.position && userData.institution && <span className="mx-1">@</span>}
                    {userData.institution && <span>{userData.institution}</span>}
                  </span>
                </div>
              )}

              {/* 位置和网站 */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                {userData.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {userData.location}
                  </div>
                )}
                {userData.website && (
                  <a
                    href={userData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LinkIcon className="w-4 h-4" />
                    个人网站
                  </a>
                )}
                {userData.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {userData.email}
                  </div>
                )}
              </div>

              {/* 学术标识 */}
              {(userData.orcid || userData.google_scholar_id || userData.researchgate_id) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {userData.orcid && (
                    <a
                      href={`https://orcid.org/${userData.orcid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-semibold">🎓 ORCID</span>
                    </a>
                  )}
                  {userData.google_scholar_id && (
                    <a
                      href={`https://scholar.google.com/citations?user=${userData.google_scholar_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-semibold">📚 Scholar</span>
                    </a>
                  )}
                  {userData.researchgate_id && (
                    <a
                      href={`https://www.researchgate.net/profile/${userData.researchgate_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-semibold">🔬 RG</span>
                    </a>
                  )}
                </div>
              )}

              {/* 研究领域 */}
              {userData.research_fields && userData.research_fields.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {userData.research_fields.slice(0, 3).map((field, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                    >
                      #{field}
                    </span>
                  ))}
                  {userData.research_fields.length > 3 && (
                    <span className="px-2 py-0.5 text-gray-500 text-xs">
                      +{userData.research_fields.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* 个人简介 */}
              {userData.bio && (
                <p className="text-sm text-gray-700 line-clamp-2">{userData.bio}</p>
              )}

              {/* 统计数据 */}
              <div className="flex gap-4 text-sm pt-2 border-t">
                <div>
                  <span className="font-semibold text-gray-900">
                    {formatStatNumber(followersCount)}
                  </span>
                  <span className="text-gray-600 ml-1">关注者</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">
                    {formatStatNumber(userData.stats?.following_count || 0)}
                  </span>
                  <span className="text-gray-600 ml-1">关注中</span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2 border-t">
                {user && user.username !== username ? (
                  <>
                    <div className="flex-1">
                      <FollowButton
                        username={username}
                        initialIsFollowing={isFollowing}
                        initialFollowersCount={followersCount}
                        onFollowChange={handleFollowChange}
                      />
                    </div>
                    <Link
                      href={`/profile/${username}`}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1 text-sm font-medium text-gray-700"
                    >
                      查看主页
                    </Link>
                  </>
                ) : user && user.username === username ? (
                  <Link
                    href={`/profile`}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                  >
                    管理个人中心
                  </Link>
                ) : (
                  <Link
                    href={`/profile/${username}`}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
                  >
                    查看主页
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              加载失败
            </div>
          )}
        </div>
      )}
    </div>
  )
}

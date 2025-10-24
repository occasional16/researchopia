'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface FollowButtonProps {
  username: string
  initialIsFollowing: boolean
  initialFollowersCount: number
  onFollowChange?: (isFollowing: boolean, followersCount: number) => void
}

export default function FollowButton({
  username,
  initialIsFollowing,
  initialFollowersCount,
  onFollowChange
}: FollowButtonProps) {
  const { user, getAccessToken } = useAuth()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)

  const handleFollow = async () => {
    if (!user) {
      alert('请先登录')
      return
    }

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        alert('请先登录')
        return
      }

      const action = isFollowing ? 'unfollow' : 'follow'
      const response = await fetch(`/api/users/${username}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to follow/unfollow')
      }

      const data = await response.json()
      setIsFollowing(data.isFollowing)
      setFollowersCount(data.followersCount)
      
      // 通知父组件
      if (onFollowChange) {
        onFollowChange(data.isFollowing, data.followersCount)
      }

    } catch (error) {
      console.error('Follow error:', error)
      alert(error instanceof Error ? error.message : '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleFollow}
      disabled={loading}
      className={`
        px-6 py-2 rounded-lg font-medium transition-all duration-200
        ${isFollowing
          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          : 'bg-blue-600 text-white hover:bg-blue-700'
        }
        ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
      `}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          处理中...
        </span>
      ) : (
        isFollowing ? '已关注' : '+ 关注'
      )}
    </button>
  )
}


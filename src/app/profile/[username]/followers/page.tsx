'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, ArrowLeft } from 'lucide-react'

interface UserItem {
  id: string
  username: string
  real_name?: string
  avatar_url?: string
  institution?: string
  position?: string
  bio?: string
  followers_count: number
  following_count: number
  followed_at: string
}

export default function FollowersPage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [followers, setFollowers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    fetchFollowers()
  }, [username, page])

  const fetchFollowers = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/users/${username}/followers?page=${page}&limit=${limit}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch followers')
      }

      const data = await response.json()
      setFollowers(data.followers)
      setTotal(data.total)
    } catch (error) {
      console.error('Error fetching followers:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {username} 的关注者
          </h1>
          <p className="text-gray-600 mt-1">
            共 {total} 位关注者
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        )}

        {/* Followers List */}
        {!loading && followers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">还没有关注者</p>
          </div>
        )}

        {!loading && followers.length > 0 && (
          <div className="space-y-4">
            {followers.map((follower) => (
              <Link
                key={follower.id}
                href={`/profile/${follower.username}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {follower.avatar_url ? (
                      <img
                        src={follower.avatar_url}
                        alt={follower.username}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        {follower.real_name || follower.username}
                      </h3>
                      {follower.real_name && (
                        <span className="text-sm text-gray-500">
                          @{follower.username}
                        </span>
                      )}
                    </div>

                    {follower.position && follower.institution && (
                      <p className="text-sm text-gray-600 mb-2">
                        {follower.position} · {follower.institution}
                      </p>
                    )}

                    {follower.bio && (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {follower.bio}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{follower.followers_count} 关注者</span>
                      <span>{follower.following_count} 关注中</span>
                    </div>
                  </div>
                </div>
              </Link>
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
      </div>
    </div>
  )
}


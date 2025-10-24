'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Star, Trash2, Calendar, ExternalLink } from 'lucide-react'
import { getUserRatings, deleteUserRating, type UserRatingWithPaper } from '@/lib/userActivity'
import { useAuth } from '@/contexts/AuthContext'

interface UserRatingsProps {
  username?: string
}

export default function UserRatings({ username }: UserRatingsProps = {}) {
  const { user, getAccessToken } = useAuth()
  const [ratings, setRatings] = useState<UserRatingWithPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const isCurrentUser = !username || (user && user.username === username)

  useEffect(() => {
    loadRatings()
  }, [user, username])

  const loadRatings = async () => {
    try {
      setLoading(true)

      if (username) {
        const accessToken = await getAccessToken()
        const response = await fetch(`/api/users/${username}/ratings?limit=100`, {
          headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
        })
        if (response.ok) {
          const data = await response.json()
          setRatings(data.ratings || [])
        }
      } else if (user) {
        const data = await getUserRatings(user.id)
        setRatings(data)
      }
    } catch (error) {
      console.error('Error loading ratings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (ratingId: string) => {
    if (!confirm('确定要删除这个评分吗？此操作不可撤销。')) {
      return
    }

    try {
      setDeleting(ratingId)
      const success = await deleteUserRating(ratingId)
      
      if (success) {
        setRatings(prev => prev.filter(r => r.id !== ratingId))
      } else {
        alert('删除失败，请重试')
      }
    } catch (error) {
      console.error('Error deleting rating:', error)
      alert('删除失败，请重试')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-32"></div>
          </div>
        ))}
      </div>
    )
  }

  if (ratings.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无评分记录</h3>
        <p className="text-gray-500 mb-6">您还没有对任何论文进行评分</p>
        <Link
          href="/search"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          开始评分论文
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          我的评分 ({ratings.length})
        </h3>
      </div>

      <div className="space-y-4">
        {ratings.map((rating) => (
          <div key={rating.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Link
                    href={`/papers/${rating.paper_id}`}
                    className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {rating.papers.title}
                  </Link>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {rating.papers.authors?.join(', ')} • {rating.papers.journal}
                </div>

                {/* Rating Scores */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold text-gray-900">{rating.innovation_score}</span>
                    </div>
                    <div className="text-xs text-gray-500">创新性</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold text-gray-900">{rating.methodology_score}</span>
                    </div>
                    <div className="text-xs text-gray-500">方法论</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold text-gray-900">{rating.practicality_score}</span>
                    </div>
                    <div className="text-xs text-gray-500">实用性</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-semibold text-gray-900">{rating.overall_score}</span>
                    </div>
                    <div className="text-xs text-gray-500">总体</div>
                  </div>
                </div>



                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(rating.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={() => handleDelete(rating.id)}
                  disabled={deleting === rating.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="删除评分"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

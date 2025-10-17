'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Heart, Calendar, ExternalLink, Star, Users } from 'lucide-react'
import { getUserFavorites, removeFromFavorites, type PaperWithFavorite } from '@/lib/favorites'
import { getPaperRoute } from '@/utils/paperRoutes'
import { useAuth } from '@/contexts/AuthContext'

export default function UserFavorites() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<PaperWithFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadFavorites()
    }
  }, [user])

  const loadFavorites = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const data = await getUserFavorites(user.id)
      setFavorites(data)
    } catch (error) {
      console.error('Error loading favorites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (paperId: string) => {
    if (!user || !confirm('确定要取消收藏这篇论文吗？')) {
      return
    }

    try {
      setRemoving(paperId)
      const success = await removeFromFavorites(user.id, paperId)
      
      if (success) {
        setFavorites(prev => prev.filter(f => f.id !== paperId))
      } else {
        alert('取消收藏失败，请重试')
      }
    } catch (error) {
      console.error('Error removing favorite:', error)
      alert('取消收藏失败，请重试')
    } finally {
      setRemoving(null)
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

  if (favorites.length === 0) {
    return (
      <div className="text-center py-12">
        <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无收藏论文</h3>
        <p className="text-gray-500 mb-6">您还没有收藏任何论文</p>
        <Link
          href="/search"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          开始收藏论文
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          我的收藏 ({favorites.length})
        </h3>
      </div>

      <div className="grid gap-6">
        {favorites.map((paper) => (
          <div key={paper.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Link
                    href={getPaperRoute(paper).href}
                    className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {paper.title}
                  </Link>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                
                {paper.authors && paper.authors.length > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-gray-600 mb-2">
                    <Users className="w-4 h-4" />
                    <span>{paper.authors.join(', ')}</span>
                  </div>
                )}

                {paper.journal && (
                  <div className="text-sm text-gray-600 mb-3">
                    发表于: {paper.journal}
                  </div>
                )}

                {paper.abstract && (
                  <p className="text-gray-700 text-sm mb-4 line-clamp-3">
                    {paper.abstract}
                  </p>
                )}

                {paper.keywords && paper.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {paper.keywords.slice(0, 4).map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                    {paper.keywords.length > 4 && (
                      <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-full">
                        +{paper.keywords.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{paper.publication_date ? new Date(paper.publication_date).getFullYear() : '未知'}</span>
                    </div>
                    {paper.doi && (
                      <div>DOI: {paper.doi}</div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Star className="w-4 h-4" />
                      <span>0.0 (0)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={() => handleRemove(paper.id)}
                  disabled={removing === paper.id}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="取消收藏"
                >
                  <Heart className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

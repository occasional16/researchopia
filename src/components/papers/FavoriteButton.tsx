'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toggleFavorite, isFavorited, getFavoriteCount } from '@/lib/favorites'

interface FavoriteButtonProps {
  paperId: string
  initialFavorited?: boolean
  showCount?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'button' | 'icon'
}

export default function FavoriteButton({ 
  paperId, 
  initialFavorited = false,
  showCount = true,
  size = 'md',
  variant = 'button'
}: FavoriteButtonProps) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadFavoriteStatus()
  }, [paperId, user])

  const loadFavoriteStatus = async () => {
    try {
      const [isFav, count] = await Promise.all([
        user ? isFavorited(user.id, paperId) : Promise.resolve(false),
        getFavoriteCount(paperId)
      ])
      
      setFavorited(isFav)
      setFavoriteCount(count)
    } catch (error) {
      console.error('Error loading favorite status:', error)
    }
  }

  const handleToggle = async () => {
    if (!user) {
      // Trigger auth modal
      const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
      window.dispatchEvent(event)
      return
    }

    if (loading) return

    try {
      setLoading(true)
      const success = await toggleFavorite(user.id, paperId)
      
      if (success) {
        const newFavorited = !favorited
        setFavorited(newFavorited)
        setFavoriteCount(prev => newFavorited ? prev + 1 : Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center justify-center rounded-full transition-colors ${
          favorited
            ? 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100'
            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${sizeClasses[size]}`}
        title={user ? (favorited ? '取消收藏' : '收藏论文') : '登录后收藏'}
      >
        <Heart 
          className={`${iconSizes[size]} ${favorited ? 'fill-current' : ''}`} 
        />
        {showCount && favoriteCount > 0 && (
          <span className="ml-1 text-xs">{favoriteCount}</span>
        )}
      </button>
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center space-x-2 rounded-md border transition-colors ${
        favorited
          ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${sizeClasses[size]}`}
      title={user ? (favorited ? '取消收藏' : '收藏论文') : '登录后收藏'}
    >
      <Heart 
        className={`${iconSizes[size]} ${favorited ? 'fill-current text-red-600' : ''}`} 
      />
      <span>
        {favorited ? '已收藏' : '收藏'}
        {showCount && favoriteCount > 0 && ` (${favoriteCount})`}
      </span>
    </button>
  )
}

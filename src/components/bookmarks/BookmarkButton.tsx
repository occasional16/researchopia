'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import BookmarkModal from './BookmarkModal'

interface BookmarkButtonProps {
  url: string
  title?: string
  variant?: 'icon' | 'button' | 'compact'
  className?: string
  onBookmarkChange?: (isBookmarked: boolean) => void
}

/**
 * Universal bookmark button component
 * - Shows filled bookmark if already bookmarked
 * - Opens folder selection modal on click
 * - Supports icon-only, button, and compact variants
 */
export default function BookmarkButton({
  url,
  title,
  variant = 'icon',
  className = '',
  onBookmarkChange
}: BookmarkButtonProps) {
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [bookmarkCount, setBookmarkCount] = useState(0) // In how many folders
  const [cachedBookmarks, setCachedBookmarks] = useState<any[]>([]) // Cache full bookmark data for modal
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Check bookmark status on mount and when URL changes
  const checkBookmarkStatus = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return
    }
    
    if (!user || !url) {
      setChecking(false)
      return
    }
    
    try {
      setChecking(true)
      const token = await getAccessToken()
      const res = await fetch(`/api/bookmarks/items/check?url=${encodeURIComponent(url)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store' // Prevent browser caching
      })
      if (res.ok) {
        const data = await res.json()
        setIsBookmarked(data.isBookmarked)
        setBookmarkCount(data.bookmarks?.length || 0)
        setCachedBookmarks(data.bookmarks || []) // Cache for modal use
      }
    } catch (error) {
      console.error('Failed to check bookmark status:', error)
    } finally {
      setChecking(false)
    }
  }, [user, url, getAccessToken, authLoading])

  useEffect(() => {
    checkBookmarkStatus()
  }, [checkBookmarkStatus])

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!user) {
      // Trigger login modal instead of redirecting
      const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
      window.dispatchEvent(event)
      return
    }
    
    setShowModal(true)
  }

  const handleBookmarkSuccess = () => {
    // Refresh status after bookmark operation
    checkBookmarkStatus()
    onBookmarkChange?.(true)
    setShowModal(false)
  }

  // Render based on variant
  const renderButton = () => {
    const iconColor = isBookmarked 
      ? 'text-yellow-500 fill-yellow-500' 
      : 'text-gray-400 hover:text-yellow-500'
    
    // Loading state during initial check
    if (checking) {
      if (variant === 'icon') {
        return (
          <span className={`p-1.5 ${className}`}>
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </span>
        )
      }
      if (variant === 'button') {
        return (
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
            <Loader2 size={16} className="animate-spin text-gray-300" />
            <span className="text-sm text-gray-400">检查中...</span>
          </span>
        )
      }
      return (
        <span className={`flex items-center gap-1 text-sm text-gray-300 ${className}`}>
          <Loader2 size={14} className="animate-spin" />
        </span>
      )
    }
    
    if (variant === 'icon') {
      return (
        <button
          onClick={handleClick}
          disabled={loading}
          className={`p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
          title={isBookmarked ? `已收藏到 ${bookmarkCount} 个文件夹` : '收藏'}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin text-gray-400" />
          ) : isBookmarked ? (
            <BookmarkCheck size={18} className={iconColor} />
          ) : (
            <Bookmark size={18} className={iconColor} />
          )}
        </button>
      )
    }

    if (variant === 'button') {
      return (
        <button
          onClick={handleClick}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
            isBookmarked 
              ? 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-700' 
              : 'border-gray-300 hover:border-yellow-300 hover:bg-yellow-50 dark:border-gray-600 dark:hover:bg-yellow-900/20 dark:hover:border-yellow-700'
          } ${className}`}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isBookmarked ? (
            <BookmarkCheck size={16} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <Bookmark size={16} />
          )}
          <span className="text-sm">{isBookmarked ? '已收藏' : '收藏'}</span>
        </button>
      )
    }

    // compact variant
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-1 text-sm ${iconColor} hover:text-yellow-500 transition-colors ${className}`}
        title={isBookmarked ? `已收藏到 ${bookmarkCount} 个文件夹` : '收藏'}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isBookmarked ? (
          <BookmarkCheck size={14} className="fill-current" />
        ) : (
          <Bookmark size={14} />
        )}
        {bookmarkCount > 0 && <span>{bookmarkCount}</span>}
      </button>
    )
  }

  return (
    <>
      {renderButton()}
      {showModal && (
        <BookmarkModal
          url={url}
          title={title}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false)
            // Refresh bookmark status in case user removed a bookmark
            checkBookmarkStatus()
          }}
          onSuccess={handleBookmarkSuccess}
          initialBookmarks={cachedBookmarks}
        />
      )}
    </>
  )
}

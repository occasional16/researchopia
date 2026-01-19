'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Globe, Star, MessageSquare, ChevronRight, Plus, Search, Home } from 'lucide-react'
import type { WebpageWithStats } from '@/lib/webpage-database'
import BookmarkButton from '@/components/bookmarks/BookmarkButton'
import { useAuth } from '@/contexts/AuthContext'

type SortOption = 'newest' | 'rating' | 'comments'

export default function WebpagesListPage() {
  const { user } = useAuth()
  const [webpages, setWebpages] = useState<WebpageWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    loadWebpages()
  }, [sortBy, searchQuery])

  const loadWebpages = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('sort', sortBy)
      params.set('limit', '50')
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim())
      }
      const res = await fetch(`/api/webpages?${params}`, {
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        // Only show webpages with engagement (rating or comments)
        const filteredWebpages = (data.webpages || []).filter(
          (w: WebpageWithStats) => (w.rating_count ?? 0) > 0 || (w.comment_count ?? 0) > 0
        )
        setWebpages(filteredWebpages)
      }
    } catch (error) {
      console.error('Failed to load webpages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddWebpage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim()) return

    setAddLoading(true)
    setAddError('')

    try {
      const res = await fetch('/api/webpages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '添加失败')
      }

      const data = await res.json()
      setShowAddModal(false)
      setNewUrl('')
      // Navigate to the new webpage
      window.location.href = `/webpages/${data.url_hash}`
    } catch (err: any) {
      setAddError(err.message || '添加网页时出错')
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 flex items-center">
            <Home size={16} className="mr-1" />
            首页
          </Link>
          <ChevronRight size={16} />
          <span className="text-gray-700 dark:text-gray-200">所有网页</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              所有网页
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              发现优质网页内容，分享您的阅读体验
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              添加网页
            </button>
          )}
        </div>

        {/* Search and Sort Options */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索网页标题或URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">排序：</span>
            <div className="flex gap-2">
            {[
              { value: 'newest', label: '最新' },
              { value: 'rating', label: '评分最高' },
              { value: 'comments', label: '评论最多' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as SortOption)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  sortBy === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* Webpages List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 animate-pulse"
              >
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : webpages.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
            <Globe className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              还没有网页
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              成为第一个添加网页评价的人
            </p>
            {user ? (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus size={20} className="mr-2" />
                添加网页
              </button>
            ) : (
              <p className="text-sm text-gray-400">请先登录</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {webpages.map((webpage) => (
              <Link
                key={webpage.id}
                href={`/webpages/${webpage.url_hash}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-4">
                  {webpage.favicon_url && (
                    <img
                      src={webpage.favicon_url}
                      alt=""
                      className="w-6 h-6 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate"
                      title={webpage.title || '未命名网页'}
                    >
                      {webpage.title || '未命名网页'}
                    </h3>
                    {webpage.description && (
                      <p 
                        className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2"
                        title={webpage.description}
                      >
                        {webpage.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center max-w-[200px]" title={webpage.url}>
                        <Globe size={14} className="mr-1 flex-shrink-0" />
                        <span className="truncate">{webpage.url}</span>
                      </span>
                      <span className="flex items-center">
                        <Star size={14} className="mr-1 text-yellow-500" />
                        {(webpage.average_rating || 0).toFixed(1)} ({webpage.rating_count || 0})
                      </span>
                      <span className="flex items-center">
                        <MessageSquare size={14} className="mr-1" />
                        {webpage.comment_count || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookmarkButton 
                      url={webpage.url}
                      title={webpage.title || undefined}
                      variant="icon"
                    />
                    <ChevronRight className="text-gray-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Add Webpage Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              添加网页
            </h2>
            <form onSubmit={handleAddWebpage}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  网页 URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              {addError && (
                <p className="text-red-600 dark:text-red-400 text-sm mb-4">{addError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewUrl('')
                    setAddError('')
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {addLoading ? '添加中...' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

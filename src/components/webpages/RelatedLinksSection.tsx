'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { 
  Link as LinkIcon, 
  Plus, 
  X, 
  Trash2,
  ExternalLink,
  Globe,
  FolderOpen
} from 'lucide-react'
import { LINK_TYPE_LABELS, type LinkType, type WebpageLink } from '@/types/bookmarks'
import { useAuth } from '@/contexts/AuthContext'

// Bookmark folder type for the selector
interface BookmarkFolder {
  id: string
  name: string
  parent_id: string | null
  children?: BookmarkFolder[]
}

// Bookmark item type
interface BookmarkItem {
  id: string
  custom_title: string | null
  webpage: {
    id: string
    url: string
    title: string | null
    favicon_url: string | null
  } | null
}

interface RelatedLinksSectionProps {
  urlHash: string
  webpageId: string
  currentUrl: string
}

interface LinkData {
  id: string
  source_webpage_id: string
  target_webpage_id: string
  link_type: LinkType
  note: string | null
  created_at: string
  is_mine: boolean
  target_webpage?: {
    id: string
    url: string
    url_hash: string
    title: string | null
    favicon_url: string | null
  }
  source_webpage?: {
    id: string
    url: string
    url_hash: string
    title: string | null
    favicon_url: string | null
  }
}

export function RelatedLinksSection({ urlHash, webpageId, currentUrl }: RelatedLinksSectionProps) {
  const { user, getAccessToken } = useAuth()
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [links, setLinks] = useState<{ outgoing: LinkData[], incoming: LinkData[] }>({ outgoing: [], incoming: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkType, setNewLinkType] = useState<LinkType>('related')
  const [newLinkNote, setNewLinkNote] = useState('')
  const [adding, setAdding] = useState(false)
  // Input mode: 'url' for manual URL input, 'bookmark' for selecting from bookmarks
  const [inputMode, setInputMode] = useState<'url' | 'bookmark'>('url')
  // Bookmark folder and items
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string>('')

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/webpages/${urlHash}/links?scope=${scope}&direction=both`, {
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch links')
      }
      const data = await response.json()
      setLinks(data.links)
      setError(null)
    } catch (err) {
      console.error('Error fetching links:', err)
      setError('加载关联链接失败')
    } finally {
      setLoading(false)
    }
  }, [urlHash, scope])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  // Fetch bookmark folders when modal opens
  const fetchBookmarkFolders = useCallback(async () => {
    if (!user) return
    
    try {
      setLoadingFolders(true)
      const token = await getAccessToken()
      const response = await fetch('/api/bookmarks/folders', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch folders')
      }
      const data = await response.json()
      if (data.success) {
        setBookmarkFolders(data.folders || [])
      }
    } catch (err) {
      console.error('Error fetching bookmark folders:', err)
    } finally {
      setLoadingFolders(false)
    }
  }, [user, getAccessToken])

  // Fetch bookmark items for selected folder
  const fetchBookmarkItems = useCallback(async (folderId: string | null) => {
    if (!user) return
    
    try {
      setLoadingItems(true)
      // Use folder_id=null for uncategorized, or the actual folder ID
      const params = folderId === null ? 'folder_id=null' : `folder_id=${folderId}`
      const token = await getAccessToken()
      const response = await fetch(`/api/bookmarks/items?${params}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
        cache: 'no-store'
      })
      if (!response.ok) {
        throw new Error('Failed to fetch items')
      }
      const data = await response.json()
      if (data.success) {
        setBookmarkItems(data.items || [])
      }
    } catch (err) {
      console.error('Error fetching bookmark items:', err)
      setBookmarkItems([])
    } finally {
      setLoadingItems(false)
    }
  }, [user, getAccessToken])

  // Load folders when modal opens (always refresh on open)
  useEffect(() => {
    if (showAddModal && user && inputMode === 'bookmark') {
      fetchBookmarkFolders()
      // Also refresh items if a folder is already selected
      if (selectedFolderId !== '') {
        const folderId = selectedFolderId === '__uncategorized__' ? null : selectedFolderId
        fetchBookmarkItems(folderId)
      }
    }
  }, [showAddModal, user, inputMode, selectedFolderId, fetchBookmarkFolders, fetchBookmarkItems])

  // Load bookmark items when folder is selected
  useEffect(() => {
    if (inputMode === 'bookmark' && selectedFolderId !== '') {
      const folderId = selectedFolderId === '__uncategorized__' ? null : selectedFolderId
      fetchBookmarkItems(folderId)
    } else {
      setBookmarkItems([])
    }
  }, [inputMode, selectedFolderId, fetchBookmarkItems])

  // Recursive function to render folder options with hierarchy
  const renderFolderOptions = (folders: BookmarkFolder[], depth: number): React.ReactNode => {
    return folders.map(folder => {
      const indent = '\u2003'.repeat(depth) // em-space for indentation
      const prefix = depth > 0 ? '└ ' : ''
      const icon = depth === 0 ? '📁' : '📂'
      
      return (
        <React.Fragment key={folder.id}>
          <option value={folder.id}>
            {indent}{prefix}{icon} {folder.name}
          </option>
          {folder.children && folder.children.length > 0 && 
            renderFolderOptions(folder.children, depth + 1)
          }
        </React.Fragment>
      )
    })
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLinkUrl.trim()) return

    try {
      setAdding(true)
      
      // Get auth token
      const token = await getAccessToken()
      if (!token) {
        throw new Error('Please login to add links')
      }
      
      // Add the link relationship
      const response = await fetch(`/api/webpages/${urlHash}/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          target_url: newLinkUrl,
          link_type: newLinkType,
          note: newLinkNote || undefined
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add link')
      }

      // Reset form state
      setShowAddModal(false)
      setNewLinkUrl('')
      setNewLinkType('related')
      setNewLinkNote('')
      setInputMode('url')
      setSelectedFolderId('')
      setSelectedBookmarkId('')
      setBookmarkItems([])
      fetchLinks()
    } catch (err) {
      console.error('Error adding link:', err)
      alert(err instanceof Error ? err.message : '添加链接失败')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('确定要删除这个关联链接吗？')) return

    try {
      const token = await getAccessToken()
      const response = await fetch(`/api/webpages/${urlHash}/links/${linkId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete link')
      }

      fetchLinks()
    } catch (err) {
      console.error('Error deleting link:', err)
      alert(err instanceof Error ? err.message : '删除链接失败')
    }
  }

  const renderLinkItem = (link: LinkData, direction: 'outgoing' | 'incoming') => {
    const webpage = direction === 'outgoing' ? link.target_webpage : link.source_webpage
    if (!webpage) return null

    const displayTitle = webpage.title || new URL(webpage.url).hostname
    const faviconUrl = webpage.favicon_url || `https://www.google.com/s2/favicons?domain=${new URL(webpage.url).hostname}&sz=32`

    return (
      <div
        key={link.id}
        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
      >
        <img
          src={faviconUrl}
          alt=""
          className="w-5 h-5 mt-0.5 rounded flex-shrink-0"
          onError={(e) => {
            e.currentTarget.src = ''
            e.currentTarget.className = 'hidden'
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/webpages/${webpage.url_hash}`}
              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 truncate"
            >
              {displayTitle}
            </Link>
            <a
              href={webpage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="在新标签页打开"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <span className={`px-1.5 py-0.5 text-xs rounded ${
              direction === 'outgoing' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            }`}>
              {LINK_TYPE_LABELS[link.link_type]}
            </span>
            {direction === 'incoming' && (
              <span className="text-xs text-gray-400 dark:text-gray-500">← 被引用</span>
            )}
          </div>
          {link.note && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {link.note}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
            {webpage.url}
          </p>
        </div>
        {link.is_mine && (
          <button
            onClick={() => handleDeleteLink(link.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  const totalLinks = links.outgoing.length + links.incoming.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-gray-500" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            关联链接
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({totalLinks})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope Toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                scope === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              所有关联
            </button>
            <button
              onClick={() => setScope('mine')}
              disabled={!user}
              className={`px-3 py-1.5 text-sm transition-colors ${
                scope === 'mine'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              我的关联
            </button>
          </div>
          {user && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : totalLinks === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无关联链接</p>
            {user && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                添加第一个关联
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Outgoing Links */}
            {links.outgoing.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  引用的页面 ({links.outgoing.length})
                </h4>
                <div className="space-y-2">
                  {links.outgoing.map(link => renderLinkItem(link, 'outgoing'))}
                </div>
              </div>
            )}

            {/* Incoming Links */}
            {links.incoming.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  被引用 ({links.incoming.length})
                </h4>
                <div className="space-y-2">
                  {links.incoming.map(link => renderLinkItem(link, 'incoming'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                添加关联链接
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="关闭"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLink} className="p-4 space-y-4">
              {/* Input Mode Toggle - only show if user is logged in */}
              {user && (
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('url')
                      setSelectedFolderId('')
                      setSelectedBookmarkId('')
                    }}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      inputMode === 'url'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    手动输入 URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('bookmark')
                      setNewLinkUrl('')
                      fetchBookmarkFolders()
                    }}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      inputMode === 'bookmark'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    从收藏夹选择
                  </button>
                </div>
              )}

              {/* URL Input Mode */}
              {inputMode === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    目标网页 URL
                  </label>
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={inputMode === 'url'}
                  />
                </div>
              )}

              {/* Bookmark Selection Mode */}
              {inputMode === 'bookmark' && (
                <>
                  <div>
                    <label htmlFor="bookmark-folder-select" className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <FolderOpen className="w-4 h-4" />
                      选择文件夹
                    </label>
                    <select
                      id="bookmark-folder-select"
                      value={selectedFolderId}
                      onChange={(e) => {
                        setSelectedFolderId(e.target.value)
                        setSelectedBookmarkId('')
                        setNewLinkUrl('')
                      }}
                      disabled={loadingFolders}
                      title="选择收藏夹文件夹"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- 请选择文件夹 --</option>
                      <option value="__uncategorized__">📁 未分类</option>
                      {renderFolderOptions(bookmarkFolders, 0)}
                    </select>
                  </div>

                  {/* Bookmark Items List */}
                  {selectedFolderId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        选择网页
                      </label>
                      {loadingItems ? (
                        <div className="text-center py-4 text-gray-500">加载中...</div>
                      ) : bookmarkItems.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">此文件夹没有收藏</div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                          {bookmarkItems.map(item => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedBookmarkId(item.id)
                                setNewLinkUrl(item.webpage?.url || '')
                              }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-start gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                selectedBookmarkId === item.id
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                                  : ''
                              }`}
                            >
                              {item.webpage?.favicon_url && (
                                <img 
                                  src={item.webpage.favicon_url} 
                                  alt="" 
                                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-gray-900 dark:text-gray-100 font-medium">
                                  {item.custom_title || item.webpage?.title || '无标题'}
                                </div>
                                {item.webpage?.url && (
                                  <div className="truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {item.webpage.url}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label htmlFor="link-type-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  关联类型
                </label>
                <select
                  id="link-type-select"
                  value={newLinkType}
                  onChange={(e) => setNewLinkType(e.target.value as LinkType)}
                  title="选择关联类型"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  备注（可选）
                </label>
                <textarea
                  value={newLinkNote}
                  onChange={(e) => setNewLinkNote(e.target.value)}
                  placeholder="简要说明关联原因..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={adding || !newLinkUrl.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {adding ? '添加中...' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

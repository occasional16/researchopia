'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Check, Loader2, Plus, ChevronRight, Folder, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import BookmarkFolderSelector from './BookmarkFolderSelector'
import type { BookmarkFolder } from '@/types/bookmarks'

interface ExistingBookmark {
  id: string
  folder_id: string | null
  folder?: {
    id: string
    name: string
  } | null
}

interface BookmarkModalProps {
  url: string
  title?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  /** Pre-fetched bookmark data to avoid duplicate API calls */
  initialBookmarks?: ExistingBookmark[]
}

/**
 * Modal for selecting folder and adding bookmark
 * Uses shared BookmarkFolderSelector component with inline folder creation
 */
export default function BookmarkModal({
  url,
  title,
  isOpen,
  onClose,
  onSuccess,
  initialBookmarks
}: BookmarkModalProps) {
  const { getAccessToken } = useAuth()
  const [existingBookmarks, setExistingBookmarks] = useState<ExistingBookmark[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [folderNames, setFolderNames] = useState<Map<string, string>>(new Map())
  
  // Inline new folder creation states
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [allFolders, setAllFolders] = useState<BookmarkFolder[]>([])
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  
  // Key to force BookmarkFolderSelector refresh
  const [folderSelectorKey, setFolderSelectorKey] = useState(0)

  // Check existing bookmarks
  const checkExistingBookmarks = useCallback(async () => {
    setCheckingStatus(true)
    setError('')
    try {
      const token = await getAccessToken()
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await fetch(`/api/bookmarks/items/check?url=${encodeURIComponent(url)}`, { 
        headers,
        cache: 'no-store' // Prevent browser caching
      })
      if (res.ok) {
        const data = await res.json()
        setExistingBookmarks(data.bookmarks || [])
        
        // Build folder name map
        const nameMap = new Map<string, string>()
        data.bookmarks?.forEach((b: ExistingBookmark) => {
          if (b.folder) {
            nameMap.set(b.folder.id, b.folder.name)
          }
        })
        setFolderNames(nameMap)
      }
    } catch (err) {
      setError('检查收藏状态失败')
    } finally {
      setCheckingStatus(false)
    }
  }, [url, getAccessToken])

  // Fetch folders for parent folder selector
  const loadFolders = useCallback(async () => {
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/bookmarks/folders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setAllFolders(data.folders || [])
      }
    } catch (err) {
      console.error('Failed to load folders for parent selector:', err)
    }
  }, [getAccessToken])

  useEffect(() => {
    if (isOpen) {
      // If initialBookmarks is provided, use it directly to avoid duplicate API calls
      if (initialBookmarks) {
        setExistingBookmarks(initialBookmarks)
        const nameMap = new Map<string, string>()
        initialBookmarks.forEach((b: ExistingBookmark) => {
          if (b.folder) {
            nameMap.set(b.folder.id, b.folder.name)
          }
        })
        setFolderNames(nameMap)
        setCheckingStatus(false)
      } else {
        checkExistingBookmarks()
      }
      loadFolders()
      // Reset new folder form when modal opens
      setShowNewFolderInput(false)
      setNewFolderName('')
      setNewFolderParentId(null)
    }
  }, [isOpen, checkExistingBookmarks, loadFolders, initialBookmarks])

  // Focus input when new folder form is shown
  useEffect(() => {
    if (showNewFolderInput && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
    }
  }, [showNewFolderInput])

  // Build flat folder list for parent selector
  const buildParentOptions = (folders: BookmarkFolder[], level = 0): { id: string; name: string; level: number }[] => {
    const result: { id: string; name: string; level: number }[] = []
    folders.sort((a, b) => a.position - b.position).forEach(folder => {
      result.push({ id: folder.id, name: folder.name, level })
      if (folder.children && folder.children.length > 0) {
        result.push(...buildParentOptions(folder.children, level + 1))
      }
    })
    return result
  }

  const parentFolderOptions = buildParentOptions(allFolders)

  // Handle creating new folder
  const handleCreateFolder = async () => {
    const trimmedName = newFolderName.trim()
    if (!trimmedName) {
      setError('请输入文件夹名称')
      return
    }

    setCreatingFolder(true)
    setError('')

    try {
      const token = await getAccessToken()
      const res = await fetch('/api/bookmarks/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: trimmedName,
          parent_id: newFolderParentId,
          visibility: 'private'
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '创建文件夹失败')
      }

      // Select the newly created folder
      if (data.folder?.id) {
        setSelectedFolderId(data.folder.id)
      }

      // Refresh folder list
      await loadFolders()
      setFolderSelectorKey(prev => prev + 1) // Force BookmarkFolderSelector refresh
      
      // Reset form
      setShowNewFolderInput(false)
      setNewFolderName('')
      setNewFolderParentId(null)
    } catch (err: any) {
      setError(err.message || '创建文件夹失败')
    } finally {
      setCreatingFolder(false)
    }
  }

  // Handle keyboard events in new folder input
  const handleNewFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateFolder()
    } else if (e.key === 'Escape') {
      setShowNewFolderInput(false)
      setNewFolderName('')
      setNewFolderParentId(null)
    }
  }

  // Handle removing bookmark from a folder
  const handleRemoveFromFolder = async (folderId: string | null) => {
    // Find the bookmark for this folder
    const bookmark = existingBookmarks.find(b => b.folder_id === folderId)
    if (!bookmark) {
      setError('未找到收藏记录')
      return
    }

    setSaving(true)
    setError('')

    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/bookmarks/items/${bookmark.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '取消收藏失败')
      }

      // Remove from local state (updates disabledFolderIds)
      setExistingBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
      
      // Force refresh folder selector to remove disabled state
      setFolderSelectorKey(prev => prev + 1)
      
      // Note: Don't call onSuccess() here because it closes the modal.
      // The parent BookmarkButton will refresh when modal closes via onClose.
    } catch (err: any) {
      setError(err.message || '取消收藏失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    // Check if already bookmarked in this folder
    if (isFolderBookmarked(selectedFolderId)) {
      setError('已收藏到该文件夹')
      return
    }

    setSaving(true)
    setError('')

    try {
      const token = await getAccessToken()
      const res = await fetch('/api/bookmarks/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          url,
          title,
          folder_id: selectedFolderId
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '收藏失败')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || '收藏失败')
    } finally {
      setSaving(false)
    }
  }

  // Check if a folder already has this bookmark
  const isFolderBookmarked = (folderId: string | null): boolean => {
    return existingBookmarks.some(b => b.folder_id === folderId)
  }

  // Get folder name by ID
  const getFolderName = (folderId: string | null): string => {
    if (folderId === null) return '未分类'
    return folderNames.get(folderId) || '未知文件夹'
  }

  // Get list of disabled folder IDs (already bookmarked)
  const disabledFolderIds = existingBookmarks.map(b => b.folder_id)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            收藏到文件夹
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="关闭"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* URL Preview */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={url}>
            {title || url}
          </p>
        </div>

        {/* Already bookmarked info */}
        {existingBookmarks.length > 0 && !checkingStatus && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <Check size={16} />
              <span>已收藏到：</span>
              <span className="font-medium">
                {existingBookmarks.map(b => getFolderName(b.folder_id)).join('、')}
              </span>
            </div>
          </div>
        )}

        {/* Content - Folder Selector */}
        <div className="px-4 py-3 max-h-80 overflow-y-auto">
          {checkingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : error && !saving && !creatingFolder ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : (
            <BookmarkFolderSelector
              key={folderSelectorKey}
              selectedFolderId={selectedFolderId}
              onFolderSelect={setSelectedFolderId}
              disabledFolderIds={disabledFolderIds}
              showCheckForDisabled={true}
              onRemoveFromFolder={handleRemoveFromFolder}
            />
          )}
        </div>

        {/* Inline New Folder Form */}
        {showNewFolderInput && (
          <div className="px-4 py-3 border-t dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 space-y-2">
            {/* Parent folder selector */}
            <div className="flex items-center gap-2">
              <Folder size={16} className="text-gray-500 flex-shrink-0" />
              <select
                value={newFolderParentId || ''}
                onChange={(e) => setNewFolderParentId(e.target.value || null)}
                className="flex-1 px-2 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                disabled={creatingFolder}
                title="选择父文件夹"
                aria-label="选择父文件夹"
              >
                <option value="">📁 根目录（顶级）</option>
                {parentFolderOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {'\u2003'.repeat(opt.level)}{opt.level > 0 ? '└ ' : ''}📁 {opt.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Folder name input */}
            <div className="flex items-center gap-2">
              <input
                ref={newFolderInputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleNewFolderKeyDown}
                placeholder="输入文件夹名称"
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creatingFolder}
              />
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="p-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="确认"
              >
                {creatingFolder ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={() => {
                  setShowNewFolderInput(false)
                  setNewFolderName('')
                  setNewFolderParentId(null)
                }}
                disabled={creatingFolder}
                className="p-1.5 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                title="取消"
              >
                <X size={16} />
              </button>
            </div>
            {error && creatingFolder === false && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            {!showNewFolderInput && (
              <>
                <button
                  onClick={() => setShowNewFolderInput(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={14} />
                  新建文件夹
                </button>
                <a
                  href="/bookmarks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  <ExternalLink size={14} />
                  管理收藏
                </a>
              </>
            )}
            {showNewFolderInput && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                按 Enter 确认，Esc 取消
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || isFolderBookmarked(selectedFolderId)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isFolderBookmarked(selectedFolderId) ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

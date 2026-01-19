'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Check, Loader2, Plus, Folder, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { PaperBookmarkFolder } from '@/types/paper-bookmarks'

interface ExistingBookmark {
  id: string
  folder_id: string | null
  folder?: {
    id: string
    name: string
  } | null
}

interface PaperBookmarkModalProps {
  paperId: string
  doi?: string | null
  title?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  /** Pre-fetched bookmark data to avoid duplicate API calls */
  initialBookmarks?: ExistingBookmark[]
}

interface FlatFolder {
  folder: PaperBookmarkFolder
  level: number
}

/**
 * Modal for selecting folder and adding paper bookmark
 * Similar to BookmarkModal but for papers
 */
export default function PaperBookmarkModal({
  paperId,
  doi,
  title,
  isOpen,
  onClose,
  onSuccess,
  initialBookmarks
}: PaperBookmarkModalProps) {
  const { user, getAccessToken } = useAuth()
  const [existingBookmarks, setExistingBookmarks] = useState<ExistingBookmark[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [folderNames, setFolderNames] = useState<Map<string, string>>(new Map())
  
  // Folder list states
  const [folders, setFolders] = useState<PaperBookmarkFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(true)
  
  // Inline new folder creation states
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  // Check existing bookmarks
  const checkExistingBookmarks = useCallback(async () => {
    if (!user) {
      setCheckingStatus(false)
      return
    }

    setCheckingStatus(true)
    setError('')
    try {
      const token = await getAccessToken()
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await fetch(`/api/paper-bookmarks/items/check?paper_id=${encodeURIComponent(paperId)}`, { 
        headers,
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        // API now returns array of bookmarks (supporting multi-folder)
        setExistingBookmarks(data.bookmarks || [])
      }
    } catch (err) {
      setError('检查收藏状态失败')
    } finally {
      setCheckingStatus(false)
    }
  }, [paperId, getAccessToken, user])

  // Load folders
  const loadFolders = useCallback(async () => {
    if (!user) {
      setLoadingFolders(false)
      return
    }

    try {
      setLoadingFolders(true)
      const token = await getAccessToken()
      const res = await fetch('/api/paper-bookmarks/folders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      }
    } catch (err) {
      console.error('Failed to load paper folders:', err)
    } finally {
      setLoadingFolders(false)
    }
  }, [getAccessToken, user])

  useEffect(() => {
    if (isOpen) {
      // If initialBookmarks is provided, use it directly to avoid duplicate API calls
      if (initialBookmarks) {
        setExistingBookmarks(initialBookmarks)
        setCheckingStatus(false)
      } else {
        checkExistingBookmarks()
      }
      loadFolders()
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

  // Build flat folder list with hierarchy indication
  const buildFlatFolderList = (folders: PaperBookmarkFolder[]): FlatFolder[] => {
    const result: FlatFolder[] = []
    
    const addWithChildren = (folder: PaperBookmarkFolder, level: number) => {
      result.push({ folder, level })
      if (folder.children && folder.children.length > 0) {
        folder.children
          .sort((a: PaperBookmarkFolder, b: PaperBookmarkFolder) => a.position - b.position)
          .forEach((child: PaperBookmarkFolder) => addWithChildren(child, level + 1))
      }
    }
    
    folders
      .sort((a, b) => a.position - b.position)
      .forEach(folder => addWithChildren(folder, 0))
    
    return result
  }

  const flatFolders = buildFlatFolderList(folders)

  // Build parent options for folder selector
  const parentFolderOptions = flatFolders.map(({ folder, level }) => ({
    id: folder.id,
    name: folder.name,
    level
  }))

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
      const res = await fetch('/api/paper-bookmarks/folders', {
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
    const bookmark = existingBookmarks.find(b => b.folder_id === folderId)
    if (!bookmark) {
      setError('未找到收藏记录')
      return
    }

    setSaving(true)
    setError('')

    try {
      const token = await getAccessToken()
      const res = await fetch(`/api/paper-bookmarks/items/${bookmark.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '取消收藏失败')
      }

      setExistingBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
    } catch (err: any) {
      setError(err.message || '取消收藏失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (isFolderBookmarked(selectedFolderId)) {
      setError('已收藏到该文件夹')
      return
    }

    setSaving(true)
    setError('')

    try {
      const token = await getAccessToken()
      const res = await fetch('/api/paper-bookmarks/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          paper_id: paperId,
          doi,
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
    const flat = flatFolders.find(f => f.folder.id === folderId)
    return flat?.folder.name || folderNames.get(folderId) || '未知文件夹'
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
            收藏论文到文件夹
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="关闭"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Paper Preview */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={title || paperId}>
            {title || doi || paperId}
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
          {checkingStatus || loadingFolders ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : error && !saving && !creatingFolder ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : (
            <div className="space-y-1">
              {/* Uncategorized option */}
              <FolderOption
                name="未分类"
                level={0}
                isSelected={selectedFolderId === null}
                isDisabled={disabledFolderIds.includes(null)}
                onClick={() => setSelectedFolderId(null)}
                onRemove={() => handleRemoveFromFolder(null)}
              />
              
              {/* Folder list */}
              {flatFolders.map(({ folder, level }) => (
                <FolderOption
                  key={folder.id}
                  name={folder.name}
                  level={level}
                  isSelected={selectedFolderId === folder.id}
                  isDisabled={disabledFolderIds.includes(folder.id)}
                  onClick={() => setSelectedFolderId(folder.id)}
                  onRemove={() => handleRemoveFromFolder(folder.id)}
                />
              ))}
              
              {flatFolders.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  暂无文件夹，点击下方"新建文件夹"创建
                </p>
              )}
            </div>
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

// Internal folder option component
interface FolderOptionProps {
  name: string
  level: number
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
  onRemove: () => void
}

function FolderOption({ name, level, isSelected, isDisabled, onClick, onRemove }: FolderOptionProps) {
  // Tailwind padding classes for nesting levels (max 6 levels deep)
  const paddingClass = ['pl-2', 'pl-6', 'pl-10', 'pl-14', 'pl-18', 'pl-22', 'pl-26'][level] || 'pl-26'
  
  return (
    <div
      className={`
        flex items-center gap-2 pr-2 py-1.5 rounded-lg cursor-pointer transition-colors group
        ${paddingClass}
        ${isSelected && !isDisabled 
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' 
          : isDisabled 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }
      `}
      onClick={() => !isDisabled && onClick()}
    >
      <Folder size={16} className={isDisabled ? 'text-green-500' : ''} />
      <span className="flex-1 text-sm truncate">{name}</span>
      {isDisabled && (
        <>
          <Check size={14} className="text-green-500 flex-shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-opacity"
            title="取消收藏"
          >
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, Check, Loader2, ChevronRight, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { BookmarkFolder } from '@/types/bookmarks'

interface BookmarkFolderSelectorProps {
  /** ID of the currently selected folder (null = uncategorized) */
  selectedFolderId: string | null
  /** Callback when folder selection changes */
  onFolderSelect: (folderId: string | null) => void
  /** Folder IDs that should be disabled (e.g., already bookmarked) */
  disabledFolderIds?: (string | null)[]
  /** Show a checkmark for disabled folders */
  showCheckForDisabled?: boolean
  /** Callback when removing bookmark from a disabled folder (optional) */
  onRemoveFromFolder?: (folderId: string | null) => void
  /** Optional class name for the container */
  className?: string
}

interface FlatFolder {
  folder: BookmarkFolder
  level: number
}

/**
 * Shared bookmark folder selector component
 * Used by:
 * - BookmarkModal (for selecting destination folder when bookmarking)
 * - RelatedLinksSection (for selecting from bookmarks)
 */
export default function BookmarkFolderSelector({
  selectedFolderId,
  onFolderSelect,
  disabledFolderIds = [],
  showCheckForDisabled = false,
  onRemoveFromFolder,
  className = ''
}: BookmarkFolderSelectorProps) {
  const { user, loading: authLoading, getAccessToken } = useAuth()
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch folders on mount
  const loadFolders = useCallback(async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      return
    }
    
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      const token = await getAccessToken()
      const res = await fetch('/api/bookmarks/folders', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      } else {
        throw new Error('Failed to fetch folders')
      }
    } catch (err) {
      setError('加载文件夹失败')
      console.error('Failed to load folders:', err)
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken, authLoading])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // Build flat folder list with hierarchy indication
  // API returns tree structure (children nested), convert to flat list with levels
  const buildFlatFolderList = (folders: BookmarkFolder[]): FlatFolder[] => {
    const result: FlatFolder[] = []
    
    const addWithChildren = (folder: BookmarkFolder, level: number) => {
      result.push({ folder, level })
      // Children are nested in the folder object, not as separate items
      if (folder.children && folder.children.length > 0) {
        folder.children
          .sort((a, b) => a.position - b.position)
          .forEach(child => addWithChildren(child, level + 1))
      }
    }
    
    // Input folders are root-level folders (parent_id === null)
    folders
      .sort((a, b) => a.position - b.position)
      .forEach(folder => addWithChildren(folder, 0))
    
    return result
  }

  const flatFolders = buildFlatFolderList(folders)
  
  // Check if a folder is disabled
  const isFolderDisabled = (folderId: string | null): boolean => {
    return disabledFolderIds.includes(folderId)
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-center py-6 text-red-500 ${className}`}>
        {error}
        <button
          onClick={loadFolders}
          className="block mx-auto mt-2 text-sm text-blue-600 hover:underline"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Uncategorized option */}
      <FolderOption
        name="未分类"
        level={0}
        isDisabled={isFolderDisabled(null)}
        isSelected={selectedFolderId === null}
        showCheckWhenDisabled={showCheckForDisabled}
        onRemove={onRemoveFromFolder && isFolderDisabled(null) ? () => onRemoveFromFolder(null) : undefined}
        onClick={() => !isFolderDisabled(null) && onFolderSelect(null)}
      />
      
      {/* User folders */}
      {flatFolders.map(({ folder, level }) => (
        <FolderOption
          key={folder.id}
          name={folder.name}
          level={level}
          isDisabled={isFolderDisabled(folder.id)}
          isSelected={selectedFolderId === folder.id}
          showCheckWhenDisabled={showCheckForDisabled}
          onRemove={onRemoveFromFolder && isFolderDisabled(folder.id) ? () => onRemoveFromFolder(folder.id) : undefined}
          onClick={() => !isFolderDisabled(folder.id) && onFolderSelect(folder.id)}
        />
      ))}
      
      {flatFolders.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
          暂无文件夹
        </p>
      )}
    </div>
  )
}

// Folder option component
function FolderOption({
  name,
  level,
  isDisabled,
  isSelected,
  showCheckWhenDisabled,
  onRemove,
  onClick
}: {
  name: string
  level: number
  isDisabled: boolean
  isSelected: boolean
  showCheckWhenDisabled: boolean
  onRemove?: () => void
  onClick: () => void
}) {
  // Level-based padding classes (supports up to 4 levels)
  const paddingClasses = ['pl-3', 'pl-8', 'pl-12', 'pl-16', 'pl-20']
  const paddingClass = paddingClasses[Math.min(level, paddingClasses.length - 1)]
  
  return (
    <div
      className={`group w-full flex items-center gap-2 ${paddingClass} pr-3 py-2 rounded-lg transition-colors ${
        isDisabled
          ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
          : isSelected
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
      }`}
    >
      <button
        onClick={onClick}
        disabled={isDisabled && !onRemove}
        title={isDisabled ? `已收藏到 ${name}` : name}
        className="flex-1 flex items-center gap-2 text-left cursor-pointer disabled:cursor-default"
      >
        {level > 0 && (
          <ChevronRight size={14} className="text-gray-400 -ml-3" />
        )}
        {isSelected ? <FolderOpen size={18} /> : <Folder size={18} />}
        <span className="flex-1 truncate">{name}</span>
        {isDisabled && showCheckWhenDisabled && !onRemove && (
          <Check size={16} className="text-green-500 flex-shrink-0" />
        )}
      </button>
      {isDisabled && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title={`取消收藏 (从 ${name})`}
          className="p-1 rounded-md text-green-600 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

// Export the folder list type for external use
export type { FlatFolder }

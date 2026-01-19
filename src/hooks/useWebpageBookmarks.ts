'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { BookmarkFolder, BookmarkItem, FolderVisibility } from '@/types/bookmarks'

interface UseWebpageBookmarksOptions {
  searchQuery: string
  activeCollectionType: 'paper' | 'webpage'
  selectedFolderId: string | null
}

interface UseWebpageBookmarksReturn {
  // State
  folders: BookmarkFolder[]
  items: BookmarkItem[]
  uncategorizedCount: number
  loading: boolean
  error: string | null
  
  // Folder expansion state
  expandedFolders: Set<string>
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>
  
  // Setters for items (needed for drag-and-drop)
  setFolders: React.Dispatch<React.SetStateAction<BookmarkFolder[]>>
  setItems: React.Dispatch<React.SetStateAction<BookmarkItem[]>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  
  // Actions
  loadFolders: () => Promise<void>
  loadItems: (folderId: string | null) => Promise<void>
  createFolder: (name: string, parentId: string | null) => Promise<boolean>
  deleteFolder: (folderId: string, selectedFolderId: string | null, setSelectedFolderId: (id: string | null) => void) => Promise<boolean>
  renameFolder: (folderId: string, newName: string) => Promise<boolean>
  updateFolderVisibility: (folderId: string, visibility: FolderVisibility) => Promise<boolean>
  createBookmark: (url: string, title: string, folderId: string | null) => Promise<boolean>
  deleteBookmark: (itemId: string) => Promise<boolean>
  moveBookmark: (itemId: string, targetFolderId: string | null) => Promise<boolean>
  reorderItems: (newItems: BookmarkItem[], folderId: string | null) => Promise<void>
}

/**
 * Hook for managing webpage bookmarks state and operations
 */
export function useWebpageBookmarks({
  searchQuery,
  activeCollectionType,
  selectedFolderId
}: UseWebpageBookmarksOptions): UseWebpageBookmarksReturn {
  const { user, getAccessToken } = useAuth()
  
  // State
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [items, setItems] = useState<BookmarkItem[]>([])
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Load folders
  const loadFolders = useCallback(async () => {
    if (!user) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch('/api/bookmarks/folders', {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to load folders')

      const data = await response.json()
      if (data.success) {
        setFolders(data.folders || [])
        setUncategorizedCount(data.uncategorized_count || 0)
      }
    } catch (err) {
      console.error('Load folders error:', err)
      setError('加载文件夹失败')
    }
  }, [user, getAccessToken])

  // Load items
  const loadItems = useCallback(async (folderId: string | null) => {
    if (!user) return

    setLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const params = new URLSearchParams()
      if (folderId === null) {
        params.set('folder_id', 'uncategorized')
      } else {
        params.set('folder_id', folderId)
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const response = await fetch(`/api/bookmarks/items?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to load items')

      const data = await response.json()
      if (data.success) {
        setItems(data.items || [])
      }
    } catch (err) {
      console.error('Load items error:', err)
      setError('加载收藏失败')
    } finally {
      setLoading(false)
    }
  }, [user, getAccessToken, searchQuery])

  // Create folder
  const createFolder = useCallback(async (name: string, parentId: string | null): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch('/api/bookmarks/folders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, parent_id: parentId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create folder')
      }

      loadFolders()
      return true
    } catch (err) {
      console.error('Create folder error:', err)
      setError('创建文件夹失败')
      return false
    }
  }, [getAccessToken, loadFolders])

  // Delete folder
  const deleteFolder = useCallback(async (
    folderId: string, 
    currentSelectedFolderId: string | null,
    setSelectedFolderId: (id: string | null) => void
  ): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete folder')

      if (currentSelectedFolderId === folderId) {
        setSelectedFolderId(null)
      }
      loadFolders()
      return true
    } catch (err) {
      console.error('Delete folder error:', err)
      setError('删除文件夹失败')
      return false
    }
  }, [getAccessToken, loadFolders])

  // Rename folder
  const renameFolder = useCallback(async (folderId: string, newName: string): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newName })
      })

      if (!response.ok) throw new Error('Failed to rename folder')

      loadFolders()
      return true
    } catch (err) {
      console.error('Rename folder error:', err)
      return false
    }
  }, [getAccessToken, loadFolders])

  // Update folder visibility
  const updateFolderVisibility = useCallback(async (folderId: string, visibility: FolderVisibility): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ visibility })
      })

      if (!response.ok) throw new Error('Failed to update visibility')

      loadFolders()
      return true
    } catch (err) {
      console.error('Update visibility error:', err)
      return false
    }
  }, [getAccessToken, loadFolders])

  // Create bookmark
  const createBookmark = useCallback(async (url: string, title: string, folderId: string | null): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch('/api/bookmarks/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          custom_title: title || undefined,
          folder_id: folderId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create bookmark')
      }

      loadItems(selectedFolderId)
      loadFolders()
      return true
    } catch (err) {
      console.error('Create bookmark error:', err)
      setError('添加收藏失败')
      return false
    }
  }, [getAccessToken, loadItems, loadFolders, selectedFolderId])

  // Delete bookmark
  const deleteBookmark = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/bookmarks/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete bookmark')

      loadItems(selectedFolderId)
      loadFolders()
      return true
    } catch (err) {
      console.error('Delete bookmark error:', err)
      setError('删除收藏失败')
      return false
    }
  }, [getAccessToken, loadItems, loadFolders, selectedFolderId])

  // Move bookmark
  const moveBookmark = useCallback(async (itemId: string, targetFolderId: string | null): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/bookmarks/items/${itemId}/move`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folder_id: targetFolderId })
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          alert(data.error || '目标文件夹已存在此收藏')
        }
        return false
      }

      loadItems(selectedFolderId)
      loadFolders()
      return true
    } catch (err) {
      console.error('Move bookmark error:', err)
      setError('移动收藏失败')
      return false
    }
  }, [getAccessToken, loadItems, loadFolders, selectedFolderId])

  // Reorder items
  const reorderItems = useCallback(async (newItems: BookmarkItem[], folderId: string | null): Promise<void> => {
    // Optimistic update
    setItems(newItems)

    try {
      const token = await getAccessToken()
      if (!token) return

      const reorderData = newItems.map((item, index) => ({
        id: item.id,
        position: index
      }))

      const response = await fetch('/api/bookmarks/items/reorder', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folder_id: folderId, items: reorderData })
      })

      if (!response.ok) {
        // Revert on error
        loadItems(selectedFolderId)
      }
    } catch (err) {
      console.error('Reorder error:', err)
      loadItems(selectedFolderId)
    }
  }, [getAccessToken, loadItems, selectedFolderId])

  // Auto-load when folder changes
  useEffect(() => {
    if (user && activeCollectionType === 'webpage') {
      loadItems(selectedFolderId)
    }
  }, [selectedFolderId, user, loadItems, activeCollectionType])

  return {
    folders,
    items,
    uncategorizedCount,
    loading,
    error,
    expandedFolders,
    setExpandedFolders,
    setFolders,
    setItems,
    setError,
    loadFolders,
    loadItems,
    createFolder,
    deleteFolder,
    renameFolder,
    updateFolderVisibility,
    createBookmark,
    deleteBookmark,
    moveBookmark,
    reorderItems
  }
}

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PaperBookmarkFolder, PaperBookmarkItem } from '@/types/paper-bookmarks'

interface UsePaperBookmarksOptions {
  searchQuery: string
  activeCollectionType: 'paper' | 'webpage'
  selectedPaperFolderId: string | null
}

interface UsePaperBookmarksReturn {
  // State
  paperFolders: PaperBookmarkFolder[]
  paperItems: PaperBookmarkItem[]
  paperUncategorizedCount: number
  paperLoading: boolean
  
  // Folder expansion state
  expandedPaperFolders: Set<string>
  setExpandedPaperFolders: React.Dispatch<React.SetStateAction<Set<string>>>
  
  // Actions
  loadPaperFolders: () => Promise<void>
  loadPaperItems: (folderId: string | null) => Promise<void>
  deletePaperItem: (itemId: string) => Promise<boolean>
}

/**
 * Hook for managing paper bookmarks state and operations
 */
export function usePaperBookmarks({
  searchQuery,
  activeCollectionType,
  selectedPaperFolderId
}: UsePaperBookmarksOptions): UsePaperBookmarksReturn {
  const { user, getAccessToken } = useAuth()
  
  // State
  const [paperFolders, setPaperFolders] = useState<PaperBookmarkFolder[]>([])
  const [paperItems, setPaperItems] = useState<PaperBookmarkItem[]>([])
  const [paperUncategorizedCount, setPaperUncategorizedCount] = useState(0)
  const [paperLoading, setPaperLoading] = useState(true)
  const [expandedPaperFolders, setExpandedPaperFolders] = useState<Set<string>>(new Set())

  // Load paper folders
  const loadPaperFolders = useCallback(async () => {
    if (!user) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch('/api/paper-bookmarks/folders', {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to load paper folders')

      const data = await response.json()
      if (data.success) {
        setPaperFolders(data.folders || [])
        setPaperUncategorizedCount(data.uncategorized_count || 0)
      }
    } catch (err) {
      console.error('Load paper folders error:', err)
    } finally {
      setPaperLoading(false)
    }
  }, [user, getAccessToken])

  // Load paper items
  const loadPaperItems = useCallback(async (folderId: string | null) => {
    if (!user) return

    setPaperLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const params = new URLSearchParams()
      if (folderId === null) {
        params.set('folder_id', 'null')
      } else {
        params.set('folder_id', folderId)
      }
      if (searchQuery) {
        params.set('search', searchQuery)
      }

      const response = await fetch(`/api/paper-bookmarks/items?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })

      if (!response.ok) throw new Error('Failed to load paper items')

      const data = await response.json()
      if (data.success) {
        setPaperItems(data.items || [])
      }
    } catch (err) {
      console.error('Load paper items error:', err)
    } finally {
      setPaperLoading(false)
    }
  }, [user, getAccessToken, searchQuery])

  // Delete paper item
  const deletePaperItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const token = await getAccessToken()
      if (!token) return false

      const response = await fetch(`/api/paper-bookmarks/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete paper item')

      // Refresh data
      loadPaperItems(selectedPaperFolderId)
      loadPaperFolders()
      return true
    } catch (err) {
      console.error('Delete paper item error:', err)
      return false
    }
  }, [getAccessToken, loadPaperItems, loadPaperFolders, selectedPaperFolderId])

  // Auto-load when folder changes
  useEffect(() => {
    if (user && activeCollectionType === 'paper') {
      loadPaperItems(selectedPaperFolderId)
    }
  }, [selectedPaperFolderId, user, loadPaperItems, activeCollectionType])

  return {
    paperFolders,
    paperItems,
    paperUncategorizedCount,
    paperLoading,
    expandedPaperFolders,
    setExpandedPaperFolders,
    loadPaperFolders,
    loadPaperItems,
    deletePaperItem
  }
}

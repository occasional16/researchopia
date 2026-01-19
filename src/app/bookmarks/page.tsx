'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
  DragOverEvent,
  CollisionDetection
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Home, ChevronRight, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import ImportExportModal from '@/components/bookmarks/ImportExportModal'
import { DragOverlayItem } from '@/components/bookmarks/SortableBookmarkList'
import BookmarksSidebar from '@/components/bookmarks/BookmarksSidebar'
import BookmarksMainContent from '@/components/bookmarks/BookmarksMainContent'
import { BatchActionBar, BatchMoveModal } from '@/components/bookmarks/BatchOperations'
import { NewFolderModal, AddBookmarkModal } from '@/components/bookmarks/BookmarkModals'
import { FolderContextMenu } from '@/components/bookmarks/FolderContextMenu'
import type { BookmarkFolder, BookmarkItem } from '@/types/bookmarks'
import type { PaperBookmarkFolder, PaperBookmarkItem } from '@/types/paper-bookmarks'

// Collection type: 'paper' or 'webpage'
type CollectionType = 'paper' | 'webpage'

// Helper function to recursively find a folder by ID
function findFolderById<T extends { id: string; children?: T[] }>(
  folders: T[],
  id: string
): T | undefined {
  for (const folder of folders) {
    if (folder.id === id) return folder
    if (folder.children) {
      const found = findFolderById(folder.children, id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * /bookmarks - Bookmarks Page
 * Edge-style bookmark management with nested folders
 */
export default function BookmarksPage() {
  const router = useRouter()
  const { user, loading: authLoading, getAccessToken } = useAuth()

  // State - Webpage bookmarks
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [items, setItems] = useState<BookmarkItem[]>([])
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State - Paper bookmarks
  const [paperFolders, setPaperFolders] = useState<PaperBookmarkFolder[]>([])
  const [paperItems, setPaperItems] = useState<PaperBookmarkItem[]>([])
  const [paperUncategorizedCount, setPaperUncategorizedCount] = useState(0)
  const [paperLoading, setPaperLoading] = useState(true)

  // UI State - Active collection type (default to 'paper', restored from localStorage)
  const [activeCollectionType, setActiveCollectionType] = useState<CollectionType>('paper')

  // UI State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedPaperFolders, setExpandedPaperFolders] = useState<Set<string>>(new Set())
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null) // null = uncategorized
  const [selectedPaperFolderId, setSelectedPaperFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stateRestored, setStateRestored] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [showAddBookmarkModal, setShowAddBookmarkModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

  // New folder form
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)

  // New bookmark form
  const [newBookmarkUrl, setNewBookmarkUrl] = useState('')
  const [newBookmarkTitle, setNewBookmarkTitle] = useState('')
  const [creatingBookmark, setCreatingBookmark] = useState(false)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'folder' | 'paper-folder' | 'item'
    id: string
  } | null>(null)

  // Editing state
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editFolderName, setEditFolderName] = useState('')

  // Drag-and-drop state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  // Batch selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [batchOperating, setBatchOperating] = useState(false)

  // Calculate total bookmark counts
  const calculateFolderTotal = useCallback((folders: BookmarkFolder[]): number => {
    return folders.reduce((sum, f) => {
      const childrenCount = f.children ? calculateFolderTotal(f.children) : 0
      return sum + (f.item_count || 0) + childrenCount
    }, 0)
  }, [])

  const calculatePaperFolderTotal = useCallback((folders: PaperBookmarkFolder[]): number => {
    return folders.reduce((sum, f) => {
      const childrenCount = f.children ? calculatePaperFolderTotal(f.children) : 0
      return sum + (f.item_count || 0) + childrenCount
    }, 0)
  }, [])

  const webpageTotalCount = useMemo(() => {
    return uncategorizedCount + calculateFolderTotal(folders)
  }, [uncategorizedCount, folders, calculateFolderTotal])

  const paperTotalCount = useMemo(() => {
    return paperUncategorizedCount + calculatePaperFolderTotal(paperFolders)
  }, [paperUncategorizedCount, paperFolders, calculatePaperFolderTotal])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  /**
   * Custom collision detection:
   * Strictly based on mouse pointer position (not dragged item bounds)
   * 1. First check if pointer is over a folder (prioritize folder drops)
   * 2. If not over folder, check if pointer is within sortable items
   * 3. If pointer is outside all areas, return empty (no collision)
   */
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    // First, check for folder collisions using pointerWithin (strict pointer position)
    const folderCollisions = pointerWithin({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        container => String(container.id).startsWith('folder-')
      )
    })
    
    // If pointer is over a folder, return that collision only
    if (folderCollisions.length > 0) {
      return folderCollisions
    }
    
    // Check if pointer is within any sortable item using pointerWithin (strict pointer position)
    const sortableContainers = args.droppableContainers.filter(
      container => !String(container.id).startsWith('folder-')
    )
    
    const sortableCollisions = pointerWithin({
      ...args,
      droppableContainers: sortableContainers
    })
    
    // Only return sortable collision if pointer is actually within an item
    if (sortableCollisions.length > 0) {
      // Return the first collision (the one pointer is directly over)
      return [sortableCollisions[0]]
    }
    
    // Pointer is outside all valid drop areas - no collision
    return []
  }, [])

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

  // Load items for selected folder
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

  // Load paper items for selected folder
  const loadPaperItems = useCallback(async (folderId: string | null) => {
    if (!user) return

    setLoading(true)
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
      setLoading(false)
    }
  }, [user, getAccessToken, searchQuery])

  // Restore state from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('bookmarks_state')
        if (saved) {
          const state = JSON.parse(saved)
          if (state.activeCollectionType) setActiveCollectionType(state.activeCollectionType)
          if (state.selectedFolderId !== undefined) setSelectedFolderId(state.selectedFolderId)
          if (state.selectedPaperFolderId !== undefined) setSelectedPaperFolderId(state.selectedPaperFolderId)
        }
      } catch (err) {
        console.error('Failed to restore bookmarks state:', err)
      }
      setStateRestored(true)
    }
  }, [])

  // Save state to localStorage when it changes
  useEffect(() => {
    if (stateRestored && typeof window !== 'undefined') {
      try {
        localStorage.setItem('bookmarks_state', JSON.stringify({
          activeCollectionType,
          selectedFolderId,
          selectedPaperFolderId
        }))
      } catch (err) {
        console.error('Failed to save bookmarks state:', err)
      }
    }
  }, [activeCollectionType, selectedFolderId, selectedPaperFolderId, stateRestored])

  // Initial load
  useEffect(() => {
    if (!authLoading && user) {
      loadFolders()
      loadPaperFolders()
      loadItems(selectedFolderId)
    }
  }, [authLoading, user, loadFolders, loadPaperFolders])

  // Reload items when folder changes (webpage)
  useEffect(() => {
    if (user && activeCollectionType === 'webpage') {
      loadItems(selectedFolderId)
    }
  }, [selectedFolderId, user, loadItems, activeCollectionType])

  // Reload items when folder changes (paper)
  useEffect(() => {
    if (user && activeCollectionType === 'paper') {
      loadPaperItems(selectedPaperFolderId)
    }
  }, [selectedPaperFolderId, user, loadPaperItems, activeCollectionType])

  // Handle search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user) {
        loadItems(selectedFolderId)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Create folder (supports both paper and webpage folders)
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      // Determine API endpoint based on active collection type
      const apiEndpoint = activeCollectionType === 'paper' 
        ? '/api/paper-bookmarks/folders'
        : '/api/bookmarks/folders'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: newFolderParent
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create folder')
      }

      setShowNewFolderModal(false)
      setNewFolderName('')
      setNewFolderParent(null)
      
      // Reload appropriate folder list
      if (activeCollectionType === 'paper') {
        loadPaperFolders()
      } else {
        loadFolders()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingFolder(false)
    }
  }

  // Create bookmark
  const handleCreateBookmark = async () => {
    if (!newBookmarkUrl.trim()) return

    setCreatingBookmark(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch('/api/bookmarks/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: newBookmarkUrl.trim(),
          title: newBookmarkTitle.trim() || undefined,
          folder_id: selectedFolderId
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add bookmark')
      }

      setShowAddBookmarkModal(false)
      setNewBookmarkUrl('')
      setNewBookmarkTitle('')
      loadItems(selectedFolderId)
      loadFolders() // Update counts
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingBookmark(false)
    }
  }

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('确定删除此文件夹？包含的收藏也会被删除。')) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete folder')

      if (selectedFolderId === folderId) {
        setSelectedFolderId(null)
      }
      loadFolders()
    } catch (err) {
      setError('删除文件夹失败')
    }
  }

  // Delete paper folder
  const handleDeletePaperFolder = async (folderId: string) => {
    if (!confirm('确定删除此文件夹？包含的收藏也会被删除。')) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch(`/api/paper-bookmarks/folders/${folderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete paper folder')

      if (selectedPaperFolderId === folderId) {
        setSelectedPaperFolderId(null)
      }
      loadPaperFolders()
    } catch (err) {
      setError('删除论文文件夹失败')
    }
  }

  // Rename paper folder
  const handleRenamePaperFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch(`/api/paper-bookmarks/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editFolderName.trim() })
      })

      if (!response.ok) throw new Error('Failed to rename paper folder')

      setEditingFolderId(null)
      setEditFolderName('')
      loadPaperFolders()
    } catch (err) {
      setError('重命名论文文件夹失败')
    }
  }

  // Delete bookmark
  const handleDeleteBookmark = async (itemId: string) => {
    if (!confirm('确定删除此收藏？')) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch(`/api/bookmarks/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Failed to delete bookmark')

      loadItems(selectedFolderId)
      loadFolders()
    } catch (err) {
      setError('删除收藏失败')
    }
  }

  // Delete paper bookmark
  const handleDeletePaperItem = async (itemId: string) => {
    const token = await getAccessToken()
    if (!token) return
    try {
      const res = await fetch(`/api/paper-bookmarks/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setPaperItems(prev => prev.filter(i => i.id !== itemId))
      }
    } catch (err) {
      console.error('Delete paper bookmark error:', err)
    }
  }

  // Reorder bookmarks within folder
  const handleItemsReorder = async (newItems: BookmarkItem[], folderId: string | null) => {
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
  }

  // Move bookmark to different folder
  const handleItemMove = async (itemId: string, targetFolderId: string | null) => {
    try {
      const token = await getAccessToken()
      if (!token) return

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
        return
      }

      // Refresh data
      loadItems(selectedFolderId)
      loadFolders()
    } catch (err) {
      console.error('Move error:', err)
      setError('移动收藏失败')
    }
  }

  // Batch selection handlers
  const handleSelectItem = (itemId: string, selected: boolean) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(itemId)
      } else {
        newSet.delete(itemId)
      }
      return newSet
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedItems(new Set(items.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedItems.size} 项收藏？`)) return

    setBatchOperating(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch('/api/bookmarks/items/batch/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ item_ids: Array.from(selectedItems) })
      })

      if (!response.ok) throw new Error('Failed to batch delete')

      setSelectedItems(new Set())
      loadItems(selectedFolderId)
      loadFolders()
    } catch (err) {
      setError('批量删除失败')
    } finally {
      setBatchOperating(false)
    }
  }

  // Batch move
  const handleBatchMove = async (targetFolderId: string | null) => {
    if (selectedItems.size === 0) return

    setBatchOperating(true)
    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch('/api/bookmarks/items/batch/move', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          item_ids: Array.from(selectedItems),
          folder_id: targetFolderId
        })
      })

      if (!response.ok) throw new Error('Failed to batch move')

      setSelectedItems(new Set())
      setShowMoveModal(false)
      loadItems(selectedFolderId)
      loadFolders()
    } catch (err) {
      setError('批量移动失败')
    } finally {
      setBatchOperating(false)
    }
  }

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (over && String(over.id).startsWith('folder-')) {
      setDragOverFolderId(String(over.id))
    } else {
      setDragOverFolderId(null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveId(null)
    setDragOverFolderId(null)

    if (!over) return

    const overId = String(over.id)
    
    // Dropped on folder
    if (overId.startsWith('folder-')) {
      const targetFolderId = overId.replace('folder-', '')
      const actualFolderId = targetFolderId === 'uncategorized' ? null : targetFolderId
      
      // Don't move if same folder
      if (actualFolderId !== selectedFolderId) {
        await handleItemMove(String(active.id), actualFolderId)
      }
      return
    }

    // Reorder within same list
    if (active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        setReordering(true)
        const newItems = arrayMove(items, oldIndex, newIndex)
        await handleItemsReorder(newItems, selectedFolderId)
        setReordering(false)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDragOverFolderId(null)
  }

  const activeItem = activeId ? items.find(i => i.id === activeId) : null

  // Rename folder
  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) return

    try {
      const token = await getAccessToken()
      if (!token) return

      const response = await fetch(`/api/bookmarks/folders/${folderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editFolderName.trim() })
      })

      if (!response.ok) throw new Error('Failed to rename folder')

      setEditingFolderId(null)
      setEditFolderName('')
      loadFolders()
    } catch (err) {
      setError('重命名失败')
    }
  }

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            请先登录
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            登录后即可使用收藏夹功能
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('showAuthModal', { detail: { mode: 'login' } }))}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden ${activeId ? 'dragging-active' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-6 overflow-x-hidden">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 flex items-center">
            <Home size={16} className="mr-1" />
            首页
          </Link>
          <ChevronRight size={16} />
          <span className="text-gray-700 dark:text-gray-200">收藏夹</span>
        </nav>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-sm underline mt-2">
              关闭
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
        <div className="flex gap-6 min-w-0">
          {/* Sidebar - Folder Tree (hidden on small screens) */}
          <BookmarksSidebar
            activeCollectionType={activeCollectionType}
            setActiveCollectionType={setActiveCollectionType}
            paperFolders={paperFolders}
            paperUncategorizedCount={paperUncategorizedCount}
            paperTotalCount={paperTotalCount}
            selectedPaperFolderId={selectedPaperFolderId}
            setSelectedPaperFolderId={setSelectedPaperFolderId}
            expandedPaperFolders={expandedPaperFolders}
            setExpandedPaperFolders={setExpandedPaperFolders}
            folders={folders}
            uncategorizedCount={uncategorizedCount}
            webpageTotalCount={webpageTotalCount}
            selectedFolderId={selectedFolderId}
            setSelectedFolderId={setSelectedFolderId}
            expandedFolders={expandedFolders}
            editingFolderId={editingFolderId}
            editFolderName={editFolderName}
            setEditingFolderId={setEditingFolderId}
            setEditFolderName={setEditFolderName}
            handleRenameFolder={handleRenameFolder}
            handleRenamePaperFolder={handleRenamePaperFolder}
            activeId={activeId}
            dragOverFolderId={dragOverFolderId}
            toggleFolder={toggleFolder}
            onFolderContextMenu={(e, id) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'folder', id })
            }}
            onPaperFolderContextMenu={(e, id) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, type: 'paper-folder', id })
            }}
            setShowNewFolderModal={setShowNewFolderModal}
            setShowImportModal={setShowImportModal}
            setShowExportModal={setShowExportModal}
          />

          {/* Main content - Items */}
          <BookmarksMainContent
            activeCollectionType={activeCollectionType}
            paperFolders={paperFolders}
            folders={folders}
            selectedPaperFolderId={selectedPaperFolderId}
            selectedFolderId={selectedFolderId}
            paperItems={paperItems}
            items={items}
            loading={loading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onDeletePaperItem={handleDeletePaperItem}
            onDeleteBookmark={handleDeleteBookmark}
            reordering={reordering}
            selectedItems={selectedItems}
            onSelectItem={handleSelectItem}
            onSelectAll={handleSelectAll}
            setShowAddBookmarkModal={setShowAddBookmarkModal}
          />
        </div>

        {/* Drag overlay - pointer-events: none allows cursor to reach elements below */}
        <DragOverlay style={{ pointerEvents: 'none' }}>
          {activeItem ? <DragOverlayItem item={activeItem} /> : null}
        </DragOverlay>
        </DndContext>
      </div>

      {/* Context Menu - Webpage Folder */}
      {contextMenu && contextMenu.type === 'folder' && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          folderId={contextMenu.id}
          onRename={(id) => {
            const folder = findFolderById(folders, id)
            if (folder) {
              setEditingFolderId(folder.id)
              setEditFolderName(folder.name)
            }
          }}
          onCreateSubfolder={(id) => {
            setNewFolderParent(id)
            setShowNewFolderModal(true)
          }}
          onDelete={handleDeleteFolder}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Context Menu - Paper Folder */}
      {contextMenu && contextMenu.type === 'paper-folder' && (
        <FolderContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          folderId={contextMenu.id}
          onRename={(id) => {
            const folder = findFolderById(paperFolders, id)
            if (folder) {
              setEditingFolderId(folder.id)
              setEditFolderName(folder.name)
            }
          }}
          onCreateSubfolder={(id) => {
            setActiveCollectionType('paper')
            setNewFolderParent(id)
            setShowNewFolderModal(true)
          }}
          onDelete={handleDeletePaperFolder}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={showNewFolderModal}
        folderName={newFolderName}
        parentId={newFolderParent}
        folders={folders}
        creating={creatingFolder}
        onClose={() => {
          setShowNewFolderModal(false)
          setNewFolderName('')
          setNewFolderParent(null)
        }}
        onNameChange={setNewFolderName}
        onCreate={handleCreateFolder}
      />

      {/* Add Bookmark Modal */}
      <AddBookmarkModal
        isOpen={showAddBookmarkModal}
        url={newBookmarkUrl}
        title={newBookmarkTitle}
        creating={creatingBookmark}
        onClose={() => {
          setShowAddBookmarkModal(false)
          setNewBookmarkUrl('')
          setNewBookmarkTitle('')
        }}
        onUrlChange={setNewBookmarkUrl}
        onTitleChange={setNewBookmarkTitle}
        onCreate={handleCreateBookmark}
      />

      {/* Import Modal */}
      <ImportExportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        mode="import"
        getAccessToken={getAccessToken}
        onImportSuccess={() => {
          loadFolders()
          loadItems(selectedFolderId)
        }}
      />

      {/* Export Modal */}
      <ImportExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        mode="export"
        getAccessToken={getAccessToken}
      />

      {/* Floating Action Bar for Batch Operations */}
      <BatchActionBar
        selectedCount={selectedItems.size}
        batchOperating={batchOperating}
        onShowMoveModal={() => setShowMoveModal(true)}
        onBatchDelete={handleBatchDelete}
        onClearSelection={() => setSelectedItems(new Set())}
      />

      {/* Batch Move Modal */}
      <BatchMoveModal
        isOpen={showMoveModal}
        selectedCount={selectedItems.size}
        folders={folders}
        batchOperating={batchOperating}
        onMove={handleBatchMove}
        onClose={() => setShowMoveModal(false)}
      />
    </div>
  )
}

'use client'

import { Globe, Plus, Search, Loader2, FileText } from 'lucide-react'
import SortableBookmarkList from '@/components/bookmarks/SortableBookmarkList'
import PaperBookmarkItemCard from '@/components/bookmarks/PaperBookmarkItemCard'
import type { BookmarkFolder, BookmarkItem } from '@/types/bookmarks'
import type { PaperBookmarkFolder, PaperBookmarkItem } from '@/types/paper-bookmarks'

type CollectionType = 'paper' | 'webpage'

interface BookmarksMainContentProps {
  // Collection type
  activeCollectionType: CollectionType
  
  // Folder data
  paperFolders: PaperBookmarkFolder[]
  folders: BookmarkFolder[]
  selectedPaperFolderId: string | null
  selectedFolderId: string | null
  
  // Items
  paperItems: PaperBookmarkItem[]
  items: BookmarkItem[]
  loading: boolean
  
  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void
  
  // Paper item actions
  onDeletePaperItem: (id: string) => Promise<void>
  
  // Webpage item actions
  onDeleteBookmark: (id: string) => Promise<void>
  reordering: boolean
  selectedItems: Set<string>
  onSelectItem: (itemId: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  
  // Modal triggers
  setShowAddBookmarkModal: (show: boolean) => void
}

/**
 * Main content area for bookmarks page
 * Displays either paper or webpage bookmark items based on active collection type
 */
export default function BookmarksMainContent({
  activeCollectionType,
  paperFolders,
  folders,
  selectedPaperFolderId,
  selectedFolderId,
  paperItems,
  items,
  loading,
  searchQuery,
  setSearchQuery,
  onDeletePaperItem,
  onDeleteBookmark,
  reordering,
  selectedItems,
  onSelectItem,
  onSelectAll,
  setShowAddBookmarkModal
}: BookmarksMainContentProps) {
  
  // Get current folder name
  const getCurrentFolderName = () => {
    if (activeCollectionType === 'paper') {
      if (selectedPaperFolderId === null) return '未分类论文'
      const folder = paperFolders.flatMap(f => [f, ...(f.children || [])]).find(f => f.id === selectedPaperFolderId)
      return folder?.name || '论文收藏'
    } else {
      if (selectedFolderId === null) return '未分类网页'
      const folder = folders.flatMap(f => [f, ...(f.children || [])]).find(f => f.id === selectedFolderId)
      return folder?.name || '网页收藏'
    }
  }

  return (
    <div className="flex-1 min-w-0 droppable-area">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {activeCollectionType === 'paper' ? (
                <FileText size={20} className="text-blue-600 dark:text-blue-400" />
              ) : (
                <Globe size={20} className="text-green-600 dark:text-green-400" />
              )}
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {getCurrentFolderName()}
              </h1>
            </div>
            {activeCollectionType === 'webpage' && (
              <button
                onClick={() => setShowAddBookmarkModal(true)}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} className="mr-1" />
                添加收藏
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={activeCollectionType === 'paper' ? '搜索论文...' : '搜索收藏...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Content based on collection type */}
        {activeCollectionType === 'paper' ? (
          /* Paper Items list */
          <div className="divide-y dark:divide-gray-700">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                <p className="text-gray-500 dark:text-gray-400">加载中...</p>
              </div>
            ) : paperItems.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">暂无收藏的论文</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  在论文详情页点击收藏按钮添加论文
                </p>
              </div>
            ) : (
              paperItems.map(item => (
                <PaperBookmarkItemCard
                  key={item.id}
                  item={item}
                  onDelete={onDeletePaperItem}
                />
              ))
            )}
          </div>
        ) : (
          /* Webpage Items list - Sortable */
          <SortableBookmarkList
            items={items}
            loading={loading}
            searchQuery={searchQuery}
            reordering={reordering}
            selectedItems={selectedItems}
            onDeleteBookmark={onDeleteBookmark}
            onSelectItem={onSelectItem}
            onSelectAll={onSelectAll}
          />
        )}
      </div>
    </div>
  )
}

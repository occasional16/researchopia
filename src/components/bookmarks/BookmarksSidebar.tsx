'use client'

import { Globe, FolderPlus, Upload, Download, Folder as FolderIcon, FileText } from 'lucide-react'
import DroppableFolderTree from '@/components/bookmarks/DroppableFolderTree'
import { PaperFolderItem } from '@/components/bookmarks/PaperFolderTree'
import type { BookmarkFolder } from '@/types/bookmarks'
import type { PaperBookmarkFolder } from '@/types/paper-bookmarks'
import { UniqueIdentifier } from '@dnd-kit/core'

type CollectionType = 'paper' | 'webpage'

interface BookmarksSidebarProps {
  // Collection state
  activeCollectionType: CollectionType
  setActiveCollectionType: (type: CollectionType) => void
  
  // Paper folders
  paperFolders: PaperBookmarkFolder[]
  paperUncategorizedCount: number
  paperTotalCount: number  // Total paper bookmarks count
  selectedPaperFolderId: string | null
  setSelectedPaperFolderId: (id: string | null) => void
  expandedPaperFolders: Set<string>
  setExpandedPaperFolders: React.Dispatch<React.SetStateAction<Set<string>>>
  
  // Webpage folders
  folders: BookmarkFolder[]
  uncategorizedCount: number
  webpageTotalCount: number  // Total webpage bookmarks count
  selectedFolderId: string | null
  setSelectedFolderId: (id: string | null) => void
  expandedFolders: Set<string>
  
  // Editing state
  editingFolderId: string | null
  editFolderName: string
  setEditingFolderId: (id: string | null) => void
  setEditFolderName: (name: string) => void
  handleRenameFolder: (folderId: string) => Promise<void>
  handleRenamePaperFolder: (folderId: string) => Promise<void>
  
  // Drag state
  activeId: UniqueIdentifier | null
  dragOverFolderId: string | null
  
  // Actions
  toggleFolder: (folderId: string) => void
  onFolderContextMenu: (e: React.MouseEvent, folderId: string) => void
  onPaperFolderContextMenu: (e: React.MouseEvent, folderId: string) => void
  setShowNewFolderModal: (show: boolean) => void
  setShowImportModal: (show: boolean) => void
  setShowExportModal: (show: boolean) => void
}

/**
 * Bookmarks Sidebar - Contains both paper and webpage folder trees
 */
export default function BookmarksSidebar({
  activeCollectionType,
  setActiveCollectionType,
  paperFolders,
  paperUncategorizedCount,
  paperTotalCount,
  selectedPaperFolderId,
  setSelectedPaperFolderId,
  expandedPaperFolders,
  setExpandedPaperFolders,
  folders,
  uncategorizedCount,
  webpageTotalCount,
  selectedFolderId,
  setSelectedFolderId,
  expandedFolders,
  editingFolderId,
  editFolderName,
  setEditingFolderId,
  setEditFolderName,
  handleRenameFolder,
  handleRenamePaperFolder,
  activeId,
  dragOverFolderId,
  toggleFolder,
  onFolderContextMenu,
  onPaperFolderContextMenu,
  setShowNewFolderModal,
  setShowImportModal,
  setShowExportModal
}: BookmarksSidebarProps) {
  return (
    <div className="hidden md:block w-64 lg:w-72 xl:w-80 flex-shrink-0 droppable-folder space-y-4">
      {/* Paper Folders Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">论文收藏</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">({paperTotalCount})</span>
          </div>
          <button
            onClick={() => {
              setActiveCollectionType('paper')
              setShowNewFolderModal(true)
            }}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="新建论文文件夹"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Paper Uncategorized */}
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
            activeCollectionType === 'paper' && selectedPaperFolderId === null
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => {
            setActiveCollectionType('paper')
            setSelectedPaperFolderId(null)
          }}
        >
          <FolderIcon size={14} />
          <span className="flex-1 truncate">未分类</span>
          {paperUncategorizedCount > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{paperUncategorizedCount}</span>
          )}
        </div>

        {/* Paper Folders */}
        {paperFolders.map(folder => (
          <PaperFolderItem
            key={folder.id}
            folder={folder}
            depth={0}
            isActive={activeCollectionType === 'paper'}
            selectedFolderId={selectedPaperFolderId}
            expandedFolders={expandedPaperFolders}
            editingFolderId={editingFolderId}
            editFolderName={editFolderName}
            onSelect={(id) => {
              setActiveCollectionType('paper')
              setSelectedPaperFolderId(id)
            }}
            onToggle={(id) => {
              setExpandedPaperFolders(prev => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }}
            onContextMenu={onPaperFolderContextMenu}
            onEditNameChange={setEditFolderName}
            onRename={handleRenamePaperFolder}
            onCancelEdit={() => {
              setEditingFolderId(null)
              setEditFolderName('')
            }}
          />
        ))}
      </div>

      {/* Webpage Folders Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-green-600 dark:text-green-400" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">网页收藏</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">({webpageTotalCount})</span>
          </div>
          <button
            onClick={() => {
              setActiveCollectionType('webpage')
              setShowNewFolderModal(true)
            }}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="新建网页文件夹"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Droppable Folder Tree */}
        <DroppableFolderTree
          folders={folders}
          uncategorizedCount={uncategorizedCount}
          selectedFolderId={selectedFolderId}
          expandedFolders={expandedFolders}
          editingFolderId={editingFolderId}
          editFolderName={editFolderName}
          isDragging={!!activeId}
          dragOverFolderId={dragOverFolderId}
          isActive={activeCollectionType === 'webpage'}
          onFolderSelect={(id) => {
            setActiveCollectionType('webpage')
            setSelectedFolderId(id)
          }}
          onFolderToggle={toggleFolder}
          onFolderContextMenu={onFolderContextMenu}
          onEditStart={(id, name) => {
            setEditingFolderId(id)
            setEditFolderName(name)
          }}
          onEditChange={setEditFolderName}
          onEditSave={handleRenameFolder}
          onEditCancel={() => {
            setEditingFolderId(null)
            setEditFolderName('')
          }}
        />

        {/* Import/Export buttons */}
        <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Upload size={16} />
            导入书签
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Download size={16} />
            导出书签
          </button>
        </div>
      </div>
    </div>
  )
}

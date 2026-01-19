'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Edit2, Check, X, Lock, Globe, Share2 } from 'lucide-react'
import type { BookmarkFolder, FolderVisibility } from '@/types/bookmarks'

// Map visibility to Lucide icon components
const VisibilityIconMap: Record<FolderVisibility, React.ComponentType<{ size?: number; className?: string }>> = {
  private: Lock,
  public: Globe,
  shared: Share2
}

interface DroppableFolderTreeProps {
  folders: BookmarkFolder[]
  uncategorizedCount: number
  selectedFolderId: string | null
  expandedFolders: Set<string>
  editingFolderId: string | null
  editFolderName: string
  isDragging: boolean
  dragOverFolderId: string | null
  isActive?: boolean // Whether this tree is the active collection type
  onFolderSelect: (folderId: string | null) => void
  onFolderToggle: (folderId: string) => void
  onFolderContextMenu: (e: React.MouseEvent, folderId: string) => void
  onEditStart: (folderId: string, name: string) => void
  onEditChange: (name: string) => void
  onEditSave: (folderId: string) => void
  onEditCancel: () => void
}

/**
 * Individual droppable folder item
 */
function DroppableFolderItem({
  folder,
  depth,
  isSelected,
  isExpanded,
  hasChildren,
  isEditing,
  editFolderName,
  isDragging,
  isOver,
  onSelect,
  onToggle,
  onContextMenu,
  onEditChange,
  onEditSave,
  onEditCancel
}: {
  folder: BookmarkFolder
  depth: number
  isSelected: boolean
  isExpanded: boolean
  hasChildren: boolean
  isEditing: boolean
  editFolderName: string
  isDragging: boolean
  isOver: boolean
  onSelect: () => void
  onToggle: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onEditChange: (name: string) => void
  onEditSave: () => void
  onEditCancel: () => void
}) {
  const { setNodeRef } = useDroppable({
    id: `folder-${folder.id}`
  })

  // Get the correct icon for folder visibility
  const VisibilityIcon = VisibilityIconMap[folder.visibility as FolderVisibility] || Folder

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center px-2 py-1.5 rounded-md cursor-pointer group transition-all
        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
        ${isDragging && isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 !cursor-copy' : ''}
        ${isDragging && !isSelected ? 'hover:ring-2 hover:ring-blue-300 !cursor-grab' : ''}
      `}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {/* Expand/collapse toggle */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="p-0.5 mr-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {/* Folder icon - always show folder, add visibility indicator for non-private */}
      {isSelected ? (
        <FolderOpen size={16} className="mr-2 text-blue-600 dark:text-blue-400" />
      ) : (
        <Folder size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
      )}
      
      {/* Visibility indicator for public/shared folders */}
      {folder.visibility !== 'private' && (
        <span className="mr-1.5 text-xs" title={folder.visibility === 'public' ? '公开' : '分享'}>
          {folder.visibility === 'public' ? <Globe size={12} className="text-green-500" /> : <Share2 size={12} className="text-blue-500" />}
        </span>
      )}

      {/* Name or edit input */}
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editFolderName}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditSave()
              if (e.key === 'Escape') onEditCancel()
            }}
            className="flex-1 px-1 py-0.5 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditSave()
            }}
            className="p-0.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
          >
            <Check size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditCancel()
            }}
            className="p-0.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <span className="flex-1 truncate text-sm">{folder.name}</span>
      )}

      {/* Item count */}
      {!isEditing && folder.item_count !== undefined && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
          {folder.item_count}
        </span>
      )}
    </div>
  )
}

/**
 * Droppable uncategorized folder
 */
function DroppableUncategorized({
  count,
  isSelected,
  isDragging,
  isOver,
  onSelect
}: {
  count: number
  isSelected: boolean
  isDragging: boolean
  isOver: boolean
  onSelect: () => void
}) {
  const { setNodeRef } = useDroppable({
    id: 'folder-uncategorized'
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        flex items-center px-2 py-1.5 rounded-md cursor-pointer transition-all
        ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
        ${isDragging && isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 !cursor-copy' : ''}
        ${isDragging && !isSelected ? 'hover:ring-2 hover:ring-blue-300 !cursor-grab' : ''}
      `}
      onClick={onSelect}
    >
      <span className="w-5" />
      <Folder size={16} className="mr-2 text-gray-500 dark:text-gray-400" />
      <span className="flex-1 truncate text-sm">未分类</span>
      {count > 0 && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{count}</span>
      )}
    </div>
  )
}

/**
 * Droppable Folder Tree Component
 */
export default function DroppableFolderTree({
  folders,
  uncategorizedCount,
  selectedFolderId,
  expandedFolders,
  editingFolderId,
  editFolderName,
  isDragging,
  dragOverFolderId,
  isActive = true,
  onFolderSelect,
  onFolderToggle,
  onFolderContextMenu,
  onEditStart,
  onEditChange,
  onEditSave,
  onEditCancel
}: DroppableFolderTreeProps) {

  const renderFolderTree = (folderList: BookmarkFolder[], depth = 0): React.ReactNode => {
    return folderList.map(folder => {
      const isExpanded = expandedFolders.has(folder.id)
      const isSelected = isActive && selectedFolderId === folder.id
      const hasChildren = folder.children && folder.children.length > 0
      const isEditing = editingFolderId === folder.id
      const isOver = dragOverFolderId === `folder-${folder.id}`

      return (
        <div key={folder.id}>
          <DroppableFolderItem
            folder={folder}
            depth={depth}
            isSelected={isSelected}
            isExpanded={isExpanded}
            hasChildren={!!hasChildren}
            isEditing={isEditing}
            editFolderName={editFolderName}
            isDragging={isDragging}
            isOver={isOver}
            onSelect={() => {
              onFolderSelect(folder.id)
              if (hasChildren) onFolderToggle(folder.id)
            }}
            onToggle={() => onFolderToggle(folder.id)}
            onContextMenu={(e) => onFolderContextMenu(e, folder.id)}
            onEditChange={onEditChange}
            onEditSave={() => onEditSave(folder.id)}
            onEditCancel={onEditCancel}
          />

          {/* Children */}
          {isExpanded && folder.children && folder.children.length > 0 && (
            <div>
              {renderFolderTree(folder.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="space-y-1">
      {/* Uncategorized */}
      <DroppableUncategorized
        count={uncategorizedCount}
        isSelected={isActive && selectedFolderId === null}
        isDragging={isDragging}
        isOver={dragOverFolderId === 'folder-uncategorized'}
        onSelect={() => onFolderSelect(null)}
      />

      {/* Folders */}
      {renderFolderTree(folders)}
    </div>
  )
}

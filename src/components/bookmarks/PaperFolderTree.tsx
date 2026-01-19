'use client'

import { Folder, FolderOpen, ChevronRight, ChevronDown, Check, X } from 'lucide-react'
import type { PaperBookmarkFolder } from '@/types/paper-bookmarks'

interface PaperFolderItemProps {
  folder: PaperBookmarkFolder
  depth: number
  isActive: boolean
  selectedFolderId: string | null
  expandedFolders: Set<string>
  editingFolderId?: string | null
  editFolderName?: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, folderId: string) => void
  onEditNameChange?: (name: string) => void
  onRename?: (folderId: string) => void
  onCancelEdit?: () => void
}

/**
 * Paper Folder Item - Recursive component for folder tree display
 * Exported for use in the sidebar paper folder section
 */
export function PaperFolderItem({
  folder,
  depth,
  isActive,
  selectedFolderId,
  expandedFolders,
  editingFolderId,
  editFolderName,
  onSelect,
  onToggle,
  onContextMenu,
  onEditNameChange,
  onRename,
  onCancelEdit
}: PaperFolderItemProps) {
  const hasChildren = folder.children && folder.children.length > 0
  const isExpanded = expandedFolders.has(folder.id)
  const isSelected = isActive && selectedFolderId === folder.id
  const isEditing = editingFolderId === folder.id

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => !isEditing && onSelect(folder.id)}
        onContextMenu={(e) => onContextMenu?.(e, folder.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle(folder.id)
            }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            aria-label={isExpanded ? '折叠文件夹' : '展开文件夹'}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        
        {/* Folder name - editable or display */}
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editFolderName || ''}
              onChange={(e) => onEditNameChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename?.(folder.id)
                if (e.key === 'Escape') onCancelEdit?.()
              }}
              className="flex-1 px-1 py-0.5 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
              autoFocus
              placeholder="文件夹名称"
              aria-label="文件夹名称"
            />
            <button
              onClick={() => onRename?.(folder.id)}
              className="p-0.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
              title="确认"
              aria-label="确认重命名"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => onCancelEdit?.()}
              className="p-0.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
              title="取消"
              aria-label="取消重命名"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 truncate">{folder.name}</span>
            {(folder.item_count ?? 0) > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{folder.item_count}</span>
            )}
          </>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map(child => (
            <PaperFolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              isActive={isActive}
              selectedFolderId={selectedFolderId}
              expandedFolders={expandedFolders}
              editingFolderId={editingFolderId}
              editFolderName={editFolderName}
              onSelect={onSelect}
              onToggle={onToggle}
              onContextMenu={onContextMenu}
              onEditNameChange={onEditNameChange}
              onRename={onRename}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface PaperFolderTreeProps {
  folders: PaperBookmarkFolder[]
  uncategorizedCount: number
  selectedFolderId: string | null
  expandedFolders: Set<string>
  isActive: boolean
  onSelectFolder: (id: string | null) => void
  onToggleFolder: (id: string) => void
  onSelectCollection: () => void
}

/**
 * Paper Folder Tree - Complete tree component for paper bookmarks sidebar
 */
export default function PaperFolderTree({
  folders,
  uncategorizedCount,
  selectedFolderId,
  expandedFolders,
  isActive,
  onSelectFolder,
  onToggleFolder,
  onSelectCollection
}: PaperFolderTreeProps) {
  return (
    <div>
      {/* Uncategorized */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm ${
          isActive && selectedFolderId === null
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}
        onClick={() => {
          onSelectCollection()
          onSelectFolder(null)
        }}
      >
        <Folder size={14} />
        <span className="flex-1">未分类</span>
        {uncategorizedCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {uncategorizedCount}
          </span>
        )}
      </div>

      {/* Folder tree */}
      {folders.map(folder => (
        <PaperFolderItem
          key={folder.id}
          folder={folder}
          depth={0}
          isActive={isActive}
          selectedFolderId={selectedFolderId}
          expandedFolders={expandedFolders}
          onSelect={(id) => {
            onSelectCollection()
            onSelectFolder(id)
          }}
          onToggle={onToggleFolder}
        />
      ))}
    </div>
  )
}

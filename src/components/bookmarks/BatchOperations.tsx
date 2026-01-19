'use client'

import { X, Folder as FolderIcon, Trash2 } from 'lucide-react'
import type { BookmarkFolder } from '@/types/bookmarks'

interface BatchActionBarProps {
  selectedCount: number
  batchOperating: boolean
  onShowMoveModal: () => void
  onBatchDelete: () => void
  onClearSelection: () => void
}

/**
 * Floating action bar for batch operations
 */
export function BatchActionBar({
  selectedCount,
  batchOperating,
  onShowMoveModal,
  onBatchDelete,
  onClearSelection
}: BatchActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg">
      <span className="text-sm text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
        已选择 {selectedCount} 项
      </span>
      <div className="w-px h-5 bg-gray-200 dark:bg-zinc-700" />
      <button
        onClick={onShowMoveModal}
        disabled={batchOperating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
      >
        <FolderIcon className="w-4 h-4" />
        移动到
      </button>
      <button
        onClick={onBatchDelete}
        disabled={batchOperating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-4 h-4" />
        删除
      </button>
      <button
        onClick={onClearSelection}
        disabled={batchOperating}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
        title="取消选择"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

interface BatchMoveModalProps {
  isOpen: boolean
  selectedCount: number
  folders: BookmarkFolder[]
  batchOperating: boolean
  onMove: (targetFolderId: string | null) => void
  onClose: () => void
}

/**
 * Modal for batch moving bookmarks to a folder
 */
export function BatchMoveModal({
  isOpen,
  selectedCount,
  folders,
  batchOperating,
  onMove,
  onClose
}: BatchMoveModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            移动 {selectedCount} 个书签到
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 max-h-64 overflow-y-auto">
          {/* Root folder option */}
          <button
            onClick={() => onMove(null)}
            disabled={batchOperating}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
          >
            <FolderIcon className="w-4 h-4 text-gray-400" />
            <span>根目录</span>
          </button>
          {/* Folder list */}
          {folders.map((folder) => (
            <div key={folder.id}>
              <button
                onClick={() => onMove(folder.id)}
                disabled={batchOperating}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
              >
                <FolderIcon className="w-4 h-4 text-blue-500" />
                <span>{folder.name}</span>
              </button>
              {folder.children?.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onMove(child.id)}
                  disabled={batchOperating}
                  className="w-full flex items-center gap-2 px-3 py-2 pl-8 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50"
                >
                  <FolderIcon className="w-4 h-4 text-blue-400" />
                  <span>{child.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end px-4 py-3 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

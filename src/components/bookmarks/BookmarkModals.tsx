'use client'

import { Loader2 } from 'lucide-react'
import type { BookmarkFolder } from '@/types/bookmarks'

interface NewFolderModalProps {
  isOpen: boolean
  folderName: string
  parentId: string | null
  folders: BookmarkFolder[]
  creating: boolean
  onClose: () => void
  onNameChange: (name: string) => void
  onCreate: () => void
}

export function NewFolderModal({
  isOpen,
  folderName,
  parentId,
  folders,
  creating,
  onClose,
  onNameChange,
  onCreate
}: NewFolderModalProps) {
  if (!isOpen) return null

  const parentName = parentId
    ? folders.flatMap(f => [f, ...(f.children || [])]).find(f => f.id === parentId)?.name
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          新建文件夹
        </h3>
        <input
          type="text"
          placeholder="文件夹名称"
          value={folderName}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate()
            if (e.key === 'Escape') onClose()
          }}
        />
        {parentName && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            将在「{parentName}」下创建
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={onCreate}
            disabled={creating || !folderName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {creating && <Loader2 className="animate-spin mr-2" size={16} />}
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

interface AddBookmarkModalProps {
  isOpen: boolean
  url: string
  title: string
  creating: boolean
  onClose: () => void
  onUrlChange: (url: string) => void
  onTitleChange: (title: string) => void
  onCreate: () => void
}

export function AddBookmarkModal({
  isOpen,
  url,
  title,
  creating,
  onClose,
  onUrlChange,
  onTitleChange,
  onCreate
}: AddBookmarkModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          添加收藏
        </h3>
        <input
          type="url"
          placeholder="网页地址 (URL)"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-3"
          autoFocus
        />
        <input
          type="text"
          placeholder="标题 (可选，留空将自动获取)"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreate()
            if (e.key === 'Escape') onClose()
          }}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={onCreate}
            disabled={creating || !url.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {creating && <Loader2 className="animate-spin mr-2" size={16} />}
            添加
          </button>
        </div>
      </div>
    </div>
  )
}

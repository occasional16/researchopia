'use client'

import { Edit2, FolderPlus, Trash2 } from 'lucide-react'

interface FolderContextMenuProps {
  x: number
  y: number
  folderId: string
  onRename: (folderId: string) => void
  onCreateSubfolder: (parentId: string) => void
  onDelete: (folderId: string) => void
  onClose: () => void
}

export function FolderContextMenu({
  x,
  y,
  folderId,
  onRename,
  onCreateSubfolder,
  onDelete,
  onClose
}: FolderContextMenuProps) {
  return (
    <div
      className="fixed bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-50"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => {
          onRename(folderId)
          onClose()
        }}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
      >
        <Edit2 size={14} className="mr-2" />
        重命名
      </button>
      <button
        onClick={() => {
          onCreateSubfolder(folderId)
          onClose()
        }}
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
      >
        <FolderPlus size={14} className="mr-2" />
        新建子文件夹
      </button>
      <hr className="my-1 dark:border-gray-700" />
      <button
        onClick={() => {
          onDelete(folderId)
          onClose()
        }}
        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
      >
        <Trash2 size={14} className="mr-2" />
        删除
      </button>
    </div>
  )
}

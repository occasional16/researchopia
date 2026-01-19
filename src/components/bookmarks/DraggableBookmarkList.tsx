'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  UniqueIdentifier,
  DragOverEvent,
  useDroppable
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Globe, ExternalLink, ChevronRight, Trash2, GripVertical, Loader2
} from 'lucide-react'
import type { BookmarkItem, BookmarkFolder } from '@/types/bookmarks'

interface DraggableBookmarkListProps {
  items: BookmarkItem[]
  folders: BookmarkFolder[]
  loading: boolean
  searchQuery: string
  selectedFolderId: string | null
  onItemsReorder: (items: BookmarkItem[], folderId: string | null) => Promise<void>
  onItemMove: (itemId: string, targetFolderId: string | null) => Promise<void>
  onDeleteBookmark: (id: string) => void
}

interface SortableItemProps {
  item: BookmarkItem
  onDelete: (id: string) => void
  isDragging?: boolean
}

/**
 * Folder Drop Zone Component
 */
function FolderDropZone({ folder, isOver }: { folder: BookmarkFolder; isOver: boolean }) {
  return (
    <div
      className={`
        px-2 py-1.5 rounded-md text-sm transition-colors
        ${isOver 
          ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500' 
          : 'bg-gray-50 dark:bg-gray-700/50'
        }
      `}
    >
      {folder.name}
    </div>
  )
}

/**
 * Sortable Bookmark Item Component
 */
function SortableItem({ item, onDelete, isDragging }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1
  }

  if (isDragging) {
    return (
      <div
        className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-blue-500"
      >
        <GripVertical size={16} className="mr-2 text-gray-400" />
        {item.webpage?.favicon_url ? (
          <img
            src={item.webpage.favicon_url}
            alt=""
            className="w-5 h-5 mr-3 rounded"
          />
        ) : (
          <Globe size={20} className="mr-3 text-gray-400" />
        )}
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate">
          {item.custom_title || item.webpage?.title || item.webpage?.url}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 group border-b dark:border-gray-700 last:border-b-0"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
        title="拖拽排序"
      >
        <GripVertical size={16} />
      </button>

      {/* Favicon */}
      {item.webpage?.favicon_url ? (
        <img
          src={item.webpage.favicon_url}
          alt=""
          className="w-5 h-5 mr-3 rounded"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <Globe size={20} className="mr-3 text-gray-400" />
      )}

      {/* Title and URL */}
      <div className="flex-1 min-w-0">
        <a
          href={item.webpage?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 font-medium block truncate"
        >
          {item.custom_title || item.webpage?.title || item.webpage?.url}
        </a>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {item.webpage?.url}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={item.webpage?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
          title="在新标签页打开"
        >
          <ExternalLink size={16} />
        </a>
        <Link
          href={`/webpages/${item.webpage?.url_hash}`}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
          title="查看详情"
        >
          <ChevronRight size={16} />
        </Link>
        <button
          onClick={() => onDelete(item.id)}
          className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
          title="删除"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * Draggable Bookmark List Component
 */
export default function DraggableBookmarkList({
  items,
  folders,
  loading,
  searchQuery,
  selectedFolderId,
  onItemsReorder,
  onItemMove,
  onDeleteBookmark
}: DraggableBookmarkListProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  const [reordering, setReordering] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Minimum drag distance to start
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const activeItem = activeId ? items.find(i => i.id === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    console.log('[DnD] Drag started:', event.active.id)
    setActiveId(event.active.id)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    console.log('[DnD] Drag over:', over?.id)
    setOverId(over?.id ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    console.log('[DnD] Drag end:', { activeId: active.id, overId: over?.id })

    setActiveId(null)
    setOverId(null)

    if (!over) return

    // Check if dropped on a folder (folder IDs start with 'folder-')
    const overId = String(over.id)
    if (overId.startsWith('folder-')) {
      const targetFolderId = overId.replace('folder-', '')
      const actualFolderId = targetFolderId === 'uncategorized' ? null : targetFolderId
      
      console.log('[DnD] Moving to folder:', actualFolderId)
      // Move to folder
      if (actualFolderId !== selectedFolderId) {
        await onItemMove(String(active.id), actualFolderId)
      }
      return
    }

    // Reorder within same list
    if (active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id)
      const newIndex = items.findIndex(i => i.id === over.id)

      console.log('[DnD] Reordering:', { oldIndex, newIndex })
      if (oldIndex !== -1 && newIndex !== -1) {
        setReordering(true)
        const newItems = arrayMove(items, oldIndex, newIndex)
        await onItemsReorder(newItems, selectedFolderId)
        setReordering(false)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOverId(null)
  }

  // Flatten folders for drop zones
  const flatFolders = folders.flatMap(f => [f, ...(f.children || [])])

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="animate-spin mx-auto" size={24} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        {searchQuery ? '没有找到匹配的收藏' : '此文件夹为空'}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="relative">
        {/* Folder drop zones - shown when dragging */}
        {activeId && (
          <div className="absolute -left-64 top-0 w-60 space-y-1 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border dark:border-gray-700 z-10">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
              拖拽到此处移动
            </div>
            <DroppableFolder id="folder-uncategorized" isOver={overId === 'folder-uncategorized'}>
              未分类
            </DroppableFolder>
            {flatFolders
              .filter(f => f.id !== selectedFolderId)
              .map(folder => (
                <DroppableFolder 
                  key={folder.id} 
                  id={`folder-${folder.id}`}
                  isOver={overId === `folder-${folder.id}`}
                >
                  {folder.name}
                </DroppableFolder>
              ))
            }
          </div>
        )}

        {/* Sortable list */}
        <SortableContext
          items={items.map(i => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className={`divide-y dark:divide-gray-700 ${reordering ? 'opacity-50 pointer-events-none' : ''}`}>
            {items.map(item => (
              <SortableItem
                key={item.id}
                item={item}
                onDelete={onDeleteBookmark}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay>
          {activeItem ? (
            <SortableItem item={activeItem} onDelete={() => {}} isDragging />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

/**
 * Droppable Folder Component
 */
function DroppableFolder({ 
  id, 
  children, 
  isOver 
}: { 
  id: string; 
  children: React.ReactNode; 
  isOver: boolean 
}) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`
        px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer
        ${isOver 
          ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-blue-500 text-blue-700 dark:text-blue-300' 
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }
      `}
    >
      {children}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Globe, ExternalLink, ChevronRight, Trash2, GripVertical, Loader2, Check
} from 'lucide-react'
import type { BookmarkItem } from '@/types/bookmarks'

interface SortableBookmarkListProps {
  items: BookmarkItem[]
  loading: boolean
  searchQuery: string
  reordering: boolean
  selectedItems: Set<string>
  onDeleteBookmark: (id: string) => void
  onSelectItem: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
}

interface SortableItemProps {
  item: BookmarkItem
  isSelected: boolean
  onDelete: (id: string) => void
  onSelect: (id: string, selected: boolean) => void
  isDragging?: boolean
}

/**
 * Sortable Bookmark Item Component
 */
function SortableItem({ item, isSelected, onDelete, onSelect, isDragging }: SortableItemProps) {
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
      className={`flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 group border-b dark:border-gray-700 last:border-b-0 ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect(item.id, !isSelected)
        }}
        className={`w-5 h-5 mr-3 flex items-center justify-center rounded border transition-colors ${
          isSelected 
            ? 'bg-blue-600 border-blue-600 text-white' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }`}
      >
        {isSelected && <Check size={14} />}
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
        title="拖拽排序 / 拖到左侧文件夹移动"
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
          title={item.custom_title || item.webpage?.title || item.webpage?.url || ''}
        >
          {item.custom_title || item.webpage?.title || item.webpage?.url}
        </a>
        <p 
          className="text-sm text-gray-500 dark:text-gray-400 truncate"
          title={item.webpage?.url || ''}
        >
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
 * Drag Overlay Item (shown when dragging)
 */
export function DragOverlayItem({ item }: { item: BookmarkItem }) {
  return (
    <div className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 border-blue-500">
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

/**
 * Sortable Bookmark List Component
 * Note: Must be wrapped in a DndContext from parent
 */
export default function SortableBookmarkList({
  items,
  loading,
  searchQuery,
  reordering,
  selectedItems,
  onDeleteBookmark,
  onSelectItem,
  onSelectAll
}: SortableBookmarkListProps) {
  const allSelected = items.length > 0 && items.every(item => selectedItems.has(item.id))
  const someSelected = items.some(item => selectedItems.has(item.id))

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
    <div>
      {/* Select All Header */}
      <div className="flex items-center px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <button
          onClick={() => onSelectAll(!allSelected)}
          className={`w-5 h-5 mr-3 flex items-center justify-center rounded border transition-colors ${
            allSelected 
              ? 'bg-blue-600 border-blue-600 text-white' 
              : someSelected
                ? 'bg-blue-300 border-blue-400 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
          }`}
        >
          {(allSelected || someSelected) && <Check size={14} />}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {selectedItems.size > 0 
            ? `已选择 ${selectedItems.size} 项` 
            : `共 ${items.length} 项`}
        </span>
      </div>

      <SortableContext
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className={`divide-y dark:divide-gray-700 ${reordering ? 'opacity-50 pointer-events-none' : ''}`}>
          {items.map(item => (
            <SortableItem
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onDelete={onDeleteBookmark}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

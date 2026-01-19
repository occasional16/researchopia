'use client'

import Link from 'next/link'
import { Trash2, FileText, ExternalLink, ChevronRight } from 'lucide-react'
import type { PaperBookmarkItem } from '@/types/paper-bookmarks'

interface PaperBookmarkItemCardProps {
  item: PaperBookmarkItem
  onDelete: (id: string) => void
}

/**
 * Paper Bookmark Item Card - Display a single paper bookmark
 */
export default function PaperBookmarkItemCard({
  item,
  onDelete
}: PaperBookmarkItemCardProps) {
  const paper = item.paper
  if (!paper) return null

  // Construct external URL for the paper (DOI link)
  const externalUrl = paper.doi 
    ? `https://doi.org/${paper.doi}`
    : null

  // Internal detail page URL
  const detailUrl = `/papers/${paper.doi ? encodeURIComponent(paper.doi) : paper.id}`

  return (
    <div className="group p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start gap-3">
        <FileText size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <Link
            href={detailUrl}
            className="text-base font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
          >
            {item.custom_title || paper.title}
          </Link>
          {paper.authors && paper.authors.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
              {paper.authors.slice(0, 3).join(', ')}
              {paper.authors.length > 3 && ' 等'}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {paper.journal && <span>{paper.journal}</span>}
            {paper.publication_date && (
              <span>{new Date(paper.publication_date).getFullYear()}</span>
            )}
            {paper.average_rating > 0 && (
              <span>⭐ {paper.average_rating.toFixed(1)}</span>
            )}
            {paper.comments_count > 0 && (
              <span>💬 {paper.comments_count}</span>
            )}
          </div>
          {item.note && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1">
              📝 {item.note}
            </p>
          )}
        </div>
        
        {/* Actions - same 3 buttons as webpage bookmarks */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
              title="在新标签页打开"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <Link
            href={detailUrl}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
            title="查看详情"
          >
            <ChevronRight size={16} />
          </Link>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="删除收藏"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

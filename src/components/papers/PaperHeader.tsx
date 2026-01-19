'use client'

import { Users, Calendar, ExternalLink, Tag, Star, MessageCircle, Eye } from 'lucide-react'
import PaperBookmarkButton from '@/components/bookmarks/PaperBookmarkButton'
import ShareButton from '@/components/shared/ShareButton'
import type { Paper } from '@/lib/supabase'

interface PaperHeaderProps {
  paper: Paper & { view_count?: number }
  rating: {
    average: number
    count: number
  }
  commentCount: number
  className?: string
}

/**
 * Paper header component with integrated stats and action buttons
 * Shows title, authors, date, journal, DOI, keywords, stats, and actions
 */
export default function PaperHeader({ 
  paper, 
  rating,
  commentCount,
  className = '' 
}: PaperHeaderProps) {
  // Build the URL for sharing
  const fullUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm p-4 ${className}`}>
      {/* Top Row: Title + Stats */}
      <div className="flex flex-col lg:flex-row lg:gap-4">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Title - compact */}
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 leading-snug">
            {paper.title}
          </h1>
          
          {/* Authors */}
          <div className="flex items-start gap-1.5 text-gray-600 dark:text-gray-400 mb-2">
            <Users size={14} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs leading-relaxed">
              {paper.authors?.join(', ') || '未知作者'}
            </span>
          </div>
          
          {/* Meta row: Date + Journal + DOI */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
            {paper.publication_date && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(paper.publication_date).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}
            
            {paper.journal && (
              <span className="italic text-gray-600 dark:text-gray-300">
                {paper.journal}
              </span>
            )}
            
            {paper.doi && (
              <a 
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                <ExternalLink size={12} />
                DOI: {paper.doi}
              </a>
            )}
          </div>
          
          {/* Keywords as compact pills */}
          {paper.keywords && paper.keywords.length > 0 && (
            <div className="flex items-start gap-1.5 mb-2 lg:mb-0">
              <Tag size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {paper.keywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-default"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Stats + Actions */}
        <div className="lg:w-40 lg:flex-shrink-0 lg:border-l lg:dark:border-gray-700 lg:pl-4 pt-3 lg:pt-0 border-t lg:border-t-0 dark:border-gray-700">
          {/* Stats */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-1.5 lg:gap-2 mb-3">
            {/* Rating */}
            <div className="flex items-center lg:justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <Star size={14} className={rating.count > 0 ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'} />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 lg:hidden">评分</span>
              </div>
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {rating.count > 0 ? rating.average.toFixed(1) : '-'}
                <span className="text-[10px] text-gray-400 ml-0.5">({rating.count})</span>
              </span>
            </div>
            
            {/* Comments */}
            <div className="flex items-center lg:justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <MessageCircle size={14} className="text-gray-400" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 lg:hidden">评论</span>
              </div>
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {commentCount}
              </span>
            </div>
            
            {/* Views */}
            <div className="flex items-center lg:justify-between gap-1.5">
              <div className="flex items-center gap-1">
                <Eye size={14} className="text-gray-400" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400 lg:hidden">浏览</span>
              </div>
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {(paper.view_count || 0).toLocaleString()}
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex lg:flex-col gap-1.5">
            <PaperBookmarkButton 
              paperId={paper.id}
              doi={paper.doi}
              title={paper.title}
              variant="button"
              className="flex-1 lg:w-full justify-center text-xs py-1.5"
            />
            <ShareButton 
              url={fullUrl}
              title={paper.title}
              variant="button"
              className="flex-1 lg:w-full justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

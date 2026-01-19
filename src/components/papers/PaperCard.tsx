import Link from 'next/link'
import { Calendar, Users, Star, MessageCircle, Eye } from 'lucide-react'
import PaperBookmarkButton from '@/components/bookmarks/PaperBookmarkButton'
import { getPaperRoute } from '@/utils/paperRoutes'
import type { Paper, Rating } from '@/lib/supabase'
import { calculateAverageRating } from '@/lib/database'

interface PaperCardProps {
  paper: Paper & {
    ratings?: Rating[]
    view_count?: number
    comment_count?: number
    rating_count?: number
    average_rating?: number
  }
}

export default function PaperCard({ paper }: PaperCardProps) {
  // 优先使用后端聚合字段，其次退回到 ratings 数组计算
  const ratingCount = (paper as any).rating_count ?? (paper.ratings?.length || 0)
  const averageValue = (typeof (paper as any).average_rating === 'number' && ratingCount > 0)
    ? (paper as any).average_rating
    : (paper.ratings ? (calculateAverageRating(paper.ratings)?.overall ?? null) : null)
  
  const paperRoute = getPaperRoute(paper.id || paper.doi || '')

  return (
    <Link href={paperRoute} className="block">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 hover:shadow-md transition-shadow p-4">
        {/* Header: Title + Bookmark */}
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2 flex-1">
            {paper.title}
          </h3>

          <div className="flex-shrink-0" onClick={(e) => e.preventDefault()}>
            <PaperBookmarkButton
              paperId={paper.id}
              doi={paper.doi}
              title={paper.title}
              variant="icon"
            />
          </div>
        </div>

        {/* Authors + Date */}
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <div className="flex items-center gap-1 truncate">
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{paper.authors?.slice(0, 3).join(', ') || '未知作者'}{paper.authors && paper.authors.length > 3 ? ' 等' : ''}</span>
          </div>
          
          {paper.publication_date && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(paper.publication_date).getFullYear()}</span>
            </div>
          )}

          {paper.journal && (
            <span className="text-gray-500 dark:text-gray-500 italic truncate">{paper.journal}</span>
          )}
        </div>

        {/* Abstract - more compact */}
        {paper.abstract && (
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-2">
            {paper.abstract}
          </p>
        )}

        {/* Keywords - smaller, fewer */}
        {paper.keywords && paper.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {paper.keywords.slice(0, 3).map((keyword, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
              >
                {keyword}
              </span>
            ))}
            {paper.keywords.length > 3 && (
              <span className="px-1.5 py-0.5 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                +{paper.keywords.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats Bar - compact */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {averageValue !== null && averageValue !== undefined ? averageValue : '-'}
            </span>
            <span>({ratingCount}人)</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            <span>{paper.comment_count || 0}评论</span>
          </div>
          {paper.view_count !== undefined && paper.view_count > 0 && (
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{paper.view_count}</span>
            </div>
          )}
          {paper.doi && (
            <span className="ml-auto text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
              DOI: {paper.doi}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

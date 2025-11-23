import Link from 'next/link'
import { Calendar, Users, Star, MessageCircle, Eye } from 'lucide-react'
import FavoriteButton from './FavoriteButton'
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

  // 计算详细评分（用于显示分项评分）
  const averageRating = paper.ratings && paper.ratings.length > 0
    ? calculateAverageRating(paper.ratings)
    : null
  
  const paperRoute = getPaperRoute(paper.id || paper.doi || '')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 hover:shadow-md transition-shadow p-6">
      <div className="flex justify-between items-start mb-3">
        <Link
          href={paperRoute}
          className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2"
        >
          {paper.title}
        </Link>

        {averageValue !== null && averageValue !== undefined && (
          <div className="flex items-center space-x-1 ml-4 flex-shrink-0">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {averageValue}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({ratingCount})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
        <div className="flex items-center space-x-1">
          <Users className="w-4 h-4" />
          <span>{paper.authors?.join(', ') || '未知作者'}</span>
        </div>
        
        {paper.publication_date && (
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(paper.publication_date).getFullYear()}</span>
          </div>
        )}
      </div>

      {paper.journal && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">{paper.journal}</p>
      )}

      {paper.abstract && (
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-4">
          {paper.abstract}
        </p>
      )}

      {paper.keywords && paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {paper.keywords.slice(0, 4).map((keyword, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
            >
              {keyword}
            </span>
          ))}
          {paper.keywords.length > 4 && (
            <span className="px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full">
              +{paper.keywords.length - 4} more
            </span>
          )}
        </div>
      )}

      {paper.doi && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          DOI: {paper.doi}
        </div>
      )}

      {averageRating && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium text-gray-700 dark:text-gray-300">{averageRating.innovation}</div>
              <div className="text-gray-500 dark:text-gray-400">创新性</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700 dark:text-gray-300">{averageRating.methodology}</div>
              <div className="text-gray-500 dark:text-gray-400">方法论</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700 dark:text-gray-300">{averageRating.practicality}</div>
              <div className="text-gray-500 dark:text-gray-400">实用性</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700 dark:text-gray-300">{averageRating.overall}</div>
              <div className="text-gray-500 dark:text-gray-400">总体</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4" />
            <span>{averageValue !== null && averageValue !== undefined ? averageValue : '暂无评分'}</span>
            <span>({ratingCount}评分)</span>
          </div>
          <div className="flex items-center space-x-1">
            <MessageCircle className="w-4 h-4" />
            <span>({paper.comment_count || 0}评论)</span>
          </div>
          {paper.view_count !== undefined && (
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{paper.view_count || 0}次查看</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <FavoriteButton
            paperId={paper.id}
            variant="icon"
            size="sm"
            showCount={true}
          />
          <Link
            href={paperRoute}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm"
          >
            查看详情 →
          </Link>
        </div>
      </div>
    </div>
  )
}

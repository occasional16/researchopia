import Link from 'next/link'
import { Calendar, Users, Star, MessageCircle, Eye } from 'lucide-react'
import FavoriteButton from './FavoriteButton'
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

  return (
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6">
      <div className="flex justify-between items-start mb-3">
        <Link
          href={`/papers/${paper.id}`}
          className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
        >
          {paper.title}
        </Link>

        {averageValue !== null && averageValue !== undefined && (
          <div className="flex items-center space-x-1 ml-4 flex-shrink-0">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm font-medium text-gray-700">
              {averageValue}
            </span>
            <span className="text-xs text-gray-500">
              ({ratingCount})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
        <div className="flex items-center space-x-1">
          <Users className="w-4 h-4" />
          <span>{paper.authors.join(', ')}</span>
        </div>
        
        {paper.publication_date && (
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(paper.publication_date).getFullYear()}</span>
          </div>
        )}
      </div>

      {paper.journal && (
        <p className="text-sm text-gray-600 mb-3 italic">{paper.journal}</p>
      )}

      {paper.abstract && (
        <p className="text-sm text-gray-700 line-clamp-3 mb-4">
          {paper.abstract}
        </p>
      )}

      {paper.keywords && paper.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {paper.keywords.slice(0, 4).map((keyword, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {keyword}
            </span>
          ))}
          {paper.keywords.length > 4 && (
            <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-full">
              +{paper.keywords.length - 4} more
            </span>
          )}
        </div>
      )}

      {paper.doi && (
        <div className="text-xs text-gray-500">
          DOI: {paper.doi}
        </div>
      )}

      {averageRating && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium text-gray-700">{averageRating.innovation}</div>
              <div className="text-gray-500">创新性</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">{averageRating.methodology}</div>
              <div className="text-gray-500">方法论</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">{averageRating.practicality}</div>
              <div className="text-gray-500">实用性</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-700">{averageRating.overall}</div>
              <div className="text-gray-500">总体</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
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
            href={`/papers/${paper.id}`}
            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            查看详情 →
          </Link>
        </div>
      </div>
    </div>
  )
}

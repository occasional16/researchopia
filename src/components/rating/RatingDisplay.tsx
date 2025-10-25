'use client'

import { useState } from 'react'
import { Star, User, BarChart3, TrendingUp, Info } from 'lucide-react'
import type { Rating, User as UserType } from '@/lib/supabase'
import { calculateAverageRating } from '@/lib/database'
import RatingAnalyticsDisplay from './RatingAnalyticsDisplay'
import { UserDisplay } from '@/components/user'

interface RatingWithUser extends Rating {
  users?: UserType
}

interface RatingDisplayProps {
  ratings: RatingWithUser[]
  showAdvanced?: boolean
}

export default function RatingDisplay({ ratings, showAdvanced = true }: RatingDisplayProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'analytics' | 'individual'>('simple')
  const averageRating = calculateAverageRating(ratings)

  if (ratings.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">还没有评分</p>
        <p className="text-sm text-gray-400 mt-1">成为第一个评价这篇论文的人</p>
      </div>
    )
  }

  const renderStars = (score: number, size: 'sm' | 'md' = 'sm') => {
    const sizes = { sm: 16, md: 20 }
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={sizes[size]}
            className={
              star <= score
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">{score}</span>
      </div>
    )
  }

  const renderSimpleView = () => (
    <div className="space-y-6">
      {/* Average Rating Summary */}
      {averageRating && (
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            平均评分 ({averageRating.count} 个评分)
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {averageRating.innovation}
              </div>
              <div className="text-sm text-gray-600 mb-2">创新性</div>
              {renderStars(Math.round(averageRating.innovation))}
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {averageRating.methodology}
              </div>
              <div className="text-sm text-gray-600 mb-2">方法论</div>
              {renderStars(Math.round(averageRating.methodology))}
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {averageRating.practicality}
              </div>
              <div className="text-sm text-gray-600 mb-2">实用性</div>
              {renderStars(Math.round(averageRating.practicality))}
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {averageRating.overall}
              </div>
              <div className="text-sm text-gray-600 mb-2">总体</div>
              {renderStars(Math.round(averageRating.overall))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderIndividualView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        用户评分 ({ratings.length})
      </h3>
      
      <div className="space-y-4">
        {ratings.map((rating) => (
          <div key={rating.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <UserDisplay
                username={rating.users?.username || 'anonymous'}
                avatarUrl={rating.users?.avatar_url}
                isAnonymous={rating.is_anonymous || !rating.show_username}
                avatarSize="sm"
                showHoverCard={!rating.is_anonymous && rating.show_username}
              />
              <span className="text-sm text-gray-500">
                {new Date(rating.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">创新性</div>
                {renderStars(rating.innovation_score)}
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">方法论</div>
                {renderStars(rating.methodology_score)}
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">实用性</div>
                {renderStars(rating.practicality_score)}
              </div>
              
              <div>
                <div className="text-sm text-gray-600 mb-1">总体</div>
                {renderStars(rating.overall_score)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* View Mode Selector */}
      {showAdvanced && (
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('simple')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'simple' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Info className="h-4 w-4" />
            <span>概览</span>
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'analytics' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>深度分析</span>
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'individual' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>详细列表</span>
          </button>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'simple' && renderSimpleView()}
      {viewMode === 'analytics' && <RatingAnalyticsDisplay ratings={ratings} showAdvanced={true} />}
      {viewMode === 'individual' && renderIndividualView()}
    </div>
  )
}

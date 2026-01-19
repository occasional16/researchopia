'use client'

import { useState } from 'react'
import { Star, User, BarChart3, TrendingUp, Info, Award, AlertTriangle, Users } from 'lucide-react'
import { UserDisplay } from '@/components/user'

export type TargetType = 'paper' | 'webpage'

interface RatingData {
  id: string
  dimension1: number | null
  dimension2: number | null
  dimension3: number | null
  overallScore: number
  isAnonymous: boolean
  showUsername?: boolean
  createdAt: string
  user?: {
    id: string
    username: string | null
    avatarUrl: string | null
  }
}

interface DimensionConfig {
  key: string
  label: string
}

export interface RatingDisplayProps {
  targetType: TargetType
  ratings: RatingData[]
  dimensions: DimensionConfig[]
  showAdvanced?: boolean
  className?: string
  currentUserId?: string | null
}

// Dimension presets
export const PAPER_DISPLAY_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '创新性' },
  { key: 'dimension2', label: '方法论' },
  { key: 'dimension3', label: '实用性' },
]

export const WEBPAGE_DISPLAY_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '内容质量' },
  { key: 'dimension2', label: '实用性' },
  { key: 'dimension3', label: '准确性' },
]

/**
 * Unified rating display component with 3 view modes:
 * - simple: Overview of average ratings
 * - analytics: Deep analysis with distribution and statistics
 * - individual: Detailed list of each user's rating
 */
export default function RatingDisplay({
  targetType,
  ratings,
  dimensions,
  showAdvanced = true,
  className = '',
  currentUserId = null,
}: RatingDisplayProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'analytics' | 'individual'>('simple')

  if (ratings.length === 0) {
    return (
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center ${className}`}>
        <Star className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">还没有评分</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          成为第一个评价{targetType === 'paper' ? '这篇论文' : '这个网页'}的人
        </p>
      </div>
    )
  }

  // Calculate averages and analytics
  const averages = calculateAverages(ratings)
  const analytics = calculateAnalytics(ratings, dimensions)

  // Helper: Get star fill state for 10-point scale
  const getStarFill = (starIndex: number, score: number): 'empty' | 'half' | 'full' => {
    const starScore = starIndex * 2
    if (score >= starScore) return 'full'
    if (score >= starScore - 1) return 'half'
    return 'empty'
  }

  const renderStars = (score: number, size: 'sm' | 'md' = 'sm') => {
    const sizes = { sm: 16, md: 20 }
    return (
      <div className="flex items-center justify-center">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fill = getStarFill(starIndex, score)
          return (
            <div key={starIndex} className="relative">
              <Star
                size={sizes[size]}
                className="text-gray-300 dark:text-gray-600"
              />
              {fill !== 'empty' && (
                <div 
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: fill === 'half' ? '50%' : '100%' }}
                >
                  <Star
                    size={sizes[size]}
                    className="text-yellow-400 fill-yellow-400"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Simple overview view
  const renderSimpleView = () => (
    <div className="space-y-3">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          平均评分 ({averages.count} 个评分)
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dimensions.map((dim, index) => {
            const key = `dimension${index + 1}` as keyof typeof averages
            const value = averages[key] as number
            return (
              <div key={dim.key} className="text-center">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                  {value.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{dim.label}</div>
                {renderStars(Math.round(value))}
              </div>
            )
          })}
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-0.5">
              {averages.overall.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">总体</div>
            {renderStars(Math.round(averages.overall))}
          </div>
        </div>
      </div>
    </div>
  )

  // Analytics view with distribution and statistics
  const renderAnalyticsView = () => (
    <div className="space-y-3">
      {/* Overall Rating Summary */}
      <div className="text-center p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
        <div className="flex items-center justify-center space-x-2 mb-1">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {averages.overall.toFixed(1)}
          </span>
          <div className="flex">{renderStars(averages.overall, 'md')}</div>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">{analytics.count} 个评分</p>
        
        {analytics.qualityScore > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-center space-x-1.5">
              <Award className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                质量评分: {Math.round(analytics.qualityScore)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {dimensions.map((dim, index) => {
          const key = `dimension${index + 1}` as keyof typeof averages
          const value = averages[key] as number
          return (
            <div key={dim.key} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
              <h4 className="font-medium text-xs text-gray-900 dark:text-gray-100 mb-1.5">{dim.label}</h4>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value.toFixed(1)}</span>
                <div className="flex">{renderStars(value)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Distribution Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
        <h4 className="font-medium text-xs text-gray-900 dark:text-gray-100 mb-3 flex items-center">
          <Users className="h-5 w-5 mr-2 text-purple-500" />
          评分分布
        </h4>
        
        <div className="space-y-2">
          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(score => {
            const count = analytics.distribution[score] || 0
            const percentage = analytics.count > 0 ? (count / analytics.count) * 100 : 0
            
            return (
              <div key={score} className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 w-16">
                  <span className="text-sm font-medium w-6 text-right text-gray-700 dark:text-gray-300">{score}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">分</span>
                </div>
                
                <div className="flex-1 relative">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>总计 {analytics.count} 个评分</span>
            <span>平均 {averages.overall.toFixed(1)} 分</span>
          </div>
        </div>
      </div>

      {/* Quality Warning */}
      {analytics.qualityScore < 30 && analytics.count < 5 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h5 className="font-medium text-amber-800 dark:text-amber-300">评分数据有限</h5>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                目前评分数量较少，可能不能完全反映{targetType === 'paper' ? '论文' : '网页'}质量。建议查看更多同行评价。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Individual ratings view
  const renderIndividualView = () => (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        用户评分 ({ratings.length})
      </h3>
      
      <div className="space-y-4">
        {ratings.map((rating) => {
          const isAnonymousDisplay = rating.isAnonymous || !rating.showUsername
          const isOwnRating = currentUserId && rating.user?.id === currentUserId
          
          return (
            <div key={rating.id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserDisplay
                    username={rating.user?.username || 'anonymous'}
                    avatarUrl={rating.user?.avatarUrl}
                    isAnonymous={isAnonymousDisplay}
                    avatarSize="sm"
                    showHoverCard={!rating.isAnonymous && rating.showUsername}
                  />
                  {/* Show "(你)" badge for user's own anonymous ratings */}
                  {isAnonymousDisplay && isOwnRating && (
                    <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">(你)</span>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(rating.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dimensions.map((dim, index) => {
                  const key = `dimension${index + 1}` as keyof RatingData
                  const value = rating[key] as number | null
                  return (
                    <div key={dim.key}>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{dim.label}</div>
                      {renderStars(value || 0)}
                    </div>
                  )
                })}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">总体</div>
                  {renderStars(rating.overallScore || 0)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Mode Selector */}
      {showAdvanced && (
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('simple')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'simple' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Info className="h-4 w-4" />
            <span>概览</span>
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'analytics' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>深度分析</span>
          </button>
          <button
            onClick={() => setViewMode('individual')}
            className={`flex items-center space-x-2 flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'individual' 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>详细列表</span>
          </button>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'simple' && renderSimpleView()}
      {viewMode === 'analytics' && renderAnalyticsView()}
      {viewMode === 'individual' && renderIndividualView()}
    </div>
  )
}

// Helper: Calculate averages
function calculateAverages(ratings: RatingData[]) {
  const totals = ratings.reduce(
    (acc, r) => ({
      dimension1: acc.dimension1 + (r.dimension1 || 0),
      dimension2: acc.dimension2 + (r.dimension2 || 0),
      dimension3: acc.dimension3 + (r.dimension3 || 0),
      overall: acc.overall + r.overallScore,
    }),
    { dimension1: 0, dimension2: 0, dimension3: 0, overall: 0 }
  )

  const count = ratings.length
  return {
    dimension1: count > 0 ? totals.dimension1 / count : 0,
    dimension2: count > 0 ? totals.dimension2 / count : 0,
    dimension3: count > 0 ? totals.dimension3 / count : 0,
    overall: count > 0 ? totals.overall / count : 0,
    count,
  }
}

// Helper: Calculate analytics data (distribution, quality score, etc.)
function calculateAnalytics(ratings: RatingData[], dimensions: DimensionConfig[]) {
  const count = ratings.length
  
  // Calculate distribution (1-10 scores)
  const distribution: Record<number, number> = {}
  for (let i = 1; i <= 10; i++) {
    distribution[i] = 0
  }
  
  ratings.forEach(r => {
    const score = Math.round(r.overallScore)
    if (score >= 1 && score <= 10) {
      distribution[score]++
    }
  })
  
  // Quality score based on rating count and variance
  // More ratings and lower variance = higher quality
  const avgOverall = count > 0 
    ? ratings.reduce((sum, r) => sum + r.overallScore, 0) / count 
    : 0
  
  // Calculate variance
  const variance = count > 1
    ? ratings.reduce((sum, r) => sum + Math.pow(r.overallScore - avgOverall, 2), 0) / (count - 1)
    : 0
  const stdDev = Math.sqrt(variance)
  
  // Quality score: higher with more ratings and lower std dev
  // Base score: min(count * 10, 50) + consistency bonus (50 - stdDev * 10)
  const baseScore = Math.min(count * 10, 50)
  const consistencyBonus = Math.max(0, 50 - stdDev * 10)
  const qualityScore = Math.min(100, baseScore + consistencyBonus)
  
  return {
    count,
    distribution,
    qualityScore,
    stdDev,
  }
}

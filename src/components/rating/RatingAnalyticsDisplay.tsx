'use client'

import { useState } from 'react'
import { Star, TrendingUp, Users, Award, AlertTriangle, Info } from 'lucide-react'
import type { Rating } from '@/lib/supabase'
import { calculateAdvancedRatingAnalytics, type RatingAnalytics, type UserRatingWeight } from '@/lib/ratingAlgorithms'

interface RatingAnalyticsDisplayProps {
  ratings: Rating[]
  userWeights?: UserRatingWeight[]
  showAdvanced?: boolean
}

export default function RatingAnalyticsDisplay({ 
  ratings, 
  userWeights,
  showAdvanced = false 
}: RatingAnalyticsDisplayProps) {
  const [viewMode, setViewMode] = useState<'basic' | 'advanced' | 'distribution'>('basic')
  
  if (ratings.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Star className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">还没有评分</p>
        <p className="text-sm text-gray-400 mt-1">成为第一个评价这篇论文的人</p>
      </div>
    )
  }

  const analytics = calculateAdvancedRatingAnalytics(ratings, userWeights)

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' }
    const stars = []
    
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.floor(rating)
      const halfFilled = i === Math.ceil(rating) && rating % 1 !== 0
      
      stars.push(
        <Star
          key={i}
          className={`${sizes[size]} ${
            filled 
              ? 'text-yellow-400 fill-current' 
              : halfFilled 
                ? 'text-yellow-400 fill-yellow-200'
                : 'text-gray-300'
          }`}
        />
      )
    }
    return stars
  }

  const renderBasicView = () => (
    <div className="space-y-4">
      {/* Overall Rating */}
      <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <span className="text-3xl font-bold text-gray-900">
            {analytics.average.overall.toFixed(1)}
          </span>
          <div className="flex">{renderStars(analytics.average.overall, 'lg')}</div>
        </div>
        <p className="text-sm text-gray-600">{analytics.count} 个评分</p>
        
        {analytics.qualityScore > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-center space-x-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-gray-700">
                质量评分: {Math.round(analytics.qualityScore)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium text-gray-900 mb-2">创新性</h4>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold">{analytics.average.innovation}</span>
            <div className="flex">{renderStars(analytics.average.innovation)}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium text-gray-900 mb-2">方法论</h4>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold">{analytics.average.methodology}</span>
            <div className="flex">{renderStars(analytics.average.methodology)}</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium text-gray-900 mb-2">实用性</h4>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold">{analytics.average.practicality}</span>
            <div className="flex">{renderStars(analytics.average.practicality)}</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAdvancedView = () => (
    <div className="space-y-6">
      {/* Weighted vs Simple Comparison */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
          加权评分对比
        </h4>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">简单平均</span>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{analytics.average.overall.toFixed(1)}</span>
              <div className="flex">{renderStars(analytics.average.overall, 'sm')}</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">专家加权</span>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">{analytics.weighted.overall.toFixed(1)}</span>
              <div className="flex">{renderStars(analytics.weighted.overall, 'sm')}</div>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">评分可信度</span>
              <span className="font-medium text-green-600">
                {(analytics.confidence.level * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Interval */}
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Info className="h-5 w-5 mr-2 text-green-500" />
          95% 置信区间
        </h4>
        
        <div className="relative">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span>5</span>
          </div>
          
          <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-blue-500 rounded-full"
              style={{
                left: `${((analytics.confidence.interval.lower - 1) / 4) * 100}%`,
                width: `${((analytics.confidence.interval.upper - analytics.confidence.interval.lower) / 4) * 100}%`
              }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{analytics.confidence.interval.lower.toFixed(1)}</span>
            <span>{analytics.confidence.interval.upper.toFixed(1)}</span>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mt-2">
          真实评分有95%的概率在此区间内
        </p>
      </div>

      {/* Quality Indicators */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h5 className="font-medium text-gray-900 mb-2">数据质量</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">评分数量</span>
              <span className="font-medium">{analytics.count}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">质量评分</span>
              <span className="font-medium">{Math.round(analytics.qualityScore)}%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <h5 className="font-medium text-gray-900 mb-2">统计信息</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">可信度</span>
              <span className="font-medium">{(analytics.confidence.level * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">区间宽度</span>
              <span className="font-medium">
                {(analytics.confidence.interval.upper - analytics.confidence.interval.lower).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDistributionView = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
          <Users className="h-5 w-5 mr-2 text-purple-500" />
          评分分布
        </h4>
        
        <div className="space-y-3">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = analytics.distribution[stars] || 0
            const percentage = analytics.count > 0 ? (count / analytics.count) * 100 : 0
            
            return (
              <div key={stars} className="flex items-center space-x-3">
                <div className="flex items-center space-x-1 w-16">
                  <span className="text-sm font-medium">{stars}</span>
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                </div>
                
                <div className="flex-1 relative">
                  <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 w-16 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </div>
              </div>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between text-sm text-gray-600">
            <span>总计 {analytics.count} 个评分</span>
            <span>平均 {analytics.average.overall.toFixed(1)} 星</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* View Mode Selector */}
      {showAdvanced && (
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('basic')}
            className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'basic' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            基础视图
          </button>
          <button
            onClick={() => setViewMode('advanced')}
            className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'advanced' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            高级分析
          </button>
          <button
            onClick={() => setViewMode('distribution')}
            className={`flex-1 text-sm py-2 px-3 rounded-md transition-colors ${
              viewMode === 'distribution' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            分布图表
          </button>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'basic' && renderBasicView()}
      {viewMode === 'advanced' && renderAdvancedView()}
      {viewMode === 'distribution' && renderDistributionView()}

      {/* Quality Warning */}
      {analytics.qualityScore < 30 && analytics.count < 5 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h5 className="font-medium text-amber-800">评分数据有限</h5>
              <p className="text-sm text-amber-700 mt-1">
                目前评分数量较少，可能不能完全反映论文质量。建议查看更多同行评价。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

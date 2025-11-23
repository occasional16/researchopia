'use client'

import { useState, useEffect } from 'react'
import { Star, TrendingUp, Calendar, Book, Filter, Search } from 'lucide-react'
import type { Rating } from '@/lib/supabase'
import { calculateUserWeight, type UserRatingWeight } from '@/lib/ratingAlgorithms'

interface UserRatingHistoryProps {
  userId: string
  ratings: Rating[]
  papers?: any[] // Paper information for context
}

interface FilterOptions {
  timeRange: 'all' | '1m' | '3m' | '6m' | '1y'
  category: 'all' | 'innovation' | 'methodology' | 'practicality' | 'overall'
  sortBy: 'date' | 'rating' | 'paper'
  sortOrder: 'asc' | 'desc'
}

export default function UserRatingHistory({ userId, ratings, papers = [] }: UserRatingHistoryProps) {
  const [filteredRatings, setFilteredRatings] = useState<Rating[]>(ratings)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: 'all',
    category: 'all',
    sortBy: 'date',
    sortOrder: 'desc'
  })
  const [userWeight, setUserWeight] = useState<UserRatingWeight | null>(null)

  // Create paper lookup map
  const paperMap = new Map(papers.map(p => [p.id, p]))

  useEffect(() => {
    // Calculate user weight and filter ratings
    if (ratings.length > 0) {
      // For user weight calculation, we need user object - using mock for now
      const mockUser = { 
        id: userId, 
        email: '', 
        username: 'user', 
        role: 'user' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      const weight = calculateUserWeight(mockUser, ratings)
      setUserWeight(weight)
    }

    // Apply filters
    let filtered = [...ratings]

    // Time range filter
    if (filters.timeRange !== 'all') {
      const now = new Date()
      const timeRanges = {
        '1m': 30 * 24 * 60 * 60 * 1000,
        '3m': 90 * 24 * 60 * 60 * 1000,
        '6m': 180 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      }
      const cutoff = new Date(now.getTime() - timeRanges[filters.timeRange])
      filtered = filtered.filter(r => new Date(r.created_at) >= cutoff)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(rating => {
        const paper = paperMap.get(rating.paper_id)
        return paper && (
          paper.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          paper.authors?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'rating':
          const categoryKey = filters.category === 'all' ? 'overall' : filters.category
          const scoreKey = `${categoryKey}_score` as keyof Rating
          comparison = (a[scoreKey] as number) - (b[scoreKey] as number)
          break
        case 'paper':
          const paperA = paperMap.get(a.paper_id)
          const paperB = paperMap.get(b.paper_id)
          comparison = (paperA?.title || '').localeCompare(paperB?.title || '')
          break
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison
    })

    setFilteredRatings(filtered)
  }, [ratings, filters, searchTerm, userId, paperMap])

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5' }
    const stars = []
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`${sizes[size]} ${
            i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
        />
      )
    }
    return stars
  }

  const calculateStats = () => {
    if (filteredRatings.length === 0) return null

    const totalRatings = filteredRatings.length
    const averageOverall = filteredRatings.reduce((sum, r) => sum + (r.overall_score || 0), 0) / totalRatings
    const averageInnovation = filteredRatings.reduce((sum, r) => sum + (r.innovation_score || 0), 0) / totalRatings
    const averageMethodology = filteredRatings.reduce((sum, r) => sum + (r.methodology_score || 0), 0) / totalRatings
    const averagePracticality = filteredRatings.reduce((sum, r) => sum + (r.practicality_score || 0), 0) / totalRatings

    const ratingDistribution = filteredRatings.reduce((acc, r) => {
      const rounded = Math.round(r.overall_score || 0)
      acc[rounded] = (acc[rounded] || 0) + 1
      return acc
    }, {} as { [key: number]: number })

    return {
      totalRatings,
      averageOverall,
      averageInnovation,
      averageMethodology,
      averagePracticality,
      ratingDistribution
    }
  }

  const stats = calculateStats()

  return (
    <div className="space-y-6">
      {/* User Rating Profile */}
      {userWeight && stats && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">评分档案</h3>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-blue-700">
                权重系数: {userWeight.weight.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalRatings}</div>
              <div className="text-sm text-gray-600">总评分数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.averageOverall.toFixed(1)}</div>
              <div className="text-sm text-gray-600">平均评分</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {((userWeight.factors.consistency + userWeight.factors.experience) * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">一致性</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(userWeight.factors.experience * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-600">经验等级</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">创新性</div>
              <div className="flex items-center justify-center space-x-1">
                <span className="font-semibold">{stats.averageInnovation.toFixed(1)}</span>
                <div className="flex">{renderStars(stats.averageInnovation)}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">方法论</div>
              <div className="flex items-center justify-center space-x-1">
                <span className="font-semibold">{stats.averageMethodology.toFixed(1)}</span>
                <div className="flex">{renderStars(stats.averageMethodology)}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">实用性</div>
              <div className="flex items-center justify-center space-x-1">
                <span className="font-semibold">{stats.averagePracticality.toFixed(1)}</span>
                <div className="flex">{renderStars(stats.averagePracticality)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索论文标题或作者..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex space-x-3">
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value as FilterOptions['timeRange'] }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">全部时间</option>
              <option value="1m">最近1个月</option>
              <option value="3m">最近3个月</option>
              <option value="6m">最近6个月</option>
              <option value="1y">最近1年</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as FilterOptions['sortBy'] }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">按时间</option>
              <option value="rating">按评分</option>
              <option value="paper">按论文</option>
            </select>

            <button
              onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc' }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {filters.sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Rating History List */}
      <div className="space-y-4">
        {filteredRatings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Book className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>没有找到符合条件的评分记录</p>
          </div>
        ) : (
          filteredRatings.map((rating) => {
            const paper = paperMap.get(rating.paper_id)
            return (
              <div key={rating.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-2">
                      {paper?.title || '未知论文'}
                    </h4>
                    {paper?.authors && (
                      <p className="text-sm text-gray-600 mb-3">{paper.authors}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">创新性</div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{rating.innovation_score || 0}</span>
                          <div className="flex">{renderStars(rating.innovation_score || 0)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">方法论</div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{rating.methodology_score || 0}</span>
                          <div className="flex">{renderStars(rating.methodology_score || 0)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">实用性</div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{rating.practicality_score || 0}</span>
                          <div className="flex">{renderStars(rating.practicality_score || 0)}</div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">总体评价</div>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{rating.overall_score || 0}</span>
                          <div className="flex">{renderStars(rating.overall_score || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-4 text-right">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(rating.created_at).toLocaleDateString('zh-CN')}
                    </div>
                    {rating.updated_at !== rating.created_at && (
                      <div className="text-xs text-gray-400 mt-1">
                        已修改
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination (if needed for large datasets) */}
      {filteredRatings.length > 20 && (
        <div className="flex justify-center">
          <div className="text-sm text-gray-500">
            显示 {Math.min(20, filteredRatings.length)} / {filteredRatings.length} 条记录
          </div>
        </div>
      )}
    </div>
  )
}

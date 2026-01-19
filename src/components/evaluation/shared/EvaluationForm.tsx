'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import StarRating from './StarRating'

// ============================================================================
// Types
// ============================================================================

export type TargetType = 'paper' | 'webpage'

export interface DimensionConfig {
  key: string
  label: string
  description: string
}

export interface RatingScores {
  dimension1: number
  dimension2: number
  dimension3: number
  overall: number
}

export interface EvaluationFormProps {
  targetType: TargetType
  targetId: string
  dimensions: DimensionConfig[]
  /** For webpage, optionally provide URL for auto-creation */
  url?: string
  title?: string
  onRatingSubmitted?: (rating: any) => void
  className?: string
}

// ============================================================================
// Dimension Presets (now with 1-10 scale descriptions)
// ============================================================================

export const PAPER_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '创新性', description: '论文的创新程度和原创性' },
  { key: 'dimension2', label: '方法论', description: '研究方法的科学性和严谨性' },
  { key: 'dimension3', label: '实用性', description: '研究成果的实际应用价值' },
]

export const WEBPAGE_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '内容质量', description: '内容的深度和完整性' },
  { key: 'dimension2', label: '实用性', description: '内容的实际应用价值' },
  { key: 'dimension3', label: '准确性', description: '信息的准确性和可靠性' },
]

// ============================================================================
// Component
// ============================================================================

/**
 * Unified evaluation form supporting both papers and webpages
 * Uses v2 unified API endpoints
 */
export default function EvaluationForm({
  targetType,
  targetId,
  dimensions,
  url,
  title,
  onRatingSubmitted,
  className = '',
}: EvaluationFormProps) {
  const { user, getAccessToken } = useAuth()
  
  const [scores, setScores] = useState<RatingScores>({
    dimension1: 0,
    dimension2: 0,
    dimension3: 0,
    overall: 0,
  })
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [showUsername, setShowUsername] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingRatingId, setExistingRatingId] = useState<string | null>(null)

  // Reset state and load existing rating when user or targetId changes
  useEffect(() => {
    // Reset state first
    setExistingRatingId(null)
    setScores({
      dimension1: 0,
      dimension2: 0,
      dimension3: 0,
      overall: 0,
    })
    setIsAnonymous(false)
    setShowUsername(true)
    setError('')
    
    // Load user's existing rating if logged in
    if (user && targetId) {
      loadExistingRating()
    }
  }, [user?.id, targetId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExistingRating = async () => {
    try {
      const token = await getAccessToken()
      
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(
        `/api/v2/ratings?targetType=${targetType}&targetId=${targetId}&includeUserRating=true&_t=${Date.now()}`,
        { headers, cache: 'no-store' }
      )
      if (!response.ok) return

      const data = await response.json()
      
      if (data.userRating) {
        setExistingRatingId(data.userRating.id)
        setScores({
          dimension1: data.userRating.dimension1 || 0,
          dimension2: data.userRating.dimension2 || 0,
          dimension3: data.userRating.dimension3 || 0,
          overall: data.userRating.overallScore || 0,
        })
        setIsAnonymous(data.userRating.isAnonymous || false)
        setShowUsername(data.userRating.showUsername !== false)
      }
    } catch (err) {
      console.log('Failed to load existing rating:', err)
    }
  }

  const handleScoreChange = (key: keyof RatingScores, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError('请先登录')
      return
    }

    if (scores.overall === 0) {
      setError('请至少设置总体评价')
      return
    }

    setLoading(true)
    setError('')

    try {
      const body: any = {
        targetType,
        targetId,
        scores: {
          dimension1: scores.dimension1 || null,
          dimension2: scores.dimension2 || null,
          dimension3: scores.dimension3 || null,
          overall: scores.overall,
        },
        isAnonymous,
        showUsername: isAnonymous ? false : showUsername,
      }

      // Include URL and title for webpage (allows auto-creation)
      if (targetType === 'webpage' && url) {
        body.url = url
        body.title = title
      }

      const token = await getAccessToken()
      if (!token) {
        setError('认证失败，请重新登录')
        setLoading(false)
        return
      }

      const response = await fetch('/api/v2/ratings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '提交失败')
      }

      const data = await response.json()
      setExistingRatingId(data.rating.id)
      onRatingSubmitted?.(data.rating)
    } catch (err: any) {
      setError(err.message || '提交评分时出错')
    } finally {
      setLoading(false)
    }
  }

  const triggerAuthModal = () => {
    const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
    window.dispatchEvent(event)
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {existingRatingId ? '修改评分' : targetType === 'paper' ? '为这篇论文评分' : '为这个网页评分'}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        {targetType === 'paper' 
          ? '请基于您的专业知识客观评价此论文'
          : '请客观评价此网页内容'}
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-3 py-2 rounded text-xs mb-3">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Dimension ratings */}
        {dimensions.map((dim, index) => (
          <StarRating
            key={dim.key}
            value={scores[`dimension${index + 1}` as keyof RatingScores]}
            onChange={(v) => handleScoreChange(`dimension${index + 1}` as keyof RatingScores, v)}
            label={dim.label}
            description={dim.description}
            compact
          />
        ))}

        {/* Overall rating */}
        <StarRating
          value={scores.overall}
          onChange={(v) => handleScoreChange('overall', v)}
          label="总体评价"
          description={targetType === 'paper' ? '对论文的整体评价' : '对网页的整体评价'}
          compact
        />

        {/* Anonymous option - simplified to single checkbox */}
        {user && (
          <div className="pt-2 border-t dark:border-gray-700">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">匿名评分</span>
            </label>
          </div>
        )}

        {/* Submit section */}
        <div className="pt-2 border-t dark:border-gray-700">
          {!user ? (
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">请登录后提交评分</p>
              <button
                type="button"
                onClick={triggerAuthModal}
                className="w-full bg-blue-600 dark:bg-blue-700 text-white py-1.5 px-3 rounded text-xs hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                登录以提交评分
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || scores.overall === 0}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white py-1.5 px-3 rounded text-xs hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? '提交中...' : existingRatingId ? '更新评分' : '提交评分'}
            </button>
          )}
        </div>

        <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            <strong>免责声明：</strong>评分仅代表个人观点，不构成官方评价。
          </p>
        </div>
      </form>
    </div>
  )
}

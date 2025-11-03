'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { createOrUpdateRating, getUserRating } from '@/lib/database'
import type { Rating } from '@/lib/supabase'

interface RatingFormProps {
  paperId: string
  onRatingSubmitted?: (rating: Rating) => void
}

interface RatingScores {
  innovation_score: number
  methodology_score: number
  practicality_score: number
  overall_score: number
}

export default function RatingForm({ paperId, onRatingSubmitted }: RatingFormProps) {
  const { user } = useAuth()
  const [scores, setScores] = useState<RatingScores>({
    innovation_score: 0,
    methodology_score: 0,
    practicality_score: 0,
    overall_score: 0,
  })
  const [isAnonymous, setIsAnonymous] = useState(false) // 🆕 匿名选项
  const [showUsername, setShowUsername] = useState(true) // 🆕 显示用户名选项
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingRating, setExistingRating] = useState<Rating | null>(null)

  useEffect(() => {
    if (user) {
      loadExistingRating()
    }
  }, [user, paperId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExistingRating = async () => {
    if (!user) return

    try {
      const rating = await getUserRating(paperId, user.id)
      if (rating) {
        setExistingRating(rating)
        setScores({
          innovation_score: rating.innovation_score,
          methodology_score: rating.methodology_score,
          practicality_score: rating.practicality_score,
          overall_score: rating.overall_score,
        })
        // 🆕 加载匿名设置
        setIsAnonymous(rating.is_anonymous || false)
        setShowUsername(rating.show_username !== false) // 默认true
      }
    } catch (error) {
      // 静默处理错误，不显示给用户
      console.log('No existing rating found or error loading rating')
    }
  }

  const handleScoreChange = (category: keyof RatingScores, score: number) => {
    setScores(prev => ({ ...prev, [category]: score }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      setError('请先登录')
      return
    }

    if (Object.values(scores).some(score => score === 0)) {
      setError('请为所有维度评分')
      return
    }

    setLoading(true)
    setError('')

    try {
      const ratingData = {
        user_id: user.id,
        paper_id: paperId,
        ...scores,
        is_anonymous: isAnonymous, // 🆕 包含匿名设置
        show_username: isAnonymous ? false : showUsername, // 🆕 匿名时强制不显示用户名
      }

      const rating = await createOrUpdateRating(ratingData)
      setExistingRating(rating)
      onRatingSubmitted?.(rating)
    } catch (err: any) {
      setError(err.message || '提交评分时出错')
    } finally {
      setLoading(false)
    }
  }

  const [hoveredStars, setHoveredStars] = useState<{ [key: string]: number }>({})

  const renderStarRating = (
    category: keyof RatingScores,
    label: string,
    description: string
  ) => (
    <div className="space-y-2">
      <div>
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{label}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isHovered = hoveredStars[category] >= star
          const isFilled = !hoveredStars[category] && star <= scores[category]
          
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleScoreChange(category, star)}
              onMouseEnter={() => setHoveredStars(prev => ({ ...prev, [category]: star }))}
              onMouseLeave={() => setHoveredStars(prev => ({ ...prev, [category]: 0 }))}
              className="p-1 transition-all duration-150 ease-out hover:scale-125 active:scale-95"
            >
              <Star
                size={24}
                className={`transition-colors duration-150 ${
                  isHovered || isFilled
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            </button>
          )
        })}
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400 font-medium min-w-[50px]">
          {scores[category] > 0 ? `${scores[category]}/5` : '未评分'}
        </span>
      </div>
    </div>
  )

  // Allow viewing the form without login, but require login for submission

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {existingRating ? '修改评分' : '为这篇论文评分'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        请基于您的专业知识客观评价此论文。您的评价将帮助其他学者更好地理解这项研究。
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderStarRating(
          'innovation_score',
          '创新性',
          '论文的创新程度和原创性'
        )}

        {renderStarRating(
          'methodology_score',
          '方法论',
          '研究方法的科学性和严谨性'
        )}

        {renderStarRating(
          'practicality_score',
          '实用性',
          '研究成果的实际应用价值'
        )}

        {renderStarRating(
          'overall_score',
          '总体评价',
          '对论文的整体评价'
        )}

        {/* 🆕 匿名选项 */}
        {user && (
          <div className="pt-4 border-t dark:border-gray-700 space-y-3">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isAnonymous" className="flex-1 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-100">匿名评分</span>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                  评分将不会显示您的用户名,显示为"匿名学者"
                </p>
              </label>
            </div>

            {!isAnonymous && (
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="showUsername"
                  checked={showUsername}
                  onChange={(e) => setShowUsername(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="showUsername" className="flex-1 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">显示用户名</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                    在评分历史中显示您的用户名(您可以随时修改此设置)
                  </p>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t dark:border-gray-700">
          {!user ? (
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">请登录后提交评分</p>
              <button
                type="button"
                onClick={() => {
                  // This will be handled by the parent component to show auth modal
                  const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
                  window.dispatchEvent(event)
                }}
                className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                登录以提交评分
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || Object.values(scores).some(score => score === 0)}
              className="w-full bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-out hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? '提交中...' : existingRating ? '更新评分' : '提交评分'}
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>免责声明：</strong>评分和评论仅代表个人学术观点，不构成对论文质量的官方评价。
            请尊重学术讨论的客观性和建设性原则。
          </p>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export type TargetType = 'paper' | 'webpage'

interface CommentFormProps {
  targetType: TargetType
  targetId: string
  /** For webpage, optionally provide URL for auto-creation */
  url?: string
  title?: string
  parentId?: string
  onCommentAdded?: (comment: any) => void
  onCancel?: () => void
  placeholder?: string
  className?: string
  compact?: boolean
}

/**
 * Unified comment form supporting both papers and webpages
 * Uses v2 unified API endpoints
 */
export default function CommentForm({
  targetType,
  targetId,
  url,
  title,
  parentId,
  onCommentAdded,
  onCancel,
  placeholder,
  className = '',
  compact = false,
}: CommentFormProps) {
  const { user, getAccessToken } = useAuth()
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      setError('请先登录')
      return
    }

    if (!content.trim()) {
      setError('请输入评论内容')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Get access token for authentication
      const token = await getAccessToken()
      if (!token) {
        throw new Error('请先登录')
      }

      const body: any = {
        targetType,
        targetId,
        content: content.trim(),
        isAnonymous,
      }

      if (parentId) body.parentId = parentId

      // Include URL and title for webpage (allows auto-creation)
      if (targetType === 'webpage' && url) {
        body.url = url
        body.title = title
      }

      const response = await fetch('/api/v2/comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '发表失败')
      }

      const data = await response.json()
      setContent('')
      setIsAnonymous(false)
      setSuccess(true)
      onCommentAdded?.(data.comment)

      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || '发表评论时出错')
    } finally {
      setLoading(false)
    }
  }

  const triggerAuthModal = () => {
    const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
    window.dispatchEvent(event)
  }

  const defaultPlaceholder = parentId
    ? '写下您的回复...'
    : targetType === 'paper'
    ? '分享您对这篇论文的看法...'
    : '分享您对这个网页的看法...'

  return (
    <div className={`${compact ? '' : 'bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-6'} ${className}`}>
      {!compact && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {parentId ? '发表回复' : '发表评论'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            欢迎分享您的见解和建设性意见。
          </p>
        </>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-4 text-sm">
          {parentId ? '回复发表成功！' : '评论发表成功！'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={compact ? 3 : 4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            placeholder={placeholder || defaultPlaceholder}
            maxLength={5000}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {content.length}/5000
            </span>
          </div>
        </div>

        {/* Anonymous option */}
        {user && (
          <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-3">
            <input
              type="checkbox"
              id={`anonymous-${parentId || 'main'}`}
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="h-4 w-4 text-blue-600 dark:text-blue-500 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor={`anonymous-${parentId || 'main'}`} className="text-sm text-gray-700 dark:text-gray-300">
              匿名发表
            </label>
          </div>
        )}

        {/* Submit buttons */}
        <div className="flex items-center gap-3">
          {!user ? (
            <button
              type="button"
              onClick={triggerAuthModal}
              className="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
            >
              登录以发表评论
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {loading ? '发表中...' : parentId ? '发表回复' : '发表评论'}
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors text-sm"
                >
                  取消
                </button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { addComment } from '@/lib/comments'
import type { Comment } from '@/lib/supabase'

interface CommentFormProps {
  paperId: string
  onCommentAdded?: () => void
}

export default function CommentForm({ paperId, onCommentAdded }: CommentFormProps) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false) // 🆕 匿名选项
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
      const result = await addComment(paperId, user.id, content.trim(), isAnonymous) // 🆕 传递匿名参数
      if (result) {
        setContent('')
        setIsAnonymous(false) // 🆕 重置匿名选项
        setSuccess(true)
        onCommentAdded?.()
        // 3秒后隐藏成功提示
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('发表评论失败，请重试')
      }
    } catch (err: any) {
      setError(err.message || '发表评论时出错')
    } finally {
      setLoading(false)
    }
  }

  // Allow viewing the form without login, but require login for submission

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">发表评论</h3>
      <p className="text-sm text-gray-600 mb-4">
        欢迎分享您的学术见解和建设性意见，促进学术交流与讨论。
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          评论发表成功！
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="分享您对这篇论文的看法..."
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-500">
              {content.length}/1000
            </span>
          </div>
        </div>

        {/* 🆕 匿名选项 */}
        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-md p-3">
          <input
            type="checkbox"
            id="anonymous-comment"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label 
            htmlFor="anonymous-comment" 
            className="text-sm text-gray-700 cursor-pointer select-none flex items-center"
          >
            <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            匿名发表
            {isAnonymous && (
              <span className="ml-2 text-xs text-blue-600 font-medium">
                （将显示为"匿名用户"）
              </span>
            )}
          </label>
          <div className="ml-auto">
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              title="匿名评论说明"
              onClick={() => {
                alert(
                  '匿名评论说明：\n\n' +
                  '✓ 您的用户名和头像不会显示\n' +
                  '✓ 系统仍会记录您的身份用于管理\n' +
                  '✓ 匿名不等于可以发表不当言论\n' +
                  '✓ 管理员可以追溯违规评论\n\n' +
                  '适用场景：\n' +
                  '• 评论权威学者的论文\n' +
                  '• 提出批评性观点\n' +
                  '• 保护学术讨论隐私'
                )
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          {!user ? (
            <button
              type="button"
              onClick={() => {
                const event = new CustomEvent('showAuthModal', { detail: { mode: 'login' } })
                window.dispatchEvent(event)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              登录以发表评论
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '发表中...' : '发表评论'}
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <strong>评论规范：</strong>请保持客观、建设性的学术讨论态度，避免人身攻击或不当言论。
            评论内容仅代表个人观点。
          </p>
        </div>
      </form>
    </div>
  )
}

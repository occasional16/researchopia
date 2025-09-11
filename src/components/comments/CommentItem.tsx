'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Trash2, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { voteOnComment, deleteComment } from '@/lib/comments'
// Remove admin import since admin.ts was deleted
import type { CommentWithVotes } from '@/lib/comments'

interface CommentItemProps {
  comment: CommentWithVotes
  onUpdate: () => void
}

export default function CommentItem({ comment, onUpdate }: CommentItemProps) {
  const { user, profile } = useAuth()
  const [voting, setVoting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleVote = async (voteType: 'like' | 'dislike') => {
    if (!user || voting) return

    try {
      setVoting(true)
      const success = await voteOnComment(comment.id, user.id, voteType)
      if (success) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error voting:', error)
    } finally {
      setVoting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || deleting) return

    try {
      setDeleting(true)
      const success = await deleteComment(comment.id)
      if (success) {
        onUpdate()
        setShowDeleteConfirm(false)
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = user && (user.id === comment.user_id || profile?.role === 'admin')

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Comment Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-blue-600">
              {comment.users.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{comment.users.username}</p>
            <p className="text-xs text-gray-500">
              {new Date(comment.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className={`text-gray-400 hover:text-red-600 transition-colors ${
              deleting ? 'cursor-not-allowed opacity-50' : ''
            }`}
            title={deleting ? '删除中...' : '删除评论'}
          >
            <Trash2 className={`w-4 h-4 ${deleting ? 'animate-pulse' : ''}`} />
          </button>
        )}
      </div>

      {/* Comment Content */}
      <div className="mb-4">
        <p className="text-gray-700 leading-relaxed">{comment.content}</p>
      </div>

      {/* Vote Buttons */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => handleVote('like')}
          disabled={!user || voting}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
            comment.user_vote === 'like'
              ? 'bg-green-100 text-green-700'
              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
          } ${!user || voting ? 'cursor-not-allowed opacity-50' : ''}`}
          title={!user ? '请登录后点赞' : voting ? '处理中...' : '点赞'}
        >
          <ThumbsUp className={`w-4 h-4 ${voting ? 'animate-pulse' : ''}`} />
          <span className="text-sm">{comment.likes_count}</span>
        </button>

        <button
          onClick={() => handleVote('dislike')}
          disabled={!user || voting}
          className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
            comment.user_vote === 'dislike'
              ? 'bg-red-100 text-red-700'
              : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
          } ${!user || voting ? 'cursor-not-allowed opacity-50' : ''}`}
          title={!user ? '请登录后点踩' : voting ? '处理中...' : '点踩'}
        >
          <ThumbsDown className={`w-4 h-4 ${voting ? 'animate-pulse' : ''}`} />
          <span className="text-sm">{comment.dislikes_count}</span>
        </button>

        {!user && (
          <span className="text-xs text-gray-400">登录后可点赞评论</span>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
            </div>
            <p className="text-gray-600 mb-6">
              确定要删除这条评论吗？此操作不可撤销。
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

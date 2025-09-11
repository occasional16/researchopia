'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle, Trash2, Calendar, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getUserComments, deleteUserComment, type UserCommentWithPaper } from '@/lib/userActivity'
import { useAuth } from '@/contexts/AuthContext'

export default function UserComments() {
  const { user } = useAuth()
  const [comments, setComments] = useState<UserCommentWithPaper[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadComments()
    }
  }, [user])

  const loadComments = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      const data = await getUserComments(user.id)
      setComments(data)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('确定要删除这个评论吗？此操作不可撤销。')) {
      return
    }

    try {
      setDeleting(commentId)
      const success = await deleteUserComment(commentId)
      
      if (success) {
        setComments(prev => prev.filter(c => c.id !== commentId))
      } else {
        alert('删除失败，请重试')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('删除失败，请重试')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-32"></div>
          </div>
        ))}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">暂无评论记录</h3>
        <p className="text-gray-500 mb-6">您还没有发表任何评论</p>
        <Link
          href="/search"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          开始评论论文
        </Link>
      </div>
    )
  }

  // 按论文分组评论
  const commentsByPaper = comments.reduce((acc, comment) => {
    const paperId = comment.paper_id
    if (!acc[paperId]) {
      acc[paperId] = {
        paper: comment.papers,
        comments: []
      }
    }
    acc[paperId].comments.push(comment)
    return acc
  }, {} as Record<string, { paper: any, comments: typeof comments }>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          我的评论 ({comments.length})
        </h3>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Link
                    href={`/papers/${comment.paper_id}`}
                    className="text-lg font-medium text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {comment.papers.title}
                  </Link>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  {comment.papers.authors?.join(', ')} • {comment.papers.journal}
                </div>

                <div className="bg-gray-50 rounded-md p-4 mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>发表于 {new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="ml-4">
                <button
                  onClick={() => handleDelete(comment.id)}
                  disabled={deleting === comment.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title="删除评论"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Filter, Clock, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getCommentsWithVotes } from '@/lib/comments'
import CommentItem from './CommentItem'
import type { CommentWithVotes } from '@/lib/comments'

interface CommentListProps {
  paperId: string
}

type FilterType = 'all' | 'mine'
type SortType = 'time' | 'likes'

export default function CommentList({ paperId }: CommentListProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentWithVotes[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('time')

  useEffect(() => {
    loadComments()
  }, [paperId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadComments = async () => {
    try {
      setLoading(true)
      const data = await getCommentsWithVotes(paperId, user?.id)
      setComments(data)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选和排序评论
  const getFilteredAndSortedComments = () => {
    let filteredComments = [...comments]

    // 筛选
    if (filter === 'mine' && user) {
      filteredComments = filteredComments.filter(comment => comment.user_id === user.id)
    }

    // 排序
    if (sort === 'time') {
      filteredComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sort === 'likes') {
      filteredComments.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
    }

    // 如果是显示所有评论，优先显示我的评论
    if (filter === 'all' && user && sort === 'time') {
      const myComments = filteredComments.filter(comment => comment.user_id === user.id)
      const otherComments = filteredComments.filter(comment => comment.user_id !== user.id)
      return [...myComments, ...otherComments]
    }

    return filteredComments
  }

  const displayComments = getFilteredAndSortedComments()

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded mb-2 w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded mb-1 w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600 font-medium mb-1">暂无评论</p>
        <p className="text-sm text-gray-500">成为第一个评论的用户吧！</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        评论 ({getFilteredAndSortedComments().length}
        {filter === 'mine' && getFilteredAndSortedComments().length !== comments.length &&
          ` / ${comments.length}`
        })
      </h3>

      {/* 筛选和排序控件 */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">筛选:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有评论</option>
            <option value="mine">我的评论</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">排序:</span>
          <button
            onClick={() => setSort('time')}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-colors ${
              sort === 'time'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>时间</span>
          </button>
          <button
            onClick={() => setSort('likes')}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-colors ${
              sort === 'likes'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ThumbsUp className="w-3 h-3" />
            <span>点赞</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {displayComments.map((comment, index) => (
          <div key={comment.id}>
            {/* 如果是我的评论且在所有评论模式下，添加分隔线 */}
            {filter === 'all' && user && index === displayComments.findIndex(c => c.user_id !== user.id) && index > 0 && (
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-4 text-sm text-gray-500 bg-white">其他评论</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
            )}
            <CommentItem
              comment={comment}
              onUpdate={loadComments}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
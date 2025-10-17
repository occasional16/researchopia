'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Filter, Clock, ThumbsUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import NestedCommentTree from '@/components/NestedCommentTree'
import type { CommentWithVotes } from '@/lib/comments'

interface CommentListProps {
  paperId: string
}

interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  parent_id: string | null
  reply_count: number
  username: string
  avatar_url: string | null
  is_anonymous?: boolean // 🆕 匿名标志
  children: Comment[]
}

type FilterType = 'all' | 'mine'
type SortType = 'time' | 'likes'

export default function CommentList({ paperId }: CommentListProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('time')
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // 🆕 直接使用AuthContext中的user.role,不需要重新查询
  const userRole = user?.role
  
  // 🔍 调试日志
  console.log('[CommentList] User and Role:', { 
    userId: user?.id, 
    userRole, 
    userObject: user 
  })

  // 获取access token
  useEffect(() => {
    const getToken = async () => {
      const { data } = await supabase.auth.getSession()
      setAccessToken(data.session?.access_token || null)
    }
    getToken()
  }, [user])

  useEffect(() => {
    loadComments()
  }, [paperId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadComments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/paper-comments/tree/${paperId}`)
      const data = await response.json()
      
      if (data.success) {
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理回复 - 🆕 添加isAnonymous参数
  const handleReply = async (parentId: string | null, content: string, isAnonymous?: boolean) => {
    if (!accessToken) {
      alert('请先登录')
      return
    }

    try {
      const response = await fetch('/api/paper-comments/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          paperId,
          parentId,
          content,
          isAnonymous: isAnonymous || false // 🆕 传递匿名参数
        })
      })

      const data = await response.json()
      
      if (data.success) {
        await loadComments()
      } else {
        alert(data.error || '回复失败')
      }
    } catch (error) {
      console.error('Failed to reply:', error)
      alert('回复失败,请重试')
    }
  }

  // 处理编辑 - 🆕 添加isAnonymous参数
  const handleEdit = async (commentId: string, content: string, isAnonymous?: boolean) => {
    if (!accessToken) {
      alert('请先登录')
      return
    }

    try {
      const response = await fetch(`/api/paper-comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          content,
          isAnonymous: isAnonymous // 🆕 传递匿名状态
        })
      })

      const data = await response.json()
      
      if (data.success) {
        await loadComments()
      } else {
        alert(data.error || '编辑失败')
      }
    } catch (error) {
      console.error('Failed to edit:', error)
      alert('编辑失败,请重试')
    }
  }

  // 处理删除
  const handleDelete = async (commentId: string) => {
    if (!accessToken) {
      alert('请先登录')
      return
    }

    if (!confirm('确定要删除这条评论吗? 所有回复也会被删除。')) {
      return
    }

    try {
      const response = await fetch(`/api/paper-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const data = await response.json()
      
      if (data.success) {
        await loadComments()
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('删除失败,请重试')
    }
  }

  // 筛选评论
  const getFilteredComments = () => {
    if (filter === 'mine' && user) {
      // 递归过滤,只显示我的评论
      const filterMyComments = (comments: Comment[]): Comment[] => {
        return comments
          .filter(c => c.user_id === user.id)
          .map(c => ({
            ...c,
            children: filterMyComments(c.children || [])
          }))
      }
      return filterMyComments(comments)
    }
    return comments
  }

  const displayComments = getFilteredComments()

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
        评论 ({displayComments.length}
        {filter === 'mine' && displayComments.length !== comments.length &&
          ` / ${comments.length}`
        })
      </h3>

      {/* 筛选控件 */}
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
      </div>

      {/* 嵌套评论树 */}
      <NestedCommentTree
        comments={displayComments}
        currentUserId={user?.id}
        currentUserRole={userRole}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        maxDepth={5}
      />
    </div>
  )
}
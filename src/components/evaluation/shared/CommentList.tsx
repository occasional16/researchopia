'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MessageSquare, Trash2, Reply, ThumbsUp, Filter, Edit2 } from 'lucide-react'
import { UserDisplay } from '@/components/user'
import CommentForm from './CommentForm'

export type TargetType = 'paper' | 'webpage'

interface Comment {
  id: string
  content: string
  userId: string
  parentId: string | null
  isAnonymous: boolean
  isOwnComment?: boolean  // Marker for user's own comments
  likesCount: number
  hasLiked?: boolean
  createdAt: string
  user?: {
    id: string
    username: string | null
    email: string
    avatarUrl: string | null
  }
  children?: Comment[]
}

type FilterType = 'all' | 'mine'

interface CommentListProps {
  targetType: TargetType
  targetId: string
  url?: string
  title?: string
  className?: string
  nested?: boolean
  /** Callback when comment count changes (for parent component to track) */
  onCommentCountChange?: (count: number) => void
}

/**
 * Unified comment list supporting both papers and webpages
 * Uses v2 unified API endpoints
 */
export default function CommentList({
  targetType,
  targetId,
  url,
  title,
  className = '',
  nested = true,
  onCommentCountChange,
}: CommentListProps) {
  const { user, getAccessToken } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [isExpanded, setIsExpanded] = useState(false)
  const pageSize = 20
  const collapsedLimit = 3 // 默认折叠时显示的评论数量

  const loadComments = useCallback(async (pageNum = 0, append = false) => {
    try {
      if (!append) setLoading(true)
      
      // Get token for authenticated requests (to get hasLiked status)
      const token = await getAccessToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(
        `/api/v2/comments?targetType=${targetType}&targetId=${targetId}&nested=${nested}&limit=${pageSize}&offset=${pageNum * pageSize}`,
        { 
          headers,
          cache: 'no-store', // Disable cache to ensure fresh data
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load comments')
      }

      const data = await response.json()
      
      if (append) {
        setComments(prev => [...prev, ...data.comments])
      } else {
        setComments(data.comments || [])
      }
      
      const newTotal = data.total || 0
      setTotal(newTotal)
      onCommentCountChange?.(newTotal)
      setHasMore(data.hasMore || false)
    } catch (err: any) {
      setError(err.message || '加载评论失败')
    } finally {
      setLoading(false)
    }
  }, [targetType, targetId, nested, pageSize, getAccessToken])

  // Reload comments when target or user changes (to update hasLiked status)
  useEffect(() => {
    if (targetId) {
      setPage(0)
      loadComments(0)
    }
  }, [targetId, user?.id, loadComments]) // Add user?.id to dependencies

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadComments(nextPage, true)
  }

  const handleCommentAdded = () => {
    // Reload from first page to show new comment
    setPage(0)
    loadComments(0)
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？')) return

    try {
      const token = await getAccessToken()
      if (!token) {
        alert('请先登录')
        return
      }

      const response = await fetch(
        `/api/v2/comments?targetType=${targetType}&targetId=${targetId}&commentId=${commentId}`,
        { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '删除失败')
      }

      // Reload comments
      loadComments(0)
    } catch (err: any) {
      alert(err.message || '删除评论失败')
    }
  }

  // Update like state in nested comment tree
  const updateCommentLike = (commentId: string, liked: boolean, likeCount: number) => {
    const updateInTree = (items: Comment[]): Comment[] => {
      return items.map(item => {
        if (item.id === commentId) {
          return { ...item, hasLiked: liked, likesCount: likeCount }
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: updateInTree(item.children) }
        }
        return item
      })
    }
    setComments(prev => updateInTree(prev))
  }

  const handleLikeComment = async (commentId: string, currentlyLiked: boolean) => {
    if (!user) {
      alert('请先登录')
      return
    }

    try {
      const token = await getAccessToken()
      if (!token) {
        alert('请先登录')
        return
      }

      const response = await fetch('/api/v2/comments/vote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType,
          commentId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Vote API error:', response.status, errorData)
        throw new Error(errorData.error || '操作失败')
      }

      const data = await response.json()
      updateCommentLike(commentId, data.hasLiked, data.likeCount)
    } catch (err: any) {
      console.error('Like error:', err)
    }
  }

  // Filter comments based on user selection
  const getFilteredComments = () => {
    if (filter === 'mine' && user) {
      const filterMyComments = (items: Comment[]): Comment[] => {
        return items
          .filter(c => c.userId === user.id)
          .map(c => ({
            ...c,
            children: c.children ? filterMyComments(c.children) : []
          }))
      }
      return filterMyComments(comments)
    }
    return comments
  }

  const filteredComments = getFilteredComments()
  // 根据展开状态决定显示的评论
  const displayComments = isExpanded ? filteredComments : filteredComments.slice(0, collapsedLimit)
  const hiddenCount = filteredComments.length - displayComments.length

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              评论 ({filter === 'mine' && filteredComments.length !== total 
                ? `${filteredComments.length} / ${total}` 
                : total})
            </h3>
          </div>
          
          {/* Filter control */}
          {user && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                aria-label="筛选评论"
                className="text-xs border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">所有评论</option>
                <option value="mine">我的评论</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Comment form */}
      <div className="px-4 py-3 border-b dark:border-gray-700">
        <CommentForm
          targetType={targetType}
          targetId={targetId}
          url={url}
          title={title}
          onCommentAdded={handleCommentAdded}
          compact
        />
      </div>

      {/* Comments list */}
      <div className="divide-y dark:divide-gray-700">
        {loading && comments.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            加载中...
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-center text-sm text-red-500">
            {error}
          </div>
        ) : displayComments.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {filter === 'mine' ? '您还没有发表评论' : '暂无评论，来发表第一条评论吧！'}
          </div>
        ) : (
          <>
            {displayComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                targetType={targetType}
                targetId={targetId}
                url={url}
                title={title}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                onDelete={handleDeleteComment}
                onReplyAdded={handleCommentAdded}
                onLike={handleLikeComment}
                depth={0}
              />
            ))}
            {/* 展开/折叠按钮 */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setIsExpanded(true)}
                className="w-full py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                展开更多 ({hiddenCount} 条)
              </button>
            )}
            {isExpanded && filteredComments.length > collapsedLimit && (
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                收起
              </button>
            )}
          </>
        )}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="px-4 py-3 border-t dark:border-gray-700">
          <button
            onClick={handleLoadMore}
            className="w-full py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            加载更多评论
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Comment Item Component
// ============================================================================

interface CommentItemProps {
  comment: Comment
  targetType: TargetType
  targetId: string
  url?: string
  title?: string
  currentUserId?: string
  currentUserRole?: 'admin' | 'user'
  onDelete: (commentId: string) => void
  onReplyAdded: () => void
  onLike: (commentId: string, currentlyLiked: boolean) => void
  depth: number
}

// Format relative time
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}天前`
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}个月前`
  return `${Math.floor(seconds / 31536000)}年前`
}

// Format full date time for tooltip
function formatFullDateTime(dateString: string): string {
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

function CommentItem({
  comment,
  targetType,
  targetId,
  url,
  title,
  currentUserId,
  currentUserRole,
  onDelete,
  onReplyAdded,
  onLike,
  depth,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const maxDepth = 3

  // User can delete their own comment OR admin can delete any comment
  const isOwner = currentUserId && currentUserId === comment.userId
  const isAdmin = currentUserRole === 'admin'
  const canDelete = isOwner || isAdmin
  const canReply = depth < maxDepth

  return (
    <div className={`px-4 py-2.5 ${depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-600' : ''}`}>
      {/* Comment header */}
      <div className="flex items-center gap-2 mb-1">
        <UserDisplay
          username={comment.user?.username || 'anonymous'}
          avatarUrl={comment.user?.avatarUrl}
          isAnonymous={comment.isAnonymous}
          avatarSize="xs"
          showHoverCard={!comment.isAnonymous}
        />
        {/* Show "(你)" badge for user's own anonymous comments */}
        {comment.isAnonymous && comment.isOwnComment && (
          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">(你)</span>
        )}
        <span 
          className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto cursor-help"
          title={formatFullDateTime(comment.createdAt)}
        >
          {formatTimeAgo(comment.createdAt)}
        </span>
      </div>

      {/* Comment content */}
      <div className="text-gray-700 dark:text-gray-300 text-xs whitespace-pre-wrap mb-2 ml-6">
        {comment.content}
      </div>

      {/* Comment actions */}
      {/* Action buttons */}
      <div className="flex items-center gap-3 ml-6">
        {/* Like button */}
        <button
          onClick={async () => {
            if (isLiking) return
            setIsLiking(true)
            await onLike(comment.id, comment.hasLiked || false)
            setIsLiking(false)
          }}
          disabled={isLiking}
          className={`flex items-center gap-0.5 text-[10px] transition-colors ${
            comment.hasLiked
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
          }`}
        >
          <ThumbsUp className={`w-3 h-3 ${comment.hasLiked ? 'fill-current' : ''}`} />
          {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
        </button>

        {canReply && (
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <Reply className="w-3 h-3" />
            回复
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(comment.id)}
            className={`flex items-center gap-0.5 text-[10px] transition-colors ${
              isAdmin && !isOwner
                ? 'text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300'
                : 'text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
            }`}
            title={isAdmin && !isOwner ? '管理员删除' : '删除'}
          >
            <Trash2 className="w-3 h-3" />
            {isAdmin && !isOwner ? '管理员删除' : '删除'}
          </button>
        )}
      </div>

      {/* Reply form */}
      {showReplyForm && (
        <div className="mt-2 ml-6">
          <CommentForm
            targetType={targetType}
            targetId={targetId}
            url={url}
            title={title}
            parentId={comment.id}
            onCommentAdded={() => {
              setShowReplyForm(false)
              onReplyAdded()
            }}
            onCancel={() => setShowReplyForm(false)}
            compact
          />
        </div>
      )}

      {/* Nested replies */}
      {comment.children && comment.children.length > 0 && (
        <div className="mt-2 space-y-0">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              targetType={targetType}
              targetId={targetId}
              url={url}
              title={title}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onDelete={onDelete}
              onReplyAdded={onReplyAdded}
              onLike={onLike}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

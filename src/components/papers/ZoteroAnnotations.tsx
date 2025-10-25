'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Heart, User, Eye, ChevronDown, ChevronUp, Bookmark } from 'lucide-react'
import NestedCommentTree from '@/components/NestedCommentTree'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext' // 🆕 导入useAuth
import { UserDisplay } from '@/components/user'

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

interface ZoteroAnnotation {
  annotation_id: string
  document_id: string
  user_id: string
  type: string
  content?: string
  comment?: string
  color: string
  position: any
  tags: string[]
  visibility: string
  likes_count: number
  comments_count: number
  created_at: string
  platform: string
  quality_score?: number
  helpfulness_score?: number
  display_name: string
  username?: string
  user_avatar?: string
}

interface ZoteroAnnotationsProps {
  paperId: string
  paperTitle: string
  paperDOI?: string
}

export default function ZoteroAnnotations({ paperId, paperTitle, paperDOI }: ZoteroAnnotationsProps) {
  const [annotations, setAnnotations] = useState<ZoteroAnnotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [filter, setFilter] = useState<'all' | 'highlight' | 'note'>('all')
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [annotationComments, setAnnotationComments] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set())
  const [accessToken, setAccessToken] = useState<string | null>(null)
  
  // 🆕 使用AuthContext获取user和role
  const { user: currentUser } = useAuth()
  const userRole = currentUser?.role
  
  // 🔍 调试日志
  console.log('[ZoteroAnnotations] User and Role:', { 
    userId: currentUser?.id, 
    userRole, 
    userObject: currentUser 
  })

  useEffect(() => {
    loadAnnotations()
    loadAccessToken()
  }, [paperId])

  const loadAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setAccessToken(session?.access_token || null)
  }

  const loadAnnotations = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/papers/${paperId}/zotero-annotations`)
      if (!response.ok) {
        throw new Error('Failed to fetch annotations')
      }

      const data = await response.json()
      setAnnotations(data.annotations || [])
    } catch (err: any) {
      console.error('Error loading Zotero annotations:', err)
      setError(err.message || 'Failed to load annotations')
    } finally {
      setLoading(false)
    }
  }

  const loadAnnotationComments = async (annotationId: string) => {
    if (annotationComments[annotationId]) {
      // 已加载，直接展开
      return
    }

    setLoadingComments(prev => new Set(prev).add(annotationId))

    try {
      const response = await fetch(`/api/annotation-comments/tree/${annotationId}`)
      const data = await response.json()

      if (data.success) {
        setAnnotationComments(prev => ({
          ...prev,
          [annotationId]: data.comments || []
        }))
      }
    } catch (err) {
      console.error('Error loading annotation comments:', err)
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev)
        newSet.delete(annotationId)
        return newSet
      })
    }
  }

  const toggleComments = async (annotationId: string) => {
    const isExpanded = expandedComments.has(annotationId)
    
    if (isExpanded) {
      // 收起评论
      setExpandedComments(prev => {
        const newSet = new Set(prev)
        newSet.delete(annotationId)
        return newSet
      })
    } else {
      // 展开评论
      setExpandedComments(prev => new Set(prev).add(annotationId))
      
      // 如果还没加载评论，则加载
      if (!annotationComments[annotationId]) {
        await loadAnnotationComments(annotationId)
      }
    }
  }

  const handleReply = async (annotationId: string, parentId: string | null, content: string, isAnonymous?: boolean) => {
    if (!accessToken) {
      alert('请先登录')
      return
    }

    try {
      const response = await fetch('/api/annotation-comments/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          annotationId,
          parentId,
          content,
          isAnonymous: isAnonymous || false // 🆕 传递匿名参数
        })
      })

      if (response.ok) {
        // 重新加载该标注的评论
        const commentsResponse = await fetch(`/api/annotation-comments/tree/${annotationId}`)
        const data = await commentsResponse.json()
        
        if (data.success) {
          setAnnotationComments(prev => ({
            ...prev,
            [annotationId]: data.comments || []
          }))
        }

        // 更新标注的评论计数
        setAnnotations(prev => prev.map(ann => 
          ann.annotation_id === annotationId 
            ? { ...ann, comments_count: ann.comments_count + 1 }
            : ann
        ))
      }
    } catch (err) {
      console.error('Error replying to comment:', err)
      alert('回复失败')
    }
  }

  const handleEdit = async (annotationId: string, commentId: string, content: string, isAnonymous?: boolean) => { // 🆕 添加isAnonymous参数
    if (!accessToken) return

    try {
      const response = await fetch(`/api/annotation-comments/${commentId}`, {
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

      if (response.ok) {
        // 重新加载该标注的评论
        const commentsResponse = await fetch(`/api/annotation-comments/tree/${annotationId}`)
        const data = await commentsResponse.json()
        
        if (data.success) {
          setAnnotationComments(prev => ({
            ...prev,
            [annotationId]: data.comments || []
          }))
        }
      }
    } catch (err) {
      console.error('Error editing comment:', err)
      alert('编辑失败')
    }
  }

  const handleDelete = async (annotationId: string, commentId: string) => {
    if (!accessToken) {
      console.error('[ZoteroAnnotations] No access token for delete')
      alert('请先登录')
      return
    }
    if (!confirm('确定要删除这条评论吗？所有回复也会被删除。')) return

    console.log('[ZoteroAnnotations] Deleting comment:', { annotationId, commentId, hasToken: !!accessToken })

    try {
      const response = await fetch(`/api/annotation-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      console.log('[ZoteroAnnotations] Delete response:', { ok: response.ok, status: response.status })

      if (response.ok) {
        // 重新加载该标注的评论
        const commentsResponse = await fetch(`/api/annotation-comments/tree/${annotationId}`)
        const data = await commentsResponse.json()
        
        if (data.success) {
          setAnnotationComments(prev => ({
            ...prev,
            [annotationId]: data.comments || []
          }))
        }

        // 更新标注的评论计数（需要递归计算删除了多少评论）
        setAnnotations(prev => prev.map(ann => 
          ann.annotation_id === annotationId 
            ? { ...ann, comments_count: Math.max(0, data.comments.length) }
            : ann
        ))
        
        console.log('[ZoteroAnnotations] Comment deleted successfully')
      } else {
        const errorData = await response.json()
        console.error('[ZoteroAnnotations] Delete failed:', errorData)
        alert(`删除失败: ${errorData.error || '未知错误'}`)
      }
    } catch (err) {
      console.error('[ZoteroAnnotations] Error deleting comment:', err)
      alert('删除失败')
    }
  }

  const getAnnotationTypeIcon = (type: string) => {
    switch (type) {
      case 'highlight':
        return '🟡'
      case 'underline':
        return '🔽'
      case 'note':
        return '📝'
      case 'text':
        return '💬'
      default:
        return '📋'
    }
  }

  const getAnnotationTypeLabel = (type: string) => {
    switch (type) {
      case 'highlight':
        return '高亮'
      case 'underline':
        return '下划线'
      case 'note':
        return '笔记'
      case 'text':
        return '文本'
      default:
        return type
    }
  }

  const filteredAnnotations = annotations.filter(annotation => {
    if (filter === 'all') return true
    if (filter === 'highlight') return ['highlight', 'underline'].includes(annotation.type)
    if (filter === 'note') return ['note', 'text'].includes(annotation.type)
    return true
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bookmark className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Zotero 共享标注
            </h3>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
              {annotations.length} 条
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span className="text-sm">{expanded ? '收起' : '展开'}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {expanded && annotations.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-3">
              来自 Zotero 插件用户的共享标注，帮助您更好地理解论文内容
            </p>
            
            {/* Filter Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'all'
                    ? 'bg-purple-100 text-purple-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                全部 ({annotations.length})
              </button>
              <button
                onClick={() => setFilter('highlight')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'highlight'
                    ? 'bg-yellow-100 text-yellow-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                高亮 ({annotations.filter(a => ['highlight', 'underline'].includes(a.type)).length})
              </button>
              <button
                onClick={() => setFilter('note')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filter === 'note'
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                笔记 ({annotations.filter(a => ['note', 'text'].includes(a.type)).length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p>{error}</p>
            </div>
          )}

          {annotations.length === 0 && !error && (
            <div className="text-center py-8">
              <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                暂无 Zotero 共享标注
              </p>
              <p className="text-sm text-gray-400 mt-1">
                安装 Researchopia Zotero 插件后可分享标注
              </p>
            </div>
          )}

          {filteredAnnotations.length > 0 && (
            <div className="space-y-4">
              {filteredAnnotations.map((annotation) => (
                <div
                  key={annotation.annotation_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Annotation Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">
                        {getAnnotationTypeIcon(annotation.type)}
                      </span>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {getAnnotationTypeLabel(annotation.type)}
                      </span>
                      {annotation.tags.length > 0 && (
                        <div className="flex space-x-1">
                          {annotation.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                          {annotation.tags.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{annotation.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      {annotation.quality_score && annotation.quality_score > 0 && (
                        <div className="flex items-center space-x-1">
                          <span>⭐</span>
                          <span>{annotation.quality_score.toFixed(1)}</span>
                        </div>
                      )}
                      <span>
                        {new Date(annotation.created_at).toLocaleDateString('zh-CN', {
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Annotation Content */}
                  {annotation.content && (
                    <div className="mb-3">
                      <div
                        className="p-3 rounded border-l-4 bg-gray-50"
                        style={{
                          borderLeftColor: annotation.color || '#ffd400',
                          backgroundColor: `${annotation.color || '#ffd400'}0d`
                        }}
                      >
                        <p className="text-gray-800 text-sm leading-relaxed">
                          {annotation.content}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Annotation Comment */}
                  {annotation.comment && (
                    <div className="mb-3">
                      <div className="bg-blue-50 border-l-4 border-blue-200 p-3 rounded">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          💭 {annotation.comment}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Annotation Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <UserDisplay
                        username={annotation.username || 'zotero_user'}
                        avatarUrl={annotation.user_avatar}
                        isAnonymous={false}
                        avatarSize="xs"
                        showHoverCard={!!annotation.username}
                      />
                      <span className="text-purple-600 font-medium">
                        Zotero
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {annotation.likes_count > 0 && (
                        <div className="flex items-center space-x-1">
                          <Heart className="w-3 h-3" />
                          <span>{annotation.likes_count}</span>
                        </div>
                      )}
                      <button
                        onClick={() => toggleComments(annotation.annotation_id)}
                        className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{annotation.comments_count}</span>
                        <span className="ml-1">
                          {expandedComments.has(annotation.annotation_id) ? '收起' : '展开'}评论
                        </span>
                      </button>
                      <div className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{annotation.visibility === 'public' ? '公开' : '共享'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nested Comments Section */}
                  {expandedComments.has(annotation.annotation_id) && (
                    <div className="mt-4 pt-4 border-t">
                      {loadingComments.has(annotation.annotation_id) ? (
                        <div className="text-center py-4">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <p className="text-sm text-gray-500 mt-2">加载评论中...</p>
                        </div>
                      ) : (
                        <NestedCommentTree
                          comments={annotationComments[annotation.annotation_id] || []}
                          currentUserId={currentUser?.id}
                          currentUserRole={userRole}
                          onReply={(parentId, content, isAnonymous) => handleReply(annotation.annotation_id, parentId, content, isAnonymous)}
                          onEdit={(commentId, content, isAnonymous) => handleEdit(annotation.annotation_id, commentId, content, isAnonymous)}
                          onDelete={(commentId) => handleDelete(annotation.annotation_id, commentId)}
                          maxDepth={5}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filteredAnnotations.length === 0 && annotations.length > 0 && (
            <div className="text-center py-6">
              <p className="text-gray-500">
                此类型暂无标注
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
'use client'

import { useEffect } from 'react'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import PaperCard from './PaperCard'
import { PaperListSkeleton, InfiniteScrollSentinel, EmptyState } from '../ui/LoadingStates'
import type { Paper, Rating } from '@/lib/supabase'

interface PaperWithRatings extends Paper {
  ratings: Rating[]
}

interface PaperListProps {
  limit?: number
  searchTerm?: string
  showInfiniteScroll?: boolean
  sortBy?: string
}

export default function PaperList({ 
  limit, 
  searchTerm = '',
  showInfiniteScroll = true,
  sortBy = 'recent_comments'
}: PaperListProps) {
  const {
    data: papers,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    sentinelRef
  } = useInfiniteScroll<PaperWithRatings>(
    '/api/papers/paginated',
    {
      limit: limit || 10,
      search: searchTerm,
      sortBy: sortBy,
      enabled: showInfiniteScroll
    }
  )

  // 移除了mock数据初始化逻辑，现在完全使用Supabase数据

  // 如果设置了limit且不显示无限滚动，则截取数据
  const displayPapers = (!showInfiniteScroll && limit) 
    ? papers.slice(0, limit) 
    : papers

  // 加载状态 - 仅在初始加载时显示骨架屏
  if (loading && papers.length === 0) {
    return <PaperListSkeleton count={limit || 5} />
  }

  // 错误状态 - 仅在没有数据且有错误时显示
  if (error && papers.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p>加载论文时出错: {error}</p>
        <button
          onClick={refresh}
          className="mt-2 text-sm underline hover:no-underline"
        >
          重试
        </button>
      </div>
    )
  }

  // 空状态
  if (displayPapers.length === 0 && !loading) {
    const emptyTitle = searchTerm ? '未找到相关论文' : '暂无论文数据'
    const emptyDescription = searchTerm 
      ? `没有找到包含 "${searchTerm}" 的论文，请尝试其他关键词`
      : '成为第一个添加论文的用户吧！'

    return (
      <EmptyState 
        title={emptyTitle}
        description={emptyDescription}
        action={searchTerm && (
          <button
            onClick={() => window.location.href = '/papers/new'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            添加论文
          </button>
        )}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* 论文列表 */}
      {displayPapers.map((paper) => (
        <PaperCard key={paper.id} paper={paper} />
      ))}

      {/* 无限滚动底部组件 */}
      {showInfiniteScroll && (
        <>
          {/* 监听元素 */}
          <div ref={sentinelRef} className="h-10" />
          
          {/* 状态提示 */}
          <InfiniteScrollSentinel
            hasMore={hasMore}
            loading={loading}
            error={error}
            onRetry={loadMore}
          />
        </>
      )}

      {/* 限制显示数量的提示 */}
      {!showInfiniteScroll && limit && papers.length > limit && (
        <div className="text-center pt-4 border-t">
          <p className="text-gray-500 text-sm mb-3">
            显示前 {limit} 篇论文，共 {papers.length} 篇
          </p>
          <button
            onClick={() => window.location.href = '/papers'}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            查看全部 →
          </button>
        </div>
      )}
    </div>
  )
}

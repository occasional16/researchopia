import React from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface LoadingSkeletonProps {
  count?: number
  className?: string
}

export function PaperListSkeleton({ count = 3, className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white p-6 rounded-lg shadow-sm border animate-pulse">
          {/* 标题骨架 */}
          <div className="h-6 bg-gray-200 rounded mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          
          {/* 作者信息骨架 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-4 bg-gray-200 rounded w-16"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
          
          {/* 摘要骨架 */}
          <div className="space-y-2 mb-4">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
          
          {/* 底部信息骨架 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export function LoadingSpinner({ 
  size = 'md', 
  text = '加载中...', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div className={`flex items-center justify-center gap-2 py-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
      <span className="text-gray-600">{text}</span>
    </div>
  )
}

interface ErrorMessageProps {
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorMessage({ message, onRetry, className = '' }: ErrorMessageProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-8 ${className}`}>
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-5 h-5" />
        <span className="font-medium">加载失败</span>
      </div>
      <p className="text-gray-600 text-center max-w-md">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </button>
      )}
    </div>
  )
}

interface InfiniteScrollSentinelProps {
  hasMore: boolean
  loading: boolean
  error?: string | null
  onRetry?: () => void
}

export function InfiniteScrollSentinel({ 
  hasMore, 
  loading, 
  error, 
  onRetry 
}: InfiniteScrollSentinelProps) {
  if (error) {
    return (
      <ErrorMessage 
        message={error}
        onRetry={onRetry}
        className="border-t"
      />
    )
  }

  if (loading) {
    return (
      <LoadingSpinner 
        text="加载更多..."
        className="border-t"
      />
    )
  }

  if (!hasMore) {
    return (
      <div className="text-center py-8 text-gray-500 border-t">
        <p>已加载全部内容</p>
      </div>
    )
  }

  return null
}

interface EmptyStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ 
  title = '暂无数据',
  description = '目前还没有相关内容',
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
        <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4 max-w-md mx-auto">{description}</p>
      {action}
    </div>
  )
}

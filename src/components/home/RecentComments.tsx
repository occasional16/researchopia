'use client'

import { MessageCircle, BookOpen, Search, Star } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

// Date formatting utilities to avoid hydration errors
function formatDate(dateString: string): string {
  if (typeof window === 'undefined') return dateString
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDateOnly(dateString: string): string {
  if (typeof window === 'undefined') return dateString
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

interface Comment {
  id: string
  title: string
  authors: string
  journal?: string
  comment_count: number
  average_rating: number
  rating_count: number
  created_at: string
  latest_comment: {
    content: string
    is_anonymous?: boolean
    created_at: string
    user?: {
      username: string
    } | null
  }
}

interface RecentCommentsProps {
  comments: Comment[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => void
}

export default function RecentComments({
  comments,
  loading,
  refreshing,
  onRefresh
}: RecentCommentsProps) {
  const { t } = useLanguage()

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <MessageCircle className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            {t('papers.recent', '最新评论')}
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-2 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              title="刷新评论"
            >
              <svg 
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <Link
              href="/papers"
              className="inline-flex items-center px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              {t('papers.allPapers', '所有论文')}
            </Link>
          </div>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            {t('papers.loading', '加载中...')}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            {t('papers.noComments', '暂无评论')}
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/papers/${comment.id}`}
                      className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors block mb-1 line-clamp-1"
                    >
                      {comment.title}
                    </Link>
                    <div className="flex flex-wrap gap-x-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
                      <span>作者：<span className="font-medium">{comment.authors}</span></span>
                      {comment.journal && (
                        <span>期刊：<span className="font-medium text-green-600 dark:text-green-400">{comment.journal}</span></span>
                      )}
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed line-clamp-2">
                        {comment.latest_comment.content}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {comment.latest_comment.is_anonymous 
                            ? '匿名用户' 
                            : (comment.latest_comment.user?.username || '匿名用户')}
                        </span>
                        <span>{formatDate(comment.latest_comment.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 text-right flex-shrink-0">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center justify-end space-x-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                          <MessageCircle className="h-3 w-3 mr-0.5 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium">{comment.comment_count}</span>
                        </div>
                        {comment.average_rating > 0 && (
                          <div className="flex items-center bg-yellow-50 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded-full">
                            <Star className="h-3 w-3 mr-0.5 text-yellow-500 dark:text-yellow-400" />
                            <span className="font-medium">{comment.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDateOnly(comment.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 text-center">
          <Link
            href="/papers"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            <BookOpen className="h-5 w-5 mr-2" />
            {t('papers.viewAll', '查看所有论文')}
            <Search className="h-4 w-4 ml-2" />
          </Link>
        </div>
      </div>
    </div>
  )
}

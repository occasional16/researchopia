'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, Star, Globe, ExternalLink, FileText, Bookmark } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import BookmarkButton from '@/components/bookmarks/BookmarkButton'
import PaperBookmarkButton from '@/components/bookmarks/PaperBookmarkButton'

// Date formatting utilities
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

interface Paper {
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

interface HotWebpage {
  url_hash: string
  url: string
  title: string
  average_rating: number
  rating_count: number
  comment_count: number
  description?: string
  latest_comment?: {
    content: string
    is_anonymous: boolean
    created_at: string
    user?: {
      username: string
    } | null
  }
}

interface HotContentProps {
  papers: Paper[]
  papersLoading: boolean
}

type Tab = 'papers' | 'webpages'

const STORAGE_KEY = 'hotContentActiveTab'

export default function HotContent({
  papers,
  papersLoading
}: HotContentProps) {
  const { t } = useLanguage()
  
  // Initialize activeTab from localStorage
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'papers' || saved === 'webpages') {
        return saved
      }
    }
    return 'papers'
  })
  
  const [webpages, setWebpages] = useState<HotWebpage[]>([])
  const [webpagesLoading, setWebpagesLoading] = useState(true)

  // Save tab selection to localStorage
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, tab)
    }
  }

  useEffect(() => {
    const fetchHotWebpages = async () => {
      try {
        const response = await fetch('/api/webpages?sort=rating&limit=5')
        if (response.ok) {
          const data = await response.json()
          // API returns { webpages: [...] } format
          if (data.webpages && Array.isArray(data.webpages)) {
            setWebpages(data.webpages.slice(0, 5))
          }
        }
      } catch (error) {
        console.error('Failed to fetch hot webpages:', error)
      } finally {
        setWebpagesLoading(false)
      }
    }

    fetchHotWebpages()
  }, [])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors">
      {/* Tab Header */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex space-x-1">
            <button
              onClick={() => handleTabChange('papers')}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                activeTab === 'papers'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t('papers.hot', '热门论文')}
            </button>
            <button
              onClick={() => handleTabChange('webpages')}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                activeTab === 'webpages'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-b-2 border-green-500'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              {t('webpages.hot', '热门网页')}
            </button>
          </div>
          {/* Actions */}
          <div className="flex items-center space-x-2">
            {activeTab === 'papers' && (
              <Link
                href="/papers"
                className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium rounded-md hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-sm hover:shadow"
              >
                <FileText className="h-3 w-3 mr-1" />
                查看全部论文
              </Link>
            )}
            {activeTab === 'webpages' && (
              <Link
                href="/webpages"
                className="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-green-500 to-teal-600 text-white text-xs font-medium rounded-md hover:from-green-600 hover:to-teal-700 transition-all duration-200 shadow-sm hover:shadow"
              >
                <Globe className="h-3 w-3 mr-1" />
                查看全部网页
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Papers Tab */}
        {activeTab === 'papers' && (
          <>
            {papersLoading ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                {t('papers.loading', '加载中...')}
              </div>
            ) : papers.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                {t('papers.noComments', '暂无数据')}
              </div>
            ) : (
              <div className="space-y-3">
                {papers.map((paper) => (
                  <div key={paper.id} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/papers/${paper.id}`}
                          className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors block mb-1 line-clamp-1"
                          title={paper.title}
                        >
                          {paper.title}
                        </Link>
                        <div className="flex flex-wrap gap-x-3 text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                          <span className="truncate max-w-[200px]" title={paper.authors}>{paper.authors}</span>
                          {paper.journal && (
                            <span className="text-green-600 dark:text-green-400 truncate max-w-[120px]" title={paper.journal}>{paper.journal}</span>
                          )}
                        </div>
                        <div className="p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                          <div className="flex items-center justify-between">
                            <p className="text-gray-600 dark:text-gray-400 line-clamp-1 flex-1" title={paper.latest_comment.content}>
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {paper.latest_comment.is_anonymous 
                                  ? '匿名' 
                                  : (paper.latest_comment.user?.username || '匿名')}：
                              </span>
                              {paper.latest_comment.content}
                            </p>
                            <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-2 flex-shrink-0">
                              {formatDateOnly(paper.latest_comment.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-3 flex-shrink-0 flex items-center space-x-2 text-xs">
                        <PaperBookmarkButton
                          paperId={paper.id}
                          title={paper.title}
                          variant="icon"
                          className="p-1"
                        />
                        <div className="flex items-center text-blue-600 dark:text-blue-400" title={`${paper.comment_count} 条评论`}>
                          <MessageCircle className="h-3 w-3 mr-0.5" />
                          <span>{paper.comment_count}</span>
                        </div>
                        {paper.average_rating > 0 && (
                          <div className="flex items-center text-yellow-600 dark:text-yellow-400" title={`评分 ${paper.average_rating.toFixed(1)}`}>
                            <Star className="h-3 w-3 mr-0.5" />
                            <span>{paper.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Webpages Tab */}
        {activeTab === 'webpages' && (
          <>
            {webpagesLoading ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                {t('common.loading', '加载中...')}
              </div>
            ) : webpages.length === 0 ? (
              <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                {t('webpages.noData', '暂无数据')}
              </div>
            ) : (
              <div className="space-y-3">
                {webpages.map((webpage) => (
                  <div key={webpage.url_hash} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/webpages/${webpage.url_hash}`}
                          className="text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors block mb-1 line-clamp-1"
                          title={webpage.title || webpage.url}
                        >
                          {webpage.title || webpage.url}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1.5" title={webpage.url}>
                          <ExternalLink className="h-2.5 w-2.5 mr-0.5 inline flex-shrink-0" />
                          {webpage.url}
                        </p>
                        {webpage.latest_comment && (
                          <div className="p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                            <div className="flex items-center justify-between">
                              <p className="text-gray-600 dark:text-gray-400 line-clamp-1 flex-1" title={webpage.latest_comment.content}>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {webpage.latest_comment.is_anonymous 
                                    ? '匿名' 
                                    : (webpage.latest_comment.user?.username || '匿名')}：
                                </span>
                                {webpage.latest_comment.content}
                              </p>
                              <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-2 flex-shrink-0">
                                {formatDateOnly(webpage.latest_comment.created_at)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="ml-3 flex-shrink-0 flex items-center space-x-2 text-xs">
                        {webpage.comment_count > 0 && (
                          <div className="flex items-center text-blue-600 dark:text-blue-400" title={`${webpage.comment_count} 条评论`}>
                            <MessageCircle className="h-3 w-3 mr-0.5" />
                            <span>{webpage.comment_count}</span>
                          </div>
                        )}
                        {webpage.average_rating > 0 && (
                          <div className="flex items-center text-yellow-600 dark:text-yellow-400" title={`评分 ${webpage.average_rating.toFixed(1)}`}>
                            <Star className="h-3 w-3 mr-0.5" />
                            <span>{webpage.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                        <BookmarkButton 
                          url={webpage.url}
                          title={webpage.title || undefined}
                          variant="compact"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

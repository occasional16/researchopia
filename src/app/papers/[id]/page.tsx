'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, ExternalLink, Tag, ChevronRight, Home, Crown } from 'lucide-react'
import { getPaper, getPaperRatings, getPaperComments } from '@/lib/database'
import { useAdmin } from '@/contexts/AdminContext'
import RatingForm from '@/components/rating/RatingForm'
import RatingDisplay from '@/components/rating/RatingDisplay'
import CommentForm from '@/components/comments/CommentForm'
import CommentList from '@/components/comments/CommentList'
import ZoteroAnnotations from '@/components/papers/ZoteroAnnotations'
import QuickSearch from '@/components/papers/QuickSearch'
import PaperReports from '@/components/papers/PaperReports'
import ReportsVisibilityInfo from '@/components/papers/ReportsVisibilityInfo'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import type { Paper, Rating, Comment, User } from '@/lib/supabase'

interface PaperWithDetails extends Paper {
  ratings: (Rating & { users?: User })[]
  comments: (Comment & { user?: User })[]
}

export default function PaperDetailPage() {
  const params = useParams()
  const paperId = params.id as string
  const { isAdminMode, loading: adminLoading } = useAdmin()
  
  useScrollRestoration()
  
  const [paper, setPaper] = useState<PaperWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (paperId) {
      loadPaper()
      // 跟踪查看次数
      trackViewCount()
    }
  }, [paperId]) // eslint-disable-line react-hooks/exhaustive-deps

  const trackViewCount = async () => {
    try {
      await fetch(`/api/papers/${paperId}/views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('Failed to track view count:', error)
    }
  }

  const loadPaper = async () => {
    try {
      setLoading(true)
      const data = await getPaper(paperId)
      setPaper(data as PaperWithDetails)
    } catch (err: any) {
      setError(err.message || 'Failed to load paper')
    } finally {
      setLoading(false)
    }
  }

  const handleRatingSubmitted = () => {
    // Reload paper data to get updated ratings
    loadPaper()
  }

  const handleCommentAdded = () => {
    // Reload paper data to get updated comments
    loadPaper()
  }

  const handleCommentDeleted = (commentId: string) => {
    if (paper) {
      setPaper({
        ...paper,
        comments: paper.comments.filter(comment => comment.id !== commentId)
      })
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/2"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded mb-6"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
          <p>{error || '论文不存在'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
        <Link
          href="/"
          className="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>首页</span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">论文详情</span>
      </nav>

      {/* Paper Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900 border dark:border-gray-700 p-8 mb-8 transition-colors">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          {paper.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600 dark:text-gray-400 mb-6">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>{paper.authors.join(', ')}</span>
          </div>
          
          {paper.publication_date && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(paper.publication_date).toLocaleDateString('zh-CN')}</span>
            </div>
          )}
          
          {paper.journal && (
            <div className="italic">
              {paper.journal}
            </div>
          )}
        </div>

        {paper.doi && (
          <div className="mb-6">
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              <ExternalLink className="w-4 h-4" />
              <span>DOI: {paper.doi}</span>
            </a>
          </div>
        )}

        {paper.keywords && paper.keywords.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Tag className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">关键词</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {paper.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {paper.abstract && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">摘要</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {paper.abstract}
            </p>
          </div>
        )}
      </div>

      {/* Quick Search Section */}
      <QuickSearch 
        paper={{
          title: paper.title,
          doi: paper.doi,
          authors: paper.authors
        }} 
      />

      {/* Admin Status and Visibility Info - 暂时隐藏，等待后续开发 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          📰 相关新闻报道
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          该功能正在开发中，敬请期待...
        </p>
      </div>

      {/* Paper Reports Section - 暂时隐藏 */}
      {/* <PaperReports 
        paperId={paperId}
        paperTitle={paper.title}
        paperDOI={paper.doi}
        isAdminMode={isAdminMode}
      /> */}

      {/* Rating Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <RatingForm 
            paperId={paperId} 
            onRatingSubmitted={handleRatingSubmitted}
          />
        </div>
        <div>
          <RatingDisplay ratings={paper.ratings} />
        </div>
      </div>

      {/* Comments Section */}
      <div className="space-y-8">
        <CommentForm 
          paperId={paperId}
          onCommentAdded={handleCommentAdded}
        />
        <CommentList
          paperId={paperId}
        />
      </div>

      {/* Zotero Annotations Section */}
      <div className="mt-8">
        <ZoteroAnnotations
          paperId={paperId}
          paperTitle={paper.title}
          paperDOI={paper.doi}
        />
      </div>
    </div>
  )
}

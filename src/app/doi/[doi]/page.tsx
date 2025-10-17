'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
import Link from 'next/link'
import { Calendar, Users, ExternalLink, Tag, ChevronRight, Home, Crown } from 'lucide-react'
import type { Paper, Rating, Comment, User } from '@/lib/supabase'

interface PaperWithDetails extends Paper {
  ratings: (Rating & { users?: User })[]
  comments: (Comment & { user?: User })[]
}

export default function DOIPaperPage() {
  const params = useParams()
  const router = useRouter()
  const { isAdminMode, loading: adminLoading } = useAdmin()
  
  // 解码DOI参数
  const encodedDOI = params.doi as string
  const doi = decodeURIComponent(encodedDOI)
  
  const [paper, setPaper] = useState<PaperWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (doi) {
      loadPaperByDOI()
    }
  }, [doi])

  const loadPaperByDOI = async () => {
    try {
      setLoading(true)
      setError('')

      // 通过DOI查找论文
      const { data: paperData, error: paperError } = await supabase
        .from('papers')
        .select('*')
        .eq('doi', doi)
        .single()

      if (paperError || !paperData) {
        setError(`未找到 DOI 为 "${doi}" 的论文`)
        return
      }

      // 获取详细信息（评分和评论）
      const [ratingsData, commentsData] = await Promise.all([
        getPaperRatings(paperData.id),
        getPaperComments(paperData.id)
      ])

      setPaper({
        ...paperData,
        ratings: ratingsData || [],
        comments: commentsData || []
      } as PaperWithDetails)

      // 跟踪查看次数
      trackViewCount(paperData.id)

    } catch (err: any) {
      console.error('Error loading paper by DOI:', err)
      setError('查找论文时发生错误')
    } finally {
      setLoading(false)
    }
  }

  const trackViewCount = async (paperId: string) => {
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

  const handleRatingSubmitted = () => {
    loadPaperByDOI()
  }

  const handleCommentAdded = () => {
    loadPaperByDOI()
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
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded mb-4 w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              论文未找到
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              {error}
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 面包屑导航 */}
      <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-700 flex items-center">
          <Home className="w-4 h-4 mr-1" />
          首页
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span>DOI: {doi}</span>
        {isAdminMode && (
          <>
            <ChevronRight className="w-4 h-4" />
            <Crown className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-600">管理员模式</span>
          </>
        )}
      </nav>

      {/* 快速搜索 */}
      <QuickSearch paper={paper} />

      {/* 论文标题和基本信息 */}
      <div className="bg-white rounded-lg shadow-sm border mb-6 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {paper.title}
        </h1>

        {paper.authors && paper.authors.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-600 mb-3">
            <Users className="w-4 h-4" />
            <span>{paper.authors.join(', ')}</span>
          </div>
        )}

        {paper.publication_date && (
          <div className="flex items-center space-x-2 text-gray-600 mb-3">
            <Calendar className="w-4 h-4" />
            <span>{new Date(paper.publication_date).toLocaleDateString('zh-CN')}</span>
          </div>
        )}

        {paper.journal && (
          <div className="text-gray-600 mb-3">
            <strong>期刊: </strong>
            {paper.journal}
          </div>
        )}

        {paper.doi && (
          <div className="mb-6">
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              <span>DOI: {paper.doi}</span>
            </a>
          </div>
        )}

        {paper.keywords && paper.keywords.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">关键词</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {paper.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {paper.abstract && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">摘要</h3>
            <p className="text-gray-700 leading-relaxed">{paper.abstract}</p>
          </div>
        )}
      </div>

      {/* 评分系统 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">论文评分</h2>
          <RatingDisplay 
            ratings={paper.ratings}
          />
          <div className="mt-4">
            <RatingForm
              paperId={paper.id}
              onRatingSubmitted={handleRatingSubmitted}
            />
          </div>
        </div>

        {/* 管理员报告区域 */}
        {isAdminMode && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <ReportsVisibilityInfo />
            <PaperReports paperId={paper.id} paperTitle={paper.title} />
          </div>
        )}
      </div>

      {/* 评论系统 */}
      <div className="mb-8">
        <CommentForm
          paperId={paper.id}
          onCommentAdded={handleCommentAdded}
        />
        <CommentList
          paperId={paper.id}
        />
      </div>

      {/* Zotero Annotations Section */}
      <div className="mt-8">
        <ZoteroAnnotations
          paperId={paper.id}
          paperTitle={paper.title}
          paperDOI={paper.doi}
        />
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home, FileText } from 'lucide-react'
import { getPaper, getPaperRatings } from '@/lib/database'
import { useAdmin } from '@/contexts/AdminContext'
import { useAuth } from '@/contexts/AuthContext'
import { 
  EvaluationForm, 
  RatingDisplay,
  CommentList,
  PAPER_DIMENSIONS,
  PAPER_DISPLAY_DIMENSIONS
} from '@/components/evaluation/shared'
import ZoteroAnnotations from '@/components/papers/ZoteroAnnotations'
import QuickSearch from '@/components/papers/QuickSearch'
import PaperHeader from '@/components/papers/PaperHeader'
import AbstractSection from '@/components/papers/AbstractSection'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import type { Paper, Rating, User } from '@/lib/supabase'

interface PaperWithDetails extends Paper {
  ratings: (Rating & { users?: User })[]
  view_count?: number
}

export default function PaperDetailPage() {
  const params = useParams()
  // Catch-all route: id is an array, join with '/' to support DOI like "10.1038/xxx"
  const idArray = params.id as string[]
  const paperId = idArray.join('/')
  
  const { isAdminMode, loading: adminLoading } = useAdmin()
  const { user } = useAuth()
  
  useScrollRestoration()
  
  const [paper, setPaper] = useState<PaperWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (paperId) {
      loadPaper()
    }
  }, [paperId]) // eslint-disable-line react-hooks/exhaustive-deps

  const trackViewCount = async (actualPaperId: string) => {
    try {
      await fetch(`/api/papers/${actualPaperId}/views`, {
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
      // getPaper supports both UUID and DOI
      const decodedId = decodeURIComponent(paperId)
      const data = await getPaper(decodedId)
      setPaper(data as PaperWithDetails)
      
      // Track view count using actual paper ID (not the DOI)
      if (data?.id) {
        trackViewCount(data.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load paper')
    } finally {
      setLoading(false)
    }
  }

  const refreshRatings = async () => {
    if (!paper) return
    try {
      const ratings = await getPaperRatings(paper.id)
      setPaper(prev => prev ? { ...prev, ratings: ratings as (Rating & { users?: User })[] } : prev)
    } catch (err) {
      console.error('Failed to refresh ratings:', err)
    }
  }

  const handleRatingSubmitted = () => {
    // Only refresh ratings data, not the entire page
    refreshRatings()
  }

  // Calculate rating stats
  const ratingStats = useMemo(() => {
    if (!paper?.ratings || paper.ratings.length === 0) {
      return { average: 0, count: 0 }
    }
    const sum = paper.ratings.reduce((acc, r) => acc + (r.overall_score || 0), 0)
    return {
      average: sum / paper.ratings.length,
      count: paper.ratings.length
    }
  }, [paper?.ratings])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center space-x-1.5 mb-4">
          <div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        
        {/* Single column skeleton - compact */}
        <div className="space-y-4">
          {/* Header card skeleton with stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 animate-pulse">
            <div className="flex flex-col lg:flex-row lg:gap-4">
              <div className="flex-1">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-1/2"></div>
                <div className="flex gap-3 mb-2">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-14"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-12"></div>
                </div>
              </div>
              <div className="lg:w-40 lg:border-l lg:dark:border-gray-700 lg:pl-4 pt-3 lg:pt-0 border-t lg:border-t-0 dark:border-gray-700">
                <div className="space-y-2 mb-3">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="space-y-1.5">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Abstract skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
            <div className="space-y-1.5">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
          
          {/* Rating section skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 h-48 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 h-48 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-3"></div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">
          <p>{error || '论文不存在'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Breadcrumb Navigation - compact */}
      <nav className="flex items-center space-x-1.5 text-xs text-gray-600 dark:text-gray-400 mb-4">
        <Link
          href="/"
          className="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          <span>首页</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link
          href="/papers"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          论文评价
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs">
          {paper.title.length > 30 ? paper.title.substring(0, 30) + '...' : paper.title}
        </span>
      </nav>

      {/* Main Content: Single column layout - compact spacing */}
      <div className="space-y-4">
        {/* Paper Header with Stats */}
        <PaperHeader 
          paper={paper} 
          rating={ratingStats}
          commentCount={commentCount}
        />
        
        {/* Abstract Section */}
        <AbstractSection abstract={paper.abstract} />
        
        {/* Quick Search Section */}
        <QuickSearch 
          paper={{
            title: paper.title,
            doi: paper.doi,
            authors: paper.authors
          }} 
        />

        {/* Rating Section - Using shared components */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EvaluationForm 
            targetType="paper"
            targetId={paper.id}
            dimensions={PAPER_DIMENSIONS}
            onRatingSubmitted={handleRatingSubmitted}
          />
          <RatingDisplay 
            targetType="paper"
            ratings={paper.ratings?.map(r => ({
              id: r.id,
              dimension1: r.innovation_score ?? null,
              dimension2: r.methodology_score ?? null,
              dimension3: r.practicality_score ?? null,
              overallScore: r.overall_score,
              isAnonymous: r.is_anonymous || false,
              showUsername: r.show_username ?? true,
              createdAt: r.created_at || '',
              user: r.users ? {
                id: r.users.id,
                username: r.users.username ?? null,
                avatarUrl: r.users.avatar_url ?? null
              } : undefined
            })) || []}
            dimensions={PAPER_DISPLAY_DIMENSIONS}
            currentUserId={user?.id}
          />
        </div>

        {/* Comments Section - Using shared components */}
        <CommentList
          targetType="paper"
          targetId={paper.id}
          onCommentCountChange={setCommentCount}
        />

        {/* Zotero Annotations Section */}
        <ZoteroAnnotations
          paperId={paper.id}
          paperTitle={paper.title}
          paperDOI={paper.doi}
        />
      </div>
    </div>
  )
}

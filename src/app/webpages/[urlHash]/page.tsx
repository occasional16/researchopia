'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, ChevronRight, Home, Star, MessageSquare, Globe } from 'lucide-react'
import { EvaluationForm, CommentList, RatingDisplay, WEBPAGE_DIMENSIONS, WEBPAGE_DISPLAY_DIMENSIONS } from '@/components/evaluation/shared'
import { RelatedLinksSection } from '@/components/webpages/RelatedLinksSection'
import BookmarkButton from '@/components/bookmarks/BookmarkButton'
import { useAuth } from '@/contexts/AuthContext'

interface WebpageData {
  id: string
  url: string
  url_hash: string
  title: string | null
  description: string | null
  favicon_url: string | null
  created_at: string
}

interface RatingsStats {
  count: number
  average: {
    dimension1: number
    dimension2: number
    dimension3: number
    overall: number
  }
}

interface RatingData {
  id: string
  dimension1: number | null
  dimension2: number | null
  dimension3: number | null
  overallScore: number
  isAnonymous: boolean
  showUsername?: boolean
  createdAt: string
  user?: {
    id: string
    username: string | null
    avatarUrl: string | null
  }
}

export default function WebpageDetailPage() {
  const params = useParams()
  const urlHash = params.urlHash as string
  const { user } = useAuth()

  const [webpage, setWebpage] = useState<WebpageData | null>(null)
  const [ratingsStats, setRatingsStats] = useState<RatingsStats | null>(null)
  const [ratings, setRatings] = useState<RatingData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadWebpage = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load webpage info via v2 ratings API (which returns webpage info if exists)
      const res = await fetch(`/api/v2/ratings?targetType=webpage&targetId=${urlHash}`, {
        cache: 'no-store'
      })
      if (!res.ok) {
        if (res.status === 404) {
          setError('网页未找到')
        } else {
          throw new Error('Failed to load webpage')
        }
        return
      }
      
      const data = await res.json()
      
      // Also fetch webpage details if available
      const webpageRes = await fetch(`/api/webpages/${urlHash}`, {
        cache: 'no-store'
      })
      if (webpageRes.ok) {
        const webpageData = await webpageRes.json()
        setWebpage(webpageData.webpage)
      }
      
      setRatingsStats(data.stats)
      
      // Map ratings to RatingData format (API returns unified dimension1/2/3 fields)
      if (data.ratings) {
        setRatings(data.ratings.map((r: any) => ({
          id: r.id,
          dimension1: r.dimension1 ?? null,
          dimension2: r.dimension2 ?? null,
          dimension3: r.dimension3 ?? null,
          overallScore: r.overallScore,
          isAnonymous: r.isAnonymous || false,
          showUsername: r.showUsername ?? true,
          createdAt: r.createdAt || '',
          user: r.user ? {
            id: r.user.id,
            username: r.user.username ?? null,
            avatarUrl: r.user.avatarUrl ?? null
          } : undefined
        })))
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load webpage')
    } finally {
      setLoading(false)
    }
  }, [urlHash])

  useEffect(() => {
    if (urlHash) {
      loadWebpage()
    }
  }, [urlHash, loadWebpage])

  const refreshRatings = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/ratings?targetType=webpage&targetId=${urlHash}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!res.ok) return
      
      const data = await res.json()
      setRatingsStats(data.stats)
      
      // Map ratings to RatingData format (API returns unified dimension1/2/3 fields)
      if (data.ratings) {
        setRatings(data.ratings.map((r: any) => ({
          id: r.id,
          dimension1: r.dimension1 ?? null,
          dimension2: r.dimension2 ?? null,
          dimension3: r.dimension3 ?? null,
          overallScore: r.overallScore,
          isAnonymous: r.isAnonymous || false,
          showUsername: r.showUsername ?? true,
          createdAt: r.createdAt || '',
          user: r.user ? {
            id: r.user.id,
            username: r.user.username ?? null,
            avatarUrl: r.user.avatarUrl ?? null
          } : undefined
        })))
      }
    } catch (err) {
      console.error('Failed to refresh ratings:', err)
    }
  }, [urlHash])

  const handleRatingSubmitted = () => {
    // Only refresh ratings data, not the entire page
    refreshRatings()
    setRefreshKey(k => k + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !webpage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
              {error || '网页未找到'}
            </h2>
            <Link
              href="/webpages"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              返回网页列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 flex items-center">
            <Home size={16} className="mr-1" />
            首页
          </Link>
          <ChevronRight size={16} />
          <Link href="/webpages" className="hover:text-gray-700 dark:hover:text-gray-200">
            所有网页
          </Link>
          <ChevronRight size={16} />
          <span className="text-gray-700 dark:text-gray-200 truncate max-w-xs">
            {webpage.title || '未命名网页'}
          </span>
        </nav>

        {/* Webpage Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 p-6 mb-6">
          <div className="flex items-start gap-4">
            {/* Favicon */}
            {webpage.favicon_url && (
              <img
                src={webpage.favicon_url}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {webpage.title || '未命名网页'}
                </h1>
                <BookmarkButton 
                  url={webpage.url}
                  title={webpage.title || undefined}
                  variant="button"
                />
              </div>
              {webpage.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                  {webpage.description}
                </p>
              )}
              <a
                href={webpage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline max-w-full"
                title={webpage.url}
              >
                <Globe size={16} className="mr-1 flex-shrink-0" />
                <span className="truncate">{webpage.url}</span>
                <ExternalLink size={14} className="ml-1 flex-shrink-0" />
              </a>
            </div>
          </div>

          {/* Stats */}
          {ratingsStats && ratingsStats.count > 0 && (
            <div className="flex items-center gap-6 mt-4 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <Star size={18} className="mr-1 text-yellow-500" />
                <span>{ratingsStats.average.overall.toFixed(1)}</span>
                <span className="text-sm ml-1">({ratingsStats.count} 评分)</span>
              </div>
            </div>
          )}
        </div>

        {/* Rating Section - Using shared components */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <EvaluationForm
              targetType="webpage"
              targetId={urlHash}
              dimensions={WEBPAGE_DIMENSIONS}
              url={webpage.url}
              title={webpage.title || undefined}
              onRatingSubmitted={handleRatingSubmitted}
            />
          </div>
          <div>
            <RatingDisplay
              targetType="webpage"
              ratings={ratings}
              dimensions={WEBPAGE_DISPLAY_DIMENSIONS}
              currentUserId={user?.id}
            />
          </div>
        </div>

        {/* Related Links Section */}
        <div className="mb-8">
          <RelatedLinksSection
            urlHash={urlHash}
            webpageId={webpage.id}
            currentUrl={webpage.url}
          />
        </div>

        {/* Comments Section - Using shared components */}
        <div className="space-y-8">
          <CommentList
            key={refreshKey}
            targetType="webpage"
            targetId={urlHash}
            url={webpage.url}
            title={webpage.title || undefined}
          />
        </div>
      </div>
    </div>
  )
}

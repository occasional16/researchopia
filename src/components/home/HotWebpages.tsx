'use client'

import { useState, useEffect } from 'react'
import { Globe, Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

interface HotWebpage {
  url_hash: string
  url: string
  title: string
  average_rating: number
  rating_count: number
}

interface HotWebpagesProps {
  limit?: number
}

export default function HotWebpages({ limit = 5 }: HotWebpagesProps) {
  const { t } = useLanguage()
  const [webpages, setWebpages] = useState<HotWebpage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHotWebpages = async () => {
      try {
        const response = await fetch(`/api/webpages?sortBy=rating&limit=${limit}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setWebpages(data.data.slice(0, limit))
          }
        }
      } catch (error) {
        console.error('Failed to fetch hot webpages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHotWebpages()
  }, [limit])

  // Get hostname from URL for display
  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors h-full">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <Globe className="h-4 w-4 mr-1.5 text-green-600 dark:text-green-400" />
            {t('webpages.hot', '热门网页')}
          </h2>
          <Link
            href="/webpages"
            className="text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            {t('common.viewAll', '全部')}
          </Link>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            {t('common.loading', '加载中...')}
          </div>
        ) : webpages.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            {t('webpages.noData', '暂无数据')}
          </div>
        ) : (
          <div className="space-y-2">
            {webpages.map((webpage, index) => (
              <Link
                key={webpage.url_hash}
                href={`/webpages/${webpage.url_hash}`}
                className="block p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                        #{index + 1}
                      </span>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 truncate">
                        {webpage.title || getHostname(webpage.url)}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center mt-0.5">
                      <ExternalLink className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                      {getHostname(webpage.url)}
                    </p>
                  </div>
                  {webpage.average_rating > 0 && (
                    <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400 flex-shrink-0">
                      <Star className="h-3 w-3 mr-0.5" />
                      <span className="font-medium">{webpage.average_rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

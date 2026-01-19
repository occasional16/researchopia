'use client'

import { Search, BookOpen, Users, Eye, TrendingUp } from 'lucide-react'
import BrandLogo from '@/components/ui/BrandLogo'
import { useLanguage } from '@/contexts/LanguageContext'

interface SiteStats {
  totalPapers: number
  totalUsers: number
  totalVisits: number
  todayVisits: number
}

interface HeroSectionProps {
  searchQuery: string
  searchStatus: 'idle' | 'checking' | 'adding' | 'redirecting' | 'error'
  processingMessage: string | null
  onSearchChange: (query: string) => void
  onSearch: (e: React.FormEvent) => void
  detectInputType: (input: string) => 'doi' | 'arxiv' | 'general'
  stats?: SiteStats
  statsLoading?: boolean
}

export default function HeroSection({
  searchQuery,
  searchStatus,
  processingMessage,
  onSearchChange,
  onSearch,
  detectInputType,
  stats,
  statsLoading = false
}: HeroSectionProps) {
  const { t } = useLanguage()

  return (
    <div className="text-center py-6 md:py-8 bg-gradient-to-r from-purple-600 to-blue-700 rounded-lg text-white">
      {/* Logo展示 */}
      <div className="mb-4">
        <BrandLogo 
          size={100} 
          variant="icon-only" 
          theme="gradient" 
          animated={true}
          className="mx-auto"
        />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold mb-1.5">
        {t('site.title', '研学港 Researchopia')}
      </h1>
      <p className="text-sm md:text-base mb-4 opacity-90">
        {t('site.subtitle', '研学并进，智慧共享')} | {t('site.subtitle') === '研学并进，智慧共享' ? 'Where Research Meets Community' : '研学并进，智慧共享'}
      </p>
      
      {/* Search Bar */}
      <div className="max-w-2xl mx-auto">
        <form onSubmit={onSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('home.search.placeholder', '搜索论文标题、作者、DOI或关键词...')}
            disabled={searchStatus === 'checking' || searchStatus === 'adding' || searchStatus === 'redirecting'}
            className="w-full pl-12 pr-32 py-4 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 disabled:bg-gray-100 dark:disabled:bg-gray-700 transition-colors"
          />
          <Search className="absolute left-4 top-4 h-6 w-6 text-gray-400 dark:text-gray-500" />
          <button
            type="submit"
            disabled={searchStatus !== 'idle' || !searchQuery.trim()}
            className={`absolute right-2 top-2 px-6 py-2 rounded-md transition-all duration-200 flex items-center gap-2 ${
              searchStatus !== 'idle'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : !searchQuery.trim() 
                  ? 'bg-[#155DFC] text-white hover:bg-[#1347CC] cursor-not-allowed opacity-75'
                  : detectInputType(searchQuery) === 'doi'
                    ? 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg transform hover:scale-105'
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg transform hover:scale-105'
            }`}
          >
            {searchStatus === 'idle' ? (
              detectInputType(searchQuery) === 'doi' ? (
                <>
                  <BookOpen className="w-4 h-4" />
                  {t('button.search', '查找/添加论文')}
                </>
              ) : (
                t('home.search.button', '智能搜索')
              )
            ) : (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('loading', '处理中')}
              </>
            )}
          </button>
        </form>
        
        {/* 智能提示和处理状态 */}
        <div className="mt-3 text-center min-h-[1.5rem]">
          {processingMessage ? (
            <p className="text-sm text-white/90 font-medium animate-pulse">
              {processingMessage}
            </p>
          ) : searchQuery.trim() ? (
            <p className="text-sm text-white/80">
              {detectInputType(searchQuery) === 'doi' 
                ? '🎯 ' + t('home.search.tip.doi', '检测到DOI格式 - 将自动查找或添加论文')
                : '💡 ' + t('home.search.tip.keyword', '支持关键词搜索，或直接输入DOI自动添加论文')
              }
            </p>
          ) : (
            <p className="text-sm text-white/60">
              💭 {t('home.search.tip.default', '输入论文标题、作者、DOI或关键词开始智能搜索')}
            </p>
          )}
        </div>
      </div>
      
      {/* Inline Stats - 紧凑展示 */}
      {stats && (
        <div className="mt-5 flex justify-center items-center gap-6 text-white/80 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>
              <span className="font-semibold">{statsLoading ? '...' : stats.totalUsers}</span> {t('stats.users', '用户')}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            <span>
              <span className="font-semibold">{statsLoading ? '...' : stats.totalVisits}</span> {t('stats.visits', '访问')}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>
              <span className="font-semibold">{statsLoading ? '...' : stats.todayVisits}</span> {t('stats.todayLabel', '今日')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

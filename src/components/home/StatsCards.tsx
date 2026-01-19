'use client'

import { Users, Eye, TrendingUp } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface SiteStats {
  totalPapers: number
  totalUsers: number
  totalVisits: number
  todayVisits: number
}

interface StatsCardsProps {
  stats: SiteStats
  loading: boolean
}

export default function StatsCards({ stats, loading }: StatsCardsProps) {
  const { t } = useLanguage()

  const cards = [
    {
      icon: Users,
      value: stats.totalUsers,
      label: t('stats.users', '注册用户'),
      color: 'text-green-600 dark:text-green-400'
    },
    {
      icon: Eye,
      value: stats.totalVisits,
      label: t('stats.visits', '总访问量'),
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      icon: TrendingUp,
      value: stats.todayVisits,
      label: t('stats.todayVisits', '今日访问'),
      color: 'text-orange-600 dark:text-orange-400'
    }
  ]

  return (
    <div className="grid grid-cols-3 gap-3 md:gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 md:p-6 text-center transition-colors"
          >
            <Icon className={`h-6 w-6 md:h-8 md:w-8 ${card.color} mx-auto mb-2`} />
            <div className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {loading ? '...' : card.value}
            </div>
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              {card.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

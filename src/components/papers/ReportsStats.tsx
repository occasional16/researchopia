'use client'

import { useState, useEffect } from 'react'
import { Users, Search, Plus, TrendingUp, Crown } from 'lucide-react'

interface ReportsStats {
  totalReports: number
  crawledReports: number
  manualReports: number
  uniqueContributors: number
  topContributor?: {
    name: string
    count: number
  }
}

interface ReportsStatsProps {
  paperId: string
}

export default function ReportsStats({ paperId }: ReportsStatsProps) {
  const [stats, setStats] = useState<ReportsStats>({
    totalReports: 0,
    crawledReports: 0,
    manualReports: 0,
    uniqueContributors: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [paperId])

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/papers/${paperId}/reports/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load reports stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-50 rounded-lg p-4 mb-4">
        <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (stats.totalReports === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6 border border-blue-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <TrendingUp className="w-4 h-4 mr-1 text-blue-600" />
          社区贡献统计
        </h4>
        <span className="text-xs text-gray-500">共建知识库</span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-blue-600">{stats.totalReports}</div>
          <div className="text-xs text-gray-600">总报道数</div>
        </div>
        
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-green-600">{stats.crawledReports}</div>
          <div className="text-xs text-gray-600 flex items-center justify-center">
            <Search className="w-3 h-3 mr-1" />
            智能爬取
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-purple-600">{stats.manualReports}</div>
          <div className="text-xs text-gray-600 flex items-center justify-center">
            <Plus className="w-3 h-3 mr-1" />
            手动添加
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-3 shadow-sm">
          <div className="text-lg font-bold text-orange-600">{stats.uniqueContributors}</div>
          <div className="text-xs text-gray-600 flex items-center justify-center">
            <Users className="w-3 h-3 mr-1" />
            贡献者数
          </div>
        </div>
      </div>
      
      {stats.topContributor && (
        <div className="mt-3 text-center">
          <div className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
            <Crown className="w-3 h-3 mr-1" />
            <span>最佳贡献者: {stats.topContributor.name} ({stats.topContributor.count}条)</span>
          </div>
        </div>
      )}
      
      <div className="mt-3 text-xs text-gray-500 text-center">
        💡 感谢社区成员的共同努力，让学术信息更加丰富完整
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { BarChart3, TrendingUp, Calendar, Users, ArrowUp, ArrowDown } from 'lucide-react'

interface DailyStats {
  visit_date: string
  total_visits: number
  unique_visitors: number
  page_views: number
  created_at: string
  updated_at: string
}

interface StatsSummary {
  totalDays: number
  totalVisits: number
  avgVisitsPerDay: number
  maxVisitsDay: {
    date: string
    visits: number
  } | null
}

export default function VisitStatsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading: authLoading } = useAuth()
  
  const [days, setDays] = useState(30)
  const [stats, setStats] = useState<DailyStats[]>([])
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // 等待认证加载完成 AND profile加载完成
    if (authLoading || (user && !profile)) {
      return
    }
    
    // 检查是否登录和管理员权限
    if (!user || !profile) {
      router.push('/')
      return
    }
    
    if (profile.role !== 'admin') {
      router.push('/')
      return
    }
    
    loadStats()
  }, [user, profile, authLoading, days, router])

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/site/daily-stats?days=${days}`)
      const result = await response.json()
      if (result.success) {
        setStats(result.data.stats)
        setSummary(result.data.summary)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrend = (index: number) => {
    if (index >= stats.length - 1) return null
    const current = stats[index].total_visits
    const previous = stats[index + 1].total_visits
    const change = current - previous
    const percentage = previous > 0 ? (change / previous * 100).toFixed(1) : '0'
    return { change, percentage, isUp: change > 0 }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载统计数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">访问统计</h1>
          <p className="text-gray-600">查看网站每日访问数据和趋势分析</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">时间范围:</span>
            <div className="flex flex-wrap gap-2">
              {[7, 30, 90, 180, 365].map(d => (
                <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${days === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {d}天
                </button>
              ))}
            </div>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">统计天数</span>
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.totalDays}</p>
              <p className="text-sm text-gray-500 mt-1">天</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">总访问量</span>
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.totalVisits.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">次</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">日均访问</span>
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.avgVisitsPerDay.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">次/天</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">最高访问</span>
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{summary.maxVisitsDay?.visits.toLocaleString() || 0}</p>
              <p className="text-sm text-gray-500 mt-1">{summary.maxVisitsDay?.date || '-'}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">访问量趋势</h3>
          <div className="space-y-2">
            {stats.slice(0, 30).reverse().map((stat, index) => {
              const maxVisits = Math.max(...stats.map(s => s.total_visits))
              const percentage = (stat.total_visits / maxVisits) * 100
              const date = new Date(stat.visit_date)
              const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 text-right">{dateStr}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2" style={{ width: `${percentage}%` }}>
                        {percentage > 15 && <span className="text-xs font-medium text-white">{stat.total_visits.toLocaleString()}</span>}
                      </div>
                    </div>
                    {percentage <= 15 && <span className="text-xs font-medium text-gray-600 w-12">{stat.total_visits.toLocaleString()}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">详细数据</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">较前日</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">独立访客</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">页面浏览</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">更新时间</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.map((stat, index) => {
                  const trend = getTrend(index)
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stat.visit_date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.total_visits.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {trend ? (
                          <div className={`flex items-center gap-1 ${trend.isUp ? 'text-green-600' : 'text-red-600'}`}>
                            {trend.isUp ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            <span>{Math.abs(trend.change)}</span>
                            <span className="text-xs">({trend.percentage}%)</span>
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.unique_visitors || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stat.page_views || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(stat.updated_at).toLocaleString('zh-CN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Eye, TrendingUp, RefreshCw, Settings } from 'lucide-react'

interface Counter {
  id: string
  counter_name: string
  counter_value: number
  last_updated: string
}

interface VisitStats {
  counters: Counter[]
  statistics: any[]
  recentVisits: any[]
}

export default function VisitStatsManager() {
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/visits')
      const result = await response.json()
      
      if (result.success) {
        setStats(result.data)
        setError(null)
      } else {
        setError(result.message || 'Failed to load stats')
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const updateCounter = async (counterName: string, action: 'reset' | 'set', value?: number) => {
    try {
      setUpdating(true)
      const response = await fetch('/api/admin/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, counterName, value })
      })
      
      const result = await response.json()
      if (result.success) {
        await loadStats() // 重新加载数据
      } else {
        setError(result.message || 'Update failed')
      }
    } catch (err: any) {
      setError(err.message || 'Update error')
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span>加载访问统计...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 text-center py-8">
          <p className="font-medium">❌ {error}</p>
          <button 
            onClick={loadStats}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 实时计数器 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Eye className="h-5 w-5 mr-2 text-blue-600" />
              实时访问计数器
            </h3>
            <button
              onClick={loadStats}
              disabled={updating}
              className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${updating ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
        <div className="p-6">
          {stats?.counters && stats.counters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.counters.map((counter) => (
                <div key={counter.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {counter.counter_name === 'total_visits' ? '总访问量' : 
                         counter.counter_name === 'today_visits' ? '今日访问' : 
                         counter.counter_name}
                      </h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {counter.counter_value.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    最后更新: {new Date(counter.last_updated).toLocaleString('zh-CN')}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => updateCounter(counter.counter_name, 'reset')}
                      disabled={updating}
                      className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      重置为0
                    </button>
                    <button
                      onClick={() => {
                        const value = prompt('设置新值:', counter.counter_value.toString())
                        if (value && !isNaN(Number(value))) {
                          updateCounter(counter.counter_name, 'set', Number(value))
                        }
                      }}
                      disabled={updating}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      设置值
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>暂无计数器数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 最近访问记录 */}
      {stats?.recentVisits && stats.recentVisits.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">最近访问记录</h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP地址
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      访问次数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentVisits.slice(0, 10).map((visit, index) => (
                    <tr key={visit.id || index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(visit.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visit.ip_address || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {visit.visit_count || 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {visit.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

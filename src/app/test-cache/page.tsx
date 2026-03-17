'use client'

import { useState } from 'react'

interface RequestLog {
  id: string // 改用string避免数字重复
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'cache'
}

export default function CacheTestPage() {
  const [logs, setLogs] = useState<RequestLog[]>([])
  const [totalRequests, setTotalRequests] = useState(0)
  const [cacheHits, setCacheHits] = useState(0)
  const [stats, setStats] = useState({
    totalPapers: '-',
    totalUsers: '-',
    todayVisits: '-',
    totalVisits: '-'
  })

  const addLog = (message: string, type: RequestLog['type'] = 'info') => {
    const now = new Date()
    const time = now.toLocaleTimeString('zh-CN', { hour12: false }) + '.' + now.getMilliseconds().toString().padStart(3, '0')
    // 使用唯一字符串ID避免重复
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setLogs(prev => [{ id: uniqueId, time, message, type }, ...prev].slice(0, 50))
  }

  const fetchStats = async () => {
    setTotalRequests(prev => prev + 1)
    const startTime = performance.now()
    
    addLog('GET /api/site/statistics - 开始请求...', 'info')

    try {
      const response = await fetch('/api/site/statistics', {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300'
        }
      })

      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)

      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          setStats({
            totalPapers: data.data.totalPapers?.toString() || '-',
            totalUsers: data.data.totalUsers?.toString() || '-',
            todayVisits: data.data.todayVisits?.toString() || '-',
            totalVisits: data.data.totalVisits?.toString() || '-'
          })
        }

        // 检查缓存(开发环境和生产环境检测方式不同)
        const cacheControl = response.headers.get('Cache-Control')
        const age = response.headers.get('Age')
        const cfCacheStatus = response.headers.get('CF-Cache-Status')
        
        // 开发环境: 通过响应时间判断(缓存<100ms)
        // 生产环境: 通过Age或CF-Cache-Status判断
        const durationNum = parseFloat(duration)
        const isCached = (age && parseInt(age) > 0) || 
                        cfCacheStatus === 'HIT' || 
                        (durationNum < 100 && process.env.NODE_ENV === 'production')
        
        if (isCached) {
          setCacheHits(prev => prev + 1)
          const cacheSource = cfCacheStatus === 'HIT' ? 'Edge缓存' : age ? `浏览器缓存(Age: ${age}s)` : '浏览器缓存'
          addLog(`✅ 200 OK - 缓存命中 [${cacheSource}] - 耗时: ${duration}ms`, 'cache')
        } else {
          addLog(`✅ 200 OK - 缓存未命中 (新请求) - 耗时: ${duration}ms`, 'success')
          addLog(`💡 提示: 开发环境默认禁用浏览器缓存。在生产环境部署后缓存会生效`, 'info')
        }
        
        if (cacheControl) {
          addLog(`📋 Cache-Control: ${cacheControl}`, 'info')
        }
      } else {
        addLog(`❌ ${response.status} ${response.statusText} - 耗时: ${duration}ms`, 'error')
      }
    } catch (error) {
      addLog(`❌ 请求失败: ${error instanceof Error ? error.message : String(error)}`, 'error')
    }
  }

  const fetchMultiple = async (count: number) => {
    addLog(`🔁 开始连续请求 ${count} 次...`, 'info')
    for (let i = 0; i < count; i++) {
      await fetchStats()
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    addLog(`✅ 连续请求完成！观察缓存命中率变化`, 'success')
  }

  const clearLogs = () => {
    setLogs([])
    setTotalRequests(0)
    setCacheHits(0)
    addLog('🗑️ 日志已清空', 'info')
  }

  const hitRate = totalRequests > 0 ? ((cacheHits / totalRequests) * 100).toFixed(1) : '0'

  const getLogColor = (type: RequestLog['type']) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'error': return 'text-red-400'
      case 'cache': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🚀 API缓存优化测试工具</h1>
          <p className="text-gray-600">实时监控API请求和缓存效果</p>
        </div>

        {/* Cache Info */}
        {/* 开发环境警告 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-orange-50 border border-orange-300 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">⚠️ 开发环境提示</h3>
            <p className="text-sm text-orange-800 mb-2">
              当前运行在开发模式下,浏览器缓存被禁用(DevTools → Network → Disable cache默认启用)
            </p>
            <p className="text-sm text-orange-800">
              要测试实际缓存效果,请:<br/>
              1. 构建生产版本: <code className="bg-orange-100 px-2 py-1 rounded">npm run build</code><br/>
              2. 部署到Vercel: <code className="bg-orange-100 px-2 py-1 rounded">vercel --prod</code>
            </p>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">⚡ 缓存策略说明</h3>
          <div className="space-y-1 text-sm text-yellow-800">
            <p>✅ 浏览器缓存: 300秒 (5分钟)</p>
            <p>✅ Edge缓存: 300-600秒</p>
            <p>✅ stale-while-revalidate: 600秒</p>
            <p>📊 预期效果: 5分钟内重复请求直接从缓存返回，不消耗Edge Requests</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fetchStats()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 请求统计数据
            </button>
            <button
              onClick={() => fetchMultiple(5)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              📊 连续请求5次
            </button>
            <button
              onClick={clearLogs}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              🗑️ 清空日志
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">总请求次数</div>
            <div className="text-3xl font-bold text-gray-900">{totalRequests}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">缓存命中</div>
            <div className="text-3xl font-bold text-green-600">{cacheHits}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-sm text-gray-600 mb-2">缓存命中率</div>
            <div className="text-3xl font-bold text-blue-600">{hitRate}%</div>
          </div>
        </div>

        {/* Current Stats */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 当前数据</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4">
              <div className="text-sm opacity-90 mb-1">论文总数</div>
              <div className="text-2xl font-bold">{stats.totalPapers}</div>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
              <div className="text-sm opacity-90 mb-1">用户总数</div>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4">
              <div className="text-sm opacity-90 mb-1">今日访问</div>
              <div className="text-2xl font-bold">{stats.todayVisits}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4">
              <div className="text-sm opacity-90 mb-1">总访问量</div>
              <div className="text-2xl font-bold">{stats.totalVisits}</div>
            </div>
          </div>
        </div>

        {/* Request Log */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 请求日志</h3>
          <div className="bg-gray-900 text-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">暂无日志</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="mb-2 pb-2 border-b border-gray-800">
                  <span className="text-gray-500">[{log.time}]</span>{' '}
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

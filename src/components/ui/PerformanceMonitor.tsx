'use client'

import { useEffect, useState } from 'react'
import { Activity, Clock, Download, Eye } from 'lucide-react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  apiResponseTime: number
  memoryUsage: number
  networkStats: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
  }
}

interface PerformanceMonitorProps {
  show?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export function PerformanceMonitor({ 
  show = false, 
  position = 'bottom-right' 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    apiResponseTime: 0,
    memoryUsage: 0,
    networkStats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    }
  })
  const [isVisible, setIsVisible] = useState(show)

  useEffect(() => {
    const updateMetrics = () => {
      if (typeof window !== 'undefined' && window.performance) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paint = performance.getEntriesByType('paint')
        
        const loadTime = navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0
        const renderTime = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
        
        // 获取内存使用情况（仅在支持的浏览器中）
        const memory = (performance as any).memory
        const memoryUsage = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0

        // 统计网络请求
        const resources = performance.getEntriesByType('resource')
        const apiRequests = resources.filter(resource => 
          resource.name.includes('/api/') || resource.name.includes('api.')
        )
        
        const networkStats = {
          totalRequests: apiRequests.length,
          successfulRequests: apiRequests.filter(req => 
            (req as PerformanceResourceTiming).transferSize > 0
          ).length,
          failedRequests: apiRequests.filter(req => 
            (req as PerformanceResourceTiming).transferSize === 0
          ).length
        }

        setMetrics({
          loadTime: Math.round(loadTime),
          renderTime: Math.round(renderTime),
          apiResponseTime: Math.round(
            apiRequests.reduce((avg, req) => avg + req.duration, 0) / (apiRequests.length || 1)
          ),
          memoryUsage: Math.round(memoryUsage * 100) / 100,
          networkStats
        })
      }
    }

    updateMetrics()
    const interval = setInterval(updateMetrics, 5000) // 每5秒更新一次

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + P 切换性能监控显示
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isVisible && !show) {
    return (
      <div 
        className={`fixed ${getPositionClasses(position)} z-50`}
        title="按 Ctrl+Shift+P 显示性能监控"
      >
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        >
          <Activity className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className={`fixed ${getPositionClasses(position)} z-50 bg-black bg-opacity-90 text-white p-4 rounded-lg shadow-lg min-w-64 font-mono text-xs`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3 border-b border-gray-600 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          <span className="font-semibold">性能监控</span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
          title="隐藏监控面板"
        >
          ×
        </button>
      </div>

      {/* Metrics */}
      <div className="space-y-2">
        {/* Load Time */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>页面加载</span>
          </div>
          <span className={getValueColor(metrics.loadTime, 1000)}>
            {metrics.loadTime}ms
          </span>
        </div>

        {/* Render Time */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Eye className="w-3 h-3 text-purple-400" />
            <span>首屏渲染</span>
          </div>
          <span className={getValueColor(metrics.renderTime, 1500)}>
            {metrics.renderTime}ms
          </span>
        </div>

        {/* API Response Time */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Download className="w-3 h-3 text-yellow-400" />
            <span>API平均响应</span>
          </div>
          <span className={getValueColor(metrics.apiResponseTime, 500)}>
            {metrics.apiResponseTime}ms
          </span>
        </div>

        {/* Memory Usage */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-red-400" />
            <span>内存使用</span>
          </div>
          <span className={getValueColor(metrics.memoryUsage, 50)}>
            {metrics.memoryUsage}MB
          </span>
        </div>

        {/* Network Stats */}
        <div className="pt-2 border-t border-gray-600">
          <div className="text-gray-400 mb-1">网络请求</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">总计:</span>
              <span className="ml-1 text-white">{metrics.networkStats.totalRequests}</span>
            </div>
            <div>
              <span className="text-gray-400">成功:</span>
              <span className="ml-1 text-green-400">{metrics.networkStats.successfulRequests}</span>
            </div>
            <div>
              <span className="text-gray-400">失败:</span>
              <span className="ml-1 text-red-400">{metrics.networkStats.failedRequests}</span>
            </div>
            <div>
              <span className="text-gray-400">成功率:</span>
              <span className="ml-1 text-white">
                {Math.round((metrics.networkStats.successfulRequests / (metrics.networkStats.totalRequests || 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-600 text-gray-400 text-xs">
        <div>Ctrl+Shift+P 切换显示</div>
        <div>每5秒自动更新</div>
      </div>
    </div>
  )
}

function getPositionClasses(position: string): string {
  switch (position) {
    case 'top-left':
      return 'top-4 left-4'
    case 'top-right':
      return 'top-4 right-4'
    case 'bottom-left':
      return 'bottom-4 left-4'
    case 'bottom-right':
      return 'bottom-4 right-4'
    default:
      return 'bottom-4 right-4'
  }
}

function getValueColor(value: number, threshold: number): string {
  if (value <= threshold * 0.5) return 'text-green-400'
  if (value <= threshold) return 'text-yellow-400'
  return 'text-red-400'
}

// 开发环境性能监控组件
export function DevPerformanceMonitor() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <PerformanceMonitor show={false} />
}

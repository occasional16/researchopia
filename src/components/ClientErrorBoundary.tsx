'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface ClientErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

export default function ClientErrorBoundary({ 
  children, 
  fallback: Fallback 
}: ClientErrorBoundaryProps) {
  useEffect(() => {
    // 全局错误处理器
    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return (
    <>
      {children}
    </>
  )
}

// 默认错误展示组件
export function DefaultErrorFallback({ 
  error, 
  reset 
}: { 
  error: Error; 
  reset: () => void 
}) {
  return (
    <div className="min-h-[400px] flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md mx-4">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          页面出现错误
        </h1>
        <p className="text-gray-600 mb-6">
          抱歉，页面加载时出现了问题。请尝试刷新页面或稍后再试。
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              错误详情（开发模式）
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-red-600 whitespace-pre-wrap">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCcw className="h-4 w-4" />
            <span>重试</span>
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

// 简单的错误提示组件
export function SimpleErrorAlert({ 
  error, 
  onDismiss 
}: { 
  error: Error; 
  onDismiss?: () => void 
}) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-red-800 font-medium">出现错误</h3>
          <p className="text-red-700 text-sm mt-1">
            {error.message || '页面加载时出现问题'}
          </p>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
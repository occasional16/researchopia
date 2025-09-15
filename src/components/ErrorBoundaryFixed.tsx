'use client'

import React from 'react'
import { RefreshCcw, AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    // 发送错误报告（如果有监控服务）
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
      })
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const Fallback = this.props.fallback
        return <Fallback error={this.state.error!} reset={this.handleReset} />
      }

      return <DefaultErrorFallback error={this.state.error!} reset={this.handleReset} />
    }

    return this.props.children
  }
}

// 默认错误展示组件
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          页面出现错误
        </h1>
        <p className="text-gray-600 mb-6">
          抱歉，页面加载时出现了问题。请尝试刷新页面或稍后再试。
        </p>
        
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              错误详情（开发模式）
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-red-600 whitespace-pre-wrap max-h-32 overflow-auto">
              {error.message}
              {error.stack && '\n\n' + error.stack}
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
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/'
              }
            }}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

// 主要导出的 ErrorBoundary 组件
export default function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorBoundaryClass {...props} />
}

// 简单的错误展示组件
export function SimpleErrorFallback({ 
  error, 
  resetError 
}: { 
  error: Error; 
  resetError: () => void 
}) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-red-800 font-semibold">出现错误</h3>
          <p className="text-red-700 text-sm mt-1">
            {error.message || '页面加载时出现问题'}
          </p>
          <button
            onClick={resetError}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md w-full">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              服务器错误
            </h1>
            
            <p className="text-gray-600 mb-6">
              抱歉，服务器遇到了问题。我们已经记录了这个错误，请稍后再试。
            </p>

            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  错误详情（开发模式）
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {error.message}
                  {error.digest && `\n\nError ID: ${error.digest}`}
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
              
              <Link
                href="/"
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2"
              >
                <Home className="h-4 w-4" />
                <span>返回首页</span>
              </Link>
            </div>

            <div className="mt-6 text-sm text-gray-500">
              错误ID: {error.digest || '未知'}
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

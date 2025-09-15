'use client'

import React, { Suspense } from 'react'
import { AlertTriangle } from 'lucide-react'

// 简单的加载中组件
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}

// 简单的错误展示组件
function ErrorFallback({ error }: { error: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg m-4">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    </div>
  )
}

// 安全的包装组件
export default function SafeWrapper({ 
  children,
  fallback 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  try {
    return (
      <Suspense fallback={fallback || <LoadingFallback />}>
        {children}
      </Suspense>
    )
  } catch (error) {
    console.error('SafeWrapper caught error:', error)
    return <ErrorFallback error={error instanceof Error ? error.message : '未知错误'} />
  }
}
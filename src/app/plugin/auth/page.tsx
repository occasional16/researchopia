'use client'

import dynamic from 'next/dynamic'

const AuthComponent = dynamic(() => import('./AuthComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  )
})

export default function PluginAuthPage() {
  return <AuthComponent />
}

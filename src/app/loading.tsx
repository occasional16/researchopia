'use client'

import LoadingLogo from '@/components/ui/LoadingLogo'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <LoadingLogo 
          size={100} 
          showText={true}
          className="mb-8"
        />
        
        <div className="space-y-3">
          <div className="text-lg font-semibold text-gray-700">
            正在为您加载内容...
          </div>
          <div className="text-sm text-gray-500">
            研学港致力于为您提供最佳的学术体验
          </div>
        </div>
        
        {/* 进度条动画 */}
        <div className="mt-8 w-64 mx-auto">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

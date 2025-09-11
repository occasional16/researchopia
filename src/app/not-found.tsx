'use client'

import Link from 'next/link'
import { Home, Search, ArrowLeft } from 'lucide-react'
import BrandLogo from '@/components/ui/BrandLogo'

export default function NotFound() {
  const handleGoBack = () => {
    window.history.back()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo区域 */}
        <div className="mb-8">
          <BrandLogo 
            size={120} 
            variant="full" 
            theme="light" 
            animated={true}
            className="mx-auto"
          />
        </div>

        {/* 404错误信息 */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">页面未找到</h2>
          <p className="text-gray-600 leading-relaxed">
            抱歉，您访问的页面不存在。可能是链接错误，或者页面已被移动。
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              <Home className="w-5 h-5 mr-2" />
              返回首页
            </Link>
            
            <Link
              href="/papers"
              className="inline-flex items-center justify-center px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-medium"
            >
              <Search className="w-5 h-5 mr-2" />
              浏览论文
            </Link>
          </div>

          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center px-4 py-2 text-gray-600 hover:text-purple-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回上一页
          </button>
        </div>

        {/* 底部提示 */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            如果问题持续存在，请联系我们的技术支持
          </p>
        </div>
      </div>
    </div>
  )
}

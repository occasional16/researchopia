'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { Book, Globe, Download, Settings } from 'lucide-react'

export default function UserGuidePage() {
  const { t, language } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('guide.title', '研学港用户指南')}
          </h1>
          <p className="text-xl opacity-90">
            {t('guide.subtitle', '详细的使用指南，助您轻松上手研学港的所有功能')}
          </p>
        </div>
      </div>

      {/* 导航卡片 */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* 网站使用指南 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <Globe className="w-8 h-8 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                {t('guide.website.title', '网站使用')}
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              {t('guide.website.desc', '学习如何使用研学港网站的各项功能，包括论文搜索、评分和社区交流。')}
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t('guide.website.feature1', '智能论文搜索')}</li>
              <li>• {t('guide.website.feature2', '多维度评价体系')}</li>
              <li>• {t('guide.website.feature3', '个性化推荐')}</li>
              <li>• {t('guide.website.feature4', '学者档案管理')}</li>
            </ul>
          </div>

          {/* 浏览器扩展 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <Download className="w-8 h-8 text-green-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                {t('guide.extension.title', '浏览器扩展')}
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              {t('guide.extension.desc', '安装和使用研学港浏览器扩展，在任意学术网页上快速访问论文评价。')}
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t('guide.extension.feature1', '自动DOI检测')}</li>
              <li>• {t('guide.extension.feature2', '悬浮拖拽图标')}</li>
              <li>• {t('guide.extension.feature3', '集成侧边栏')}</li>
              <li>• {t('guide.extension.feature4', '一键搜索')}</li>
            </ul>
          </div>

          {/* Zotero插件 */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center mb-4">
              <Book className="w-8 h-8 text-purple-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                {t('guide.zotero.title', 'Zotero插件')}
              </h2>
            </div>
            <p className="text-gray-600 mb-4">
              {t('guide.zotero.desc', '将研学港功能集成到Zotero文献管理器中，无缝管理您的学术资源。')}
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• {t('guide.zotero.feature1', '条目面板集成')}</li>
              <li>• {t('guide.zotero.feature2', '自动评价同步')}</li>
              <li>• {t('guide.zotero.feature3', '灵活配置选项')}</li>
              <li>• {t('guide.zotero.feature4', '多平台支持')}</li>
            </ul>
          </div>
        </div>

        {/* 完整用户指南嵌入 */}
        <div className="mt-16 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                {t('guide.complete.title', '完整用户指南')}
              </h2>
              <Link 
                href="/user-guide.html" 
                target="_blank" 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                {t('guide.complete.openNewTab', '在新窗口中打开')}
              </Link>
            </div>
          </div>
          
          {/* 嵌入iframe */}
          <div className="relative">
            <iframe 
              src="/user-guide.html"
              className="w-full h-[800px] border-none"
              title={t('guide.complete.title', '研学港用户指南')}
            />
          </div>
        </div>

        {/* 快速链接 */}
        <div className="mt-12 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
            {t('guide.quickLinks.title', '快速链接')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link 
              href="/" 
              className="text-center p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="text-blue-600 text-2xl mb-2">🏠</div>
              <div className="text-sm font-medium">{t('nav.home', '首页')}</div>
            </Link>
            <Link 
              href="/papers" 
              className="text-center p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="text-green-600 text-2xl mb-2">📚</div>
              <div className="text-sm font-medium">{t('nav.papers', '论文')}</div>
            </Link>
            <Link 
              href="/profile" 
              className="text-center p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="text-purple-600 text-2xl mb-2">👤</div>
              <div className="text-sm font-medium">{t('nav.profile', '个人中心')}</div>
            </Link>
            <a 
              href="https://github.com/occasional16/researchopia" 
              target="_blank" 
              className="text-center p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="text-gray-600 text-2xl mb-2">💻</div>
              <div className="text-sm font-medium">{t('guide.github', 'GitHub')}</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
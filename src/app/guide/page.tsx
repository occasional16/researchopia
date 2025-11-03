'use client'

import Link from 'next/link'
import { ArrowRight, Search, BookOpen } from 'lucide-react'
import { guideConfig } from './guide-config'

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* 页面头部 */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-700 dark:via-purple-700 dark:to-pink-700 text-white py-20">
        <div className="absolute inset-0 bg-grid-white/10"></div>
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 dark:bg-white/30 backdrop-blur-sm rounded-2xl mb-6">
            <BookOpen className="w-10 h-10" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
            Researchopia 用户指南
          </h1>
          <p className="text-xl md:text-2xl opacity-90 mb-8 max-w-3xl mx-auto">
            详细的使用指南，助您轻松上手 Researchopia 的所有功能
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/guide/getting-started/account"
              className="px-8 py-3 bg-white dark:bg-gray-100 text-blue-600 dark:text-blue-700 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-white transition-all hover:scale-105 shadow-lg flex items-center space-x-2"
            >
              <span>快速开始</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#categories"
              className="px-8 py-3 bg-white/10 dark:bg-white/20 backdrop-blur-sm border-2 border-white/20 dark:border-white/30 text-white rounded-lg font-semibold hover:bg-white/20 dark:hover:bg-white/30 transition-all flex items-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>浏览指南</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 分类卡片 */}
      <div id="categories" className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">探索所有指南</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">选择一个类别开始学习</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {guideConfig.map((category) => (
            <div
              key={category.slug}
              className="group bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-2xl dark:hover:shadow-blue-900/20 transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="p-6">
                {/* 分类头部 */}
                <div className="flex items-center mb-4">
                  <div className="text-4xl mr-4">{category.icon}</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {category.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{category.description}</p>
                  </div>
                </div>

                {/* 分类项目列表 */}
                <ul className="space-y-2 mt-4">
                  {category.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/guide/${category.slug}/${item.slug}`}
                        className="flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/item"
                      >
                        <span className="text-gray-700 dark:text-gray-300 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400">
                          {item.title}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 group-hover/item:translate-x-1 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>

                {/* 查看全部链接 */}
                <Link
                  href={`/guide/${category.slug}/${category.items[0].slug}`}
                  className="mt-4 flex items-center justify-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  开始学习
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 快速链接区域 */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl font-bold text-center mb-8">快速访问</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/"
              className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-4xl mb-2">🏠</div>
              <div className="font-medium">首页</div>
            </Link>
            <Link
              href="/papers"
              className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-4xl mb-2">📚</div>
              <div className="font-medium">论文</div>
            </Link>
            <Link
              href="/profile"
              className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-4xl mb-2">👤</div>
              <div className="font-medium">个人中心</div>
            </Link>
            <a
              href="https://github.com/occasional16/researchopia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all hover:scale-105"
            >
              <div className="text-4xl mb-2">💻</div>
              <div className="font-medium">GitHub</div>
            </a>
          </div>
        </div>
      </div>

      {/* 底部 CTA */}
      <div className="bg-white dark:bg-gray-800 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">需要帮助？</h3>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            如果在使用过程中遇到问题，欢迎查看常见问题或联系我们
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/guide/best-practices/faq"
              className="px-8 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all hover:scale-105"
            >
              查看常见问题
            </Link>
            <a
              href="https://github.com/occasional16/researchopia/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              提交反馈
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
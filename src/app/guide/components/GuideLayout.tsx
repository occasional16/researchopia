'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronRight, Home } from 'lucide-react'
import { guideConfig } from '../guide-config'
import SearchBar from './SearchBar'

interface GuideLayoutProps {
  children: ReactNode
  category?: string
  slug?: string
}

export default function GuideLayout({ children, category, slug }: GuideLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // 滚动监听：向下隐藏，向上显示（与Navbar同步）
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      if (currentScrollY < 10) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* 顶部导航栏 - 固定在Navbar下方，同步响应滚动 */}
      <header className={`fixed top-16 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 左侧 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <Link href="/guide" className="flex items-center space-x-2 font-semibold text-lg px-3 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-all">
                <span className="text-2xl">📖</span>
                <span>用户指南</span>
              </Link>
            </div>

            {/* 中间 - 搜索栏 */}
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <SearchBar />
            </div>

            {/* 右侧 */}
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-1 px-3 py-2 text-sm rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">返回首页</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 内容区域 - 添加top padding为header高度（16+16=32） */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-32">
        {/* 移动端搜索栏 */}
        <div className="md:hidden mb-4">
          <SearchBar />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* 侧边栏 */}
          <aside
            className={`
              lg:w-64 flex-shrink-0
              ${sidebarOpen ? 'block' : 'hidden lg:block'}
            `}
          >
            <nav className="sticky top-40 space-y-6">
              {guideConfig.map((cat) => (
                <div key={cat.slug} className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <span className="text-xl">{cat.icon}</span>
                    <span>{cat.title}</span>
                  </div>
                  <ul className="space-y-1 ml-7">
                    {cat.items.map((item) => {
                      const isActive = pathname === `/guide/${cat.slug}/${item.slug}`
                      return (
                        <li key={item.slug}>
                          <Link
                            href={`/guide/${cat.slug}/${item.slug}`}
                            onClick={() => setSidebarOpen(false)}
                            className={`
                              block px-3 py-2 text-sm rounded-md transition-colors
                              ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                              }
                            `}
                          >
                            {item.title}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* 主内容区 */}
          <main className="flex-1 min-w-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 lg:p-8 transition-colors">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

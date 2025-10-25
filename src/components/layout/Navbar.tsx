'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User, LogOut, UserCircle, Shield, Book, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import AuthModal from '@/components/auth/AuthModal'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'

export default function Navbar() {
  const { user, profile, signOut, isAuthenticated, loading, getAccessToken } = useAuth()
  const { t } = useLanguage()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // 调试日志
  useEffect(() => {
    console.log('🔍 Navbar状态:', { 
      user: !!user, 
      profile: !!profile, 
      isAuthenticated, 
      loading,
      userEmail: user?.email,
      profileUsername: profile?.username
    })
  }, [user, profile, isAuthenticated, loading])

  // 使用 useMemo 缓存用户状态
  const userState = useMemo(() => ({
    isLoggedIn: isAuthenticated && !!user,
    isAdmin: profile?.role === 'admin',
    displayName: profile?.username || user?.email?.split('@')[0] || 'User',
    email: user?.email
  }), [user, profile, isAuthenticated])

  useEffect(() => {
    const handleShowAuthModal = (event: CustomEvent) => {
      setAuthMode(event.detail.mode || 'login')
      setShowAuthModal(true)
    }

    window.addEventListener('showAuthModal', handleShowAuthModal as EventListener)
    return () => {
      window.removeEventListener('showAuthModal', handleShowAuthModal as EventListener)
    }
  }, [])

  // 加载未读通知数量
  useEffect(() => {
    if (!userState.isLoggedIn) {
      setUnreadCount(0)
      return
    }

    const loadUnreadCount = async () => {
      try {
        const accessToken = await getAccessToken()
        if (!accessToken) return

        const response = await fetch('/api/notifications?limit=1&is_read=false', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setUnreadCount(data.unread_count || 0)
        }
      } catch (error) {
        console.error('Error loading unread count:', error)
      }
    }

    loadUnreadCount()
    // 优化：改为5分钟刷新一次，减少Edge Requests
    const interval = setInterval(loadUnreadCount, 300000) // 5分钟
    return () => clearInterval(interval)
  }, [userState.isLoggedIn])

  const handleAuthClick = useCallback((mode: 'login' | 'signup') => {
    setAuthMode(mode)
    setShowAuthModal(true)
  }, [])

  const handleSignOut = useCallback(async () => {
    try {
      setShowUserMenu(false) // 立即关闭菜单
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
      // 即使出错也要确保UI状态正确
      setShowUserMenu(false)
      // 可以在这里添加用户友好的错误提示
      alert('登出过程中出现问题，但本地状态已清理。请刷新页面。')
    }
  }, [signOut])

  return (
    <>
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <Image 
                  src="/logo-small.svg" 
                  alt="研学港 Researchopia Logo" 
                  width={40} 
                  height={40}
                  className="hover:scale-110 transition-all duration-300 filter group-hover:drop-shadow-lg"
                />
                {/* 悬停时的光晕效果 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 opacity-0 group-hover:opacity-20 transition-all duration-300 blur-sm"></div>
              </div>
              <div className="hidden md:block">
                <div className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors duration-200">{t('site.title', '研学港')}</div>
                <div className="text-xs text-gray-500 group-hover:text-purple-400 transition-colors duration-200 -mt-1">{t('site.subtitle', 'Researchopia')}</div>
              </div>
              {/* 移动端仅显示简化版本 */}
              <div className="md:hidden">
                <div className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors duration-200">{t('site.title', '研学港')}</div>
              </div>
            </Link>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {/* 学术导航链接 */}
              <Link
                href="/academic-navigation"
                className="hidden md:flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition-all shadow-md hover:shadow-lg transform hover:scale-105"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('nav.academicNav', '学术导航')}</span>
              </Link>
              
              {/* 用户指南链接 */}
              <Link
                href="/guide"
                className="hidden md:flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Book className="w-4 h-4" />
                <span>{t('nav.guide', '用户指南')}</span>
              </Link>
              
              {/* PDF演示链接；暂不开放 */}
              {/*<Link
                href="/pdf-demo"
                className="hidden md:flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>PDF阅读器</span>
              </Link>*/}
              
              {/* 语言切换器 */}
              <LanguageSwitcher variant="compact" position="navbar" />
              
              {userState.isLoggedIn ? (
                <>
                  {/* 通知图标；暂不开放 */}
                  {/* <Link
                    href="/notifications"
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Bell className="w-5 h-5 text-gray-600" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link> */}

                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <User size={16} className="text-gray-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {userState.displayName}
                      </span>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                        <Link
                          href="/profile"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setShowUserMenu(false)}
                        >
                          <UserCircle className="w-4 h-4" />
                          <span>{t('nav.profile', '个人中心')}</span>
                        </Link>
                        <div className="border-t border-gray-100 my-1"></div>
                        {userState.isAdmin && (
                          <>
                            <Link
                              href="/admin"
                              className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setShowUserMenu(false)}
                            >
                              <Shield className="w-4 h-4" />
                              <span>{t('nav.admin', '管理员控制台')}</span>
                            </Link>
                            <div className="border-t border-gray-100 my-1"></div>
                          </>
                        )}
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                        >
                          <LogOut size={16} />
                          <span>{t('nav.logout', '退出登录')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleAuthClick('login')}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {t('nav.login', '登录')}
                  </button>
                  <button
                    onClick={() => handleAuthClick('signup')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('nav.register', '注册')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  )
}

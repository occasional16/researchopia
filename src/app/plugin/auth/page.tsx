'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface AuthMessage {
  type: string
  source?: string
  authenticated?: boolean
  user?: any
  token?: string
}

export default function PluginAuthPage() {
  const { user, signIn, signOut, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 监听来自插件的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 验证消息来源（在生产环境中应该更严格）
      if (event.data?.type === 'REQUEST_AUTH_STATUS' && event.data?.source === 'zotero-plugin') {
        sendAuthStatus()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user])

  // 发送认证状态到插件
  const sendAuthStatus = () => {
    const message: AuthMessage = {
      type: 'AUTH_STATUS_RESPONSE',
      authenticated: !!user,
      user: user ? {
        id: user.id,
        name: user.user_metadata?.username || user.email?.split('@')[0] || '用户',
        email: user.email || '',
        username: user.user_metadata?.username || user.email?.split('@')[0] || 'user'
      } : null,
      token: user ? 'supabase-token' : null,
      source: 'researchopia-auth'
    }

    // 发送到父窗口（插件）
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(message, '*')
    }
  }

  // 用户状态变化时自动发送更新
  useEffect(() => {
    if (!loading) {
      sendAuthStatus()
    }
  }, [user, loading])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const { error } = await signIn(email, password)
      if (error) {
        setError(error.message)
      } else {
        // 登录成功，状态会通过useEffect自动发送
        setEmail('')
        setPassword('')
      }
    } catch (err) {
      setError('登录失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await signOut()
      // 登出成功，状态会通过useEffect自动发送
    } catch (err) {
      setError('登出失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[300px] bg-white p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">研学港认证</h2>
          <p className="text-sm text-gray-600">Zotero插件专用认证面板</p>
        </div>

        {user ? (
          // 已登录状态
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">已登录</h3>
                  <div className="mt-1 text-sm text-green-700">
                    <p><strong>用户：</strong>{user.user_metadata?.username || user.email?.split('@')[0] || '用户'}</p>
                    <p><strong>邮箱：</strong>{user.email}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登出中...' : '登出'}
            </button>
          </div>
        ) : (
          // 未登录状态
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入邮箱"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            此页面专为Zotero插件设计，与主网站共享登录状态
          </p>
        </div>
      </div>
    </div>
  )
}

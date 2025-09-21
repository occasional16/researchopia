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

export default function AuthComponent() {
  const { user, signIn, signOut, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 发送认证状态到父窗口
  const sendAuthStatus = () => {
    const message: AuthMessage = {
      type: 'AUTH_STATUS_RESPONSE',
      authenticated: !!user,
      user: user ? {
        id: user.id,
        name: (user as any).user_metadata?.username || user.email?.split('@')[0] || '用户',
        email: user.email || '',
        username: (user as any).user_metadata?.username || user.email?.split('@')[0] || 'user'
      } : null,
      token: user ? 'supabase-token' : undefined,
      source: 'researchopia-auth'
    }
    
    window.parent.postMessage(message, '*')
  }

  // 监听来自插件的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REQUEST_AUTH_STATUS' && event.data?.source === 'zotero-plugin') {
        sendAuthStatus()
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user])

  // 用户状态变化时自动发送状态
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
      await signIn(email, password)
      // 登录成功，状态会通过useEffect自动发送
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
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
      setError(err instanceof Error ? err.message : '登出失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            研学港
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Zotero插件认证
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {user ? (
            // 已登录状态
            <div className="space-y-4">
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">已登录</h3>
                    <div className="mt-1 text-sm text-green-700">
                      <p><strong>用户：</strong>{(user as any).user_metadata?.username || user.email?.split('@')[0] || '用户'}</p>
                      <p><strong>邮箱：</strong>{user.email}</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isLoading ? '登出中...' : '登出'}
              </button>
            </div>
          ) : (
            // 未登录状态
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  邮箱地址
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="请输入邮箱地址"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  密码
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="请输入密码"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? '登录中...' : '登录'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="text-center text-xs text-gray-500">
              <p>此页面专为Zotero插件认证设计</p>
              <p>登录状态将自动同步到插件</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

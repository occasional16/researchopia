'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'

export default function AuthTestPage() {
  const { user, profile, isAuthenticated, signOut, loading } = useAuth()
  const [localStorageData, setLocalStorageData] = useState<string[]>([])
  const [sessionStorageData, setSessionStorageData] = useState<string[]>([])

  useEffect(() => {
    // 检查本地存储中的认证相关数据
    const checkStorage = () => {
      const localKeys = []
      const sessionKeys = []

      // 检查localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          localKeys.push(`${key}: ${localStorage.getItem(key)?.substring(0, 50)}...`)
        }
      }

      // 检查sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          sessionKeys.push(`${key}: ${sessionStorage.getItem(key)?.substring(0, 50)}...`)
        }
      }

      setLocalStorageData(localKeys)
      setSessionStorageData(sessionKeys)
    }

    checkStorage()
    
    // 每秒检查一次存储状态
    const interval = setInterval(checkStorage, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      // 强制刷新页面以测试状态持久性
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const clearAllStorage = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">认证状态测试页面</h1>
        
        {/* 认证状态 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">当前认证状态</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-medium">认证状态:</p>
              <p className={`text-lg ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                {isAuthenticated ? '✅ 已登录' : '❌ 未登录'}
              </p>
            </div>
            <div>
              <p className="font-medium">用户信息:</p>
              <p className="text-sm text-gray-600">
                {user ? `${user.email}` : '无'}
              </p>
            </div>
            <div>
              <p className="font-medium">用户档案:</p>
              <p className="text-sm text-gray-600">
                {profile ? `${profile.username} (${profile.role})` : '无'}
              </p>
            </div>
            <div>
              <p className="font-medium">加载状态:</p>
              <p className="text-sm text-gray-600">
                {loading ? '加载中...' : '已完成'}
              </p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">操作</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleSignOut}
              disabled={!isAuthenticated}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
            >
              登出并刷新页面
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              刷新页面
            </button>
            <button
              onClick={clearAllStorage}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              清除所有存储并刷新
            </button>
          </div>
        </div>

        {/* 存储状态 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">LocalStorage 认证数据</h2>
            {localStorageData.length > 0 ? (
              <ul className="space-y-2">
                {localStorageData.map((item, index) => (
                  <li key={index} className="text-sm text-gray-600 break-all">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">无认证相关数据</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">SessionStorage 认证数据</h2>
            {sessionStorageData.length > 0 ? (
              <ul className="space-y-2">
                {sessionStorageData.map((item, index) => (
                  <li key={index} className="text-sm text-gray-600 break-all">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">无认证相关数据</p>
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">测试说明</h2>
          <ul className="space-y-2 text-blue-700">
            <li>• 登录后，刷新页面应该保持登录状态</li>
            <li>• 登出后，刷新页面应该显示未登录状态</li>
            <li>• 登出后，存储中不应该有认证相关数据</li>
            <li>• 如果登出后刷新页面仍显示登录状态，说明存在安全问题</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

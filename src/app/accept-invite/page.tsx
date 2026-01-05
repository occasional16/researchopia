'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, UserPlus, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export default function AcceptInvitePage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isValidToken, setIsValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    const checkInviteToken = async () => {
      try {
        // Supabase puts tokens in URL hash (after #), not query params
        // Format: /accept-invite#access_token=xxx&refresh_token=xxx&type=invite
        let accessToken: string | null = null
        let refreshToken: string | null = null

        if (typeof window !== 'undefined') {
          const hash = window.location.hash.substring(1) // Remove leading #
          const hashParams = new URLSearchParams(hash)
          accessToken = hashParams.get('access_token')
          refreshToken = hashParams.get('refresh_token')
        }
        
        if (!accessToken || !refreshToken) {
          setError('邀请链接无效或已过期')
          setCheckingToken(false)
          return
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !anonKey) {
          setError('服务配置错误')
          setCheckingToken(false)
          return
        }

        const supabase = createClient(supabaseUrl, anonKey)
        
        // Set session from invite tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (sessionError) {
          setError('邀请链接无效或已过期')
        } else {
          setIsValidToken(true)
          // Get user email for display
          if (data.user?.email) {
            setUserEmail(data.user.email)
          }
        }
      } catch (error) {
        setError('验证邀请链接时出错')
      } finally {
        setCheckingToken(false)
      }
    }

    checkInviteToken()
  }, [])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) return '密码长度至少6位'
    if (pwd.length > 128) return '密码长度不能超过128位'
    if (!/[a-zA-Z]/.test(pwd)) return '密码必须包含字母'
    if (!/\d/.test(pwd)) return '密码必须包含数字'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    // Validate password
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      setLoading(false)
      return
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !anonKey) {
        setError('服务配置错误')
        setLoading(false)
        return
      }

      const supabase = createClient(supabaseUrl, anonKey)

      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        setError('设置密码失败：' + error.message)
      } else {
        setMessage('账户创建成功！正在跳转到首页...')
        setTimeout(() => {
          router.push('/')
        }, 2000)
      }
    } catch (error: any) {
      setError('设置密码过程中出现错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">验证邀请链接...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">邀请链接无效</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <p className="text-sm text-gray-500 mb-6">
              邀请链接可能已过期或已被使用。请联系邀请人重新发送邀请。
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <UserPlus className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">🎉 欢迎加入研学港！</h2>
            <p className="text-gray-600 mt-2">请设置您的账户密码</p>
            {userEmail && (
              <p className="text-sm text-green-600 mt-2">
                账户邮箱: {userEmail}
              </p>
            )}
          </div>

          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
              <span className="text-green-700">{message}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                设置密码
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                  placeholder="至少6位，包含字母和数字"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                确认密码
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                  placeholder="再次输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  创建中...
                </>
              ) : (
                '完成注册'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-800 mb-2">🔬 研学港功能特色</p>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 共享论文标注与笔记</li>
                <li>• 与 Zotero 无缝集成</li>
                <li>• 学术协作与讨论</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

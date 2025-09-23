'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { validateEducationalEmail } from '@/lib/emailValidation'

interface SignUpFormProps {
  onToggleMode: () => void
  onClose?: () => void
}

export default function SignUpForm({ onToggleMode, onClose }: SignUpFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [emailValidation, setEmailValidation] = useState<{
    isValid: boolean
    isEducational: boolean
    institution?: string
    error?: string
  } | null>(null)
  const [usernameValidation, setUsernameValidation] = useState<{
    available: boolean
    message: string
    suggestions?: string[]
    checking?: boolean
  } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { signUp } = useAuth()

  // 防抖检查用户名
  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameValidation(null)
      return
    }

    setUsernameValidation({ available: false, message: '', checking: true })

    try {
      const response = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })

      const result = await response.json()
      setUsernameValidation({
        available: result.available,
        message: result.message,
        suggestions: result.suggestions,
        checking: false
      })
    } catch (error) {
      setUsernameValidation({
        available: false,
        message: '检查失败，请重试',
        checking: false
      })
    }
  }, [])

  // 用户名输入防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) {
        checkUsername(username)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, checkUsername])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setError('')

    if (value.trim()) {
      const validation = validateEducationalEmail(value)
      setEmailValidation(validation)
    } else {
      setEmailValidation(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate email first
    const emailValidation = validateEducationalEmail(email)
    if (!emailValidation.isValid) {
      setError(emailValidation.error || '邮箱验证失败')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('密码不匹配')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      setLoading(false)
      return
    }

    // 检查密码复杂度
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('密码必须包含字母和数字')
      setLoading(false)
      return
    }

    // 检查用户名可用性
    if (!usernameValidation?.available) {
      setError(usernameValidation?.message || '请检查用户名')
      setLoading(false)
      return
    }

    try {
      await signUp(email, password, username)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          <h3 className="font-medium">注册成功！</h3>
          <p className="text-sm mt-1">请检查您的邮箱并点击确认链接来激活账户。</p>
        </div>
        <button
          onClick={onToggleMode}
          className="text-blue-600 hover:text-blue-500 font-medium"
        >
          返回登录
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">注册</h2>
      
      {/* 注册说明 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-green-900 mb-2">🎓 教育账户注册</h3>
        <p className="text-sm text-green-700 mb-2">
          使用教育邮箱注册，享受完整学术评价功能
        </p>
        <div className="text-xs text-green-600">
          <div>• 支持: .edu.cn, .edu, .ac.uk 等教育域名</div>
          <div>• 数据云端安全存储</div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            用户名
          </label>
          <div className="relative">
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                usernameValidation?.available === false
                  ? 'border-red-300 bg-red-50'
                  : usernameValidation?.available === true
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300'
              }`}
              placeholder="请输入用户名（3-20个字符）"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {usernameValidation?.checking ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : usernameValidation?.available === true ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : usernameValidation?.available === false ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>
          {usernameValidation?.message && (
            <p className={`text-sm mt-1 ${
              usernameValidation.available ? 'text-green-600' : 'text-red-600'
            }`}>
              {usernameValidation.message}
            </p>
          )}
          {usernameValidation?.suggestions && usernameValidation.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 mb-1">建议用户名：</p>
              <div className="flex flex-wrap gap-1">
                {usernameValidation.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setUsername(suggestion)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            教育邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              emailValidation?.error
                ? 'border-red-300 bg-red-50'
                : emailValidation?.isEducational
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300'
            }`}
            placeholder="请输入教育邮箱（如：student@university.edu.cn）"
          />
          {emailValidation?.error && (
            <p className="text-sm text-red-600 mt-1">{emailValidation.error}</p>
          )}
          {emailValidation?.isEducational && (
            <p className="text-sm text-green-600 mt-1">
              ✓ 有效的教育邮箱
              {emailValidation.institution && ` - ${emailValidation.institution}`}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            仅支持教育机构邮箱注册（.edu.cn、.edu、.ac.uk等）
          </p>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            密码
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              placeholder="请输入密码（至少6位）"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            密码必须包含字母和数字，至少6位
          </p>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              placeholder="请再次输入密码"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '注册中...' : '注册'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          已有账号？{' '}
          <button
            onClick={onToggleMode}
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            立即登录
          </button>
        </p>
      </div>
    </div>
  )
}

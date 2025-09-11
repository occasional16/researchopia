'use client'

import { useState } from 'react'
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

  const { signUp } = useAuth()

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
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入用户名"
          />
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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请输入密码（至少6位）"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            确认密码
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="请再次输入密码"
          />
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

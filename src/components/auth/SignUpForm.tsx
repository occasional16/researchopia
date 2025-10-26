'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { validateEducationalEmail } from '@/lib/emailValidation'
import { validateEmailEnhanced, validateReCaptcha, EmailValidationResult } from '@/lib/emailValidationEnhanced'
import { useReCaptcha } from '@/hooks/useReCaptcha'

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
  const [emailValidation, setEmailValidation] = useState<EmailValidationResult | null>(null)
  const [emailValidating, setEmailValidating] = useState(false)
  const [usernameValidation, setUsernameValidation] = useState<{
    available: boolean
    message: string
    suggestions?: string[]
    checking?: boolean
  } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const { signUp } = useAuth()
  const { executeReCaptcha } = useReCaptcha()

  // 冷却计时器
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // 重新发送验证邮件
  const handleResendVerification = async () => {
    if (!email || resendCooldown > 0) return

    setResendLoading(true)
    setResendMessage('')
    setError('')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const result = await response.json()

      if (response.ok) {
        setResendMessage('✅ ' + (result.message || '验证邮件已发送'))
        setResendCooldown(60) // 60秒冷却
      } else {
        setResendMessage('❌ ' + (result.error || '发送失败'))
      }
    } catch (error) {
      setResendMessage('❌ 网络错误，请重试')
    } finally {
      setResendLoading(false)
    }
  }

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

  // 增强的邮箱验证(移除实时reCAPTCHA检查,只在提交时验证)
  const validateEmailWithDelay = useCallback(async (email: string) => {
    if (!email.trim()) {
      setEmailValidation(null)
      return
    }

    setEmailValidating(true)
    console.log('🔍 开始邮箱验证流程:', email)

    try {
      // 直接进行邮箱格式和教育性验证,跳过reCAPTCHA(减少API调用)
      console.log('📧 验证教育邮箱格式...')
      const validation = await validateEmailEnhanced(email)
      console.log('✅ 邮箱验证完成:', validation)
      setEmailValidation(validation)
    } catch (error) {
      console.error('❌ Email validation error:', error)
      // 降级到基础验证
      console.warn('⚠️ 降级到基础邮箱验证')
      const basicValidation = validateEducationalEmail(email)
      setEmailValidation(basicValidation)
    } finally {
      setEmailValidating(false)
    }
  }, [executeReCaptcha])

  // 用户名输入防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username) {
        checkUsername(username)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, checkUsername])

  // 邮箱验证防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email) {
        validateEmailWithDelay(email)
      }
    }, 800) // 稍长的延迟，因为需要API调用

    return () => clearTimeout(timer)
  }, [email, validateEmailWithDelay])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setError('')
    setEmailValidation(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // 1. 验证reCAPTCHA(最终提交验证)
      console.log('🤖 [注册] 开始执行reCAPTCHA验证...')
      const recaptchaToken = await executeReCaptcha('signup')
      
      if (!recaptchaToken) {
        console.warn('⚠️ [注册] reCAPTCHA token获取失败,但继续注册流程')
        // 不再直接throw错误,允许在服务端降级处理
        // throw new Error('人机验证失败,请刷新页面重试')
      } else {
        console.log('✅ [注册] reCAPTCHA token获取成功')
        
        // 验证 token (可选,服务端也会验证)
        const recaptchaResult = await validateReCaptcha(recaptchaToken, 'signup')
        
        if (!recaptchaResult.isValid) {
          console.warn('⚠️ [注册] reCAPTCHA验证未通过:', recaptchaResult.error)
          console.warn('⚠️ [注册] 继续注册流程,由服务端决定是否允许')
          // 不阻止用户注册,让服务端决定
        }
      }

      // 2. 验证邮箱(已在输入时完成初步验证)
      if (!emailValidation || !emailValidation.isValid) {
        throw new Error('请输入有效的教育邮箱')
      }

      // 3. 检查邮箱可投递性
      if (emailValidation.isDeliverable === false) {
        throw new Error('该邮箱无法接收邮件，请检查拼写或使用其他邮箱')
      }

      // 4. 检查一次性邮箱
      if (emailValidation.isDisposable === true) {
        throw new Error('不支持一次性邮箱，请使用真实的教育邮箱')
      }

      // 5. 验证密码
      if (password !== confirmPassword) {
        throw new Error('密码不匹配')
      }

      if (password.length < 6) {
        throw new Error('密码长度至少6位')
      }

      // 检查密码复杂度
      if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        throw new Error('密码必须包含字母和数字')
      }

      // 6. 检查用户名可用性
      if (!usernameValidation?.available) {
        throw new Error(usernameValidation?.message || '请检查用户名')
      }

      // 7. 执行注册
      await signUp(email, password, username)
      setSuccess(true)

    } catch (err: any) {
      setError(err.message || '注册过程中发生错误，请重试')
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
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 ${
                emailValidation?.error
                  ? 'border-red-300 bg-red-50'
                  : emailValidation?.isValid && emailValidation?.isEducational
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300'
              }`}
              placeholder="请输入教育邮箱（如：student@university.edu.cn）"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {emailValidating ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : emailValidation?.isValid && emailValidation?.isEducational ? (
                <div className="flex items-center space-x-1">
                  {emailValidation?.isDeliverable && (
                    <div title="邮箱可投递">
                      <Shield className="h-3 w-3 text-blue-500" />
                    </div>
                  )}
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              ) : emailValidation?.error ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>

          {/* 错误信息 */}
          {emailValidation?.error && (
            <p className="text-sm text-red-600 mt-1">{emailValidation.error}</p>
          )}

          {/* 成功信息 */}
          {emailValidation?.isValid && emailValidation?.isEducational && (
            <div className="text-sm text-green-600 mt-1">
              <div className="flex items-center space-x-1">
                <span>✓ 有效的教育邮箱</span>
                {emailValidation.institution && <span>- {emailValidation.institution}</span>}
              </div>
              {emailValidation.isDeliverable && (
                <div className="text-xs text-blue-600 mt-1">
                  ✓ 邮箱可正常接收邮件
                </div>
              )}
            </div>
          )}

          {/* 建议 */}
          {emailValidation?.suggestions && emailValidation.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-600 mb-1">建议邮箱：</p>
              <div className="flex flex-wrap gap-1">
                {emailValidation.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setEmail(suggestion)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-1">
            仅支持教育机构邮箱注册（.edu.cn、.edu、.ac.uk等）
          </p>

          {/* 重新发送验证邮件 */}
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={!email || resendLoading || resendCooldown > 0}
              className="text-xs text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendLoading ? (
                <span className="flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  发送中...
                </span>
              ) : resendCooldown > 0 ? (
                `${resendCooldown}秒后可重新发送`
              ) : (
                '已注册但未收到验证邮件？点击重新发送'
              )}
            </button>
          </div>

          {/* 重新发送结果提示 */}
          {resendMessage && (
            <div className={`mt-2 text-xs p-2 rounded ${
              resendMessage.startsWith('✅') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {resendMessage}
            </div>
          )}
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

        {/* 安全验证状态 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 text-sm text-blue-700">
            <Shield className="h-4 w-4" />
            <span className="font-medium">安全验证步骤</span>
          </div>
          <div className="mt-2 space-y-1 text-xs text-blue-600">
            <div className="flex items-center space-x-2">
              {emailValidation?.isEducational ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : emailValidation && !emailValidation.isEducational ? (
                <XCircle className="h-3 w-3 text-red-500" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-gray-300" />
              )}
              <span>1. 教育邮箱验证</span>
            </div>
            <div className="flex items-center space-x-2">
              {emailValidation?.isDeliverable ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : emailValidation && emailValidation.isEducational && emailValidation.isDeliverable === false ? (
                <XCircle className="h-3 w-3 text-red-500" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-gray-300" />
              )}
              <span>2. 邮箱可投递性检查</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-3 w-3 text-blue-500" />
              <span>3. Google reCAPTCHA 人机验证（提交时自动执行）</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !emailValidation?.isValid || emailValidating}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>注册中...</span>
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              <span>安全注册</span>
            </>
          )}
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

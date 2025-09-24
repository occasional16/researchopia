'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token')
      const email = searchParams.get('email')

      if (!token || !email) {
        setStatus('error')
        setMessage('验证链接无效，缺少必要参数')
        return
      }

      try {
        const response = await fetch('/api/auth/verify-email-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, email }),
        })

        const result = await response.json()

        if (response.ok && result.success) {
          setStatus('success')
          setMessage('邮箱验证成功！您现在可以正常使用所有功能。')
          
          // 3秒后跳转到登录页面
          setTimeout(() => {
            router.push('/')
          }, 3000)
        } else {
          setStatus('error')
          setMessage(result.error || '验证失败，请重试或联系管理员')
        }
      } catch (error) {
        console.error('Email verification error:', error)
        setStatus('error')
        setMessage('网络错误，请检查网络连接后重试')
      }
    }

    verifyEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  正在验证邮箱...
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  请稍候，我们正在验证您的邮箱地址
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  验证成功！
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {message}
                </p>
                <p className="mt-4 text-xs text-gray-500">
                  3秒后自动跳转到首页...
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="mx-auto h-12 w-12 text-red-500" />
                <h2 className="mt-4 text-xl font-semibold text-gray-900">
                  验证失败
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {message}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/')}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    返回首页
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { ReactNode } from 'react'

interface ReCaptchaProviderProps {
  children: ReactNode
}

export default function ReCaptchaProvider({ children }: ReCaptchaProviderProps) {
  // 直接使用NEXT_PUBLIC_前缀的环境变量（在客户端自动可用）
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  console.log('🔑 ReCaptcha Provider - Site Key:', siteKey ? `${siteKey.substring(0, 8)}...` : 'not configured')
  console.log('🌐 Window available:', typeof window !== 'undefined')

  if (!siteKey) {
    console.warn('⚠️ reCAPTCHA site key not configured, children will render without reCAPTCHA')
    return <>{children}</>
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: true, // Google推荐异步加载
        defer: true, // 延迟执行
        appendTo: 'head',
        nonce: undefined,
      }}
      container={{
        parameters: {
          badge: 'bottomright', // 显示reCAPTCHA徽章
          theme: 'light',
        }
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  )
}

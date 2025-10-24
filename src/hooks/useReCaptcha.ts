'use client'

import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { useCallback } from 'react'

export function useReCaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha()

  const executeReCaptcha = useCallback(async (action: string): Promise<string | null> => {
    console.log('🤖 [useReCaptcha] 准备执行reCAPTCHA, action:', action)
    console.log('🤖 [useReCaptcha] executeRecaptcha 可用:', !!executeRecaptcha)
    
    if (!executeRecaptcha) {
      console.warn('⚠️ [useReCaptcha] reCAPTCHA not available - executeRecaptcha is null')
      console.warn('⚠️ [useReCaptcha] 这可能意味着 GoogleReCaptchaProvider 没有正确加载或站点密钥无效')
      return null
    }

    try {
      console.log('🔄 [useReCaptcha] 开始执行 executeRecaptcha...')
      const token = await executeRecaptcha(action)
      console.log('✅ [useReCaptcha] reCAPTCHA执行成功, token length:', token?.length)
      return token
    } catch (error) {
      console.error('❌ [useReCaptcha] reCAPTCHA execution failed:', error)
      return null
    }
  }, [executeRecaptcha])

  return { executeReCaptcha }
}

// Enhanced email validation with real-time verification
import { validateEducationalEmail } from './emailValidation'

export interface EmailValidationResult {
  isValid: boolean
  isEducational: boolean
  isDeliverable?: boolean
  isDisposable?: boolean
  institution?: string
  error?: string
  suggestions?: string[]
  riskScore?: number
}

export interface ReCaptchaValidationResult {
  isValid: boolean
  score?: number
  error?: string
}

/**
 * 验证reCAPTCHA token
 */
export async function validateReCaptcha(token: string, action: string): Promise<ReCaptchaValidationResult> {
  try {
    const response = await fetch('/api/auth/verify-recaptcha', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, action }),
    })

    const result = await response.json()
    
    if (!response.ok) {
      return {
        isValid: false,
        error: result.message || 'reCAPTCHA验证失败'
      }
    }

    return {
      isValid: result.success,
      score: result.score,
      error: result.success ? undefined : result.message
    }
  } catch (error) {
    console.error('reCAPTCHA validation error:', error)
    return {
      isValid: false,
      error: '网络错误，请重试'
    }
  }
}

/**
 * 增强的邮箱验证（包含真实性检查）
 */
export async function validateEmailEnhanced(email: string): Promise<EmailValidationResult> {
  // 首先进行基础教育邮箱验证
  const basicValidation = validateEducationalEmail(email)
  
  if (!basicValidation.isValid) {
    return {
      isValid: false,
      isEducational: false,
      error: basicValidation.error
    }
  }

  try {
    // 调用邮箱真实性验证API
    const response = await fetch('/api/auth/validate-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const result = await response.json()
    
    if (!response.ok) {
      // 如果API调用失败，仍然返回基础验证结果
      console.warn('Email validation API failed:', result.message)
      return {
        isValid: basicValidation.isValid,
        isEducational: basicValidation.isEducational,
        institution: basicValidation.institution,
        error: undefined // 不显示API错误给用户
      }
    }

    return {
      isValid: result.isValid && basicValidation.isValid,
      isEducational: basicValidation.isEducational,
      isDeliverable: result.isDeliverable,
      isDisposable: result.isDisposable,
      institution: basicValidation.institution,
      suggestions: result.suggestions,
      riskScore: result.riskScore,
      error: result.isValid ? undefined : result.error
    }
  } catch (error) {
    console.error('Enhanced email validation error:', error)
    // 网络错误时返回基础验证结果
    return {
      isValid: basicValidation.isValid,
      isEducational: basicValidation.isEducational,
      institution: basicValidation.institution
    }
  }
}

/**
 * 检查邮箱是否为一次性邮箱
 */
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com',
    'guerrillamail.com',
    'mailinator.com',
    'tempmail.org',
    'yopmail.com',
    'temp-mail.org',
    'throwaway.email',
    'maildrop.cc',
    'sharklasers.com',
    'guerrillamailblock.com'
  ]

  const domain = email.toLowerCase().split('@')[1]
  return disposableDomains.includes(domain)
}

/**
 * 生成邮箱建议
 */
export function generateEmailSuggestions(email: string): string[] {
  const [localPart, domain] = email.toLowerCase().split('@')
  
  if (!domain) return []

  const commonEducationalDomains = [
    'gmail.com',
    'edu.cn',
    'ac.uk',
    'edu',
    'student.edu.cn'
  ]

  const suggestions: string[] = []
  
  // 检查常见拼写错误
  const domainSuggestions: Record<string, string[]> = {
    'gmial.com': ['gmail.com'],
    'gmai.com': ['gmail.com'],
    'yahooo.com': ['yahoo.com'],
    'hotmial.com': ['hotmail.com'],
    'edu.c': ['edu.cn'],
    'edu.c n': ['edu.cn'],
    'ac.u k': ['ac.uk']
  }

  if (domainSuggestions[domain]) {
    domainSuggestions[domain].forEach(suggestedDomain => {
      suggestions.push(`${localPart}@${suggestedDomain}`)
    })
  }

  return suggestions.slice(0, 3) // 最多返回3个建议
}

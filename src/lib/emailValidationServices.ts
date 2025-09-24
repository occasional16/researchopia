// Email validation services abstraction layer
export interface EmailValidationServiceResult {
  isValid: boolean
  isDeliverable: boolean
  isDisposable: boolean
  isFreeEmail: boolean
  riskScore: number
  provider: string
  details?: any
  error?: string
}

export interface EmailValidationService {
  name: string
  validate(email: string): Promise<EmailValidationServiceResult>
}

/**
 * Abstract API Email Validation Service
 */
export class AbstractAPIEmailValidation implements EmailValidationService {
  name = 'AbstractAPI'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async validate(email: string): Promise<EmailValidationServiceResult> {
    try {
      // 使用正确的Abstract API端点
      const response = await fetch(
        `https://emailreputation.abstractapi.com/v1/?api_key=${this.apiKey}&email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        }
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const result = await response.json()

      // 解析Abstract API的实际响应结构
      const deliverability = result.email_deliverability || {}
      const quality = result.email_quality || {}
      const risk = result.email_risk || {}

      const isDeliverable = deliverability.status === 'deliverable'
      const isValidFormat = deliverability.is_format_valid === true
      const isSmtpValid = deliverability.is_smtp_valid === true
      const isDisposable = quality.is_disposable === true
      const isFreeEmail = quality.is_free_email === true

      // 使用质量分数计算风险
      const qualityScore = parseFloat(quality.score || '0')
      const riskScore = 1 - qualityScore // 质量分数越高，风险越低

      return {
        isValid: isValidFormat && isSmtpValid && isDeliverable && qualityScore > 0.7,
        isDeliverable,
        isDisposable,
        isFreeEmail,
        riskScore,
        provider: this.name,
        details: {
          format: isValidFormat,
          smtp: isSmtpValid,
          deliverability: deliverability.status,
          quality: qualityScore,
          riskStatus: risk.address_risk_status
        }
      }
    } catch (error) {
      return {
        isValid: false,
        isDeliverable: false,
        isDisposable: false,
        isFreeEmail: false,
        riskScore: 1.0,
        provider: this.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * EmailJS Email Validation Service (Alternative)
 */
export class EmailJSValidation implements EmailValidationService {
  name = 'EmailJS'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async validate(email: string): Promise<EmailValidationServiceResult> {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const result = await response.json()

      return {
        isValid: result.valid === true,
        isDeliverable: result.deliverable === true,
        isDisposable: result.disposable === true,
        isFreeEmail: result.free === true,
        riskScore: result.valid ? 0.1 : 0.8,
        provider: this.name,
        details: result
      }
    } catch (error) {
      return {
        isValid: false,
        isDeliverable: false,
        isDisposable: false,
        isFreeEmail: false,
        riskScore: 1.0,
        provider: this.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Basic Email Validation (Fallback)
 */
export class BasicEmailValidation implements EmailValidationService {
  name = 'Basic'

  async validate(email: string): Promise<EmailValidationServiceResult> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isValid = emailRegex.test(email)

    if (!isValid) {
      return {
        isValid: false,
        isDeliverable: false,
        isDisposable: false,
        isFreeEmail: false,
        riskScore: 1.0,
        provider: this.name,
        error: '邮箱格式不正确'
      }
    }

    // Check against known disposable domains
    const disposableDomains = [
      '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
      'tempmail.org', 'yopmail.com', 'temp-mail.org'
    ]

    const domain = email.toLowerCase().split('@')[1]
    const isDisposable = disposableDomains.includes(domain)

    // Check for free email providers
    const freeEmailDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      '163.com', 'qq.com', '126.com'
    ]
    const isFreeEmail = freeEmailDomains.includes(domain)

    // 基础验证：检查教育域名和可疑域名
    const isLikelyEducational = this.isLikelyEducationalDomain(domain)
    const isDeliverable = isLikelyEducational && !isDisposable

    return {
      isValid: isDeliverable,
      isDeliverable,
      isDisposable,
      isFreeEmail,
      riskScore: isDeliverable ? 0.3 : 0.8,
      provider: this.name,
      error: isDeliverable ? undefined : '邮箱地址可能无法接收邮件，请检查拼写或使用真实的教育邮箱'
    }
  }

  private isLikelyEducationalDomain(domain: string): boolean {
    // 检查是否为已知的教育域名模式
    const educationalPatterns = [
      /\.edu$/,           // 美国教育域名
      /\.edu\.cn$/,       // 中国教育域名
      /\.ac\.uk$/,        // 英国学术域名
      /\.ac\.jp$/,        // 日本学术域名
      /\.edu\.au$/,       // 澳大利亚教育域名
      /\.ac\.kr$/,        // 韩国学术域名
    ]

    // 检查是否匹配教育域名模式
    const matchesPattern = educationalPatterns.some(pattern => pattern.test(domain))

    // 检查是否为已知的教育机构
    const knownEducationalDomains = [
      'tsinghua.edu.cn', 'pku.edu.cn', 'fudan.edu.cn', 'sjtu.edu.cn',
      'zju.edu.cn', 'nju.edu.cn', 'ustc.edu.cn', 'hit.edu.cn',
      'mit.edu', 'stanford.edu', 'harvard.edu', 'berkeley.edu',
      'oxford.ac.uk', 'cambridge.ac.uk', 'imperial.ac.uk'
    ]

    const isKnownEducational = knownEducationalDomains.includes(domain)

    // 检查是否为明显的假域名（如包含多个连续的a）
    const isSuspiciousDomain = /a{3,}/.test(domain) || domain.includes('fake') || domain.includes('test')

    return (matchesPattern || isKnownEducational) && !isSuspiciousDomain
  }
}

/**
 * Email Validation Service Factory
 */
export class EmailValidationServiceFactory {
  static createService(apiKey?: string): EmailValidationService {
    // 检查API密钥是否有效（不是默认值或测试值）
    const isValidApiKey = apiKey &&
                         apiKey !== 'your_email_validation_api_key' &&
                         apiKey !== 'test_api_key' &&
                         apiKey.length > 10 // 真实API密钥通常较长

    if (isValidApiKey) {
      console.log('🔑 Using AbstractAPI email validation service')
      return new AbstractAPIEmailValidation(apiKey)
    } else {
      console.warn('⚠️ No valid email validation API key found, using basic validation')
      console.warn('Current API key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'undefined')
      return new BasicEmailValidation()
    }
  }
}

/**
 * Enhanced email validation with multiple service fallback
 */
export async function validateEmailWithServices(email: string): Promise<EmailValidationServiceResult> {
  const apiKey = process.env.EMAIL_VALIDATION_API_KEY
  console.log('🔍 Email validation - API Key status:', apiKey ? `${apiKey.substring(0, 8)}...` : 'not configured')

  const service = EmailValidationServiceFactory.createService(apiKey)
  console.log('📧 Using email validation service:', service.name)

  try {
    const result = await service.validate(email)
    console.log('✅ Email validation result:', {
      email,
      isValid: result.isValid,
      isDeliverable: result.isDeliverable,
      provider: result.provider,
      error: result.error
    })

    // If the primary service fails, try basic validation
    if (result.error && service.name !== 'BasicEmailValidation') {
      console.warn(`${service.name} validation failed, falling back to basic validation`)
      const basicService = new BasicEmailValidation()
      const fallbackResult = await basicService.validate(email)
      console.log('🔄 Fallback validation result:', fallbackResult)
      return fallbackResult
    }

    return result
  } catch (error) {
    console.error('❌ Email validation service error:', error)
    // Final fallback
    const basicService = new BasicEmailValidation()
    const fallbackResult = await basicService.validate(email)
    console.log('🆘 Final fallback result:', fallbackResult)
    return fallbackResult
  }
}

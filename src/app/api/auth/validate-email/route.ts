import { NextRequest, NextResponse } from 'next/server'
import { isDisposableEmail, generateEmailSuggestions } from '@/lib/emailValidationEnhanced'
import { validateEmailWithServices } from '@/lib/emailValidationServices'
import {
  emailValidationMonitor,
  emailValidationRateLimit,
  emailValidationCache
} from '@/lib/emailValidationMonitor'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const ip = request.ip || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({
        isValid: false,
        error: '邮箱地址不能为空'
      }, { status: 400 })
    }

    // Rate limiting check
    if (emailValidationRateLimit.isRateLimited(ip)) {
      const remaining = emailValidationRateLimit.getRemainingAttempts(ip)
      return NextResponse.json({
        isValid: false,
        error: '验证请求过于频繁，请稍后再试',
        rateLimitRemaining: remaining
      }, { status: 429 })
    }

    // Record the attempt
    emailValidationRateLimit.recordAttempt(ip)

    // Check cache first
    const cachedResult = emailValidationCache.get(email)
    if (cachedResult) {
      console.log(`📧 Cache hit for email: ${email}`)
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        processingTime: Date.now() - startTime
      })
    }

    // 基础格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        isValid: false,
        error: '邮箱格式不正确'
      })
    }

    // 检查是否为一次性邮箱
    const isDisposable = isDisposableEmail(email)
    if (isDisposable) {
      return NextResponse.json({
        isValid: false,
        isDisposable: true,
        error: '不支持一次性邮箱，请使用真实的教育邮箱'
      })
    }

    try {
      // 使用增强的邮箱验证服务
      const validationResult = await validateEmailWithServices(email)
      const processingTime = Date.now() - startTime

      const response = {
        isValid: validationResult.isValid,
        isDeliverable: validationResult.isDeliverable,
        isDisposable: validationResult.isDisposable,
        isFreeEmail: validationResult.isFreeEmail,
        riskScore: validationResult.riskScore,
        provider: validationResult.provider,
        suggestions: validationResult.isValid ? [] : generateEmailSuggestions(email),
        error: validationResult.isValid ? undefined : (
          validationResult.error || '邮箱地址无法接收邮件，请检查拼写或使用其他邮箱'
        ),
        details: validationResult.details,
        message: validationResult.error ? `验证失败: ${validationResult.error}` : undefined,
        processingTime,
        cached: false
      }

      // Cache the result (only cache successful validations)
      if (validationResult.isValid) {
        emailValidationCache.set(email, response)
      }

      // Log the validation
      emailValidationMonitor.logValidation({
        email,
        isValid: validationResult.isValid,
        isDeliverable: validationResult.isDeliverable,
        isDisposable: validationResult.isDisposable,
        riskScore: validationResult.riskScore,
        provider: validationResult.provider,
        userAgent,
        ip,
        error: validationResult.error,
        processingTime
      })

      return NextResponse.json(response)

    } catch (serviceError) {
      console.error('Email validation service error:', serviceError)
      const processingTime = Date.now() - startTime

      // Log the error
      emailValidationMonitor.logValidation({
        email,
        isValid: false,
        isDeliverable: false,
        isDisposable: false,
        riskScore: 1.0,
        provider: 'Error',
        userAgent,
        ip,
        error: serviceError instanceof Error ? serviceError.message : 'Unknown error',
        processingTime
      })

      // 最终降级到基础验证 - 但要真正验证
      const basicService = new (await import('@/lib/emailValidationServices')).BasicEmailValidation()
      const fallbackResult = await basicService.validate(email)

      return NextResponse.json({
        isValid: fallbackResult.isValid,
        isDeliverable: fallbackResult.isDeliverable,
        isDisposable: fallbackResult.isDisposable,
        isFreeEmail: fallbackResult.isFreeEmail,
        riskScore: fallbackResult.riskScore,
        provider: 'BasicValidation',
        error: fallbackResult.error,
        message: fallbackResult.isValid ? '基础验证通过（API服务不可用）' : '基础验证失败',
        processingTime,
        cached: false
      })
    }

  } catch (error: any) {
    console.error('Email validation error:', error)
    const processingTime = Date.now() - startTime

    // Log the critical error
    emailValidationMonitor.logValidation({
      email: 'unknown',
      isValid: false,
      isDeliverable: false,
      isDisposable: false,
      riskScore: 1.0,
      provider: 'CriticalError',
      userAgent,
      ip,
      error: error.message || 'Critical validation error',
      processingTime
    })

    return NextResponse.json({
      isValid: false,
      error: '验证服务暂时不可用，请重试',
      processingTime
    }, { status: 500 })
  }
}

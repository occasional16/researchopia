import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emailService'
import { emailMonitor } from '@/lib/emailMonitor'
import { validateEducationalEmail } from '@/lib/emailValidation'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { email, verificationUrl } = await request.json()

    if (!email || !verificationUrl) {
      return NextResponse.json({
        success: false,
        error: '邮箱地址和验证链接不能为空'
      }, { status: 400 })
    }

    // Validate email format and educational domain
    const emailValidation = validateEducationalEmail(email)
    if (!emailValidation.isValid) {
      return NextResponse.json({
        success: false,
        error: emailValidation.error || '无效的教育邮箱'
      }, { status: 400 })
    }

    // Check if email is blacklisted
    if (emailMonitor.isBlacklisted(email)) {
      return NextResponse.json({
        success: false,
        error: '该邮箱地址暂时无法接收邮件'
      }, { status: 400 })
    }

    // Check if email service is available
    if (!emailService.isAvailable()) {
      console.warn('Email service not available, falling back to Supabase')
      return NextResponse.json({
        success: false,
        error: '邮件服务暂时不可用，请稍后重试',
        fallback: true
      }, { status: 503 })
    }

    try {
      // Send verification email
      const result = await emailService.sendEmailVerification(email, verificationUrl)
      const processingTime = Date.now() - startTime

      // Log the send attempt
      emailMonitor.logEmailSend({
        to: email,
        subject: '验证您的Researchopia账户',
        type: 'verification',
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        bounced: result.bounced,
        rejected: result.rejected,
        processingTime,
        retryCount: 0
      })

      if (result.success) {
        return NextResponse.json({
          success: true,
          messageId: result.messageId,
          processingTime
        })
      } else {
        return NextResponse.json({
          success: false,
          error: result.error || '邮件发送失败',
          bounced: result.bounced,
          processingTime
        }, { status: 500 })
      }

    } catch (sendError: any) {
      const processingTime = Date.now() - startTime
      
      // Log the error
      emailMonitor.logEmailSend({
        to: email,
        subject: '验证您的Researchopia账户',
        type: 'verification',
        success: false,
        error: sendError.message,
        processingTime,
        retryCount: 0
      })

      return NextResponse.json({
        success: false,
        error: '邮件发送失败，请重试',
        processingTime
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Send verification email error:', error)
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

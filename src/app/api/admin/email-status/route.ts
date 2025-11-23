import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emailService'

export async function GET(request: NextRequest) {
  try {
    // 简单的管理员验证（生产环境应该更严格）
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const status = {
      isAvailable: emailService.isAvailable(),
      config: {
        smtpHost: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        smtpPort: process.env.SMTP_PORT || '587',
        smtpUser: process.env.SMTP_USER || '',
        smtpPassConfigured: !!(process.env.SMTP_PASS),
        fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@researchopia.com',
        fromName: process.env.SMTP_FROM_NAME || 'Researchopia'
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(status)
  } catch (error: any) {
    console.error('Email status check error:', error)
    return NextResponse.json({
      error: 'Failed to check email service status',
      message: error.message
    }, { status: 500 })
  }
}

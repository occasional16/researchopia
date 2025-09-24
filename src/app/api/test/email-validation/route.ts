import { NextRequest, NextResponse } from 'next/server'
import { validateEmailEnhanced } from '@/lib/emailValidationEnhanced'
import { validateEmailWithServices } from '@/lib/emailValidationServices'
import { emailService } from '@/lib/emailService'

export async function POST(request: NextRequest) {
  try {
    const { email, testType } = await request.json()

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    const results: any = {
      email,
      timestamp: new Date().toISOString(),
      tests: {}
    }

    switch (testType) {
      case 'basic':
        // Test basic email validation
        const basicResult = await validateEmailEnhanced(email)
        results.tests.basic = basicResult
        break

      case 'service':
        // Test email validation service
        const serviceResult = await validateEmailWithServices(email)
        results.tests.service = serviceResult
        break

      case 'smtp':
        // Test SMTP service availability
        results.tests.smtp = {
          available: emailService.isAvailable(),
          configured: process.env.SMTP_HOST ? true : false
        }
        break

      case 'full':
        // Run all tests
        const startTime = Date.now()
        
        // Basic validation
        const fullBasicResult = await validateEmailEnhanced(email)
        results.tests.basic = fullBasicResult

        // Service validation
        const fullServiceResult = await validateEmailWithServices(email)
        results.tests.service = fullServiceResult

        // SMTP test
        results.tests.smtp = {
          available: emailService.isAvailable(),
          configured: process.env.SMTP_HOST ? true : false
        }

        // Performance metrics
        results.performance = {
          totalTime: Date.now() - startTime,
          basicTime: 0, // Would need to measure individually
          serviceTime: 0 // Would need to measure individually
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid test type. Use: basic, service, smtp, or full'
        }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error: any) {
    console.error('Email validation test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return test configuration and status
    const config = {
      recaptcha: {
        configured: !!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
        siteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? 'configured' : 'not configured'
      },
      emailValidation: {
        apiKey: process.env.EMAIL_VALIDATION_API_KEY ? 'configured' : 'not configured'
      },
      smtp: {
        host: process.env.SMTP_HOST || 'not configured',
        port: process.env.SMTP_PORT || 'not configured',
        configured: !!(process.env.SMTP_HOST && process.env.SMTP_PASS)
      },
      emailService: {
        available: emailService.isAvailable()
      }
    }

    return NextResponse.json({
      success: true,
      config,
      testEndpoints: {
        basic: 'POST /api/test/email-validation { "email": "test@edu.cn", "testType": "basic" }',
        service: 'POST /api/test/email-validation { "email": "test@edu.cn", "testType": "service" }',
        smtp: 'POST /api/test/email-validation { "email": "test@edu.cn", "testType": "smtp" }',
        full: 'POST /api/test/email-validation { "email": "test@edu.cn", "testType": "full" }'
      }
    })

  } catch (error: any) {
    console.error('Email validation test config error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get test configuration'
    }, { status: 500 })
  }
}

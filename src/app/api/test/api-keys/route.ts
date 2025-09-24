import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      apiKeys: {},
      services: {}
    }

    // 检查环境变量
    const emailApiKey = process.env.EMAIL_VALIDATION_API_KEY
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY
    const smtpPass = process.env.SMTP_PASS

    results.apiKeys = {
      emailValidation: {
        configured: !!emailApiKey,
        value: emailApiKey ? `${emailApiKey.substring(0, 8)}...` : 'not configured',
        isDefault: emailApiKey === 'your_email_validation_api_key',
        length: emailApiKey?.length || 0
      },
      recaptcha: {
        siteKey: {
          configured: !!recaptchaSiteKey,
          value: recaptchaSiteKey ? `${recaptchaSiteKey.substring(0, 8)}...` : 'not configured',
          isTestKey: recaptchaSiteKey === '***REMOVED_SITE_KEY***'
        },
        secretKey: {
          configured: !!recaptchaSecretKey,
          value: recaptchaSecretKey ? `${recaptchaSecretKey.substring(0, 8)}...` : 'not configured',
          isTestKey: recaptchaSecretKey === '***REMOVED_SECRET_KEY***'
        }
      },
      smtp: {
        configured: !!smtpPass,
        value: smtpPass ? `${smtpPass.substring(0, 8)}...` : 'not configured',
        isDefault: smtpPass === 'your_sendgrid_api_key'
      }
    }

    // 测试Abstract API
    if (emailApiKey && emailApiKey !== 'your_email_validation_api_key') {
      try {
        const testResponse = await fetch(
          `https://emailreputation.abstractapi.com/v1/?api_key=${emailApiKey}&email=test@example.com`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          }
        )
        
        results.services.abstractAPI = {
          status: testResponse.status,
          ok: testResponse.ok,
          accessible: testResponse.status !== 401 && testResponse.status !== 403
        }

        if (testResponse.ok) {
          const testResult = await testResponse.json()
          results.services.abstractAPI.sampleResponse = testResult
        }
      } catch (error) {
        results.services.abstractAPI = {
          error: error instanceof Error ? error.message : 'Unknown error',
          accessible: false
        }
      }
    } else {
      results.services.abstractAPI = {
        status: 'not configured',
        accessible: false
      }
    }

    // 测试reCAPTCHA
    if (recaptchaSecretKey) {
      try {
        const testResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            secret: recaptchaSecretKey,
            response: 'test_token'
          }),
        })

        const testResult = await testResponse.json()
        results.services.recaptcha = {
          status: testResponse.status,
          ok: testResponse.ok,
          accessible: testResponse.ok,
          testResult: testResult
        }
      } catch (error) {
        results.services.recaptcha = {
          error: error instanceof Error ? error.message : 'Unknown error',
          accessible: false
        }
      }
    } else {
      results.services.recaptcha = {
        status: 'not configured',
        accessible: false
      }
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('API keys test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { testEmail } = await request.json()
    
    if (!testEmail) {
      return NextResponse.json({
        success: false,
        error: 'Test email is required'
      }, { status: 400 })
    }

    const emailApiKey = process.env.EMAIL_VALIDATION_API_KEY
    
    if (!emailApiKey || emailApiKey === 'your_email_validation_api_key') {
      return NextResponse.json({
        success: false,
        error: 'Email validation API key not configured'
      }, { status: 400 })
    }

    // 测试真实的邮箱验证
    const response = await fetch(
      `https://emailreputation.abstractapi.com/v1/?api_key=${emailApiKey}&email=${encodeURIComponent(testEmail)}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }
    )

    const result = await response.json()

    return NextResponse.json({
      success: true,
      testEmail,
      apiResponse: {
        status: response.status,
        ok: response.ok,
        data: result
      }
    })

  } catch (error) {
    console.error('Email validation test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

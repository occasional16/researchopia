import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { token, action } = await request.json()

    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'reCAPTCHA token is required'
      }, { status: 400 })
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

    if (!secretKey) {
      console.error('reCAPTCHA secret key not configured')
      return NextResponse.json({
        success: false,
        message: 'reCAPTCHA服务未配置'
      }, { status: 500 })
    }

    // 检查是否为测试密钥
    const isTestKey = secretKey === '6Lcco9MrAAAAAE_RcXECKqmAg2dj2SWza7_aGWp1' ||
                     siteKey === '6Lcco9MrAAAAAKtxnQLg6qoy9Ndj0Jb_a7j1bk6E'

    if (isTestKey) {
      console.warn('Using test reCAPTCHA keys - this may not work in production')
      // 在测试环境中，我们可以模拟成功的验证
      return NextResponse.json({
        success: true,
        score: 0.9,
        message: '测试环境验证通过',
        isTest: true
      })
    }

    // 验证reCAPTCHA token
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: request.headers.get('x-forwarded-for')?.split(',')[0] ||
                 request.headers.get('x-real-ip') ||
                 'unknown'
      }),
    })

    const verifyResult = await verifyResponse.json()

    if (!verifyResult.success) {
      console.error('reCAPTCHA verification failed:', verifyResult['error-codes'])
      return NextResponse.json({
        success: false,
        message: '人机验证失败，请重试',
        errors: verifyResult['error-codes']
      }, { status: 400 })
    }

    // 检查action是否匹配
    if (action && verifyResult.action !== action) {
      return NextResponse.json({
        success: false,
        message: 'Invalid action'
      }, { status: 400 })
    }

    // 检查分数（reCAPTCHA v3）
    const score = verifyResult.score || 0
    const minScore = 0.5 // 最低接受分数

    if (score < minScore) {
      console.warn(`Low reCAPTCHA score: ${score} for action: ${action}`)
      return NextResponse.json({
        success: false,
        message: '安全验证未通过，请稍后重试',
        score
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      score,
      action: verifyResult.action,
      hostname: verifyResult.hostname
    })

  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error)
    return NextResponse.json({
      success: false,
      message: '验证服务暂时不可用，请重试'
    }, { status: 500 })
  }
}

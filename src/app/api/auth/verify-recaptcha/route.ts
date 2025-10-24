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
    const isTestKey = secretKey === '***REMOVED_SECRET_KEY***' ||
                     siteKey === '***REMOVED_SITE_KEY***'

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
    console.log('🔐 [verify-recaptcha] 调用Google siteverify API...')
    console.log('🔐 [verify-recaptcha] Token length:', token.length)
    console.log('🔐 [verify-recaptcha] Action:', action)
    
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
    console.log('🔐 [verify-recaptcha] Google API响应:', verifyResult)

    if (!verifyResult.success) {
      console.error('❌ [verify-recaptcha] reCAPTCHA verification failed:', verifyResult['error-codes'])
      return NextResponse.json({
        success: false,
        message: '人机验证失败，请重试',
        errors: verifyResult['error-codes']
      }, { status: 400 })
    }

    // 检查action是否匹配
    if (action && verifyResult.action !== action) {
      console.warn('⚠️ [verify-recaptcha] Action不匹配:', { expected: action, received: verifyResult.action })
      return NextResponse.json({
        success: false,
        message: 'Invalid action'
      }, { status: 400 })
    }

    // 检查分数（reCAPTCHA v3）
    const score = verifyResult.score || 0
    const minScore = 0.5 // 最低接受分数
    console.log('📊 [verify-recaptcha] reCAPTCHA评分:', score, '(最低要求:', minScore, ')')

    if (score < minScore) {
      console.warn(`⚠️ [verify-recaptcha] Low reCAPTCHA score: ${score} for action: ${action}`)
      return NextResponse.json({
        success: false,
        message: '安全验证未通过，请稍后重试',
        score
      }, { status: 400 })
    }

    console.log('✅ [verify-recaptcha] reCAPTCHA验证成功! Score:', score)
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

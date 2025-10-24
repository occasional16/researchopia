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

    // 检查是否为测试密钥(Google提供的通用测试密钥)
    const isGoogleTestKey = 
      secretKey === '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe' || // Google官方测试secret
      siteKey === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'    // Google官方测试site key
    
    // 检查是否为我们自己的测试密钥(可能只在localhost有效)
    const isLocalTestKey = secretKey === '6Lcco9MrAAAAAE_RcXECKqmAg2dj2SWza7_aGWp1' ||
                           siteKey === '6Lcco9MrAAAAAKtxnQLg6qoy9Ndj0Jb_a7j1bk6E'

    if (isGoogleTestKey) {
      console.warn('⚠️ 使用Google官方测试密钥 - 所有请求都会通过验证')
      return NextResponse.json({
        success: true,
        score: 0.9,
        message: '测试环境验证通过',
        isTest: true
      })
    }

    if (isLocalTestKey) {
      console.warn('⚠️ 使用自定义测试密钥 - 可能仅在localhost有效')
      console.warn(`⚠️ 当前请求来自: ${request.headers.get('host')}`)
      console.warn(`⚠️ 如果在生产环境失败,请访问 https://www.google.com/recaptcha/admin 注册新密钥`)
      // 继续执行真实验证,不直接返回成功
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
      console.error('❌ [verify-recaptcha] 完整响应:', JSON.stringify(verifyResult))
      
      // 提供更友好的错误信息
      let errorMessage = '人机验证失败，请重试'
      const errorCodes = verifyResult['error-codes'] || []
      
      if (errorCodes.includes('invalid-input-secret')) {
        errorMessage = 'reCAPTCHA密钥配置错误，请联系管理员'
        console.error('❌ RECAPTCHA_SECRET_KEY 配置错误!')
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = '验证token无效，请刷新页面重试'
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = '验证已过期或重复使用，请重新验证'
      }
      
      return NextResponse.json({
        success: false,
        message: errorMessage,
        errors: errorCodes
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

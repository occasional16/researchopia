import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({
        success: false,
        message: '请输入邮箱地址'
      }, { status: 400 })
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        message: '邮箱格式不正确'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({
        success: false,
        message: '服务配置错误'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, anonKey)

    // 发送密码重置邮件
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`
    })

    if (error) {
      console.error('Password reset error:', error)
      
      // 不暴露具体错误信息，统一返回成功消息
      // 这样可以防止邮箱枚举攻击
      return NextResponse.json({
        success: true,
        message: '如果该邮箱已注册，您将收到密码重置邮件'
      })
    }

    return NextResponse.json({
      success: true,
      message: '密码重置邮件已发送，请检查您的邮箱'
    })

  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailService } from '@/lib/emailService'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({
        error: '邮箱地址不能为空'
      }, { status: 400 })
    }

    // 使用service role查询用户
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: '服务器配置错误'
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 查询用户
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      return NextResponse.json({
        error: '该邮箱未注册，请先注册'
      }, { status: 404 })
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({
        error: '该邮箱已验证，请直接登录'
      }, { status: 400 })
    }

    // 发送验证邮件
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://www.researchopia.com'
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    const verificationUrl = `${baseUrl}/auth/verify?token=${user.id}&email=${encodeURIComponent(email)}`

    if (!emailService.isAvailable()) {
      return NextResponse.json({
        error: '邮件服务暂时不可用，请稍后重试'
      }, { status: 503 })
    }

    const result = await emailService.sendEmailVerification(email, verificationUrl)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '验证邮件已发送，请检查您的邮箱'
      })
    } else {
      return NextResponse.json({
        error: result.error || '邮件发送失败',
        success: false
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Resend verification failed:', error)
    return NextResponse.json({
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

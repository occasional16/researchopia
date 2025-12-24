import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAnon } from '@/lib/supabase/runtime-admin'

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

    // 使用运行时 Supabase 客户端 (Cloudflare Workers 兼容)
    const supabase = getSupabaseAnon()

    // 获取站点URL，确保包含协议前缀
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    // 确保URL包含协议
    if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
      siteUrl = `https://${siteUrl}`
    }
    // 移除尾部斜杠
    siteUrl = siteUrl.replace(/\/$/, '')
    
    const redirectUrl = `${siteUrl}/reset-password`
    console.log('[forgot-password] Sending reset email to:', email, 'redirectTo:', redirectUrl)

    // 发送密码重置邮件
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    })

    if (error) {
      console.error('[forgot-password] Supabase error:', error.message, error)
      
      // Supabase SMTP configuration error - return server error
      // This means the email could not be sent due to server-side issue
      return NextResponse.json({
        success: false,
        message: '邮件发送失败，请稍后重试或联系管理员'
      }, { status: 500 })
    }

    console.log('[forgot-password] Email sent successfully to:', email)
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

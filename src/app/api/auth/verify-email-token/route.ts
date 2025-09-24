import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { token, email } = await request.json()

    if (!token || !email) {
      return NextResponse.json({
        success: false,
        error: '验证参数不完整'
      }, { status: 400 })
    }

    // 使用service role验证和更新用户
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: '服务器配置错误'
      }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 验证token是否为有效的用户ID，并且邮箱匹配
    const { data: user, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(token)

    if (getUserError || !user.user) {
      console.error('❌ Get user error:', getUserError)
      return NextResponse.json({
        success: false,
        error: '无效的验证链接'
      }, { status: 400 })
    }

    // 检查邮箱是否匹配
    if (user.user.email !== decodeURIComponent(email)) {
      return NextResponse.json({
        success: false,
        error: '验证链接与邮箱不匹配'
      }, { status: 400 })
    }

    // 检查用户是否已经验证过
    if (user.user.email_confirmed_at) {
      return NextResponse.json({
        success: true,
        message: '邮箱已经验证过了'
      })
    }

    // 更新用户邮箱验证状态
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(token, {
      email_confirm: true
    })

    if (updateError) {
      console.error('❌ Update user error:', updateError)
      return NextResponse.json({
        success: false,
        error: '验证失败，请重试'
      }, { status: 500 })
    }

    console.log('✅ Email verified successfully for user:', token)

    return NextResponse.json({
      success: true,
      message: '邮箱验证成功'
    })

  } catch (error) {
    console.error('❌ Email verification failed:', error)
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

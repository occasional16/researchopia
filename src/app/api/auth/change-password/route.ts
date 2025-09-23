import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    // 验证新密码强度
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({
        success: false,
        message: '新密码长度至少6位'
      }, { status: 400 })
    }

    if (newPassword.length > 128) {
      return NextResponse.json({
        success: false,
        message: '密码长度不能超过128位'
      }, { status: 400 })
    }

    // 检查密码复杂度
    const hasLetter = /[a-zA-Z]/.test(newPassword)
    const hasNumber = /\d/.test(newPassword)
    
    if (!hasLetter || !hasNumber) {
      return NextResponse.json({
        success: false,
        message: '密码必须包含字母和数字'
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

    // 从请求头获取认证信息
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        message: '未授权访问'
      }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabase = createClient(supabaseUrl, anonKey)

    // 设置用户会话
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '用户认证失败'
      }, { status: 401 })
    }

    // 验证当前密码（通过重新登录验证）
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (signInError) {
      return NextResponse.json({
        success: false,
        message: '当前密码错误'
      }, { status: 400 })
    }

    // 更新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({
        success: false,
        message: '密码更新失败：' + updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '密码修改成功'
    })

  } catch (error: any) {
    console.error('Change password error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({
        success: false,
        message: '密码不能为空'
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

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        message: '用户认证失败'
      }, { status: 401 })
    }

    // 创建一个临时的Supabase客户端来验证密码
    // 这不会影响当前的会话
    const tempSupabase = createClient(supabaseUrl, anonKey)
    
    try {
      // 尝试使用提供的密码登录来验证密码正确性
      const { error: signInError } = await tempSupabase.auth.signInWithPassword({
        email: user.email!,
        password: password
      })

      if (signInError) {
        // 密码错误
        return NextResponse.json({
          success: false,
          message: '密码错误'
        }, { status: 400 })
      }

      // 立即登出临时会话，避免影响原会话
      await tempSupabase.auth.signOut()

      return NextResponse.json({
        success: true,
        message: '密码验证成功'
      })

    } catch (verifyError: any) {
      console.error('Password verification error:', verifyError)
      return NextResponse.json({
        success: false,
        message: '密码验证失败'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Verify password error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

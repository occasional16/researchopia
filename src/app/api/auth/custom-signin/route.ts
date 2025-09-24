import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({
        error: '邮箱和密码不能为空'
      }, { status: 400 })
    }

    // 使用普通客户端进行登录
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: '服务器配置错误'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 尝试登录
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('❌ Custom signin error:', error)
      
      // 提供友好的错误信息
      if (error.message === 'Invalid login credentials') {
        return NextResponse.json({
          error: '登录失败：邮箱或密码错误'
        }, { status: 401 })
      } else if (error.message.includes('Email not confirmed')) {
        return NextResponse.json({
          error: '请先验证您的邮箱地址'
        }, { status: 401 })
      } else if (error.message.includes('Email logins are disabled')) {
        return NextResponse.json({
          error: '邮箱登录功能暂时不可用，请联系管理员'
        }, { status: 503 })
      } else {
        return NextResponse.json({
          error: error.message || '登录失败'
        }, { status: 400 })
      }
    }

    if (!data.user || !data.session) {
      return NextResponse.json({
        error: '登录失败：未能获取用户信息'
      }, { status: 500 })
    }

    console.log('✅ Custom signin successful:', data.user.id)

    return NextResponse.json({
      data,
      error: null
    })

  } catch (error) {
    console.error('❌ Custom signin failed:', error)
    return NextResponse.json({
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

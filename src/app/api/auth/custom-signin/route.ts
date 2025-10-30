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

    // 获取用户详细信息(username, role等)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username, role, avatar_url')
      .eq('id', data.user.id)
      .single()

    if (userError) {
      console.error('⚠️ Get user data error:', userError)
      console.error('⚠️ User ID:', data.user.id)
    }

    console.log('✅ Custom signin successful for user:', data.user.id)
    console.log('📊 User data from users table:', JSON.stringify(userData, null, 2))
    console.log('📊 Final username:', userData?.username || data.user.email?.split('@')[0])

    // 合并用户信息 - 将自定义字段放入user_metadata以符合Supabase标准
    const enrichedData = {
      user: {
        ...data.user,
        user_metadata: {
          ...data.user.user_metadata,
          username: userData?.username || data.user.email?.split('@')[0],
          role: userData?.role || 'user',
          avatar_url: userData?.avatar_url
        },
        // 同时在顶层也保留一份,用于插件等直接访问
        username: userData?.username || data.user.email?.split('@')[0],
        role: userData?.role || 'user',
        avatar_url: userData?.avatar_url
      },
      session: data.session
    }

    return NextResponse.json({
      data: enrichedData,
      error: null
    })

  } catch (error) {
    console.error('❌ Custom signin failed:', error)
    return NextResponse.json({
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

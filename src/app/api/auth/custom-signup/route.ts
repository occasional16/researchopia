import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json()

    if (!email || !password || !username) {
      return NextResponse.json({
        error: '邮箱、密码和用户名不能为空'
      }, { status: 400 })
    }

    // 使用service role创建用户，完全控制邮件发送
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

    // 使用Admin API创建用户，禁用自动邮件发送
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        username,
        full_name: username
      },
      email_confirm: false, // 关键：禁用邮件确认
      phone_confirm: false
    })

    if (error) {
      console.error('❌ Custom signup error:', error)
      return NextResponse.json({
        error: error.message || '注册失败'
      }, { status: 400 })
    }

    if (!data.user) {
      return NextResponse.json({
        error: '注册失败：未能创建用户'
      }, { status: 500 })
    }

    console.log('✅ Custom signup successful:', data.user.id)

    // 创建用户档案
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: data.user.id,
          email: data.user.email,
          username,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])

    if (profileError) {
      console.error('❌ Profile creation error:', profileError)
      // 不抛出错误，因为用户已经创建成功
    } else {
      console.log('✅ User profile created successfully')
    }

    return NextResponse.json({
      data,
      error: null
    })

  } catch (error) {
    console.error('❌ Custom signup failed:', error)
    return NextResponse.json({
      error: '服务器错误，请重试'
    }, { status: 500 })
  }
}

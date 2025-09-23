import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { password, confirmText } = await request.json()

    // 验证确认文本
    if (confirmText !== '删除我的账户') {
      return NextResponse.json({
        success: false,
        message: '请输入正确的确认文本'
      }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({
        success: false,
        message: '请输入当前密码'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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

    // 验证当前密码
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (signInError) {
      return NextResponse.json({
        success: false,
        message: '密码错误'
      }, { status: 400 })
    }

    // 检查是否为管理员账户
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      return NextResponse.json({
        success: false,
        message: '管理员账户不能被删除'
      }, { status: 403 })
    }

    // 使用Service Role Key删除用户数据
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

    try {
      // 1. 删除用户相关数据（评论、收藏等）
      await adminSupabase.from('paper_comments').delete().eq('user_id', user.id)
      await adminSupabase.from('paper_ratings').delete().eq('user_id', user.id)
      await adminSupabase.from('paper_favorites').delete().eq('user_id', user.id)
      
      // 2. 删除用户档案
      await adminSupabase.from('users').delete().eq('id', user.id)
      
      // 3. 删除认证用户
      const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        console.error('Delete user error:', deleteError)
        return NextResponse.json({
          success: false,
          message: '账户删除失败：' + deleteError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '账户已成功删除'
      })

    } catch (error: any) {
      console.error('Account deletion error:', error)
      return NextResponse.json({
        success: false,
        message: '删除过程中出现错误，请联系管理员'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Delete account error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

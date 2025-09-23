import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 敏感用户名列表（与check-username保持一致）
const FORBIDDEN_USERNAMES = [
  'admin', 'administrator', 'root', 'superuser', 'moderator', 'mod',
  'system', 'support', 'help', 'service', 'official', 'staff',
  'manager', 'owner', 'master', 'supervisor', 'operator',
  'researchopia', 'research', 'academia', 'academic',
  'null', 'undefined', 'test', 'demo', 'guest', 'anonymous',
  'api', 'www', 'mail', 'email', 'ftp', 'http', 'https'
]

// 检查用户名是否包含敏感词
function containsSensitiveWords(username: string): boolean {
  const lowerUsername = username.toLowerCase()
  
  // 精确匹配敏感词
  if (FORBIDDEN_USERNAMES.includes(lowerUsername)) {
    return true
  }
  
  // 检查是否以敏感词开头或结尾
  const sensitivePatterns = ['admin', 'root', 'system', 'support', 'official', 'staff']
  return sensitivePatterns.some(pattern => 
    lowerUsername.startsWith(pattern) || 
    lowerUsername.endsWith(pattern) ||
    lowerUsername.includes(pattern + '_') ||
    lowerUsername.includes('_' + pattern)
  )
}

// 验证用户名格式
function validateUsernameFormat(username: string): { isValid: boolean; message?: string } {
  if (!username) return { isValid: false, message: '用户名不能为空' }
  if (username.length < 3) return { isValid: false, message: '用户名至少3个字符' }
  if (username.length > 20) return { isValid: false, message: '用户名最多20个字符' }
  
  // 只允许字母、数字、下划线和中文
  const validPattern = /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/
  if (!validPattern.test(username)) {
    return { isValid: false, message: '用户名只能包含字母、数字、下划线和中文' }
  }
  
  // 检查敏感词
  if (containsSensitiveWords(username)) {
    return { isValid: false, message: '该用户名包含敏感词，请选择其他用户名' }
  }
  
  return { isValid: true }
}

export async function POST(request: NextRequest) {
  try {
    const { newUsername, password } = await request.json()

    // 验证新用户名格式
    const formatValidation = validateUsernameFormat(newUsername)
    if (!formatValidation.isValid) {
      return NextResponse.json({
        success: false,
        message: formatValidation.message
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

    // 检查新用户名是否已被使用
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('username')
      .ilike('username', newUsername)
      .neq('id', user.id) // 排除当前用户
      .limit(1)

    if (checkError) {
      console.error('Username check error:', checkError)
      return NextResponse.json({
        success: false,
        message: '检查用户名失败，请重试'
      }, { status: 500 })
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({
        success: false,
        message: '该用户名已被使用'
      }, { status: 400 })
    }

    // 获取当前用户信息
    const { data: currentProfile, error: profileError } = await supabase
      .from('users')
      .select('username, last_username_change')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({
        success: false,
        message: '获取用户信息失败'
      }, { status: 500 })
    }

    // 检查用户名修改频率限制（30天内只能修改一次）
    if (currentProfile.last_username_change) {
      const lastChange = new Date(currentProfile.last_username_change)
      const now = new Date()
      const daysSinceLastChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSinceLastChange < 30) {
        return NextResponse.json({
          success: false,
          message: `用户名修改过于频繁，请等待 ${30 - daysSinceLastChange} 天后再试`
        }, { status: 400 })
      }
    }

    // 更新用户名
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        username: newUsername,
        last_username_change: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Username update error:', updateError)
      return NextResponse.json({
        success: false,
        message: '用户名更新失败：' + updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '用户名修改成功',
      newUsername: newUsername
    })

  } catch (error: any) {
    console.error('Change username error:', error)
    return NextResponse.json({
      success: false,
      message: '服务器错误，请重试'
    }, { status: 500 })
  }
}

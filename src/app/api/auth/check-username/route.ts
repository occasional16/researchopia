import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 敏感用户名列表（禁止使用）
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
    const { username } = await request.json()
    
    // 格式验证
    const formatValidation = validateUsernameFormat(username)
    if (!formatValidation.isValid) {
      return NextResponse.json({
        available: false,
        message: formatValidation.message
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({
        available: false,
        message: '服务暂时不可用'
      })
    }

    const supabase = createClient(supabaseUrl, anonKey)

    // 检查数据库中是否已存在
    const { data: existingUsers, error } = await supabase
      .from('users')
      .select('username')
      .ilike('username', username)
      .limit(1)

    if (error) {
      console.error('Username check error:', error)
      return NextResponse.json({
        available: false,
        message: '检查失败，请重试'
      })
    }

    const isAvailable = !existingUsers || existingUsers.length === 0

    return NextResponse.json({
      available: isAvailable,
      message: isAvailable ? '用户名可用' : '该用户名已被使用',
      suggestions: isAvailable ? [] : generateUsernameSuggestions(username)
    })

  } catch (error: any) {
    console.error('Username check error:', error)
    return NextResponse.json({
      available: false,
      message: '检查失败，请重试'
    })
  }
}

// 生成用户名建议
function generateUsernameSuggestions(username: string): string[] {
  const suggestions = []
  const baseUsername = username.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '')
  
  // 添加数字后缀
  for (let i = 1; i <= 3; i++) {
    suggestions.push(`${baseUsername}${i}`)
  }
  
  // 添加随机数字
  const randomNum = Math.floor(Math.random() * 999) + 100
  suggestions.push(`${baseUsername}${randomNum}`)
  
  // 添加下划线变体
  if (!baseUsername.includes('_')) {
    suggestions.push(`${baseUsername}_user`)
    suggestions.push(`user_${baseUsername}`)
  }
  
  return suggestions.slice(0, 3) // 只返回前3个建议
}

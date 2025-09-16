// 测试认证修复效果
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testAuthFix() {
  console.log('🧪 测试认证修复效果...')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少环境变量')
    return
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // 测试注册
  const testEmail = `test_fix_${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const testUsername = `testuser_${Date.now()}`
  
  try {
    console.log('📝 测试用户注册...')
    console.log('邮箱:', testEmail)
    console.log('用户名:', testUsername)
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          full_name: '测试用户修复'
        }
      }
    })
    
    if (error) {
      console.error('❌ 注册测试失败:', error.message)
      
      if (error.message.includes('Database error saving new user')) {
        console.log('🔧 请在Supabase SQL Editor中运行 fix-auth-database.sql 文件')
      }
      return false
    }
    
    console.log('✅ 注册成功！')
    console.log('用户ID:', data.user?.id)
    console.log('邮箱确认:', data.user?.email_confirmed_at ? '已确认' : '需要确认')
    
    // 等待一下，让触发器完成
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 检查用户是否在users表中
    console.log('📋 检查用户档案是否已创建...')
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user?.id)
      .single()
    
    if (profileError) {
      console.error('❌ 用户档案查询失败:', profileError.message)
      return false
    }
    
    if (userProfile) {
      console.log('✅ 用户档案已创建:')
      console.log('- ID:', userProfile.id)
      console.log('- 邮箱:', userProfile.email)
      console.log('- 用户名:', userProfile.username)
      console.log('- 角色:', userProfile.role)
      console.log('- 创建时间:', userProfile.created_at)
    }
    
    // 测试登录
    console.log('🔐 测试用户登录...')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })
    
    if (loginError) {
      if (loginError.message.includes('Email not confirmed')) {
        console.log('⚠️ 需要邮箱验证，但注册流程正常')
        return true
      } else {
        console.error('❌ 登录测试失败:', loginError.message)
        return false
      }
    }
    
    console.log('✅ 登录成功！')
    console.log('用户ID:', loginData.user?.id)
    
    // 清理测试数据
    await supabase.auth.signOut()
    
    return true
    
  } catch (error) {
    console.error('❌ 测试过程异常:', error.message)
    return false
  }
}

async function main() {
  const success = await testAuthFix()
  
  if (success) {
    console.log('\n🎉 认证系统修复成功！')
    console.log('现在用户可以正常注册和登录了。')
  } else {
    console.log('\n⚠️ 认证系统仍有问题，请检查:')
    console.log('1. 是否在Supabase SQL Editor中运行了 fix-auth-database.sql')
    console.log('2. 检查Supabase Dashboard > Authentication设置')
    console.log('3. 确认环境变量配置正确')
  }
}

main()
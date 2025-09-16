// 简单的认证配置检查
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkAuthConfig() {
  console.log('🔍 检查Supabase认证配置...\n')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // 1. 测试基本连接
  console.log('1️⃣ 测试数据库连接...')
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) {
      console.error('❌ 数据库连接失败:', error.message)
      return
    }
    console.log('✅ 数据库连接成功')
  } catch (e) {
    console.error('❌ 连接异常:', e.message)
    return
  }
  
  // 2. 检查现有用户
  console.log('\n2️⃣ 检查现有用户...')
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('email, username, role, created_at')
      .limit(5)
    
    if (error) {
      console.error('❌ 查询用户失败:', error.message)
    } else {
      console.log(`✅ 用户表中有 ${users.length} 个用户`)
      users.forEach(user => {
        console.log(`- ${user.email} (${user.username}) - ${user.role}`)
      })
    }
  } catch (e) {
    console.error('❌ 用户查询异常:', e.message)
  }
  
  // 3. 使用真实邮箱测试注册
  console.log('\n3️⃣ 使用标准邮箱格式测试注册...')
  const testEmail = 'test@gmail.com'  // 使用标准格式
  const testPassword = 'TestPassword123!'
  
  try {
    console.log('📧 测试邮箱:', testEmail)
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: 'testuser',
          full_name: '测试用户'
        }
      }
    })
    
    if (error) {
      if (error.message.includes('User already registered')) {
        console.log('⚠️ 用户已存在，尝试登录测试...')
        
        // 尝试登录
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        })
        
        if (loginError) {
          if (loginError.message === 'Invalid login credentials') {
            console.log('⚠️ 登录凭据无效 - 这说明用户存在但密码不匹配（正常）')
            console.log('💡 建议：尝试使用您之前注册过的真实账户和密码')
          } else {
            console.error('❌ 登录错误:', loginError.message)
          }
        } else {
          console.log('✅ 登录成功!')
          console.log('用户ID:', loginData.user?.id)
          await supabase.auth.signOut() // 清理
        }
      } else {
        console.error('❌ 注册失败:', error.message)
      }
    } else {
      console.log('✅ 注册成功!')
      console.log('用户ID:', data.user?.id)
      console.log('需要邮箱验证:', !data.user?.email_confirmed_at)
    }
  } catch (e) {
    console.error('❌ 测试异常:', e.message)
  }
  
  console.log('\n4️⃣ 认证配置建议:')
  console.log('📧 邮箱验证问题可能的原因:')
  console.log('1. Supabase项目设置了严格的邮箱验证规则')
  console.log('2. 需要在Supabase Dashboard > Authentication > Settings中:')
  console.log('   - 检查"Enable email confirmations"设置')
  console.log('   - 确认允许的邮箱域名设置')
  console.log('   - 检查SMTP配置是否正确')
  console.log('3. 如果是测试环境，可以暂时禁用邮箱确认')
  
  console.log('\n🎯 解决步骤:')
  console.log('1. 使用真实的Gmail、Outlook等常见邮箱进行测试')
  console.log('2. 检查Supabase Dashboard的Authentication设置')
  console.log('3. 如果仍有问题，可以尝试创建一个新的测试用户')
}

checkAuthConfig()
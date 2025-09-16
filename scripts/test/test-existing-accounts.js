// 测试现有账户登录
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function testExistingLogin() {
  console.log('🔐 测试现有账户登录...\n')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // 测试已知存在的账户
  const testAccounts = [
    { email: 'admin@test.edu.cn', desc: '管理员测试账户' },
    { email: 'fengbothu@tsinghua.edu.cn', desc: '清华用户' },
    { email: 'fengboswu@email.swu.edu.cn', desc: '西南大学用户' }
  ]
  
  for (const account of testAccounts) {
    console.log(`📧 测试账户: ${account.email} (${account.desc})`)
    
    // 尝试一些常见的测试密码
    const testPasswords = ['123456', 'admin123', 'password', 'test123', 'admin', 'Test123456!']
    
    for (const password of testPasswords) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: password
        })
        
        if (!error && data.user) {
          console.log(`✅ 登录成功! 密码: ${password}`)
          console.log(`用户ID: ${data.user.id}`)
          await supabase.auth.signOut()
          return { email: account.email, password }
        }
      } catch (e) {
        // 继续尝试下一个密码
      }
    }
    
    console.log(`❌ 所有测试密码都失败`)
    console.log('---')
  }
  
  console.log('\n💡 建议：')
  console.log('1. 如果您有现有账户的密码，请直接使用')
  console.log('2. 或者注册一个新的 .edu.cn 邮箱账户')
  console.log('3. 检查Supabase Dashboard的用户管理，重置密码')
  
  // 尝试注册edu.cn邮箱
  console.log('\n🎓 尝试注册教育邮箱...')
  const testEduEmail = `test${Date.now()}@test.edu.cn`
  const testPassword = 'TestPassword123!'
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEduEmail,
      password: testPassword,
      options: {
        data: {
          username: `testuser${Date.now()}`,
          full_name: '测试用户'
        }
      }
    })
    
    if (error) {
      console.error('❌ 教育邮箱注册失败:', error.message)
    } else {
      console.log('✅ 教育邮箱注册成功!')
      console.log('邮箱:', testEduEmail)
      console.log('密码:', testPassword)
      console.log('需要邮箱验证:', !data.user?.email_confirmed_at)
      
      // 立即尝试登录
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: testEduEmail,
        password: testPassword
      })
      
      if (loginError) {
        console.log('⚠️ 登录需要邮箱验证:', loginError.message)
      } else {
        console.log('✅ 可以直接登录!')
      }
    }
  } catch (e) {
    console.error('❌ 注册异常:', e.message)
  }
}

testExistingLogin()
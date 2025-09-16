const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testUserLogin() {
  try {
    console.log('🔐 测试用户登录功能...')
    
    // 测试用户账户登录
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'fengbothu@tsinghua.edu.cn',
      password: 'testpassword' // 这是示例密码，实际可能不同
    })
    
    if (authError) {
      console.log('ℹ️  登录错误（预期的）:', authError.message)
      console.log('请使用正确的密码或在网站上重置密码')
    } else {
      console.log('✅ 用户登录成功')
      console.log('用户ID:', authData.user?.id)
      console.log('邮箱:', authData.user?.email)
    }
    
    // 测试数据关联查询（这是之前出错的地方）
    console.log('\n🔍 测试论文数据查询...')
    
    const { data: papersData, error: papersError } = await supabase
      .from('papers')
      .select(`
        *,
        ratings(*),
        comments(*),
        paper_favorites(*)
      `)
      .limit(3)
    
    if (papersError) {
      console.error('❌ 论文数据查询失败:', papersError.message)
    } else {
      console.log('✅ 论文数据查询成功')
      console.log(`找到 ${papersData?.length || 0} 篇论文`)
      
      if (papersData && papersData.length > 0) {
        const paper = papersData[0]
        console.log('\n示例论文数据:')
        console.log(`- 标题: ${paper.title}`)
        console.log(`- 评分数: ${paper.ratings?.length || 0}`)
        console.log(`- 评论数: ${paper.comments?.length || 0}`)
        console.log(`- 收藏数: ${paper.paper_favorites?.length || 0}`)
      }
    }
    
    // 测试用户表查询
    console.log('\n👥 测试用户数据查询...')
    
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, email, username, role')
      .limit(3)
    
    if (usersError) {
      console.error('❌ 用户数据查询失败:', usersError.message)
    } else {
      console.log('✅ 用户数据查询成功')
      console.log(`找到 ${usersData?.length || 0} 个用户`)
    }
    
  } catch (error) {
    console.error('测试失败:', error)
  }
}

testUserLogin()

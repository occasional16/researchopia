// 测试 Supabase 服务器连接
require('dotenv').config({ path: '.env.local' })

console.log('=== 环境变量检查 ===')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || '未设置')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '已设置' : '未设置')

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Service Key 长度:', process.env.SUPABASE_SERVICE_ROLE_KEY.length)
  console.log('Service Key 开头:', process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...')
}

// 简单测试 Supabase 连接
async function testConnection() {
  try {
    const { createClient } = require('@supabase/supabase-js')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('\n✗ 环境变量未设置')
      return
    }
    
    console.log('\n=== 测试 Supabase 连接 ===')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // 测试简单查询
    const { data, error } = await supabase
      .from('papers')
      .select('id, title')
      .limit(1)
    
    if (error) {
      console.log('✗ 连接失败:', error.message)
      console.log('错误详情:', error)
    } else {
      console.log('✓ 连接成功! 返回数据:', data?.length || 0, '条')
      if (data && data.length > 0) {
        console.log('示例数据:', data[0])
      }
    }
  } catch (err) {
    console.log('✗ 测试异常:', err.message)
  }
}

testConnection()

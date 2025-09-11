const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  console.log('SUPABASE_URL:', !!supabaseUrl)
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addViewCountDirect() {
  console.log('开始添加view_count字段...\n')

  try {
    // 方法1: 尝试直接更新一条记录来测试字段是否存在
    console.log('测试view_count字段是否存在...')
    const { data: testData, error: testError } = await supabase
      .from('papers')
      .select('id, view_count')
      .limit(1)

    if (testError && testError.message.includes('column') && testError.message.includes('view_count')) {
      console.log('❌ view_count字段不存在，需要手动添加')
      console.log('\n请在Supabase Dashboard的SQL Editor中运行以下SQL:')
      console.log('---')
      console.log('ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;')
      console.log('UPDATE public.papers SET view_count = 0 WHERE view_count IS NULL;')
      console.log('---')
      console.log('\n然后重新运行此脚本')
      return
    } else if (testError) {
      console.error('❌ 测试错误:', testError.message)
      return
    } else {
      console.log('✅ view_count字段已存在')
      
      // 检查是否有NULL值需要初始化
      console.log('检查NULL值...')
      const { data: nullData, error: nullError } = await supabase
        .from('papers')
        .select('id')
        .is('view_count', null)

      if (nullError) {
        console.error('❌ 检查NULL值失败:', nullError.message)
        return
      }

      if (nullData && nullData.length > 0) {
        console.log(`发现 ${nullData.length} 条记录需要初始化view_count`)
        const { error: updateError } = await supabase
          .from('papers')
          .update({ view_count: 0 })
          .is('view_count', null)

        if (updateError) {
          console.error('❌ 初始化失败:', updateError.message)
        } else {
          console.log('✅ view_count初始化完成')
        }
      } else {
        console.log('✅ 所有记录的view_count都已有值')
      }
    }

    // 显示当前论文数据
    console.log('\n当前论文数据:')
    const { data: papers, error: papersError } = await supabase
      .from('papers')
      .select('id, title, view_count')
      .limit(5)

    if (papersError) {
      console.error('❌ 获取论文数据失败:', papersError.message)
    } else if (papers && papers.length > 0) {
      papers.forEach(paper => {
        console.log(`- ${paper.title.substring(0, 50)}... (view_count: ${paper.view_count || 0})`)
      })
    } else {
      console.log('没有找到论文数据')
    }

  } catch (error) {
    console.error('❌ 脚本执行错误:', error.message)
  }
}

addViewCountDirect()

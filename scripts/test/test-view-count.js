const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testViewCount() {
  console.log('测试查看次数功能...\n')

  try {
    // 1. 获取所有论文并检查view_count字段
    console.log('=== 检查论文表是否包含 view_count 字段 ===')
    const { data: papers, error: papersError } = await supabase
      .from('papers')
      .select('id, title, view_count')
      .limit(5)

    if (papersError) {
      console.error('获取论文失败:', papersError.message)
      return
    }

    if (papers && papers.length > 0) {
      console.log('✅ 论文数据:')
      papers.forEach(paper => {
        console.log(`- ${paper.title.substring(0, 50)}... (view_count: ${paper.view_count || 0})`)
      })
    } else {
      console.log('❌ 没有找到论文数据')
    }

    // 2. 测试更新view_count
    if (papers && papers.length > 0) {
      const testPaper = papers[0]
      console.log(`\n=== 测试更新论文 "${testPaper.title.substring(0, 30)}..." 的查看次数 ===`)
      
      const currentCount = testPaper.view_count || 0
      console.log(`当前查看次数: ${currentCount}`)

      const { error: updateError } = await supabase
        .from('papers')
        .update({ 
          view_count: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', testPaper.id)

      if (updateError) {
        console.error('❌ 更新查看次数失败:', updateError.message)
      } else {
        console.log(`✅ 查看次数已更新为: ${currentCount + 1}`)
        
        // 验证更新
        const { data: updatedPaper, error: verifyError } = await supabase
          .from('papers')
          .select('view_count')
          .eq('id', testPaper.id)
          .single()

        if (verifyError) {
          console.error('❌ 验证更新失败:', verifyError.message)
        } else {
          console.log(`✅ 验证成功，当前查看次数: ${updatedPaper.view_count}`)
        }
      }
    }

    // 3. 测试统计信息API
    console.log('\n=== 测试统计信息 ===')
    const { data: stats, error: statsError } = await supabase
      .from('papers')
      .select('*', { count: 'exact' })

    if (statsError) {
      console.error('❌ 获取统计信息失败:', statsError.message)
    } else {
      console.log(`✅ 论文总数: ${stats?.length || 0}`)
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message)
  }
}

testViewCount()

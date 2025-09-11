const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAllNewFeatures() {
  console.log('🧪 测试所有新功能...\n')

  try {
    // 1. 测试view_count字段
    console.log('=== 1. 测试查看次数功能 ===')
    const { data: papers, error: papersError } = await supabase
      .from('papers')
      .select('id, title, view_count')
      .limit(3)

    if (papersError) {
      console.log('❌ 查看次数字段测试失败:', papersError.message)
    } else {
      console.log('✅ 查看次数字段正常:')
      papers.forEach(paper => {
        console.log(`   - ${paper.title.substring(0, 40)}...: ${paper.view_count || 0} 次查看`)
      })
    }

    // 2. 测试论文数量统计
    console.log('\n=== 2. 测试论文统计 ===')
    const { count, error: countError } = await supabase
      .from('papers')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.log('❌ 论文统计失败:', countError.message)
    } else {
      console.log('✅ 论文统计正常:')
      console.log(`   - 论文总数: ${count}`)
    }

    // 3. 测试用户统计
    console.log('\n=== 3. 测试用户统计 ===')
    const { count: userCount, error: userCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (userCountError) {
      console.log('❌ 用户统计失败 (可能没有用户表):', userCountError.message)
    } else {
      console.log('✅ 用户统计正常:')
      console.log(`   - 用户总数: ${userCount}`)
    }

    // 4. 测试评论功能
    console.log('\n=== 4. 测试评论数据 ===')
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        *,
        papers(id, title)
      `)
      .limit(3)

    if (commentsError) {
      console.log('❌ 评论数据测试失败:', commentsError.message)
    } else {
      console.log('✅ 评论数据正常:')
      console.log(`   - 评论总数: ${comments.length}`)
      if (comments.length > 0) {
        console.log(`   - 最新评论: ${comments[0].content.substring(0, 30)}...`)
      }
    }

    // 5. 测试更新查看次数
    console.log('\n=== 5. 测试查看次数更新 ===')
    if (papers && papers.length > 0) {
      const testPaper = papers[0]
      const currentCount = testPaper.view_count || 0
      
      const { error: updateError } = await supabase
        .from('papers')
        .update({ view_count: currentCount + 1 })
        .eq('id', testPaper.id)
      
      if (updateError) {
        console.log('❌ 查看次数更新失败:', updateError.message)
      } else {
        console.log('✅ 查看次数更新正常')
        console.log(`   - 论文: ${testPaper.title.substring(0, 30)}...`)
        console.log(`   - 从 ${currentCount} 更新为 ${currentCount + 1}`)
      }
    }

    console.log('\n🎉 所有数据库功能测试完成！')
    console.log('\n📝 注意：API端点测试需要在浏览器中进行：')
    console.log('   - http://localhost:3000/api/site/statistics')
    console.log('   - http://localhost:3000/api/papers/recent-comments')
    console.log('   - http://localhost:3000 (主页)')

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message)
  }
}

testAllNewFeatures()

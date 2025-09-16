// 简单的数据库扩展脚本
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addStatisticsColumns() {
  console.log('开始数据库扩展...');
  
  try {
    // 1. 为 papers 表添加 view_count 字段
    console.log('1. 添加论文点击量字段...');
    await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE public.papers 
        ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
      `
    });
    console.log('✅ 论文点击量字段添加成功');

    // 2. 检查现有数据并初始化 view_count
    console.log('2. 初始化现有论文的点击量...');
    const { error: updateError } = await supabase
      .from('papers')
      .update({ view_count: 0 })
      .is('view_count', null);
    
    if (updateError) {
      console.log('初始化警告:', updateError.message);
    } else {
      console.log('✅ 现有论文点击量初始化完成');
    }

    console.log('✅ 数据库扩展完成！');
    
  } catch (error) {
    console.error('❌ 数据库扩展失败:', error);
  }
}

addStatisticsColumns();

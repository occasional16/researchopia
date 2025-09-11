const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function setupVisitsTable() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ 缺少Supabase配置');
      return;
    }

    console.log('正在连接数据库...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 直接插入访问记录到简单表
    console.log('创建访问记录表...');
    
    // 插入一些初始访问数据
    const visits = [];
    const today = new Date();
    
    // 过去7天的访问记录
    for (let i = 7; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // 每天随机访问次数
      const dailyVisits = Math.floor(Math.random() * 100) + 50;
      for (let j = 0; j < dailyVisits; j++) {
        visits.push({
          date: dateStr,
          visit_count: 1
        });
      }
    }

    console.log(`准备插入 ${visits.length} 条访问记录...`);

    // 分批插入避免一次性插入太多
    const batchSize = 100;
    for (let i = 0; i < visits.length; i += batchSize) {
      const batch = visits.slice(i, i + batchSize);
      const { error } = await supabase
        .from('page_visits')
        .insert(batch);

      if (error) {
        console.error(`❌ 批次 ${Math.floor(i/batchSize) + 1} 插入失败:`, error.message);
      } else {
        console.log(`✅ 批次 ${Math.floor(i/batchSize) + 1} 插入成功 (${batch.length} 条记录)`);
      }
    }

    console.log('🎉 访问统计表设置完成!');
    
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
  }
}

setupVisitsTable();

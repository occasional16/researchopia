const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function createStatisticsTable() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ 缺少Supabase配置');
      return;
    }

    console.log('正在连接数据库...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 读取SQL文件
    const sql = fs.readFileSync('create-statistics-table.sql', 'utf8');
    
    // 分割SQL语句
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`正在执行 ${statements.length} 个SQL语句...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        console.log(`执行语句 ${i + 1}/${statements.length}...`);
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          console.error(`❌ 语句 ${i + 1} 执行失败:`, error.message);
        } else {
          console.log(`✅ 语句 ${i + 1} 执行成功`);
        }
      }
    }

    // 测试插入初始数据
    console.log('插入今日初始数据...');
    const { error: insertError } = await supabase
      .from('site_statistics')
      .upsert({
        date: new Date().toISOString().split('T')[0],
        page_views: 100,
        unique_visitors: 50,
        new_users: 5,
        new_papers: 2,
        new_comments: 15,
        new_ratings: 8
      });

    if (insertError) {
      console.error('❌ 插入初始数据失败:', insertError.message);
    } else {
      console.log('✅ 初始数据插入成功!');
    }

    console.log('🎉 统计表设置完成!');
    
  } catch (err) {
    console.error('❌ 执行失败:', err.message);
  }
}

createStatisticsTable();

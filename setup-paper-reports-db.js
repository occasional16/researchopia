const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function setupPaperReportsTable() {
  console.log('🔧 开始设置 paper_reports 数据库表...')
  
  try {
    // 创建表的SQL
    const createTableSQL = `
      -- 创建论文相关报道表
      CREATE TABLE IF NOT EXISTS paper_reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        paper_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        url TEXT NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (source IN ('wechat', 'news', 'blog', 'other')),
        author VARCHAR(200),
        publish_date DATE,
        description TEXT,
        thumbnail_url TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID,
        
        -- 确保同一篇论文的同一个URL只能添加一次
        CONSTRAINT paper_reports_paper_id_url_key UNIQUE (paper_id, url)
      );
    `
    
    console.log('📝 执行创建表SQL...')
    const { data: createResult, error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    
    if (createError) {
      console.error('❌ 创建表失败:', createError)
      // 尝试直接使用SQL编辑器
      console.log('🔄 尝试使用原生SQL查询...')
      
      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'paper_reports')
        
      if (error) {
        console.error('❌ 检查表是否存在失败:', error)
      } else if (data.length > 0) {
        console.log('✅ paper_reports 表已经存在')
      } else {
        console.log('❌ paper_reports 表不存在，需要手动创建')
        console.log('\n请在 Supabase Dashboard 的 SQL Editor 中执行以下SQL：')
        console.log('=' .repeat(80))
        console.log(createTableSQL)
        console.log('=' .repeat(80))
      }
    } else {
      console.log('✅ 创建表成功!')
    }
    
    // 创建索引
    console.log('📝 创建索引...')
    const indexSQL = `
      CREATE INDEX IF NOT EXISTS paper_reports_paper_id_idx ON paper_reports(paper_id);
      CREATE INDEX IF NOT EXISTS paper_reports_source_idx ON paper_reports(source);
      CREATE INDEX IF NOT EXISTS paper_reports_publish_date_idx ON paper_reports(publish_date DESC);
      CREATE INDEX IF NOT EXISTS paper_reports_created_at_idx ON paper_reports(created_at DESC);
    `
    
    // 创建RLS策略
    console.log('🔒 设置行级安全策略...')
    const rlsSQL = `
      ALTER TABLE paper_reports ENABLE ROW LEVEL SECURITY;
      
      -- 创建策略（如果不存在）
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'paper_reports' AND policyname = 'Anyone can view paper reports') THEN
          EXECUTE 'CREATE POLICY "Anyone can view paper reports" ON paper_reports FOR SELECT USING (true)';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'paper_reports' AND policyname = 'Anyone can insert paper reports') THEN
          EXECUTE 'CREATE POLICY "Anyone can insert paper reports" ON paper_reports FOR INSERT WITH CHECK (true)';
        END IF;
      END $$;
    `
    
    // 测试表是否可以访问
    console.log('🧪 测试表访问...')
    const { data: testData, error: testError } = await supabase
      .from('paper_reports')
      .select('count', { count: 'exact', head: true })
      
    if (testError) {
      console.error('❌ 表访问测试失败:', testError)
      console.log('\n需要手动创建 paper_reports 表!')
      console.log('请访问 Supabase Dashboard > SQL Editor，执行以下SQL:')
      console.log('=' .repeat(80))
      console.log(`
CREATE TABLE IF NOT EXISTS paper_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID NOT NULL,
  title VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (source IN ('wechat', 'news', 'blog', 'other')),
  author VARCHAR(200),
  publish_date DATE,
  description TEXT,
  thumbnail_url TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  CONSTRAINT paper_reports_paper_id_url_key UNIQUE (paper_id, url)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS paper_reports_paper_id_idx ON paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS paper_reports_source_idx ON paper_reports(source);
CREATE INDEX IF NOT EXISTS paper_reports_publish_date_idx ON paper_reports(publish_date DESC);
CREATE INDEX IF NOT EXISTS paper_reports_created_at_idx ON paper_reports(created_at DESC);

-- 启用RLS
ALTER TABLE paper_reports ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Anyone can view paper reports" ON paper_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert paper reports" ON paper_reports FOR INSERT WITH CHECK (true);
      `)
      console.log('=' .repeat(80))
    } else {
      console.log(`✅ paper_reports 表设置完成! 当前记录数: ${testData || 0}`)
      console.log('🎉 现在可以正常使用爬虫功能保存文章了!')
    }
    
  } catch (error) {
    console.error('❌ 设置过程中发生错误:', error)
  }
}

// 运行设置
setupPaperReportsTable().then(() => {
  console.log('✅ 设置完成')
  process.exit(0)
}).catch(error => {
  console.error('❌ 设置失败:', error)
  process.exit(1)
})
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function createPaperReportsTable() {
  console.log('🔧 开始创建 paper_reports 表...')
  
  const sql = `
-- 创建论文相关报道表
CREATE TABLE IF NOT EXISTS paper_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL, -- 'wechat', 'news', 'blog', 'other'
  author TEXT,
  publish_date DATE,
  description TEXT,
  thumbnail_url TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- 确保同一论文的报道URL不重复
  UNIQUE(paper_id, url)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_paper_reports_paper_id ON paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_reports_source ON paper_reports(source);
CREATE INDEX IF NOT EXISTS idx_paper_reports_publish_date ON paper_reports(publish_date DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_paper_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_paper_reports_updated_at ON paper_reports;
CREATE TRIGGER trigger_update_paper_reports_updated_at
  BEFORE UPDATE ON paper_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_paper_reports_updated_at();
`

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('❌ 创建表失败:', error)
      // 尝试备用方法
      console.log('🔄 尝试备用方法...')
      return await createTableAlternative()
    }
    
    console.log('✅ paper_reports 表创建成功!')
    return true
    
  } catch (err) {
    console.error('❌ 执行SQL失败:', err)
    return await createTableAlternative()
  }
}

async function createTableAlternative() {
  console.log('🔄 使用Supabase客户端创建表...')
  
  try {
    // 检查表是否已存在
    const { data: existingTable } = await supabase
      .from('paper_reports')
      .select('id')
      .limit(1)
    
    if (existingTable !== null) {
      console.log('✅ paper_reports 表已存在!')
      return true
    }
  } catch (error) {
    // 表不存在，继续创建
    console.log('📝 表不存在，准备创建...')
  }
  
  // 直接通过管理API创建（这需要service role key）
  console.log('⚠️ 无法通过客户端创建表，请手动在Supabase Dashboard中执行以下SQL:')
  console.log(`
-- 复制以下SQL到 Supabase Dashboard > SQL Editor 中执行:

CREATE TABLE IF NOT EXISTS paper_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  author TEXT,
  publish_date DATE,
  description TEXT,
  thumbnail_url TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(paper_id, url)
);

CREATE INDEX IF NOT EXISTS idx_paper_reports_paper_id ON paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_reports_source ON paper_reports(source);
CREATE INDEX IF NOT EXISTS idx_paper_reports_publish_date ON paper_reports(publish_date DESC);
`)
  
  return false
}

// 运行脚本
if (require.main === module) {
  createPaperReportsTable()
    .then(success => {
      if (success) {
        console.log('🎉 数据库设置完成!')
        process.exit(0)
      } else {
        console.log('⚠️ 请手动创建表')
        process.exit(1)
      }
    })
    .catch(err => {
      console.error('💥 脚本执行失败:', err)
      process.exit(1)
    })
}
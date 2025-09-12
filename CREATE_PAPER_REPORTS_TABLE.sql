-- 创建论文报道表
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

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS paper_reports_paper_id_idx ON paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS paper_reports_source_idx ON paper_reports(source);
CREATE INDEX IF NOT EXISTS paper_reports_publish_date_idx ON paper_reports(publish_date DESC);
CREATE INDEX IF NOT EXISTS paper_reports_created_at_idx ON paper_reports(created_at DESC);

-- 启用行级安全策略
ALTER TABLE paper_reports ENABLE ROW LEVEL SECURITY;

-- 创建访问策略
CREATE POLICY "Anyone can view paper reports" ON paper_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can insert paper reports" ON paper_reports FOR INSERT WITH CHECK (true);

-- 创建自动更新时间戳的触发器
CREATE OR REPLACE FUNCTION update_paper_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_paper_reports_updated_at
  BEFORE UPDATE ON paper_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_paper_reports_updated_at();
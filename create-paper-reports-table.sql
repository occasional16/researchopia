-- 创建论文相关报道表
CREATE TABLE paper_reports (
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
CREATE INDEX idx_paper_reports_paper_id ON paper_reports(paper_id);
CREATE INDEX idx_paper_reports_source ON paper_reports(source);
CREATE INDEX idx_paper_reports_publish_date ON paper_reports(publish_date DESC);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_paper_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_paper_reports_updated_at
  BEFORE UPDATE ON paper_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_paper_reports_updated_at();

-- 插入一些示例数据（可选）
-- INSERT INTO paper_reports (paper_id, title, url, source, author, publish_date, description) 
-- VALUES 
-- ('example-paper-id', '重大突破！这篇论文改变了我们对XX的理解', 'https://mp.weixin.qq.com/s/example', 'wechat', '科学前沿', '2024-01-15', '这篇发表在顶级期刊的论文...');
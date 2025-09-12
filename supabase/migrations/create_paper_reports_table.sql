-- 创建论文相关报道表
CREATE TABLE IF NOT EXISTS paper_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
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
  created_by UUID REFERENCES users(id),
  
  -- 确保同一篇论文的同一个URL只能添加一次
  CONSTRAINT paper_reports_paper_id_url_key UNIQUE (paper_id, url)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS paper_reports_paper_id_idx ON paper_reports(paper_id);
CREATE INDEX IF NOT EXISTS paper_reports_source_idx ON paper_reports(source);
CREATE INDEX IF NOT EXISTS paper_reports_publish_date_idx ON paper_reports(publish_date DESC);
CREATE INDEX IF NOT EXISTS paper_reports_created_at_idx ON paper_reports(created_at DESC);

-- 创建触发器以自动更新 updated_at 字段
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

-- 添加RLS (Row Level Security) 策略
ALTER TABLE paper_reports ENABLE ROW LEVEL SECURITY;

-- 允许所有用户查看报道
CREATE POLICY "Anyone can view paper reports" ON paper_reports
  FOR SELECT USING (true);

-- 只允许认证用户添加报道（临时设为所有人都可以添加）
CREATE POLICY "Anyone can insert paper reports" ON paper_reports
  FOR INSERT WITH CHECK (true);

-- 只允许报道创建者或管理员更新/删除报道
CREATE POLICY "Users can update their own paper reports" ON paper_reports
  FOR UPDATE USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can delete their own paper reports" ON paper_reports
  FOR DELETE USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

-- 插入一些示例数据
INSERT INTO paper_reports (
  paper_id, 
  title, 
  url, 
  source, 
  author, 
  publish_date, 
  description,
  view_count
) VALUES
-- 为第一篇论文添加示例报道
((SELECT id FROM papers LIMIT 1), 
 '突破性研究：科学家发现新材料制备方法', 
 'https://mp.weixin.qq.com/s/example1', 
 'wechat', 
 '材料科学前沿', 
 '2024-01-15',
 '这篇发表在《Nature》上的论文展示了一种全新的材料制备方法，有望革命性地改变相关领域的研究和应用。',
 1250),
 
((SELECT id FROM papers LIMIT 1), 
 '重大进展！新材料研究获得国际认可', 
 'https://www.example-news.com/article/123', 
 'news', 
 '科技日报', 
 '2024-01-16',
 '该研究成果在材料强度和导电性方面实现了重大突破，为新能源、电子器件等领域带来新的发展机遇。',
 2100),

((SELECT id FROM papers LIMIT 1), 
 '深度解析：这项材料科学研究的创新之处', 
 'https://blog.example.com/material-science-breakthrough', 
 'blog', 
 '科学博主老王', 
 '2024-01-18',
 '从技术角度详细分析了这项研究的创新点和应用前景，为读者提供了深入的科学解读。',
 850);

COMMENT ON TABLE paper_reports IS '论文相关报道表，存储各类媒体对论文的报道文章';
COMMENT ON COLUMN paper_reports.paper_id IS '关联的论文ID';
COMMENT ON COLUMN paper_reports.title IS '报道标题';
COMMENT ON COLUMN paper_reports.url IS '报道链接';
COMMENT ON COLUMN paper_reports.source IS '报道来源类型：wechat(微信公众号), news(新闻媒体), blog(博客文章), other(其他)';
COMMENT ON COLUMN paper_reports.author IS '报道作者或媒体名称';
COMMENT ON COLUMN paper_reports.publish_date IS '报道发布日期';
COMMENT ON COLUMN paper_reports.description IS '报道简短描述';
COMMENT ON COLUMN paper_reports.thumbnail_url IS '报道缩略图URL';
COMMENT ON COLUMN paper_reports.view_count IS '报道查看次数';
COMMENT ON COLUMN paper_reports.created_by IS '添加报道的用户ID';
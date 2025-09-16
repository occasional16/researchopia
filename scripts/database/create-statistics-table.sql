-- 创建网站统计表
CREATE TABLE public.site_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  new_papers INTEGER DEFAULT 0,
  new_comments INTEGER DEFAULT 0,
  new_ratings INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_site_statistics_date ON public.site_statistics(date);

-- 启用RLS
ALTER TABLE public.site_statistics ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略 - 所有人可以查看统计数据
CREATE POLICY "Anyone can view site statistics" ON public.site_statistics FOR SELECT USING (true);

-- 只有管理员可以插入/更新统计数据
CREATE POLICY "Admins can manage statistics" ON public.site_statistics FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 创建更新触发器
CREATE TRIGGER update_site_statistics_updated_at 
  BEFORE UPDATE ON public.site_statistics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入今天的初始数据
INSERT INTO public.site_statistics (date, page_views, unique_visitors) 
VALUES (CURRENT_DATE, 0, 0) 
ON CONFLICT (date) DO NOTHING;

-- 创建函数来增加页面访问量
CREATE OR REPLACE FUNCTION public.increment_page_views()
RETURNS void AS $$
BEGIN
  INSERT INTO public.site_statistics (date, page_views, unique_visitors)
  VALUES (CURRENT_DATE, 1, 1)
  ON CONFLICT (date) 
  DO UPDATE SET 
    page_views = site_statistics.page_views + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

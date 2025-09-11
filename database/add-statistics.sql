-- 数据库扩展：添加访问统计和点击量功能
-- 执行日期：2025-09-11

-- 1. 为 papers 表添加 view_count 字段（论文点击量）
ALTER TABLE public.papers 
ADD COLUMN view_count INTEGER DEFAULT 0;

-- 2. 创建网站访问统计表
CREATE TABLE public.site_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建论文访问记录表（用于跟踪唯一访问者）
CREATE TABLE public.paper_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 可为空，支持匿名用户
  ip_address INET, -- 用于匿名用户去重
  user_agent TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- 4. 创建网站访问记录表
CREATE TABLE public.site_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 可为空，支持匿名用户
  ip_address INET NOT NULL,
  user_agent TEXT,
  page_path TEXT NOT NULL,
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- 5. 创建索引
CREATE INDEX idx_site_statistics_date ON public.site_statistics(date DESC);
CREATE INDEX idx_paper_views_paper_id ON public.paper_views(paper_id);
CREATE INDEX idx_paper_views_date ON public.paper_views(date DESC);
CREATE INDEX idx_paper_views_user_id ON public.paper_views(user_id);
CREATE INDEX idx_site_visits_date ON public.site_visits(date DESC);
CREATE INDEX idx_site_visits_ip_date ON public.site_visits(ip_address, date);

-- 6. 添加触发器更新 updated_at
CREATE TRIGGER update_site_statistics_updated_at 
BEFORE UPDATE ON public.site_statistics 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. 创建函数来记录论文访问
CREATE OR REPLACE FUNCTION record_paper_view(
  p_paper_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  view_exists BOOLEAN := FALSE;
  current_date DATE := CURRENT_DATE;
BEGIN
  -- 检查今天是否已经访问过此论文（避免重复计数）
  IF p_user_id IS NOT NULL THEN
    -- 已登录用户：按用户ID去重
    SELECT EXISTS(
      SELECT 1 FROM public.paper_views 
      WHERE paper_id = p_paper_id 
        AND user_id = p_user_id 
        AND date = current_date
    ) INTO view_exists;
  ELSE
    -- 匿名用户：按IP地址去重
    SELECT EXISTS(
      SELECT 1 FROM public.paper_views 
      WHERE paper_id = p_paper_id 
        AND ip_address = p_ip_address 
        AND user_id IS NULL
        AND date = current_date
    ) INTO view_exists;
  END IF;

  -- 如果今天还没有访问过，则记录访问并增加计数
  IF NOT view_exists THEN
    -- 插入访问记录
    INSERT INTO public.paper_views (paper_id, user_id, ip_address, user_agent, date)
    VALUES (p_paper_id, p_user_id, p_ip_address, p_user_agent, current_date);
    
    -- 增加论文的总访问量
    UPDATE public.papers 
    SET view_count = view_count + 1 
    WHERE id = p_paper_id;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建函数来记录网站访问
CREATE OR REPLACE FUNCTION record_site_visit(
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_page_path TEXT DEFAULT '/'
)
RETURNS BOOLEAN AS $$
DECLARE
  visit_exists BOOLEAN := FALSE;
  current_date DATE := CURRENT_DATE;
BEGIN
  -- 检查今天是否已经从此IP访问过（避免重复计数unique visitors）
  SELECT EXISTS(
    SELECT 1 FROM public.site_visits 
    WHERE ip_address = p_ip_address 
      AND date = current_date
  ) INTO visit_exists;

  -- 插入访问记录（每次访问都记录，用于page_views统计）
  INSERT INTO public.site_visits (user_id, ip_address, user_agent, page_path, date)
  VALUES (p_user_id, p_ip_address, p_user_agent, p_page_path, current_date);
  
  -- 更新当日统计
  INSERT INTO public.site_statistics (date, page_views, unique_visitors)
  VALUES (current_date, 1, CASE WHEN visit_exists THEN 0 ELSE 1 END)
  ON CONFLICT (date) 
  DO UPDATE SET 
    page_views = public.site_statistics.page_views + 1,
    unique_visitors = public.site_statistics.unique_visitors + CASE WHEN visit_exists THEN 0 ELSE 1 END,
    updated_at = NOW();
  
  RETURN NOT visit_exists; -- 返回是否是新的唯一访问者
END;
$$ LANGUAGE plpgsql;

-- 9. 设置 RLS 策略
ALTER TABLE public.site_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

-- 网站统计：所有人可读
CREATE POLICY "Anyone can view site statistics" ON public.site_statistics FOR SELECT USING (true);

-- 论文访问记录：所有人可读，任何人可插入
CREATE POLICY "Anyone can view paper views" ON public.paper_views FOR SELECT USING (true);
CREATE POLICY "Anyone can record paper views" ON public.paper_views FOR INSERT WITH CHECK (true);

-- 网站访问记录：管理员可读，任何人可插入
CREATE POLICY "Admins can view site visits" ON public.site_visits FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "Anyone can record site visits" ON public.site_visits FOR INSERT WITH CHECK (true);

-- 10. 创建获取农历日期的函数（简化版）
CREATE OR REPLACE FUNCTION get_lunar_date(input_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
  lunar_months TEXT[] := ARRAY['正月', '二月', '三月', '四月', '五月', '六月', 
                              '七月', '八月', '九月', '十月', '十一月', '腊月'];
  lunar_days TEXT[] := ARRAY['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
                            '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
                            '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  -- 简化计算，这里返回一个示例格式
  month_num INTEGER;
  day_num INTEGER;
BEGIN
  -- 这是一个简化的农历计算，实际应用中需要更复杂的算法
  -- 这里使用公历日期的月份和日期作为示例
  month_num := EXTRACT(MONTH FROM input_date);
  day_num := EXTRACT(DAY FROM input_date);
  
  -- 确保索引在有效范围内
  month_num := LEAST(month_num, 12);
  day_num := LEAST(day_num, 30);
  
  RETURN lunar_months[month_num] || lunar_days[day_num];
END;
$$ LANGUAGE plpgsql;

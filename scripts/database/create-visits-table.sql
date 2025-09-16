-- 创建简化的访问统计表
CREATE TABLE IF NOT EXISTS public.page_visits (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  visit_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_page_visits_date ON public.page_visits(date);

-- 启用RLS
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略 - 所有人可以查看和插入访问记录（兼容不支持 IF NOT EXISTS 的 PostgreSQL 版本）
DROP POLICY IF EXISTS "Anyone can view visits" ON public.page_visits;
CREATE POLICY "Anyone can view visits" ON public.page_visits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can record visits" ON public.page_visits;
CREATE POLICY "Anyone can record visits" ON public.page_visits FOR INSERT WITH CHECK (true);

-- 创建访问记录函数
CREATE OR REPLACE FUNCTION public.record_visit()
RETURNS void AS $$
BEGIN
  INSERT INTO public.page_visits (date, visit_count) VALUES (CURRENT_DATE, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

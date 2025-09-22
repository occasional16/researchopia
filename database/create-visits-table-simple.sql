-- 创建访问统计表（简化版本）
-- 修复访问量统计问题

-- 1. 删除可能存在的旧表和函数
DROP TABLE IF EXISTS public.page_visits CASCADE;
DROP TABLE IF EXISTS public.realtime_counters CASCADE;
DROP TABLE IF EXISTS public.visit_statistics CASCADE;
DROP FUNCTION IF EXISTS update_visit_statistics() CASCADE;
DROP FUNCTION IF EXISTS increment_visit_counter() CASCADE;
DROP FUNCTION IF EXISTS reset_today_counter() CASCADE;

-- 2. 创建页面访问表（与API匹配）
CREATE TABLE public.page_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  visit_count INTEGER DEFAULT 1 NOT NULL,
  ip_address INET,
  user_agent TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建实时计数器表
CREATE TABLE public.realtime_counters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  counter_name TEXT UNIQUE NOT NULL,
  counter_value BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建访问统计汇总表
CREATE TABLE public.visit_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  total_visits INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建索引优化查询性能
CREATE INDEX idx_page_visits_date ON public.page_visits(date DESC);
CREATE INDEX idx_page_visits_ip_date ON public.page_visits(ip_address, date);
CREATE INDEX idx_visit_statistics_date ON public.visit_statistics(date DESC);
CREATE INDEX idx_realtime_counters_name ON public.realtime_counters(counter_name);

-- 6. 设置RLS策略
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_counters ENABLE ROW LEVEL SECURITY;

-- 允许所有人查看统计数据
CREATE POLICY "Anyone can view visit statistics" ON public.visit_statistics FOR SELECT USING (true);
CREATE POLICY "Anyone can view page visits" ON public.page_visits FOR SELECT USING (true);
CREATE POLICY "Anyone can view counters" ON public.realtime_counters FOR SELECT USING (true);

-- 允许所有人插入访问记录
CREATE POLICY "Anyone can insert page visits" ON public.page_visits FOR INSERT WITH CHECK (true);

-- 允许系统更新计数器
CREATE POLICY "System can update counters" ON public.realtime_counters 
  FOR UPDATE USING (true);
CREATE POLICY "System can insert counters" ON public.realtime_counters 
  FOR INSERT WITH CHECK (true);

-- 7. 初始化实时计数器
INSERT INTO public.realtime_counters (counter_name, counter_value) VALUES
  ('total_visits', 2500),
  ('today_visits', 0)
ON CONFLICT (counter_name) DO NOTHING;

-- 8. 创建简化的计数器更新函数
CREATE OR REPLACE FUNCTION increment_visit_counter()
RETURNS void AS $$
BEGIN
  -- 增加总访问量
  INSERT INTO public.realtime_counters (counter_name, counter_value, last_updated)
  VALUES ('total_visits', 1, NOW())
  ON CONFLICT (counter_name) 
  DO UPDATE SET 
    counter_value = public.realtime_counters.counter_value + 1,
    last_updated = NOW();
  
  -- 增加今日访问量
  INSERT INTO public.realtime_counters (counter_name, counter_value, last_updated)
  VALUES ('today_visits', 1, NOW())
  ON CONFLICT (counter_name) 
  DO UPDATE SET 
    counter_value = public.realtime_counters.counter_value + 1,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- 9. 创建重置今日计数器的函数
CREATE OR REPLACE FUNCTION reset_today_counter()
RETURNS void AS $$
BEGIN
  UPDATE public.realtime_counters 
  SET counter_value = 0, last_updated = NOW()
  WHERE counter_name = 'today_visits';
END;
$$ LANGUAGE plpgsql;

-- 10. 插入一些测试数据
INSERT INTO public.page_visits (date, visit_count, ip_address) VALUES
  (CURRENT_DATE, 1, '127.0.0.1'),
  (CURRENT_DATE, 1, '192.168.1.1'),
  (CURRENT_DATE, 1, '10.0.0.1'),
  (CURRENT_DATE - INTERVAL '1 day', 5, '127.0.0.1'),
  (CURRENT_DATE - INTERVAL '1 day', 3, '192.168.1.1'),
  (CURRENT_DATE - INTERVAL '2 days', 8, '127.0.0.1'),
  (CURRENT_DATE - INTERVAL '2 days', 4, '192.168.1.1'),
  (CURRENT_DATE - INTERVAL '3 days', 12, '127.0.0.1')
ON CONFLICT DO NOTHING;

-- 11. 手动调用一次计数器更新来初始化数据
SELECT increment_visit_counter();

-- 12. 验证数据
SELECT 'Counters:' as info;
SELECT counter_name, counter_value, last_updated FROM public.realtime_counters;

SELECT 'Recent visits:' as info;
SELECT date, count(*) as visit_count, count(DISTINCT ip_address) as unique_ips 
FROM public.page_visits 
GROUP BY date 
ORDER BY date DESC 
LIMIT 5;

-- 完成提示
SELECT '✅ 访问统计表创建完成！' as status;

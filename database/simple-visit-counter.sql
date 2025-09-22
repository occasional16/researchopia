-- 极简访问统计方案
-- 解决访问量不增加的问题

-- 1. 清理旧数据（如果存在）
DROP TABLE IF EXISTS public.page_visits CASCADE;
DROP TABLE IF EXISTS public.realtime_counters CASCADE;
DROP TABLE IF EXISTS public.visit_statistics CASCADE;

-- 2. 创建极简的访问计数表
CREATE TABLE public.visit_counters (
  id SERIAL PRIMARY KEY,
  counter_type VARCHAR(50) UNIQUE NOT NULL,
  counter_value BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建访问日志表（可选，用于详细分析）
CREATE TABLE public.visit_logs (
  id SERIAL PRIMARY KEY,
  ip_address INET,
  user_agent TEXT,
  page_path TEXT DEFAULT '/',
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- 4. 创建索引
CREATE INDEX idx_visit_logs_date ON public.visit_logs(date);
CREATE INDEX idx_visit_logs_ip ON public.visit_logs(ip_address);

-- 5. 设置RLS策略
ALTER TABLE public.visit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

-- 允许所有人查看计数器
CREATE POLICY "Anyone can view visit counters" ON public.visit_counters FOR SELECT USING (true);
-- 允许所有人插入访问日志
CREATE POLICY "Anyone can insert visit logs" ON public.visit_logs FOR INSERT WITH CHECK (true);
-- 允许系统更新计数器
CREATE POLICY "System can update visit counters" ON public.visit_counters FOR ALL USING (true);

-- 6. 初始化计数器数据
INSERT INTO public.visit_counters (counter_type, counter_value) VALUES
  ('total_visits', 2500),
  ('today_visits', 0),
  ('this_week_visits', 0),
  ('this_month_visits', 0)
ON CONFLICT (counter_type) DO NOTHING;

-- 7. 创建简单的增加计数器函数
CREATE OR REPLACE FUNCTION increment_counter(counter_name TEXT, increment_by INTEGER DEFAULT 1)
RETURNS BIGINT AS $$
DECLARE
  new_value BIGINT;
BEGIN
  -- 更新计数器并返回新值
  UPDATE public.visit_counters 
  SET 
    counter_value = counter_value + increment_by,
    last_updated = NOW()
  WHERE counter_type = counter_name
  RETURNING counter_value INTO new_value;
  
  -- 如果计数器不存在，创建它
  IF new_value IS NULL THEN
    INSERT INTO public.visit_counters (counter_type, counter_value, last_updated)
    VALUES (counter_name, increment_by, NOW())
    RETURNING counter_value INTO new_value;
  END IF;
  
  RETURN new_value;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建获取计数器值的函数
CREATE OR REPLACE FUNCTION get_counter(counter_name TEXT)
RETURNS BIGINT AS $$
DECLARE
  counter_val BIGINT;
BEGIN
  SELECT counter_value INTO counter_val
  FROM public.visit_counters
  WHERE counter_type = counter_name;
  
  RETURN COALESCE(counter_val, 0);
END;
$$ LANGUAGE plpgsql;

-- 9. 创建重置今日计数器的函数
CREATE OR REPLACE FUNCTION reset_today_visits()
RETURNS void AS $$
BEGIN
  UPDATE public.visit_counters 
  SET counter_value = 0, last_updated = NOW()
  WHERE counter_type = 'today_visits';
END;
$$ LANGUAGE plpgsql;

-- 10. 插入一些测试访问日志
INSERT INTO public.visit_logs (ip_address, page_path, visited_at, date) VALUES
  ('127.0.0.1', '/', NOW(), CURRENT_DATE),
  ('192.168.1.1', '/', NOW() - INTERVAL '1 hour', CURRENT_DATE),
  ('10.0.0.1', '/papers', NOW() - INTERVAL '2 hours', CURRENT_DATE),
  ('127.0.0.1', '/', NOW() - INTERVAL '1 day', CURRENT_DATE - 1),
  ('192.168.1.1', '/', NOW() - INTERVAL '2 days', CURRENT_DATE - 2);

-- 11. 测试函数
SELECT 'Testing increment_counter function:' as test;
SELECT increment_counter('total_visits', 1) as new_total_visits;
SELECT increment_counter('today_visits', 1) as new_today_visits;

-- 12. 验证数据
SELECT 'Current counters:' as info;
SELECT counter_type, counter_value, last_updated FROM public.visit_counters ORDER BY counter_type;

SELECT 'Recent visit logs:' as info;
SELECT date, COUNT(*) as visits, COUNT(DISTINCT ip_address) as unique_visitors
FROM public.visit_logs 
GROUP BY date 
ORDER BY date DESC 
LIMIT 5;

-- 完成提示
SELECT '✅ 极简访问统计系统创建完成！' as status;
SELECT '📊 计数器已初始化，API可以正常工作' as message;

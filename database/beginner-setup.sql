-- 初学者友好的Supabase数据库设置脚本
-- 请将此脚本复制到Supabase SQL编辑器中执行

-- 第1步：清理可能存在的旧表
DROP TABLE IF EXISTS public.visit_counters CASCADE;
DROP TABLE IF EXISTS public.visit_logs CASCADE;

-- 第2步：创建访问计数器表（核心表）
CREATE TABLE public.visit_counters (
  id SERIAL PRIMARY KEY,
  counter_type VARCHAR(50) UNIQUE NOT NULL,
  counter_value BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 第3步：创建访问日志表（详细记录）
CREATE TABLE public.visit_logs (
  id SERIAL PRIMARY KEY,
  ip_address INET,
  user_agent TEXT,
  page_path TEXT DEFAULT '/',
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE
);

-- 第4步：创建索引（提升查询速度）
CREATE INDEX idx_visit_logs_date ON public.visit_logs(date);
CREATE INDEX idx_visit_logs_ip ON public.visit_logs(ip_address);
CREATE INDEX idx_visit_counters_type ON public.visit_counters(counter_type);

-- 第5步：设置安全策略（RLS）
ALTER TABLE public.visit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

-- 允许所有人查看计数器
CREATE POLICY "Anyone can view visit counters" ON public.visit_counters 
  FOR SELECT USING (true);

-- 允许所有人插入访问日志
CREATE POLICY "Anyone can insert visit logs" ON public.visit_logs 
  FOR INSERT WITH CHECK (true);

-- 允许系统更新计数器
CREATE POLICY "System can update visit counters" ON public.visit_counters 
  FOR ALL USING (true);

-- 第6步：初始化计数器数据
INSERT INTO public.visit_counters (counter_type, counter_value) VALUES
  ('total_visits', 2500),
  ('today_visits', 0)
ON CONFLICT (counter_type) DO UPDATE SET
  counter_value = EXCLUDED.counter_value;

-- 第7步：创建增加计数器的函数
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

-- 第8步：创建获取计数器值的函数
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

-- 第9步：插入一些测试数据
INSERT INTO public.visit_logs (ip_address, page_path, visited_at, date) VALUES
  ('127.0.0.1', '/', NOW(), CURRENT_DATE),
  ('192.168.1.1', '/', NOW() - INTERVAL '1 hour', CURRENT_DATE),
  ('10.0.0.1', '/papers', NOW() - INTERVAL '2 hours', CURRENT_DATE);

-- 第10步：验证设置是否成功
SELECT '✅ 数据库表创建完成！' as status;

SELECT 'visit_counters表内容:' as info;
SELECT counter_type, counter_value, last_updated FROM public.visit_counters;

SELECT 'visit_logs表内容:' as info;
SELECT COUNT(*) as log_count FROM public.visit_logs;

SELECT '🎉 Supabase数据库设置完成！现在可以测试访问统计功能了。' as message;

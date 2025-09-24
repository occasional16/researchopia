-- 禁用所有相关表的行级安全策略以便测试
-- 在Supabase SQL编辑器中运行此脚本

-- 1. 禁用所有表的RLS（用于测试）
DO $$
DECLARE
    table_name text;
BEGIN
    -- 获取所有public schema中的表
    FOR table_name IN
        SELECT t.table_name
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
    LOOP
        -- 禁用每个表的RLS
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_name);
        RAISE NOTICE 'Disabled RLS for table: %', table_name;
    END LOOP;
END
$$;

-- 2. 检查RLS状态
SELECT
    schemaname,
    tablename,
    rowsecurity,
    CASE
        WHEN rowsecurity THEN '🔒 RLS启用'
        ELSE '🔓 RLS禁用'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 3. 验证表结构
SELECT 'Available tables:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

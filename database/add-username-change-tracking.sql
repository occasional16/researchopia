-- 为用户表添加用户名修改跟踪字段
-- 执行此脚本前请备份数据库

-- 添加用户名修改时间字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN public.users.last_username_change IS '最后一次修改用户名的时间，用于限制修改频率';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_last_username_change 
ON public.users(last_username_change);

-- 验证表结构
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

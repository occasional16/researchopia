-- 修复Supabase认证问题的SQL脚本
-- 请在Supabase SQL Editor中运行此脚本

-- 1. 确保users表存在且结构正确
CREATE TABLE IF NOT EXISTS public.users (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email text NOT NULL,
    username text,
    full_name text,
    avatar_url text,
    bio text,
    role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. 启用行级安全(RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "用户可以查看所有用户" ON public.users;
DROP POLICY IF EXISTS "用户可以插入自己的记录" ON public.users;
DROP POLICY IF EXISTS "用户可以更新自己的记录" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.users;
DROP POLICY IF EXISTS "Users can update own profile." ON public.users;

-- 4. 创建新的RLS策略
CREATE POLICY "允许查看所有用户公开信息" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "允许用户插入自己的记录" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "允许用户更新自己的记录" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 5. 删除旧的触发器和函数（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 6. 创建新的触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- 插入新用户记录到public.users表
    INSERT INTO public.users (id, email, username, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        CASE 
            WHEN new.email = 'admin@test.edu.cn' THEN 'admin'
            ELSE 'user'
        END
    );
    RETURN new;
EXCEPTION
    WHEN others THEN
        -- 如果插入失败，记录错误但不阻止认证流程
        RAISE LOG 'Error creating user profile: %', SQLERRM;
        RETURN new;
END;
$$;

-- 7. 创建触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 8. 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS handle_updated_at ON public.users;
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 9. 验证设置
SELECT 
    'users表行数' as info, 
    count(*)::text as value 
FROM public.users
UNION ALL
SELECT 
    '触发器状态' as info,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created'
    ) THEN '已创建' ELSE '未找到' END as value;

-- 完成提示
SELECT '🎉 认证系统修复完成！现在可以正常注册和登录了。' as message;
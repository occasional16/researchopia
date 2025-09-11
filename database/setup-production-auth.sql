-- 确保管理员用户存在的脚本
-- 运行前请确保已经通过Supabase Auth创建了admin@test.edu.cn账号

-- 首先检查users表结构
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'user')) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    avatar_url TEXT
);

-- 启用RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS策略
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "System can insert user profiles" ON public.users
    FOR INSERT WITH CHECK (true);

-- 管理员可以查看所有用户
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 创建触发器自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 注意：管理员账号需要通过Supabase Auth创建
-- 1. 在Supabase Dashboard -> Authentication -> Users 中创建用户
-- 2. Email: admin@test.edu.cn
-- 3. Password: 您选择的安全密码
-- 4. 确认邮箱验证

-- 如果管理员已通过Auth创建，手动插入到users表（替换YOUR_ADMIN_UUID）
-- INSERT INTO public.users (id, email, username, role)
-- VALUES ('YOUR_ADMIN_UUID', 'admin@test.edu.cn', 'admin', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 查询现有用户
-- SELECT id, email, username, role, created_at FROM public.users;

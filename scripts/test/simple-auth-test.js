// 简单的Supabase连接测试
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function simpleAuthTest() {
  console.log('🔍 简单认证测试...')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('URL:', supabaseUrl)
  console.log('Key starts with:', supabaseKey?.substring(0, 20) + '...')
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 环境变量未正确设置')
    return
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // 测试基本连接
    console.log('\n📡 测试连接...')
    const { data: healthData, error: healthError } = await supabase.from('users').select('count').limit(1)
    
    if (healthError) {
      console.error('❌ 连接错误:', healthError.message)
      
      if (healthError.message.includes('"users" does not exist')) {
        console.log('\n🔧 需要创建users表！请在Supabase SQL Editor中运行:')
        console.log(`
-- 创建用户表
CREATE TABLE IF NOT EXISTS public.users (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email text NOT NULL,
    username text,
    full_name text,
    avatar_url text,
    bio text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 启用行级安全
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "用户可以查看所有用户" ON public.users FOR SELECT USING (true);
CREATE POLICY "用户可以插入自己的记录" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "用户可以更新自己的记录" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, username, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'full_name', '')
    );
    RETURN new;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        `)
        return
      }
      
      return
    }
    
    console.log('✅ 数据库连接成功')
    
    // 测试认证功能
    console.log('\n🔐 测试认证功能...')
    console.log('提示：如果遇到"Invalid login credentials"，请确保:')
    console.log('1. 用户已经注册')
    console.log('2. 邮箱已验证（如果开启了邮箱验证）')
    console.log('3. 密码正确')
    console.log('4. Supabase项目的Auth设置正确')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

simpleAuthTest()
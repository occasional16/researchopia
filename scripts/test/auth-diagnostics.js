// 认证调试工具
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 认证系统诊断工具')
console.log('===================')

async function runDiagnostics() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 缺少Supabase环境变量')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('\n1️⃣ 测试数据库连接...')
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1)
    if (error) {
      console.error('❌ 数据库连接失败:', error.message)
      return
    }
    console.log('✅ 数据库连接成功')
  } catch (e) {
    console.error('❌ 数据库连接异常:', e.message)
    return
  }

  console.log('\n2️⃣ 检查用户表结构...')
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, username, created_at')
      .limit(1)
    
    if (error) {
      console.error('❌ 用户表查询失败:', error.message)
    } else {
      console.log('✅ 用户表结构正常')
    }
  } catch (e) {
    console.error('❌ 用户表查询异常:', e.message)
  }

  console.log('\n3️⃣ 测试注册流程...')
  const testEmail = `test_${Date.now()}@example.com`
  const testPassword = 'Test123456!'
  
  try {
    console.log('📝 尝试注册:', testEmail)
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: `testuser_${Date.now()}`,
          full_name: '测试用户'
        }
      }
    })

    if (error) {
      console.error('❌ 注册失败:', error.message)
      
      if (error.message.includes('Database error saving new user')) {
        console.log('\n🔧 可能的解决方案:')
        console.log('1. 检查users表是否存在触发器')
        console.log('2. 检查RLS策略是否正确')
        console.log('3. 在Supabase SQL Editor中运行以下SQL:')
        console.log(`
-- 检查触发器是否存在
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 如果不存在，创建触发器
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        `)
      }
    } else {
      console.log('✅ 注册成功!')
      console.log('- 用户ID:', data.user?.id)
      console.log('- 邮箱确认状态:', data.user?.email_confirmed_at ? '已确认' : '待确认')
    }
  } catch (e) {
    console.error('❌ 注册过程异常:', e.message)
  }

  console.log('\n4️⃣ 认证设置建议...')
  console.log('✓ 在Supabase Dashboard > Authentication > Settings:')
  console.log('  - 确认"Enable email confirmations"根据需求设置')
  console.log('  - 检查"Site URL"是否正确')
  console.log('  - 确认"Redirect URLs"包含所需的URL')
  
  console.log('\n✅ 诊断完成！如有问题，请根据上述输出进行修复。')
}

runDiagnostics()
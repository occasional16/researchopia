const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkDatabaseSchema() {
  try {
    console.log('🔍 检查数据库表结构...')
    
    // 直接测试paper_favorites表
    const { data: favoritesTest, error: favoritesError } = await supabase
      .from('paper_favorites')
      .select('count', { count: 'exact', head: true })
    
    if (favoritesError) {
      if (favoritesError.message.includes('relation "public.paper_favorites" does not exist')) {
        console.log('❌ paper_favorites 表不存在')
        console.log('请在Supabase控制台的SQL编辑器中执行以下SQL:')
        console.log(`
-- 创建paper_favorites表
CREATE TABLE public.paper_favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- 创建索引
CREATE INDEX idx_paper_favorites_user_id ON public.paper_favorites(user_id);
CREATE INDEX idx_paper_favorites_paper_id ON public.paper_favorites(paper_id);

-- 启用RLS
ALTER TABLE public.paper_favorites ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Anyone can view favorites" ON public.paper_favorites FOR SELECT USING (true);
CREATE POLICY "Users can manage own favorites" ON public.paper_favorites FOR ALL USING (auth.uid() = user_id);
        `)
      } else {
        console.error('❌ paper_favorites表查询错误:', favoritesError.message)
      }
    } else {
      console.log('✅ paper_favorites 表存在')
    }
    
    // 测试其他关键表
    const { data: papersTest, error: papersError } = await supabase
      .from('papers')
      .select('count', { count: 'exact', head: true })
    
    if (papersError) {
      console.error('❌ papers表查询失败:', papersError.message)
    } else {
      console.log('✅ papers表正常')
    }
    
    // 检查现有用户
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, username, role')
      .limit(5)
    
    if (userError) {
      console.error('❌ 用户表查询失败:', userError.message)
    } else {
      console.log('✅ 用户表正常，当前用户数:', userData?.length || 0)
      if (userData && userData.length > 0) {
        console.log('现有用户:')
        userData.forEach(user => {
          console.log(`  - ${user.email} (${user.username}) [${user.role}]`)
        })
      }
    }
    
  } catch (error) {
    console.error('检查失败:', error)
  }
}

checkDatabaseSchema()

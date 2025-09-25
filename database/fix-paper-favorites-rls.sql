-- 修复paper_favorites表的RLS策略
-- 这个脚本解决406 Not Acceptable错误

-- 首先删除现有的策略
DROP POLICY IF EXISTS "Users can view own favorites" ON public.paper_favorites;
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.paper_favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON public.paper_favorites;

-- 创建更宽松的策略，允许匿名用户查看（但不能修改）
CREATE POLICY "Allow anonymous read access to paper_favorites" ON public.paper_favorites
  FOR SELECT USING (true);

-- 只有认证用户可以管理自己的收藏
CREATE POLICY "Authenticated users can manage own favorites" ON public.paper_favorites
  FOR ALL USING (auth.uid() = user_id);

-- 确保RLS已启用
ALTER TABLE public.paper_favorites ENABLE ROW LEVEL SECURITY;

-- 为了调试，我们也可以暂时禁用RLS（不推荐在生产环境中使用）
-- ALTER TABLE public.paper_favorites DISABLE ROW LEVEL SECURITY;

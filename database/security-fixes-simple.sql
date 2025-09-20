-- 研学港数据库安全修复脚本（简化版）
-- Researchopia Database Security Fixes (Simplified)

-- 1. 启用所有表的行级安全（RLS）
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.annotation_stats ENABLE ROW LEVEL SECURITY;

-- 2. 删除可能存在的旧策略
DROP POLICY IF EXISTS "Users can view their own annotations and public/shared annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can modify their own annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.annotation_likes;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.annotation_comments;
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can view shares they are involved in" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can create shares for their annotations" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can update their own shares" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can delete their own shares" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can manage their own follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can view all favorites" ON public.annotation_favorites;
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.annotation_favorites;
DROP POLICY IF EXISTS "Users can view all ratings" ON public.annotation_ratings;
DROP POLICY IF EXISTS "Users can manage their own ratings" ON public.annotation_ratings;
DROP POLICY IF EXISTS "Users can view sessions for documents they have access to" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can view all stats" ON public.annotation_stats;
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.annotation_stats;

-- 3. 创建新的安全策略

-- 文档表策略
CREATE POLICY "documents_select_policy" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "documents_insert_policy" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_policy" ON public.documents
  FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- 标注表策略
CREATE POLICY "annotations_select_policy" ON public.annotations
  FOR SELECT USING (
    user_id = auth.uid() OR 
    visibility = 'public' OR 
    (visibility = 'shared' AND id IN (
      SELECT annotation_id FROM public.annotation_shares 
      WHERE shared_with_user_id = auth.uid()
    ))
  );

CREATE POLICY "annotations_insert_policy" ON public.annotations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "annotations_update_policy" ON public.annotations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "annotations_delete_policy" ON public.annotations
  FOR DELETE USING (user_id = auth.uid());

-- 标注点赞表策略
CREATE POLICY "annotation_likes_select_policy" ON public.annotation_likes
  FOR SELECT USING (true);

CREATE POLICY "annotation_likes_all_policy" ON public.annotation_likes
  FOR ALL USING (user_id = auth.uid());

-- 标注评论表策略
CREATE POLICY "annotation_comments_select_policy" ON public.annotation_comments
  FOR SELECT USING (true);

CREATE POLICY "annotation_comments_insert_policy" ON public.annotation_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "annotation_comments_update_policy" ON public.annotation_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "annotation_comments_delete_policy" ON public.annotation_comments
  FOR DELETE USING (user_id = auth.uid());

-- 标注分享表策略
CREATE POLICY "annotation_shares_select_policy" ON public.annotation_shares
  FOR SELECT USING (
    user_id = auth.uid() OR 
    shared_with_user_id = auth.uid()
  );

CREATE POLICY "annotation_shares_insert_policy" ON public.annotation_shares
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "annotation_shares_update_policy" ON public.annotation_shares
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "annotation_shares_delete_policy" ON public.annotation_shares
  FOR DELETE USING (user_id = auth.uid());

-- 用户关注表策略
CREATE POLICY "user_follows_select_policy" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "user_follows_all_policy" ON public.user_follows
  FOR ALL USING (follower_id = auth.uid());

-- 标注收藏表策略
CREATE POLICY "annotation_favorites_select_policy" ON public.annotation_favorites
  FOR SELECT USING (true);

CREATE POLICY "annotation_favorites_all_policy" ON public.annotation_favorites
  FOR ALL USING (user_id = auth.uid());

-- 标注评分表策略
CREATE POLICY "annotation_ratings_select_policy" ON public.annotation_ratings
  FOR SELECT USING (true);

CREATE POLICY "annotation_ratings_all_policy" ON public.annotation_ratings
  FOR ALL USING (user_id = auth.uid());

-- 协作会话表策略
CREATE POLICY "collaboration_sessions_select_policy" ON public.collaboration_sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    document_id IN (
      SELECT id FROM public.documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "collaboration_sessions_insert_policy" ON public.collaboration_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "collaboration_sessions_update_policy" ON public.collaboration_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "collaboration_sessions_delete_policy" ON public.collaboration_sessions
  FOR DELETE USING (user_id = auth.uid());

-- 标注统计表策略
CREATE POLICY "annotation_stats_select_policy" ON public.annotation_stats
  FOR SELECT USING (true);

CREATE POLICY "annotation_stats_all_policy" ON public.annotation_stats
  FOR ALL USING (user_id = auth.uid());

-- 4. 修复视图安全设置
-- 删除并重新创建视图，确保使用security_invoker
DROP VIEW IF EXISTS public.user_annotation_overview CASCADE;
DROP VIEW IF EXISTS public.document_annotation_stats CASCADE;

CREATE VIEW public.user_annotation_overview 
WITH (security_invoker = true) AS
SELECT 
  u.id as user_id,
  u.username,
  u.avatar_url,
  COUNT(a.id) as total_annotations,
  COUNT(CASE WHEN a.visibility = 'public' THEN 1 END) as public_annotations,
  COUNT(CASE WHEN a.visibility = 'shared' THEN 1 END) as shared_annotations,
  COALESCE(SUM(a.likes_count), 0) as total_likes_received,
  COALESCE(SUM(a.comments_count), 0) as total_comments_received,
  MAX(a.created_at) as last_annotation_at
FROM public.users u
LEFT JOIN public.annotations a ON u.id = a.user_id
GROUP BY u.id, u.username, u.avatar_url;

CREATE VIEW public.document_annotation_stats 
WITH (security_invoker = true) AS
SELECT 
  d.id as document_id,
  d.title,
  d.doi,
  COUNT(a.id) as total_annotations,
  COUNT(DISTINCT a.user_id) as unique_annotators,
  COUNT(CASE WHEN a.visibility = 'public' THEN 1 END) as public_annotations,
  COALESCE(AVG(a.quality_score), 0) as avg_quality_score,
  MAX(a.created_at) as last_annotation_at
FROM public.documents d
LEFT JOIN public.annotations a ON d.id = a.document_id
GROUP BY d.id, d.title, d.doi;

-- 5. 创建安全监控函数
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE(
    table_name TEXT,
    rls_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        COALESCE(c.relrowsecurity, false) as rls_enabled
    FROM information_schema.tables t
    LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 显示安全状态
SELECT 'RLS Status Check' as check_type, table_name, 
       CASE WHEN rls_enabled THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM public.check_rls_status();

-- 7. 显示策略数量
SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

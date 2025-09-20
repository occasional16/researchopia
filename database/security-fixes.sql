-- 研学港数据库安全修复脚本
-- Researchopia Database Security Fixes

-- 1. 确保所有表都启用了RLS
DO $$
DECLARE
    tbl_name TEXT;
    tables_to_check TEXT[] := ARRAY[
        'documents',
        'annotations', 
        'annotation_likes',
        'annotation_comments',
        'annotation_shares',
        'user_follows',
        'annotation_favorites',
        'annotation_ratings',
        'collaboration_sessions',
        'annotation_stats'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY tables_to_check
    LOOP
        -- 检查表是否存在
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl_name) THEN
            -- 启用RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_name);
            RAISE NOTICE 'Enabled RLS for table: %', tbl_name;
        ELSE
            RAISE NOTICE 'Table does not exist: %', tbl_name;
        END IF;
    END LOOP;
END $$;

-- 2. 删除可能存在的旧策略（如果存在）
DO $$
DECLARE
    policy_name TEXT;
    policies_to_drop TEXT[] := ARRAY[
        'Users can view their own annotations and public/shared annotations',
        'Users can modify their own annotations',
        'Users can manage their own likes',
        'Users can manage their own comments'
    ];
BEGIN
    FOREACH policy_name IN ARRAY policies_to_drop
    LOOP
        -- 尝试删除策略（如果存在）
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.annotations', policy_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.annotation_likes', policy_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.annotation_comments', policy_name);
        EXCEPTION
            WHEN OTHERS THEN
                -- 忽略错误，继续执行
                NULL;
        END;
    END LOOP;
END $$;

-- 3. 创建更安全的RLS策略

-- 文档表策略
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;

CREATE POLICY "documents_select_policy" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "documents_insert_policy" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_policy" ON public.documents
  FOR UPDATE USING (created_by = auth.uid() OR auth.uid() IS NOT NULL);

-- 标注表策略
DROP POLICY IF EXISTS "Users can view their own annotations and public/shared annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can create annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can update their own annotations" ON public.annotations;
DROP POLICY IF EXISTS "Users can delete their own annotations" ON public.annotations;

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
DROP POLICY IF EXISTS "Users can view all likes" ON public.annotation_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.annotation_likes;

CREATE POLICY "annotation_likes_select_policy" ON public.annotation_likes
  FOR SELECT USING (true);

CREATE POLICY "annotation_likes_all_policy" ON public.annotation_likes
  FOR ALL USING (user_id = auth.uid());

-- 标注评论表策略
DROP POLICY IF EXISTS "Users can view all comments" ON public.annotation_comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.annotation_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.annotation_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.annotation_comments;

CREATE POLICY "annotation_comments_select_policy" ON public.annotation_comments
  FOR SELECT USING (true);

CREATE POLICY "annotation_comments_insert_policy" ON public.annotation_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "annotation_comments_update_policy" ON public.annotation_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "annotation_comments_delete_policy" ON public.annotation_comments
  FOR DELETE USING (user_id = auth.uid());

-- 标注分享表策略
DROP POLICY IF EXISTS "Users can view shares they are involved in" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can create shares for their annotations" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can update their own shares" ON public.annotation_shares;
DROP POLICY IF EXISTS "Users can delete their own shares" ON public.annotation_shares;

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
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can manage their own follows" ON public.user_follows;

CREATE POLICY "user_follows_select_policy" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "user_follows_all_policy" ON public.user_follows
  FOR ALL USING (follower_id = auth.uid());

-- 标注收藏表策略
DROP POLICY IF EXISTS "Users can view all favorites" ON public.annotation_favorites;
DROP POLICY IF EXISTS "Users can manage their own favorites" ON public.annotation_favorites;

CREATE POLICY "annotation_favorites_select_policy" ON public.annotation_favorites
  FOR SELECT USING (true);

CREATE POLICY "annotation_favorites_all_policy" ON public.annotation_favorites
  FOR ALL USING (user_id = auth.uid());

-- 标注评分表策略
DROP POLICY IF EXISTS "Users can view all ratings" ON public.annotation_ratings;
DROP POLICY IF EXISTS "Users can manage their own ratings" ON public.annotation_ratings;

CREATE POLICY "annotation_ratings_select_policy" ON public.annotation_ratings
  FOR SELECT USING (true);

CREATE POLICY "annotation_ratings_all_policy" ON public.annotation_ratings
  FOR ALL USING (user_id = auth.uid());

-- 协作会话表策略
DROP POLICY IF EXISTS "Users can view sessions for documents they have access to" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.collaboration_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.collaboration_sessions;

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
DROP POLICY IF EXISTS "Users can view all stats" ON public.annotation_stats;
DROP POLICY IF EXISTS "Users can manage their own stats" ON public.annotation_stats;

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

-- 5. 创建安全审计函数
CREATE OR REPLACE FUNCTION public.audit_security_status()
RETURNS TABLE(
    table_name TEXT,
    rls_enabled BOOLEAN,
    policy_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        COALESCE(c.relrowsecurity, false) as rls_enabled,
        COALESCE(p.policy_count, 0) as policy_count
    FROM information_schema.tables t
    LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LEFT JOIN (
        SELECT schemaname, tablename, COUNT(*) as policy_count
        FROM pg_policies 
        WHERE schemaname = 'public'
        GROUP BY schemaname, tablename
    ) p ON p.tablename = t.table_name
    WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建安全检查报告
CREATE OR REPLACE FUNCTION public.security_check_report()
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    rec RECORD;
BEGIN
    result := '=== 研学港数据库安全检查报告 ===' || E'\n';
    result := result || '检查时间: ' || NOW() || E'\n\n';
    
    -- 检查RLS状态
    result := result || '1. 行级安全(RLS)状态:' || E'\n';
    FOR rec IN SELECT * FROM public.audit_security_status() LOOP
        result := result || '   ' || rec.table_name || ': ' || 
                 CASE WHEN rec.rls_enabled THEN '✅ 已启用' ELSE '❌ 未启用' END ||
                 ' (策略数: ' || rec.policy_count || ')' || E'\n';
    END LOOP;
    
    -- 检查视图安全设置
    result := result || E'\n2. 视图安全设置:' || E'\n';
    FOR rec IN SELECT 
        schemaname, viewname, 
        CASE WHEN options LIKE '%security_invoker=true%' THEN '✅ 安全调用者' ELSE '❌ 安全定义者' END as security_type
    FROM pg_views v
    LEFT JOIN pg_options_to_table(v.options) o ON true
    WHERE schemaname = 'public' LOOP
        result := result || '   ' || rec.viewname || ': ' || rec.security_type || E'\n';
    END LOOP;
    
    result := result || E'\n=== 检查完成 ===' || E'\n';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 执行安全检查并显示结果
SELECT public.security_check_report();

-- 8. 创建安全监控视图
CREATE OR REPLACE VIEW public.security_monitor AS
SELECT 
    'RLS Status' as check_type,
    table_name,
    CASE WHEN rls_enabled THEN 'PASS' ELSE 'FAIL' END as status,
    CASE WHEN rls_enabled THEN 'RLS已启用' ELSE 'RLS未启用，需要修复' END as message
FROM public.audit_security_status()
WHERE NOT rls_enabled

UNION ALL

SELECT 
    'Policy Count' as check_type,
    table_name,
    CASE WHEN policy_count > 0 THEN 'PASS' ELSE 'WARN' END as status,
    CASE WHEN policy_count > 0 THEN '有' || policy_count || '个策略' ELSE '无策略，建议添加' END as message
FROM public.audit_security_status()
WHERE rls_enabled AND policy_count = 0;

-- 显示安全监控结果
SELECT * FROM public.security_monitor;

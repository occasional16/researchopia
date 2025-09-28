-- 测试数据库函数和数据
-- Test database function and data

-- 1. 检查是否有文档数据
SELECT 'Documents count:' as check_type, COUNT(*) as count FROM public.documents;

-- 2. 检查是否有标注数据
SELECT 'Annotations count:' as check_type, COUNT(*) as count FROM public.annotations;
SELECT 'Public annotations count:' as check_type, COUNT(*) as count FROM public.annotations WHERE visibility IN ('public', 'shared');

-- 3. 检查用户数据
SELECT 'Users count:' as check_type, COUNT(*) as count FROM public.users;
SELECT 'Users with username:' as check_type, COUNT(*) as count FROM public.users WHERE username IS NOT NULL;

-- 4. 检查视图是否工作
SELECT 'Annotations with users view count:' as check_type, COUNT(*) as count FROM public.annotations_with_users;

-- 5. 测试函数是否存在
SELECT 'Function exists:' as check_type, 
       CASE WHEN EXISTS(
         SELECT 1 FROM pg_proc p 
         JOIN pg_namespace n ON p.pronamespace = n.oid 
         WHERE n.nspname = 'public' AND p.proname = 'get_shared_annotations_with_users'
       ) THEN 'YES' ELSE 'NO' END as result;

-- 6. 如果有数据，试着调用函数（需要一个真实的document_id）
DO $$
DECLARE
    test_doc_id UUID;
    result_count INT;
BEGIN
    -- 获取第一个文档的ID
    SELECT id INTO test_doc_id FROM public.documents LIMIT 1;
    
    IF test_doc_id IS NOT NULL THEN
        SELECT COUNT(*) INTO result_count 
        FROM get_shared_annotations_with_users(test_doc_id);
        
        RAISE NOTICE 'Test function call with doc_id %, returned % rows', test_doc_id, result_count;
    ELSE
        RAISE NOTICE 'No documents found to test function with';
    END IF;
END;
$$;

-- 7. 查看一些实际数据样本
SELECT 
    d.doi,
    d.title,
    COUNT(a.id) as annotation_count
FROM public.documents d
LEFT JOIN public.annotations a ON d.id = a.document_id AND a.visibility IN ('public', 'shared')
GROUP BY d.id, d.doi, d.title
ORDER BY annotation_count DESC
LIMIT 5;
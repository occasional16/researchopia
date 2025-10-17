


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."find_or_create_paper_by_doi"("p_doi" "text", "p_title" "text" DEFAULT NULL::"text", "p_authors" "text"[] DEFAULT NULL::"text"[], "p_abstract" "text" DEFAULT NULL::"text", "p_journal" "text" DEFAULT NULL::"text", "p_publication_date" "date" DEFAULT NULL::"date", "p_keywords" "text"[] DEFAULT NULL::"text"[], "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    paper_id_found UUID;
    new_paper_id UUID;
BEGIN
    -- 首先尝试通过DOI查找现有论文
    SELECT id INTO paper_id_found
    FROM public.papers
    WHERE doi = p_doi
    LIMIT 1;
    
    -- 如果找到了，返回现有ID
    IF paper_id_found IS NOT NULL THEN
        RETURN paper_id_found;
    END IF;
    
    -- 如果没找到且提供了必要信息，创建新论文
    IF p_title IS NOT NULL AND p_created_by IS NOT NULL THEN
        INSERT INTO public.papers (
            doi, 
            title, 
            authors, 
            abstract, 
            journal, 
            publication_date, 
            keywords, 
            created_by
        ) VALUES (
            p_doi,
            p_title,
            COALESCE(p_authors, ARRAY[]::TEXT[]),
            p_abstract,
            p_journal,
            p_publication_date,
            COALESCE(p_keywords, ARRAY[]::TEXT[]),
            p_created_by
        ) RETURNING id INTO new_paper_id;
        
        RETURN new_paper_id;
    END IF;
    
    -- 如果无法创建，返回NULL
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."find_or_create_paper_by_doi"("p_doi" "text", "p_title" "text", "p_authors" "text"[], "p_abstract" "text", "p_journal" "text", "p_publication_date" "date", "p_keywords" "text"[], "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_annotation_comment_tree"("p_annotation_id" "uuid") RETURNS TABLE("id" "uuid", "annotation_id" "uuid", "user_id" "uuid", "content" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "parent_id" "uuid", "reply_count" integer, "depth" integer, "path" "uuid"[], "is_anonymous" boolean, "username" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE
    AS $$
  WITH RECURSIVE comment_tree AS (
    -- 根评论
    SELECT 
      c.id,
      c.annotation_id,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      c.parent_id,
      c.reply_count,
      0 as depth,
      ARRAY[c.id] as path,
      COALESCE(c.is_anonymous, false) as is_anonymous,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN '匿名用户'
        ELSE COALESCE(u.username, 'Anonymous')
      END as username,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN NULL
        ELSE u.avatar_url
      END as avatar_url
    FROM annotation_comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.annotation_id = p_annotation_id 
      AND c.parent_id IS NULL
    
    UNION ALL
    
    -- 递归获取子评论
    SELECT 
      c.id,
      c.annotation_id,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      c.parent_id,
      c.reply_count,
      ct.depth + 1,
      ct.path || c.id,
      COALESCE(c.is_anonymous, false) as is_anonymous,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN '匿名用户'
        ELSE COALESCE(u.username, 'Anonymous')
      END as username,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN NULL
        ELSE u.avatar_url
      END as avatar_url
    FROM annotation_comments c
    INNER JOIN comment_tree ct ON c.parent_id = ct.id
    LEFT JOIN users u ON c.user_id = u.id
  )
  SELECT * FROM comment_tree
  ORDER BY path;
$$;


ALTER FUNCTION "public"."get_annotation_comment_tree"("p_annotation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_counter"("counter_name" "text") RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  counter_val BIGINT;
BEGIN
  SELECT counter_value INTO counter_val
  FROM public.visit_counters
  WHERE counter_type = counter_name;
  
  RETURN COALESCE(counter_val, 0);
END;
$$;


ALTER FUNCTION "public"."get_counter"("counter_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_paper_comment_tree"("p_paper_id" "uuid") RETURNS TABLE("id" "uuid", "paper_id" "uuid", "user_id" "uuid", "content" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "parent_id" "uuid", "reply_count" integer, "depth" integer, "path" "uuid"[], "is_anonymous" boolean, "username" "text", "avatar_url" "text")
    LANGUAGE "sql" STABLE
    AS $$
  WITH RECURSIVE comment_tree AS (
    -- 根评论
    SELECT 
      c.id,
      c.paper_id,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      c.parent_id,
      c.reply_count,
      0 as depth,
      ARRAY[c.id] as path,
      COALESCE(c.is_anonymous, false) as is_anonymous,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN '匿名用户'
        ELSE COALESCE(u.username, 'Anonymous')
      END as username,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN NULL
        ELSE u.avatar_url
      END as avatar_url
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.paper_id = p_paper_id 
      AND c.parent_id IS NULL
    
    UNION ALL
    
    -- 递归获取子评论
    SELECT 
      c.id,
      c.paper_id,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      c.parent_id,
      c.reply_count,
      ct.depth + 1,
      ct.path || c.id,
      COALESCE(c.is_anonymous, false) as is_anonymous,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN '匿名用户'
        ELSE COALESCE(u.username, 'Anonymous')
      END as username,
      CASE 
        WHEN COALESCE(c.is_anonymous, false) = true THEN NULL
        ELSE u.avatar_url
      END as avatar_url
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_id = ct.id
    LEFT JOIN users u ON c.user_id = u.id
  )
  SELECT * FROM comment_tree
  ORDER BY path;
$$;


ALTER FUNCTION "public"."get_paper_comment_tree"("p_paper_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_paper_zotero_annotations"("target_paper_id" "uuid") RETURNS TABLE("annotation_id" "uuid", "document_id" "uuid", "user_id" "uuid", "type" "text", "content" "text", "comment" "text", "color" "text", "position" "jsonb", "tags" "text"[], "visibility" "text", "likes_count" integer, "comments_count" integer, "created_at" timestamp with time zone, "platform" "text", "quality_score" numeric, "helpfulness_score" numeric, "display_name" "text", "username" "text", "user_avatar" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.annotation_id,
        pa.document_id,
        pa.user_id,
        pa.type,
        pa.content,
        pa.comment,
        pa.color,
        pa."position",
        pa.tags,
        pa.visibility,
        pa.likes_count,
        pa.comments_count,
        pa.annotation_created_at as created_at,
        pa.platform,
        pa.quality_score,
        pa.helpfulness_score,
        pa.display_name,
        pa.username,
        pa.user_avatar
    FROM public.paper_annotations pa
    WHERE pa.paper_id = target_paper_id 
    AND pa.visibility IN ('public', 'shared')
    AND pa.platform = 'zotero'
    ORDER BY pa.annotation_created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_paper_zotero_annotations"("target_paper_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_annotations_with_users"("doc_id" "uuid") RETURNS TABLE("id" "uuid", "document_id" "uuid", "user_id" "uuid", "type" "text", "content" "text", "comment" "text", "color" "text", "position" "jsonb", "tags" "text"[], "visibility" "text", "likes_count" integer, "comments_count" integer, "shares_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "version" integer, "parent_id" "uuid", "platform" "text", "original_id" "text", "permissions" "jsonb", "quality_score" numeric, "helpfulness_score" numeric, "show_author_name" boolean, "author_name" "text", "username" "text", "user_email" "text", "user_avatar" "text", "display_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.annotations_with_users
    WHERE document_id = doc_id 
    AND visibility IN ('public', 'shared')
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_shared_annotations_with_users"("doc_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_annotation_stats"("user_uuid" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_annotations', COALESCE(COUNT(a.id), 0),
    'public_annotations', COALESCE(COUNT(CASE WHEN a.visibility = 'public' THEN 1 END), 0),
    'shared_annotations', COALESCE(COUNT(CASE WHEN a.visibility IN ('shared', 'public') THEN 1 END), 0),
    'total_likes', COALESCE(SUM(a.likes_count), 0),
    'total_comments', COALESCE(SUM(a.comments_count), 0),
    'documents_annotated', COALESCE(COUNT(DISTINCT a.document_id), 0)
  ) INTO result
  FROM public.annotations a
  WHERE a.user_id = user_uuid;
  
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_user_annotation_stats"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("user_uuid" "uuid", "show_real_name" boolean) RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  real_name TEXT;
  username TEXT;
BEGIN
  -- 如果不显示真实姓名，返回匿名标识
  IF NOT show_real_name THEN
    RETURN '匿名用户';
  END IF;
  
  -- 尝试获取真实姓名和用户名
  SELECT u.username INTO username
  FROM public.users u 
  WHERE u.id = user_uuid;
  
  -- 如果没有找到用户，返回匿名
  IF username IS NULL THEN
    RETURN '匿名用户';
  END IF;
  
  -- 返回用户名
  RETURN username;
END;
$$;


ALTER FUNCTION "public"."get_user_display_name"("user_uuid" "uuid", "show_real_name" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  generated_username TEXT;
  counter INTEGER := 0;
  base_username TEXT;
BEGIN
  -- 生成基础用户名
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'name', 
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );
  
  -- 确保用户名不为空
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user_' || substring(NEW.id::text from 1 for 8);
  END IF;
  
  generated_username := base_username;
  
  -- 检查用户名是否已存在，如果存在则添加数字后缀
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = generated_username AND id != NEW.id) LOOP
    counter := counter + 1;
    generated_username := base_username || '_' || counter::text;
  END LOOP;
  
  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, generated_username)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, public.users.username);
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_counter"("counter_name" "text", "increment_by" integer DEFAULT 1) RETURNS bigint
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  new_value BIGINT;
BEGIN
  -- 更新计数器并返回新值
  UPDATE public.visit_counters 
  SET 
    counter_value = counter_value + increment_by,
    last_updated = NOW()
  WHERE counter_type = counter_name
  RETURNING counter_value INTO new_value;
  
  -- 如果计数器不存在，创建它
  IF new_value IS NULL THEN
    INSERT INTO public.visit_counters (counter_type, counter_value, last_updated)
    VALUES (counter_name, increment_by, NOW())
    RETURNING counter_value INTO new_value;
  END IF;
  
  RETURN new_value;
END;
$$;


ALTER FUNCTION "public"."increment_counter"("counter_name" "text", "increment_by" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_visit_counter"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 增加总访问量
  INSERT INTO public.realtime_counters (counter_name, counter_value, last_updated)
  VALUES ('total_visits', 1, NOW())
  ON CONFLICT (counter_name) 
  DO UPDATE SET 
    counter_value = public.realtime_counters.counter_value + 1,
    last_updated = NOW();
  
  -- 增加今日访问量
  INSERT INTO public.realtime_counters (counter_name, counter_value, last_updated)
  VALUES ('today_visits', 1, NOW())
  ON CONFLICT (counter_name) 
  DO UPDATE SET 
    counter_value = public.realtime_counters.counter_value + 1,
    last_updated = NOW();
END;
$$;


ALTER FUNCTION "public"."increment_visit_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_documents_to_papers"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    linked_count INTEGER := 0;
    doc_record RECORD;
    paper_id_found UUID;
BEGIN
    -- 遍历所有有DOI且未关联的文档
    FOR doc_record IN 
        SELECT id, doi, title, authors 
        FROM public.documents 
        WHERE doi IS NOT NULL 
        AND paper_id IS NULL
    LOOP
        -- 尝试通过DOI匹配论文
        SELECT id INTO paper_id_found
        FROM public.papers 
        WHERE doi = doc_record.doi
        LIMIT 1;
        
        -- 如果找到匹配的论文，建立关联
        IF paper_id_found IS NOT NULL THEN
            UPDATE public.documents 
            SET paper_id = paper_id_found
            WHERE id = doc_record.id;
            
            linked_count := linked_count + 1;
        END IF;
    END LOOP;
    
    RETURN linked_count;
END;
$$;


ALTER FUNCTION "public"."link_documents_to_papers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_visit"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.page_visits (date, visit_count) VALUES (CURRENT_DATE, 1);
END;
$$;


ALTER FUNCTION "public"."record_visit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_today_counter"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.realtime_counters 
  SET counter_value = 0, last_updated = NOW()
  WHERE counter_name = 'today_visits';
END;
$$;


ALTER FUNCTION "public"."reset_today_counter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_today_visits"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.visit_counters 
  SET counter_value = 0, last_updated = NOW()
  WHERE counter_type = 'today_visits';
END;
$$;


ALTER FUNCTION "public"."reset_today_visits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_annotation_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE annotations 
    SET comments_count = comments_count + 1, updated_at = NOW()
    WHERE id = NEW.annotation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE annotations 
    SET comments_count = GREATEST(0, comments_count - 1), updated_at = NOW()
    WHERE id = OLD.annotation_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_annotation_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_annotation_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE annotations 
    SET likes_count = likes_count + 1, updated_at = NOW()
    WHERE id = NEW.annotation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE annotations 
    SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW()
    WHERE id = OLD.annotation_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_annotation_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_reply_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE annotation_comments 
    SET reply_count = reply_count + 1, updated_at = NOW()
    WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE annotation_comments 
    SET reply_count = GREATEST(0, reply_count - 1), updated_at = NOW()
    WHERE id = OLD.parent_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_comment_reply_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_paper_comment_reply_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 插入时更新父评论的 reply_count
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE comments 
      SET reply_count = reply_count + 1
      WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- 删除时更新父评论的 reply_count
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE comments 
      SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_paper_comment_reply_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_paper_comments_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    paper_uuid UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        paper_uuid := OLD.paper_id;
    ELSE
        paper_uuid := NEW.paper_id;
    END IF;

    UPDATE papers
    SET 
        comments_count = (SELECT COUNT(*) FROM comments WHERE paper_id = paper_uuid),
        updated_at = NOW()
    WHERE id = paper_uuid;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_paper_comments_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_paper_rating_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    paper_uuid UUID;
BEGIN
    -- 确定要更新的paper_id
    IF TG_OP = 'DELETE' THEN
        paper_uuid := OLD.paper_id;
    ELSE
        paper_uuid := NEW.paper_id;
    END IF;

    -- 更新论文的评分统计
    UPDATE papers
    SET 
        ratings_count = (SELECT COUNT(*) FROM ratings WHERE paper_id = paper_uuid),
        average_rating = (SELECT ROUND(AVG(overall_score)::numeric, 1) FROM ratings WHERE paper_id = paper_uuid),
        updated_at = NOW()
    WHERE id = paper_uuid;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_paper_rating_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_paper_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_paper_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."annotation_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "annotation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_id" "uuid",
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reply_count" integer DEFAULT 0,
    "is_anonymous" boolean DEFAULT false
);


ALTER TABLE "public"."annotation_comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."annotation_comments"."is_anonymous" IS 'Whether this comment should be displayed anonymously. User ID is still tracked for moderation.';



CREATE TABLE IF NOT EXISTS "public"."annotation_likes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "annotation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."annotation_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annotation_shares" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "annotation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid",
    "shared_with_group_id" "uuid",
    "permissions" "jsonb" DEFAULT '{"canEdit": false, "canComment": true}'::"jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."annotation_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annotations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "content" "text",
    "comment" "text",
    "color" "text" DEFAULT '#ffd400'::"text",
    "position" "jsonb" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "visibility" "text" DEFAULT 'private'::"text",
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "shares_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1,
    "parent_id" "uuid",
    "platform" "text" DEFAULT 'zotero'::"text",
    "original_id" "text",
    "permissions" "jsonb" DEFAULT '{"canEdit": [], "canView": [], "canComment": []}'::"jsonb",
    "quality_score" numeric(3,2) DEFAULT 0.0,
    "helpfulness_score" numeric(3,2) DEFAULT 0.0,
    "show_author_name" boolean DEFAULT true,
    "author_name" "text",
    CONSTRAINT "annotations_platform_check" CHECK (("platform" = ANY (ARRAY['zotero'::"text", 'mendeley'::"text", 'adobe-reader'::"text", 'researchopia'::"text", 'hypothesis'::"text", 'web-annotate'::"text"]))),
    CONSTRAINT "annotations_type_check" CHECK (("type" = ANY (ARRAY['highlight'::"text", 'underline'::"text", 'strikeout'::"text", 'note'::"text", 'text'::"text", 'ink'::"text", 'image'::"text", 'shape'::"text"]))),
    CONSTRAINT "annotations_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'shared'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."annotations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."annotations"."show_author_name" IS '是否显示真实作者姓名（隐私控制）';



COMMENT ON COLUMN "public"."annotations"."author_name" IS '作者的真实姓名（从认证系统获取）';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'moderator'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."annotations_with_display_names" WITH ("security_invoker"='true') AS
 SELECT "a"."id",
    "a"."document_id",
    "a"."user_id",
    "a"."type",
    "a"."content",
    "a"."comment",
    "a"."color",
    "a"."position",
    "a"."tags",
    "a"."visibility",
    "a"."likes_count",
    "a"."comments_count",
    "a"."shares_count",
    "a"."created_at",
    "a"."updated_at",
    "a"."version",
    "a"."parent_id",
    "a"."platform",
    "a"."original_id",
    "a"."permissions",
    "a"."quality_score",
    "a"."helpfulness_score",
    "a"."show_author_name",
    "a"."author_name",
        CASE
            WHEN ("a"."show_author_name" AND ("a"."author_name" IS NOT NULL)) THEN "a"."author_name"
            WHEN "a"."show_author_name" THEN "u"."username"
            ELSE '匿名用户'::"text"
        END AS "display_name"
   FROM ("public"."annotations" "a"
     LEFT JOIN "public"."users" "u" ON (("a"."user_id" = "u"."id")));


ALTER VIEW "public"."annotations_with_display_names" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."annotations_with_users" AS
 SELECT "a"."id",
    "a"."document_id",
    "a"."user_id",
    "a"."type",
    "a"."content",
    "a"."comment",
    "a"."color",
    "a"."position",
    "a"."tags",
    "a"."visibility",
    "a"."likes_count",
    "a"."comments_count",
    "a"."shares_count",
    "a"."created_at",
    "a"."updated_at",
    "a"."version",
    "a"."parent_id",
    "a"."platform",
    "a"."original_id",
    "a"."permissions",
    "a"."quality_score",
    "a"."helpfulness_score",
    "a"."show_author_name",
    "a"."author_name",
    "u"."username",
    "u"."email" AS "user_email",
    "u"."avatar_url" AS "user_avatar",
        CASE
            WHEN ("a"."show_author_name" AND ("a"."author_name" IS NOT NULL)) THEN "a"."author_name"
            WHEN ("a"."show_author_name" AND ("u"."username" IS NOT NULL)) THEN "u"."username"
            ELSE '匿名用户'::"text"
        END AS "display_name"
   FROM ("public"."annotations" "a"
     LEFT JOIN "public"."users" "u" ON (("a"."user_id" = "u"."id")));


ALTER VIEW "public"."annotations_with_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(100) NOT NULL,
    "content" "text" NOT NULL,
    "type" character varying(20) DEFAULT 'info'::character varying,
    "is_active" boolean DEFAULT true,
    "created_by" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "announcements_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'success'::character varying, 'error'::character varying])::"text"[])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


COMMENT ON TABLE "public"."announcements" IS '系统公告表';



COMMENT ON COLUMN "public"."announcements"."id" IS '公告唯一标识';



COMMENT ON COLUMN "public"."announcements"."title" IS '公告标题';



COMMENT ON COLUMN "public"."announcements"."content" IS '公告内容';



COMMENT ON COLUMN "public"."announcements"."type" IS '公告类型：info-信息，warning-警告，success-成功，error-错误';



COMMENT ON COLUMN "public"."announcements"."is_active" IS '是否激活显示';



COMMENT ON COLUMN "public"."announcements"."created_by" IS '创建者用户名';



COMMENT ON COLUMN "public"."announcements"."created_at" IS '创建时间';



COMMENT ON COLUMN "public"."announcements"."updated_at" IS '更新时间';



CREATE TABLE IF NOT EXISTS "public"."collaboration_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "text" NOT NULL,
    "cursor_position" "jsonb",
    "is_active" boolean DEFAULT true,
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collaboration_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_votes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "vote_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "comment_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['like'::"text", 'dislike'::"text"])))
);


ALTER TABLE "public"."comment_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reply_count" integer DEFAULT 0,
    "parent_id" "uuid",
    "is_anonymous" boolean DEFAULT false
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."comments"."is_anonymous" IS 'Whether this comment should be displayed anonymously. User ID is still tracked for moderation.';



CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "doi" "text",
    "title" "text" NOT NULL,
    "authors" "text"[] NOT NULL,
    "abstract" "text",
    "publication_date" "date",
    "journal" "text",
    "document_type" "text" DEFAULT 'pdf'::"text",
    "file_path" "text",
    "file_size" bigint,
    "page_count" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "paper_id" "uuid",
    CONSTRAINT "documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['pdf'::"text", 'epub'::"text", 'html'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."documents"."paper_id" IS '关联的论文ID，用于连接Zotero文档与主网站论文数据';



CREATE OR REPLACE VIEW "public"."document_annotation_stats" AS
 SELECT "d"."id" AS "document_id",
    "d"."title",
    "d"."doi",
    "count"("a"."id") AS "total_annotations",
    "count"(DISTINCT "a"."user_id") AS "unique_annotators",
    "count"(
        CASE
            WHEN ("a"."visibility" = 'public'::"text") THEN 1
            ELSE NULL::integer
        END) AS "public_annotations",
    COALESCE("avg"("a"."quality_score"), (0)::numeric) AS "avg_quality_score",
    "max"("a"."created_at") AS "last_annotation_at"
   FROM ("public"."documents" "d"
     LEFT JOIN "public"."annotations" "a" ON (("d"."id" = "a"."document_id")))
  GROUP BY "d"."id", "d"."title", "d"."doi";


ALTER VIEW "public"."document_annotation_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."papers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "authors" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "doi" "text",
    "abstract" "text",
    "keywords" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "publication_date" "date",
    "journal" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "view_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "ratings_count" integer DEFAULT 0 NOT NULL,
    "average_rating" numeric(3,1) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."papers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."papers"."comments_count" IS 'Total number of comments (including nested replies) for this paper';



COMMENT ON COLUMN "public"."papers"."ratings_count" IS 'Count of ratings for this paper';



COMMENT ON COLUMN "public"."papers"."average_rating" IS 'Average overall score from all ratings (1 decimal place)';



CREATE OR REPLACE VIEW "public"."paper_annotations" AS
 SELECT "a"."id" AS "annotation_id",
    "a"."document_id",
    "a"."user_id",
    "a"."type",
    "a"."content",
    "a"."comment",
    "a"."color",
    "a"."position",
    "a"."tags",
    "a"."visibility",
    "a"."likes_count",
    "a"."comments_count",
    "a"."created_at" AS "annotation_created_at",
    "a"."updated_at" AS "annotation_updated_at",
    "a"."platform",
    "a"."quality_score",
    "a"."helpfulness_score",
    "a"."show_author_name",
    "a"."author_name",
    "d"."paper_id",
    COALESCE("p"."title", "d"."title") AS "paper_title",
    COALESCE("p"."doi", "d"."doi") AS "paper_doi",
    COALESCE("p"."authors", "d"."authors") AS "paper_authors",
    COALESCE("p"."abstract", "d"."abstract") AS "paper_abstract",
    "p"."keywords" AS "paper_keywords",
    "p"."journal" AS "paper_journal",
    "p"."publication_date" AS "paper_publication_date",
    "u"."username",
    "u"."avatar_url" AS "user_avatar",
        CASE
            WHEN ("a"."show_author_name" AND ("a"."author_name" IS NOT NULL)) THEN "a"."author_name"
            WHEN ("a"."show_author_name" AND ("u"."username" IS NOT NULL)) THEN "u"."username"
            ELSE '匿名用户'::"text"
        END AS "display_name"
   FROM ((("public"."annotations" "a"
     LEFT JOIN "public"."documents" "d" ON (("a"."document_id" = "d"."id")))
     LEFT JOIN "public"."papers" "p" ON (("d"."paper_id" = "p"."id")))
     LEFT JOIN "public"."users" "u" ON (("a"."user_id" = "u"."id")));


ALTER VIEW "public"."paper_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paper_favorites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."paper_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."paper_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "title" character varying(500) NOT NULL,
    "url" "text" NOT NULL,
    "source" character varying(20) DEFAULT 'other'::character varying NOT NULL,
    "author" character varying(200),
    "publish_date" "date",
    "description" "text",
    "thumbnail_url" "text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "paper_reports_source_check" CHECK ((("source")::"text" = ANY ((ARRAY['wechat'::character varying, 'news'::character varying, 'blog'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."paper_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paper_id" "uuid" NOT NULL,
    "innovation_score" integer NOT NULL,
    "methodology_score" integer NOT NULL,
    "practicality_score" integer NOT NULL,
    "overall_score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "show_username" boolean DEFAULT true NOT NULL,
    CONSTRAINT "ratings_innovation_score_check" CHECK ((("innovation_score" >= 1) AND ("innovation_score" <= 5))),
    CONSTRAINT "ratings_methodology_score_check" CHECK ((("methodology_score" >= 1) AND ("methodology_score" <= 5))),
    CONSTRAINT "ratings_overall_score_check" CHECK ((("overall_score" >= 1) AND ("overall_score" <= 5))),
    CONSTRAINT "ratings_practicality_score_check" CHECK ((("practicality_score" >= 1) AND ("practicality_score" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ratings"."is_anonymous" IS 'Whether the rating was submitted anonymously';



COMMENT ON COLUMN "public"."ratings"."show_username" IS 'Whether to display the username (can be toggled by user)';



CREATE OR REPLACE VIEW "public"."user_annotation_overview" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."username",
    "u"."avatar_url",
    "count"("a"."id") AS "total_annotations",
    "count"(
        CASE
            WHEN ("a"."visibility" = 'public'::"text") THEN 1
            ELSE NULL::integer
        END) AS "public_annotations",
    "count"(
        CASE
            WHEN ("a"."visibility" = 'shared'::"text") THEN 1
            ELSE NULL::integer
        END) AS "shared_annotations",
    COALESCE("sum"("a"."likes_count"), (0)::bigint) AS "total_likes_received",
    COALESCE("sum"("a"."comments_count"), (0)::bigint) AS "total_comments_received",
    "max"("a"."created_at") AS "last_annotation_at"
   FROM ("public"."users" "u"
     LEFT JOIN "public"."annotations" "a" ON (("u"."id" = "a"."user_id")))
  GROUP BY "u"."id", "u"."username", "u"."avatar_url";


ALTER VIEW "public"."user_annotation_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_comment_preferences" (
    "user_id" "uuid" NOT NULL,
    "default_anonymous" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_comment_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_comment_preferences" IS 'User preferences for comment anonymity. Stores default settings.';



CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_counters" (
    "id" integer NOT NULL,
    "counter_type" character varying(50) NOT NULL,
    "counter_value" bigint DEFAULT 0,
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."visit_counters" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."visit_counters_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."visit_counters_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."visit_counters_id_seq" OWNED BY "public"."visit_counters"."id";



ALTER TABLE ONLY "public"."visit_counters" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."visit_counters_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."annotation_comments"
    ADD CONSTRAINT "annotation_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotation_likes"
    ADD CONSTRAINT "annotation_likes_annotation_id_user_id_key" UNIQUE ("annotation_id", "user_id");



ALTER TABLE ONLY "public"."annotation_likes"
    ADD CONSTRAINT "annotation_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotation_shares"
    ADD CONSTRAINT "annotation_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collaboration_sessions"
    ADD CONSTRAINT "collaboration_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_user_id_comment_id_key" UNIQUE ("user_id", "comment_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_doi_key" UNIQUE ("doi");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paper_favorites"
    ADD CONSTRAINT "paper_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."paper_favorites"
    ADD CONSTRAINT "paper_favorites_user_id_paper_id_key" UNIQUE ("user_id", "paper_id");



ALTER TABLE ONLY "public"."paper_reports"
    ADD CONSTRAINT "paper_reports_paper_id_url_key" UNIQUE ("paper_id", "url");



ALTER TABLE ONLY "public"."paper_reports"
    ADD CONSTRAINT "paper_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."papers"
    ADD CONSTRAINT "papers_doi_key" UNIQUE ("doi");



ALTER TABLE ONLY "public"."papers"
    ADD CONSTRAINT "papers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_paper_id_key" UNIQUE ("user_id", "paper_id");



ALTER TABLE ONLY "public"."user_comment_preferences"
    ADD CONSTRAINT "user_comment_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."visit_counters"
    ADD CONSTRAINT "visit_counters_counter_type_key" UNIQUE ("counter_type");



ALTER TABLE ONLY "public"."visit_counters"
    ADD CONSTRAINT "visit_counters_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_annotation_comments_annotation_created" ON "public"."annotation_comments" USING "btree" ("annotation_id", "created_at");



CREATE INDEX "idx_annotation_comments_is_anonymous" ON "public"."annotation_comments" USING "btree" ("is_anonymous");



CREATE INDEX "idx_annotation_likes_user_annotation" ON "public"."annotation_likes" USING "btree" ("user_id", "annotation_id");



CREATE INDEX "idx_annotations_content_search" ON "public"."annotations" USING "gin" ("to_tsvector"('"english"'::"regconfig", ((COALESCE("content", ''::"text") || ' '::"text") || COALESCE("comment", ''::"text"))));



CREATE INDEX "idx_annotations_created_at" ON "public"."annotations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_annotations_doc_user" ON "public"."annotations" USING "btree" ("document_id", "user_id");



CREATE INDEX "idx_annotations_doc_visibility" ON "public"."annotations" USING "btree" ("document_id", "visibility");



CREATE INDEX "idx_annotations_document_id" ON "public"."annotations" USING "btree" ("document_id");



CREATE INDEX "idx_annotations_document_visibility" ON "public"."annotations" USING "btree" ("document_id", "visibility") WHERE ("visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"]));



CREATE INDEX "idx_annotations_platform" ON "public"."annotations" USING "btree" ("platform");



CREATE INDEX "idx_annotations_position" ON "public"."annotations" USING "gin" ("position");



CREATE INDEX "idx_annotations_show_author_name" ON "public"."annotations" USING "btree" ("show_author_name");



CREATE INDEX "idx_annotations_tags" ON "public"."annotations" USING "gin" ("tags");



CREATE INDEX "idx_annotations_type" ON "public"."annotations" USING "btree" ("type");



CREATE INDEX "idx_annotations_user_document" ON "public"."annotations" USING "btree" ("user_id", "document_id");



CREATE INDEX "idx_annotations_user_id" ON "public"."annotations" USING "btree" ("user_id");



CREATE INDEX "idx_annotations_user_visibility" ON "public"."annotations" USING "btree" ("user_id", "visibility");



CREATE INDEX "idx_annotations_visibility" ON "public"."annotations" USING "btree" ("visibility");



CREATE INDEX "idx_annotations_with_users_doc_visibility" ON "public"."annotations" USING "btree" ("document_id", "visibility") WHERE ("visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"]));



CREATE INDEX "idx_announcements_active" ON "public"."announcements" USING "btree" ("is_active");



CREATE INDEX "idx_announcements_created_at" ON "public"."announcements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_announcements_type" ON "public"."announcements" USING "btree" ("type");



CREATE INDEX "idx_comment_votes_comment_id" ON "public"."comment_votes" USING "btree" ("comment_id");



CREATE INDEX "idx_comments_is_anonymous" ON "public"."comments" USING "btree" ("is_anonymous");



CREATE INDEX "idx_comments_paper_id" ON "public"."comments" USING "btree" ("paper_id");



CREATE INDEX "idx_comments_paper_parent" ON "public"."comments" USING "btree" ("paper_id", "parent_id");



CREATE INDEX "idx_comments_parent_id" ON "public"."comments" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_comments_user_id" ON "public"."comments" USING "btree" ("user_id");



CREATE INDEX "idx_documents_abstract_search" ON "public"."documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", COALESCE("abstract", ''::"text")));



CREATE INDEX "idx_documents_doi_paper_mapping" ON "public"."documents" USING "btree" ("doi", "paper_id");



CREATE INDEX "idx_documents_paper_id" ON "public"."documents" USING "btree" ("paper_id");



CREATE INDEX "idx_documents_title_search" ON "public"."documents" USING "gin" ("to_tsvector"('"english"'::"regconfig", "title"));



CREATE INDEX "idx_paper_favorites_paper_id" ON "public"."paper_favorites" USING "btree" ("paper_id");



CREATE INDEX "idx_paper_favorites_user_id" ON "public"."paper_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_papers_average_rating" ON "public"."papers" USING "btree" ("average_rating");



CREATE INDEX "idx_papers_comments_count" ON "public"."papers" USING "btree" ("comments_count");



CREATE INDEX "idx_papers_created_by" ON "public"."papers" USING "btree" ("created_by");



CREATE INDEX "idx_papers_doi" ON "public"."papers" USING "btree" ("doi");



CREATE INDEX "idx_papers_ratings_count" ON "public"."papers" USING "btree" ("ratings_count");



CREATE INDEX "idx_ratings_anonymous" ON "public"."ratings" USING "btree" ("is_anonymous");



CREATE INDEX "idx_ratings_paper_id" ON "public"."ratings" USING "btree" ("paper_id");



CREATE INDEX "idx_ratings_show_username" ON "public"."ratings" USING "btree" ("show_username");



CREATE INDEX "idx_ratings_user_id" ON "public"."ratings" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_username" ON "public"."users" USING "btree" ("username");



CREATE INDEX "idx_visit_counters_type" ON "public"."visit_counters" USING "btree" ("counter_type");



CREATE INDEX "paper_reports_created_at_idx" ON "public"."paper_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "paper_reports_paper_id_idx" ON "public"."paper_reports" USING "btree" ("paper_id");



CREATE INDEX "paper_reports_publish_date_idx" ON "public"."paper_reports" USING "btree" ("publish_date" DESC);



CREATE INDEX "paper_reports_source_idx" ON "public"."paper_reports" USING "btree" ("source");



CREATE UNIQUE INDEX "unique_like_per_annotation" ON "public"."annotation_likes" USING "btree" ("user_id", "annotation_id");



CREATE UNIQUE INDEX "unique_paper_favorite_per_user" ON "public"."paper_favorites" USING "btree" ("user_id", "paper_id");



CREATE UNIQUE INDEX "unique_public_shared_annotation" ON "public"."annotations" USING "btree" ("document_id", "user_id", "type", "content", ((("position" ->> 'page'::"text"))::integer)) WHERE (("visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"])) AND ("content" IS NOT NULL) AND (("position" ->> 'page'::"text") IS NOT NULL));



CREATE UNIQUE INDEX "unique_rating_per_user_paper" ON "public"."ratings" USING "btree" ("user_id", "paper_id");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_annotation_comments_count" AFTER INSERT OR DELETE ON "public"."annotation_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_annotation_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_annotation_likes_count" AFTER INSERT OR DELETE ON "public"."annotation_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_annotation_likes_count"();



CREATE OR REPLACE TRIGGER "trigger_update_comments_count" AFTER INSERT OR DELETE ON "public"."annotation_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_annotation_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_likes_count" AFTER INSERT OR DELETE ON "public"."annotation_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_annotation_likes_count"();



CREATE OR REPLACE TRIGGER "trigger_update_paper_comments_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_paper_comments_count"();



CREATE OR REPLACE TRIGGER "trigger_update_paper_rating_stats" AFTER INSERT OR DELETE OR UPDATE ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_paper_rating_stats"();



CREATE OR REPLACE TRIGGER "trigger_update_paper_reply_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_paper_comment_reply_count"();



CREATE OR REPLACE TRIGGER "trigger_update_reply_count" AFTER INSERT OR DELETE ON "public"."annotation_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_reply_count"();



CREATE OR REPLACE TRIGGER "update_annotation_comments_updated_at" BEFORE UPDATE ON "public"."annotation_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_annotations_updated_at" BEFORE UPDATE ON "public"."annotations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_announcements_updated_at" BEFORE UPDATE ON "public"."announcements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_comments_updated_at" BEFORE UPDATE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_paper_reports_updated_at" BEFORE UPDATE ON "public"."paper_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_paper_reports_updated_at"();



CREATE OR REPLACE TRIGGER "update_papers_updated_at" BEFORE UPDATE ON "public"."papers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ratings_updated_at" BEFORE UPDATE ON "public"."ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."annotation_comments"
    ADD CONSTRAINT "annotation_comments_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_comments"
    ADD CONSTRAINT "annotation_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."annotation_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_comments"
    ADD CONSTRAINT "annotation_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_likes"
    ADD CONSTRAINT "annotation_likes_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_likes"
    ADD CONSTRAINT "annotation_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_shares"
    ADD CONSTRAINT "annotation_shares_annotation_id_fkey" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_shares"
    ADD CONSTRAINT "annotation_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotation_shares"
    ADD CONSTRAINT "annotation_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."annotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaboration_sessions"
    ADD CONSTRAINT "collaboration_sessions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collaboration_sessions"
    ADD CONSTRAINT "collaboration_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_votes"
    ADD CONSTRAINT "comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."paper_favorites"
    ADD CONSTRAINT "paper_favorites_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."paper_favorites"
    ADD CONSTRAINT "paper_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."papers"
    ADD CONSTRAINT "papers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_comment_preferences"
    ADD CONSTRAINT "user_comment_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow read user basic info" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Allow users to follow others" ON "public"."user_follows" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Allow users to unfollow others" ON "public"."user_follows" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Allow view all follows" ON "public"."user_follows" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert paper reports" ON "public"."paper_reports" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view active announcements" ON "public"."announcements" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view likes" ON "public"."annotation_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view paper reports" ON "public"."paper_reports" FOR SELECT USING (true);



CREATE POLICY "Anyone can view public annotation comments" ON "public"."annotation_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."annotations"
  WHERE (("annotations"."id" = "annotation_comments"."annotation_id") AND ("annotations"."visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"]))))));



CREATE POLICY "Anyone can view visit counters" ON "public"."visit_counters" FOR SELECT USING (true);



CREATE POLICY "Only view counters" ON "public"."visit_counters" FOR SELECT USING (true);



CREATE POLICY "Service role can manage all announcements" ON "public"."announcements" USING (true);



CREATE POLICY "System can update visit counters" ON "public"."visit_counters" USING (true);



CREATE POLICY "Users and admins can delete comments" ON "public"."annotation_comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users and admins can delete paper comments" ON "public"."comments" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))));



CREATE POLICY "Users can create comments on public annotations" ON "public"."annotation_comments" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."annotations"
  WHERE (("annotations"."id" = "annotation_comments"."annotation_id") AND ("annotations"."visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"])))))));



CREATE POLICY "Users can insert own preferences" ON "public"."user_comment_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can like public annotations" ON "public"."annotation_likes" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."annotations"
  WHERE (("annotations"."id" = "annotation_likes"."annotation_id") AND ("annotations"."visibility" = ANY (ARRAY['public'::"text", 'shared'::"text"])))))));



CREATE POLICY "Users can manage their own comments" ON "public"."annotation_comments" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own likes" ON "public"."annotation_likes" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can unlike their own likes" ON "public"."annotation_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own comments" ON "public"."annotation_comments" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own preferences" ON "public"."user_comment_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view all profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can view own preferences" ON "public"."user_comment_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_all_comment_votes" ON "public"."comment_votes" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_comments" ON "public"."comments" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_paper_favorites" ON "public"."paper_favorites" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_papers" ON "public"."papers" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all_ratings" ON "public"."ratings" USING (true) WITH CHECK (true);



ALTER TABLE "public"."annotation_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotation_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotation_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "annotations_delete_policy" ON "public"."annotations" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "annotations_insert_policy" ON "public"."annotations" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "annotations_select_policy" ON "public"."annotations" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("visibility" = 'public'::"text") OR (("visibility" = 'shared'::"text") AND ("id" IN ( SELECT "annotation_shares"."annotation_id"
   FROM "public"."annotation_shares"
  WHERE ("annotation_shares"."shared_with_user_id" = "auth"."uid"()))))));



CREATE POLICY "annotations_update_policy" ON "public"."annotations" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collaboration_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments_allow_all" ON "public"."comments" USING (true) WITH CHECK (true);



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_insert_policy" ON "public"."documents" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "documents_select_policy" ON "public"."documents" FOR SELECT USING (true);



CREATE POLICY "documents_update_policy" ON "public"."documents" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "favorites_allow_all" ON "public"."paper_favorites" USING (true) WITH CHECK (true);



ALTER TABLE "public"."paper_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."paper_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."papers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "papers_allow_all" ON "public"."papers" USING (true) WITH CHECK (true);



ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ratings_allow_all" ON "public"."ratings" USING (true) WITH CHECK (true);



ALTER TABLE "public"."user_comment_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_allow_all" ON "public"."users" USING (true) WITH CHECK (true);



ALTER TABLE "public"."visit_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "允许查看所有用户公开信息" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "允许用户插入自己的记录" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "允许用户更新自己的记录" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."find_or_create_paper_by_doi"("p_doi" "text", "p_title" "text", "p_authors" "text"[], "p_abstract" "text", "p_journal" "text", "p_publication_date" "date", "p_keywords" "text"[], "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."find_or_create_paper_by_doi"("p_doi" "text", "p_title" "text", "p_authors" "text"[], "p_abstract" "text", "p_journal" "text", "p_publication_date" "date", "p_keywords" "text"[], "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_or_create_paper_by_doi"("p_doi" "text", "p_title" "text", "p_authors" "text"[], "p_abstract" "text", "p_journal" "text", "p_publication_date" "date", "p_keywords" "text"[], "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_annotation_comment_tree"("p_annotation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_annotation_comment_tree"("p_annotation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_annotation_comment_tree"("p_annotation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_counter"("counter_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_counter"("counter_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_counter"("counter_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_paper_comment_tree"("p_paper_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_paper_comment_tree"("p_paper_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_paper_comment_tree"("p_paper_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_paper_zotero_annotations"("target_paper_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_paper_zotero_annotations"("target_paper_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_paper_zotero_annotations"("target_paper_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_annotations_with_users"("doc_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_annotations_with_users"("doc_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_annotations_with_users"("doc_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_annotation_stats"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_annotation_stats"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_annotation_stats"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_uuid" "uuid", "show_real_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_uuid" "uuid", "show_real_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_display_name"("user_uuid" "uuid", "show_real_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_counter"("counter_name" "text", "increment_by" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_counter"("counter_name" "text", "increment_by" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_counter"("counter_name" "text", "increment_by" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_visit_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_visit_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_visit_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_documents_to_papers"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_documents_to_papers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_documents_to_papers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_visit"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_visit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_visit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_today_counter"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_today_counter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_today_counter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_today_visits"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_today_visits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_today_visits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_annotation_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_annotation_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_annotation_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_annotation_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_annotation_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_annotation_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_paper_comment_reply_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_paper_comment_reply_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_paper_comment_reply_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_paper_comments_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_paper_comments_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_paper_comments_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_paper_rating_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_paper_rating_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_paper_rating_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_paper_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_paper_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_paper_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."annotation_comments" TO "anon";
GRANT ALL ON TABLE "public"."annotation_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."annotation_comments" TO "service_role";



GRANT ALL ON TABLE "public"."annotation_likes" TO "anon";
GRANT ALL ON TABLE "public"."annotation_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."annotation_likes" TO "service_role";



GRANT ALL ON TABLE "public"."annotation_shares" TO "anon";
GRANT ALL ON TABLE "public"."annotation_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."annotation_shares" TO "service_role";



GRANT ALL ON TABLE "public"."annotations" TO "anon";
GRANT ALL ON TABLE "public"."annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."annotations_with_display_names" TO "anon";
GRANT ALL ON TABLE "public"."annotations_with_display_names" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations_with_display_names" TO "service_role";



GRANT ALL ON TABLE "public"."annotations_with_users" TO "anon";
GRANT ALL ON TABLE "public"."annotations_with_users" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations_with_users" TO "service_role";



GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."collaboration_sessions" TO "anon";
GRANT ALL ON TABLE "public"."collaboration_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."collaboration_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."comment_votes" TO "anon";
GRANT ALL ON TABLE "public"."comment_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_votes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."document_annotation_stats" TO "anon";
GRANT ALL ON TABLE "public"."document_annotation_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."document_annotation_stats" TO "service_role";



GRANT ALL ON TABLE "public"."papers" TO "anon";
GRANT ALL ON TABLE "public"."papers" TO "authenticated";
GRANT ALL ON TABLE "public"."papers" TO "service_role";



GRANT ALL ON TABLE "public"."paper_annotations" TO "anon";
GRANT ALL ON TABLE "public"."paper_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."paper_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."paper_favorites" TO "anon";
GRANT ALL ON TABLE "public"."paper_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."paper_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."paper_reports" TO "anon";
GRANT ALL ON TABLE "public"."paper_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."paper_reports" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."user_annotation_overview" TO "anon";
GRANT ALL ON TABLE "public"."user_annotation_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."user_annotation_overview" TO "service_role";



GRANT ALL ON TABLE "public"."user_comment_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_comment_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_comment_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."visit_counters" TO "anon";
GRANT ALL ON TABLE "public"."visit_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_counters" TO "service_role";



GRANT ALL ON SEQUENCE "public"."visit_counters_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."visit_counters_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."visit_counters_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();



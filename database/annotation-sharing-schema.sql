-- 研学港标注分享数据库设计
-- Researchopia Annotation Sharing Database Schema

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 创建文档表（扩展papers表）
CREATE TABLE public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  doi TEXT UNIQUE,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL,
  abstract TEXT,
  publication_date DATE,
  journal TEXT,
  document_type TEXT DEFAULT 'pdf' CHECK (document_type IN ('pdf', 'epub', 'html', 'text')),
  file_path TEXT,
  file_size BIGINT,
  page_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- 创建标注表
CREATE TABLE public.annotations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- 标注基本信息
  type TEXT NOT NULL CHECK (type IN ('highlight', 'underline', 'strikeout', 'note', 'text', 'ink', 'image', 'shape')),
  content TEXT, -- 选中的文本内容
  comment TEXT, -- 用户评论
  color TEXT DEFAULT '#ffd400', -- 颜色值
  
  -- 位置信息（JSON格式存储，支持多种文档类型）
  position JSONB NOT NULL,
  
  -- 元数据
  tags TEXT[] DEFAULT '{}',
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  
  -- 社交功能
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 版本控制
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES public.annotations(id) ON DELETE SET NULL, -- 用于标注的版本历史
  
  -- 平台信息
  platform TEXT DEFAULT 'zotero' CHECK (platform IN ('zotero', 'mendeley', 'adobe-reader', 'researchopia', 'hypothesis', 'web-annotate')),
  original_id TEXT, -- 原始平台中的ID
  
  -- 权限控制
  permissions JSONB DEFAULT '{"canEdit": [], "canView": [], "canComment": []}',
  
  -- 质量评分
  quality_score DECIMAL(3,2) DEFAULT 0.0,
  helpfulness_score DECIMAL(3,2) DEFAULT 0.0
);

-- 创建标注点赞表
CREATE TABLE public.annotation_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- 创建标注评论表
CREATE TABLE public.annotation_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.annotation_comments(id) ON DELETE CASCADE, -- 支持嵌套评论
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建标注分享表
CREATE TABLE public.annotation_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  shared_with_group_id UUID, -- 未来扩展群组功能
  permissions JSONB DEFAULT '{"canEdit": false, "canComment": true}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户关注表
CREATE TABLE public.user_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- 创建标注收藏表
CREATE TABLE public.annotation_favorites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, annotation_id)
);

-- 创建标注质量评分表
CREATE TABLE public.annotation_ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  quality_score INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  helpfulness_score INTEGER CHECK (helpfulness_score >= 1 AND helpfulness_score <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- 创建实时协作会话表
CREATE TABLE public.collaboration_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  cursor_position JSONB, -- 光标位置信息
  is_active BOOLEAN DEFAULT true,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建标注统计表
CREATE TABLE public.annotation_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  total_annotations INTEGER DEFAULT 0,
  public_annotations INTEGER DEFAULT 0,
  shared_annotations INTEGER DEFAULT 0,
  total_likes_received INTEGER DEFAULT 0,
  total_comments_received INTEGER DEFAULT 0,
  last_annotation_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, user_id)
);

-- 创建索引以优化查询性能
CREATE INDEX idx_annotations_document_id ON public.annotations(document_id);
CREATE INDEX idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX idx_annotations_type ON public.annotations(type);
CREATE INDEX idx_annotations_visibility ON public.annotations(visibility);
CREATE INDEX idx_annotations_created_at ON public.annotations(created_at DESC);
CREATE INDEX idx_annotations_platform ON public.annotations(platform);
CREATE INDEX idx_annotations_position ON public.annotations USING GIN(position);
CREATE INDEX idx_annotations_tags ON public.annotations USING GIN(tags);

-- 全文搜索索引
CREATE INDEX idx_annotations_content_search ON public.annotations USING GIN(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(comment, '')));
CREATE INDEX idx_documents_title_search ON public.documents USING GIN(to_tsvector('english', title));
CREATE INDEX idx_documents_abstract_search ON public.documents USING GIN(to_tsvector('english', COALESCE(abstract, '')));

-- 创建复合索引
CREATE INDEX idx_annotations_doc_user ON public.annotations(document_id, user_id);
CREATE INDEX idx_annotations_doc_visibility ON public.annotations(document_id, visibility);
CREATE INDEX idx_annotations_user_visibility ON public.annotations(user_id, visibility);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION update_annotation_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新用户标注统计
  INSERT INTO public.annotation_stats (document_id, user_id, total_annotations, public_annotations, shared_annotations, last_annotation_at)
  VALUES (
    NEW.document_id, 
    NEW.user_id, 
    1, 
    CASE WHEN NEW.visibility = 'public' THEN 1 ELSE 0 END,
    CASE WHEN NEW.visibility IN ('shared', 'public') THEN 1 ELSE 0 END,
    NEW.created_at
  )
  ON CONFLICT (document_id, user_id) 
  DO UPDATE SET
    total_annotations = annotation_stats.total_annotations + 1,
    public_annotations = annotation_stats.public_annotations + CASE WHEN NEW.visibility = 'public' THEN 1 ELSE 0 END,
    shared_annotations = annotation_stats.shared_annotations + CASE WHEN NEW.visibility IN ('shared', 'public') THEN 1 ELSE 0 END,
    last_annotation_at = NEW.created_at,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER trigger_update_annotation_stats
  AFTER INSERT ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION update_annotation_stats();

-- 创建更新updated_at的触发器
CREATE TRIGGER update_annotations_updated_at 
  BEFORE UPDATE ON public.annotations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotation_comments_updated_at 
  BEFORE UPDATE ON public.annotation_comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotation_ratings_updated_at 
  BEFORE UPDATE ON public.annotation_ratings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建视图：用户标注概览（普通视图，非安全定义）
CREATE VIEW public.user_annotation_overview AS
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

-- 创建视图：文档标注统计（普通视图，非安全定义）
CREATE VIEW public.document_annotation_stats AS
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

-- 为视图启用RLS
ALTER VIEW public.user_annotation_overview SET (security_invoker = true);
ALTER VIEW public.document_annotation_stats SET (security_invoker = true);

-- 插入示例数据
INSERT INTO public.documents (doi, title, authors, abstract, publication_date, journal, document_type)
VALUES 
  ('10.1038/nature12373', 'Sample Research Paper 1', ARRAY['John Doe', 'Jane Smith'], 'This is a sample abstract for testing purposes.', '2023-01-15', 'Nature', 'pdf'),
  ('10.1126/science.1234567', 'Sample Research Paper 2', ARRAY['Alice Johnson', 'Bob Wilson'], 'Another sample abstract for testing the annotation system.', '2023-02-20', 'Science', 'pdf');

-- 启用所有表的行级安全（RLS）
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_stats ENABLE ROW LEVEL SECURITY;

-- 文档表RLS策略
CREATE POLICY "Users can view all documents" ON public.documents
  FOR SELECT USING (true);

CREATE POLICY "Users can create documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own documents" ON public.documents
  FOR UPDATE USING (created_by = auth.uid());

-- 标注表RLS策略
CREATE POLICY "Users can view their own annotations and public/shared annotations" ON public.annotations
  FOR SELECT USING (
    user_id = auth.uid() OR 
    visibility = 'public' OR 
    (visibility = 'shared' AND id IN (
      SELECT annotation_id FROM public.annotation_shares 
      WHERE shared_with_user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can create annotations" ON public.annotations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own annotations" ON public.annotations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own annotations" ON public.annotations
  FOR DELETE USING (user_id = auth.uid());

-- 标注点赞表RLS策略
CREATE POLICY "Users can view all likes" ON public.annotation_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON public.annotation_likes
  FOR ALL USING (user_id = auth.uid());

-- 标注评论表RLS策略
CREATE POLICY "Users can view all comments" ON public.annotation_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON public.annotation_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own comments" ON public.annotation_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON public.annotation_comments
  FOR DELETE USING (user_id = auth.uid());

-- 标注分享表RLS策略
CREATE POLICY "Users can view shares they are involved in" ON public.annotation_shares
  FOR SELECT USING (
    user_id = auth.uid() OR 
    shared_with_user_id = auth.uid()
  );

CREATE POLICY "Users can create shares for their annotations" ON public.annotation_shares
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own shares" ON public.annotation_shares
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own shares" ON public.annotation_shares
  FOR DELETE USING (user_id = auth.uid());

-- 用户关注表RLS策略
CREATE POLICY "Users can view all follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON public.user_follows
  FOR ALL USING (follower_id = auth.uid());

-- 标注收藏表RLS策略
CREATE POLICY "Users can view all favorites" ON public.annotation_favorites
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own favorites" ON public.annotation_favorites
  FOR ALL USING (user_id = auth.uid());

-- 标注评分表RLS策略
CREATE POLICY "Users can view all ratings" ON public.annotation_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own ratings" ON public.annotation_ratings
  FOR ALL USING (user_id = auth.uid());

-- 协作会话表RLS策略
CREATE POLICY "Users can view sessions for documents they have access to" ON public.collaboration_sessions
  FOR SELECT USING (
    user_id = auth.uid() OR
    document_id IN (
      SELECT id FROM public.documents WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create their own sessions" ON public.collaboration_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions" ON public.collaboration_sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions" ON public.collaboration_sessions
  FOR DELETE USING (user_id = auth.uid());

-- 标注统计表RLS策略
CREATE POLICY "Users can view all stats" ON public.annotation_stats
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own stats" ON public.annotation_stats
  FOR ALL USING (user_id = auth.uid());

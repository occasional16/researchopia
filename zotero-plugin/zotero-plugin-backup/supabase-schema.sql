-- Researchopia 标注共享系统数据库结构
-- 基于Supabase PostgreSQL

-- 用户表 (扩展auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 统计信息
  annotations_count INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0
);

-- 论文表
CREATE TABLE public.papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  authors TEXT[], -- 作者数组
  journal VARCHAR(255),
  year INTEGER,
  abstract TEXT,
  pdf_url TEXT,
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 统计信息
  annotations_count INTEGER DEFAULT 0,
  users_count INTEGER DEFAULT 0 -- 有标注的用户数
);

-- 标注表
CREATE TABLE public.annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE,
  
  -- Zotero标注信息
  zotero_key VARCHAR(255), -- Zotero标注的key
  annotation_type VARCHAR(20) NOT NULL, -- highlight, note, image, ink
  
  -- 标注内容
  text_content TEXT, -- 高亮的文本内容
  comment TEXT, -- 用户评论/笔记
  color VARCHAR(7) DEFAULT '#ffd400', -- 颜色
  
  -- 位置信息
  page_number INTEGER,
  page_label VARCHAR(50),
  position_data JSONB, -- Zotero的位置数据
  
  -- 精细定位信息
  text_before TEXT, -- 前文上下文
  text_after TEXT, -- 后文上下文
  paragraph_hash VARCHAR(64), -- 段落哈希用于匹配
  sentence_index INTEGER, -- 句子索引
  
  -- 状态
  is_public BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 统计信息
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  
  -- 索引
  UNIQUE(user_id, paper_id, zotero_key)
);

-- 标注点赞表
CREATE TABLE public.annotation_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, annotation_id)
);

-- 标注评论表
CREATE TABLE public.annotation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.annotation_comments(id), -- 支持回复
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0
);

-- 用户关注表
CREATE TABLE public.user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- 标注分享表
CREATE TABLE public.annotation_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  annotation_id UUID REFERENCES public.annotations(id) ON DELETE CASCADE,
  share_type VARCHAR(20) DEFAULT 'share', -- share, repost, etc.
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, annotation_id)
);

-- 创建索引
CREATE INDEX idx_annotations_paper_id ON public.annotations(paper_id);
CREATE INDEX idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX idx_annotations_created_at ON public.annotations(created_at DESC);
CREATE INDEX idx_annotations_likes_count ON public.annotations(likes_count DESC);
CREATE INDEX idx_annotations_public ON public.annotations(is_public) WHERE is_public = true;
CREATE INDEX idx_papers_doi ON public.papers(doi);
CREATE INDEX idx_annotation_likes_annotation_id ON public.annotation_likes(annotation_id);
CREATE INDEX idx_annotation_comments_annotation_id ON public.annotation_comments(annotation_id);

-- 创建触发器函数用于更新统计
CREATE OR REPLACE FUNCTION update_annotation_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 更新点赞数
    IF TG_TABLE_NAME = 'annotation_likes' THEN
      UPDATE public.annotations 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.annotation_id;
    END IF;
    
    -- 更新评论数
    IF TG_TABLE_NAME = 'annotation_comments' THEN
      UPDATE public.annotations 
      SET comments_count = comments_count + 1 
      WHERE id = NEW.annotation_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    -- 更新点赞数
    IF TG_TABLE_NAME = 'annotation_likes' THEN
      UPDATE public.annotations 
      SET likes_count = likes_count - 1 
      WHERE id = OLD.annotation_id;
    END IF;
    
    -- 更新评论数
    IF TG_TABLE_NAME = 'annotation_comments' THEN
      UPDATE public.annotations 
      SET comments_count = comments_count - 1 
      WHERE id = OLD.annotation_id;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_annotation_likes_stats
  AFTER INSERT OR DELETE ON public.annotation_likes
  FOR EACH ROW EXECUTE FUNCTION update_annotation_stats();

CREATE TRIGGER trigger_annotation_comments_stats
  AFTER INSERT OR DELETE ON public.annotation_comments
  FOR EACH ROW EXECUTE FUNCTION update_annotation_stats();

-- 启用行级安全策略 (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_shares ENABLE ROW LEVEL SECURITY;

-- 创建安全策略
-- 用户可以查看所有公开信息，但只能修改自己的数据
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can view papers" ON public.papers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert papers" ON public.papers FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view public annotations" ON public.annotations 
  FOR SELECT USING (is_public = true AND is_deleted = false);
CREATE POLICY "Users can manage own annotations" ON public.annotations 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own likes" ON public.annotation_likes 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view comments" ON public.annotation_comments 
  FOR SELECT USING (is_deleted = false);
CREATE POLICY "Users can manage own comments" ON public.annotation_comments 
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own follows" ON public.user_follows 
  FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Anyone can view follows" ON public.user_follows FOR SELECT USING (true);

CREATE POLICY "Users can manage own shares" ON public.annotation_shares 
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view shares" ON public.annotation_shares FOR SELECT USING (true);

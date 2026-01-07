-- ============================================================
-- Migration: 002 Documents & Annotations
-- Description: PDF documents and annotation system
-- Generated from production database: 2026-01-07
-- ============================================================

-- ============================================================
-- 1. Documents Table (文档表)
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doi TEXT UNIQUE,
    title TEXT NOT NULL,
    authors TEXT[],
    abstract TEXT,
    publication_date DATE,
    journal TEXT,
    document_type TEXT DEFAULT 'pdf' CHECK (document_type = ANY (ARRAY['pdf', 'epub', 'html', 'text'])),
    file_path TEXT,
    file_size BIGINT,
    page_count INTEGER,
    paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Annotations Table (标注表)
-- ============================================================
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type = ANY (ARRAY['highlight', 'underline', 'strikeout', 'note', 'text', 'ink', 'image', 'shape'])),
    content TEXT,
    comment TEXT,
    color TEXT DEFAULT '#ffd400',
    position JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}',
    visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private', 'shared', 'public', 'anonymous'])),
    show_author_name BOOLEAN DEFAULT true,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    parent_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    platform TEXT DEFAULT 'zotero' CHECK (platform = ANY (ARRAY['zotero', 'mendeley', 'adobe-reader', 'researchopia', 'hypothesis', 'web-annotate'])),
    original_id TEXT,
    permissions JSONB DEFAULT '{"canEdit": [], "canView": [], "canComment": []}',
    quality_score NUMERIC DEFAULT 0.0,
    helpfulness_score NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Annotation Likes Table (标注点赞表)
-- ============================================================
CREATE TABLE IF NOT EXISTS annotation_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(annotation_id, user_id)
);

-- ============================================================
-- 4. Annotation Comments Table (标注评论表)
-- ============================================================
CREATE TABLE IF NOT EXISTS annotation_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES annotation_comments(id) ON DELETE CASCADE,
    likes_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Annotation Shares Table (标注分享表)
-- ============================================================
CREATE TABLE IF NOT EXISTS annotation_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_group_id UUID,
    session_id UUID,  -- Will be referenced after reading_sessions is created
    permissions JSONB DEFAULT '{"canEdit": false, "canComment": true}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_doi ON documents(doi);
CREATE INDEX IF NOT EXISTS idx_documents_paper ON documents(paper_id);
CREATE INDEX IF NOT EXISTS idx_annotations_document ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_visibility ON annotations(visibility);
CREATE INDEX IF NOT EXISTS idx_annotation_likes_annotation ON annotation_likes(annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_comments_annotation ON annotation_comments(annotation_id);

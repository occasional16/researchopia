-- ============================================================
-- Migration: 004 Knowledge Web
-- Description: Knowledge units, links, tags, collections, notes
-- Generated from production database: 2026-01-07
-- ============================================================

-- ============================================================
-- 1. Knowledge Units Table (知识单元表)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type = ANY (ARRAY['webpage', 'paper', 'book', 'video'])),
    url TEXT,
    doi TEXT,
    isbn TEXT,
    title TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private', 'public'])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Knowledge Links Table (知识关联表)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
    link_type TEXT DEFAULT 'related' CHECK (link_type = ANY (ARRAY['cite', 'respond', 'review', 'derive', 'related'])),
    evidence_text TEXT,
    evidence_page INTEGER,
    evidence_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    confidence DOUBLE PRECISION DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. Tags Table (标签表)
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private', 'public'])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, user_id)
);

-- ============================================================
-- 4. Unit Tags Table (单元标签关联表)
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_tags (
    unit_id UUID NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (unit_id, tag_id)
);

-- ============================================================
-- 5. KN Collections Table (知识合集表)
-- ============================================================
CREATE TABLE IF NOT EXISTS kn_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private', 'public'])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. Collection Units Table (合集单元关联表)
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_units (
    collection_id UUID NOT NULL REFERENCES kn_collections(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (collection_id, unit_id)
);

-- ============================================================
-- 7. KN Notes Table (知识笔记表)
-- ============================================================
CREATE TABLE IF NOT EXISTS kn_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES knowledge_units(id) ON DELETE CASCADE,
    note_type TEXT DEFAULT 'comment' CHECK (note_type = ANY (ARRAY['highlight', 'comment'])),
    text_excerpt TEXT,
    position JSONB,
    content TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility TEXT DEFAULT 'private' CHECK (visibility = ANY (ARRAY['private', 'public'])),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_knowledge_units_user ON knowledge_units(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_units_type ON knowledge_units(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_source ON knowledge_links(source_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_target ON knowledge_links(target_id);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_kn_collections_user ON kn_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_kn_notes_unit ON kn_notes(unit_id);

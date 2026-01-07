-- ============================================================
-- Migration: 005 Webpage Evaluation
-- Description: Webpage rating and comment system
-- Generated from production database: 2026-01-07
-- ============================================================

-- ============================================================
-- 1. Webpages Table (网页表)
-- ============================================================
CREATE TABLE IF NOT EXISTS webpages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    url_hash TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    favicon_url TEXT,
    og_image_url TEXT,
    metadata JSONB,
    first_submitted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Webpage Ratings Table (网页评分表)
-- ============================================================
CREATE TABLE IF NOT EXISTS webpage_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webpage_id UUID NOT NULL REFERENCES webpages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quality_score INTEGER NOT NULL CHECK (quality_score >= 1 AND quality_score <= 5),
    usefulness_score INTEGER NOT NULL CHECK (usefulness_score >= 1 AND usefulness_score <= 5),
    accuracy_score INTEGER NOT NULL CHECK (accuracy_score >= 1 AND accuracy_score <= 5),
    overall_score INTEGER NOT NULL CHECK (overall_score >= 1 AND overall_score <= 5),
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(webpage_id, user_id)
);

-- ============================================================
-- 3. Webpage Comments Table (网页评论表)
-- ============================================================
CREATE TABLE IF NOT EXISTS webpage_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webpage_id UUID NOT NULL REFERENCES webpages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_id UUID REFERENCES webpage_comments(id) ON DELETE CASCADE,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_webpages_url_hash ON webpages(url_hash);
CREATE INDEX IF NOT EXISTS idx_webpage_ratings_webpage ON webpage_ratings(webpage_id);
CREATE INDEX IF NOT EXISTS idx_webpage_ratings_user ON webpage_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_webpage_comments_webpage ON webpage_comments(webpage_id);
CREATE INDEX IF NOT EXISTS idx_webpage_comments_parent ON webpage_comments(parent_id);

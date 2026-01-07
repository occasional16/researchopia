-- ============================================================
-- Migration: 003 Reading Sessions
-- Description: Co-reading sessions for collaborative annotation
-- Generated from production database: 2026-01-07
-- ============================================================

-- ============================================================
-- 1. Reading Sessions Table (共读会话表)
-- ============================================================
CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_doi TEXT NOT NULL,
    paper_title TEXT,
    session_type TEXT NOT NULL CHECK (session_type = ANY (ARRAY['public', 'private'])),
    invite_code TEXT UNIQUE CHECK (length(invite_code) >= 6),
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    max_participants INTEGER,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. Session Members Table (会话成员表)
-- ============================================================
CREATE TABLE IF NOT EXISTS session_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES reading_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role = ANY (ARRAY['host', 'participant'])),
    current_page INTEGER DEFAULT 1,
    is_online BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, user_id)
);

-- ============================================================
-- 3. Session Annotations Table (会话标注表)
-- ============================================================
CREATE TABLE IF NOT EXISTS session_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES reading_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    paper_doi TEXT NOT NULL,
    annotation_data JSONB NOT NULL,
    page_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. Session Chat Table (会话聊天表)
-- ============================================================
CREATE TABLE IF NOT EXISTS session_chat (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT,
    user_email TEXT,
    message TEXT NOT NULL,
    message_type VARCHAR DEFAULT 'text',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. Session Logs Table (会话日志表)
-- ============================================================
CREATE TABLE IF NOT EXISTS session_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT,
    target_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Add foreign key to annotation_shares
-- ============================================================
ALTER TABLE annotation_shares 
    ADD CONSTRAINT annotation_shares_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_doi ON reading_sessions(paper_doi);
CREATE INDEX IF NOT EXISTS idx_sessions_creator ON reading_sessions(creator_id);
CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON reading_sessions(invite_code);
CREATE INDEX IF NOT EXISTS idx_session_members_session ON session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_user ON session_members(user_id);
CREATE INDEX IF NOT EXISTS idx_session_annotations_session ON session_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_chat_session ON session_chat(session_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_session ON session_logs(session_id);

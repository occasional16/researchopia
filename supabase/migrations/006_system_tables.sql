-- ============================================================
-- Migration: 006 System Tables
-- Description: Announcements, notifications, activities, configs
-- Generated from production database: 2026-01-07
-- ============================================================

-- Create notification type enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'new_follower', 'annotation_liked', 'annotation_commented',
        'comment_replied', 'paper_commented', 'mention', 'system'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 1. Announcements Table (公告表)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR DEFAULT 'info' CHECK (type = ANY (ARRAY['info', 'warning', 'success', 'error'])),
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE announcements IS '系统公告表';

-- ============================================================
-- 2. Notifications Table (通知表)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    target_type TEXT,
    target_id UUID,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifications IS '用户通知表';

-- ============================================================
-- 3. User Activities Table (用户动态表)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type = ANY (ARRAY[
        'paper_added', 'annotation_added', 'comment_added',
        'rating_added', 'paper_favorited', 'user_followed'
    ])),
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
    annotation_id UUID REFERENCES annotations(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    rating_id UUID REFERENCES ratings(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_preview TEXT,
    visibility TEXT DEFAULT 'public' CHECK (visibility = ANY (ARRAY['public', 'followers', 'private'])),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. User Comment Preferences Table (用户评论偏好表)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_comment_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    default_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_comment_preferences IS 'User preferences for comment anonymity';

-- ============================================================
-- 5. Paper Reports Table (论文报道表)
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID,
    title VARCHAR NOT NULL,
    url TEXT NOT NULL,
    source VARCHAR DEFAULT 'other' CHECK (source = ANY (ARRAY['wechat', 'news', 'blog', 'other'])),
    author VARCHAR,
    publish_date DATE,
    description TEXT,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. Paper Reading History Table (论文阅读历史表)
-- ============================================================
CREATE TABLE IF NOT EXISTS paper_reading_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_doi TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    first_read_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    read_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(paper_doi, user_id)
);

COMMENT ON TABLE paper_reading_history IS '论文阅读历史记录表';

-- ============================================================
-- 7. Visit Counters Table (访问计数器表)
-- ============================================================
CREATE TABLE IF NOT EXISTS visit_counters (
    id SERIAL PRIMARY KEY,
    counter_type VARCHAR UNIQUE NOT NULL,
    counter_value BIGINT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. Daily Visit Stats Table (每日访问统计表)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_visit_stats (
    id SERIAL PRIMARY KEY,
    visit_date DATE UNIQUE NOT NULL,
    total_visits BIGINT DEFAULT 0,
    unique_visitors BIGINT DEFAULT 0,
    page_views BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE daily_visit_stats IS '每日访问统计历史';

-- ============================================================
-- 9. Plugin Version Config Table (插件版本配置表)
-- ============================================================
CREATE TABLE IF NOT EXISTS plugin_version_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_name TEXT UNIQUE NOT NULL,
    min_version TEXT NOT NULL,
    latest_version TEXT NOT NULL,
    download_url TEXT,
    force_update BOOLEAN DEFAULT false,
    update_message TEXT,
    disabled_features TEXT[],
    enabled BOOLEAN DEFAULT true,
    beta_version TEXT,
    beta_testers TEXT[],
    beta_message TEXT,
    beta_confirm_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE plugin_version_config IS '插件版本控制配置表';

-- ============================================================
-- 10. Collaboration Sessions Table (协作会话表)
-- ============================================================
CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    cursor_position JSONB,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_activities_user ON user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON user_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_reading_history_user ON paper_reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_doi ON paper_reading_history(paper_doi);

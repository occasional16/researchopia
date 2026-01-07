-- ============================================================
-- Migration: 007 RLS Policies
-- Description: Row Level Security policies for all tables
-- Generated from production database: 2026-01-07
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE kn_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE kn_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE webpages ENABLE ROW LEVEL SECURITY;
ALTER TABLE webpage_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE webpage_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_comment_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_visit_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_version_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Users Policies
-- ============================================================
CREATE POLICY "users_select_public" ON users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- Papers Policies
-- ============================================================
CREATE POLICY "papers_select_public" ON papers FOR SELECT USING (true);
CREATE POLICY "papers_insert_authenticated" ON papers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "papers_update_authenticated" ON papers FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- Ratings Policies
-- ============================================================
CREATE POLICY "ratings_select_public" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert_own" ON ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_update_own" ON ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ratings_delete_own" ON ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Comments Policies
-- ============================================================
CREATE POLICY "comments_select_public" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Comment Votes Policies
-- ============================================================
CREATE POLICY "votes_select_public" ON comment_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert_own" ON comment_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete_own" ON comment_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Paper Favorites Policies
-- ============================================================
CREATE POLICY "favorites_select_own" ON paper_favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert_own" ON paper_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete_own" ON paper_favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- User Follows Policies
-- ============================================================
CREATE POLICY "follows_select_public" ON user_follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON user_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON user_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============================================================
-- Documents Policies
-- ============================================================
CREATE POLICY "documents_select_public" ON documents FOR SELECT USING (true);
CREATE POLICY "documents_insert_authenticated" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "documents_update_own" ON documents FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- ============================================================
-- Annotations Policies
-- ============================================================
CREATE POLICY "annotations_select_visible" ON annotations FOR SELECT USING (
    visibility = 'public' OR visibility = 'anonymous' OR auth.uid() = user_id
);
CREATE POLICY "annotations_insert_own" ON annotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotations_update_own" ON annotations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "annotations_delete_own" ON annotations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Annotation Likes Policies
-- ============================================================
CREATE POLICY "annotation_likes_select" ON annotation_likes FOR SELECT USING (true);
CREATE POLICY "annotation_likes_insert_own" ON annotation_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotation_likes_delete_own" ON annotation_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Annotation Comments Policies
-- ============================================================
CREATE POLICY "annotation_comments_select" ON annotation_comments FOR SELECT USING (true);
CREATE POLICY "annotation_comments_insert_own" ON annotation_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "annotation_comments_update_own" ON annotation_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "annotation_comments_delete_own" ON annotation_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Annotation Shares Policies
-- ============================================================
CREATE POLICY "shares_select_involved" ON annotation_shares FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR auth.uid() = shared_with_user_id
);
CREATE POLICY "shares_insert_own" ON annotation_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shares_delete_own" ON annotation_shares FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Reading Sessions Policies
-- ============================================================
CREATE POLICY "sessions_select" ON reading_sessions FOR SELECT USING (
    session_type = 'public' OR creator_id = auth.uid()
);
CREATE POLICY "sessions_insert_authenticated" ON reading_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sessions_update_creator" ON reading_sessions FOR UPDATE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "sessions_delete_creator" ON reading_sessions FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- ============================================================
-- Session Members Policies
-- ============================================================
CREATE POLICY "members_select" ON session_members FOR SELECT USING (true);
CREATE POLICY "members_insert" ON session_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members_update" ON session_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "members_delete_own" ON session_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Session Annotations Policies
-- ============================================================
CREATE POLICY "session_annotations_select" ON session_annotations FOR SELECT USING (true);
CREATE POLICY "session_annotations_insert_own" ON session_annotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "session_annotations_delete_own" ON session_annotations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Session Chat Policies
-- ============================================================
CREATE POLICY "chat_select" ON session_chat FOR SELECT USING (true);
CREATE POLICY "chat_insert" ON session_chat FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Session Logs Policies
-- ============================================================
CREATE POLICY "logs_select" ON session_logs FOR SELECT USING (true);
CREATE POLICY "logs_insert" ON session_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- Knowledge Units Policies
-- ============================================================
CREATE POLICY "units_select" ON knowledge_units FOR SELECT USING (
    visibility = 'public' OR auth.uid() = user_id
);
CREATE POLICY "units_insert_own" ON knowledge_units FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "units_update_own" ON knowledge_units FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "units_delete_own" ON knowledge_units FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Knowledge Links Policies
-- ============================================================
CREATE POLICY "links_select" ON knowledge_links FOR SELECT USING (true);
CREATE POLICY "links_insert_own" ON knowledge_links FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "links_delete_own" ON knowledge_links FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- ============================================================
-- Tags Policies
-- ============================================================
CREATE POLICY "tags_select" ON tags FOR SELECT USING (
    visibility = 'public' OR auth.uid() = user_id
);
CREATE POLICY "tags_insert_own" ON tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON tags FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON tags FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Unit Tags Policies
-- ============================================================
CREATE POLICY "unit_tags_select" ON unit_tags FOR SELECT USING (true);
CREATE POLICY "unit_tags_insert" ON unit_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "unit_tags_delete" ON unit_tags FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Collections Policies
-- ============================================================
CREATE POLICY "collections_select" ON kn_collections FOR SELECT USING (
    visibility = 'public' OR auth.uid() = user_id
);
CREATE POLICY "collections_insert_own" ON kn_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_update_own" ON kn_collections FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "collections_delete_own" ON kn_collections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Collection Units Policies
-- ============================================================
CREATE POLICY "collection_units_select" ON collection_units FOR SELECT USING (true);
CREATE POLICY "collection_units_insert" ON collection_units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "collection_units_delete" ON collection_units FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Notes Policies
-- ============================================================
CREATE POLICY "notes_select" ON kn_notes FOR SELECT USING (
    visibility = 'public' OR auth.uid() = user_id
);
CREATE POLICY "notes_insert_own" ON kn_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON kn_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON kn_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Webpages Policies
-- ============================================================
CREATE POLICY "webpages_select_public" ON webpages FOR SELECT USING (true);
CREATE POLICY "webpages_insert_authenticated" ON webpages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "webpages_update_authenticated" ON webpages FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- Webpage Ratings Policies
-- ============================================================
CREATE POLICY "webpage_ratings_select" ON webpage_ratings FOR SELECT USING (true);
CREATE POLICY "webpage_ratings_insert_own" ON webpage_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "webpage_ratings_update_own" ON webpage_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "webpage_ratings_delete_own" ON webpage_ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- Webpage Comments Policies
-- ============================================================
CREATE POLICY "webpage_comments_select" ON webpage_comments FOR SELECT USING (true);
CREATE POLICY "webpage_comments_insert_own" ON webpage_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "webpage_comments_update_own" ON webpage_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "webpage_comments_delete_own" ON webpage_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- System Tables Policies (mostly public read, admin write)
-- ============================================================
CREATE POLICY "announcements_select_active" ON announcements FOR SELECT USING (is_active = true);
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "activities_select_visible" ON user_activities FOR SELECT USING (
    visibility = 'public' OR auth.uid() = user_id
);
CREATE POLICY "preferences_select_own" ON user_comment_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "preferences_upsert_own" ON user_comment_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferences_update_own" ON user_comment_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reports_select_public" ON paper_reports FOR SELECT USING (true);
CREATE POLICY "reading_history_select_own" ON paper_reading_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "reading_history_upsert_own" ON paper_reading_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reading_history_update_own" ON paper_reading_history FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "visit_counters_select" ON visit_counters FOR SELECT USING (true);
CREATE POLICY "daily_stats_select" ON daily_visit_stats FOR SELECT USING (true);
CREATE POLICY "plugin_config_select" ON plugin_version_config FOR SELECT USING (true);
CREATE POLICY "collab_sessions_select" ON collaboration_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

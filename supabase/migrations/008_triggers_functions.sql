-- ============================================================
-- Migration: 008 Triggers & Functions
-- Description: Auto-update triggers and helper functions
-- Generated from production database: 2026-01-07
-- ============================================================

-- ============================================================
-- Updated_at Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Apply updated_at triggers
-- ============================================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON papers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON annotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotation_comments_updated_at BEFORE UPDATE ON annotation_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_annotations_updated_at BEFORE UPDATE ON session_annotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_chat_updated_at BEFORE UPDATE ON session_chat
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_units_updated_at BEFORE UPDATE ON knowledge_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kn_collections_updated_at BEFORE UPDATE ON kn_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kn_notes_updated_at BEFORE UPDATE ON kn_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webpages_updated_at BEFORE UPDATE ON webpages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webpage_ratings_updated_at BEFORE UPDATE ON webpage_ratings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webpage_comments_updated_at BEFORE UPDATE ON webpage_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preferences_updated_at BEFORE UPDATE ON user_comment_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reading_history_updated_at BEFORE UPDATE ON paper_reading_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_config_updated_at BEFORE UPDATE ON plugin_version_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Likes Count Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_annotation_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE annotations SET likes_count = likes_count + 1 WHERE id = NEW.annotation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE annotations SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.annotation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_annotation_likes_count
    AFTER INSERT OR DELETE ON annotation_likes
    FOR EACH ROW EXECUTE FUNCTION update_annotation_likes_count();

-- ============================================================
-- Comments Count Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_annotation_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE annotations SET comments_count = comments_count + 1 WHERE id = NEW.annotation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE annotations SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.annotation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_annotation_comments_count
    AFTER INSERT OR DELETE ON annotation_comments
    FOR EACH ROW EXECUTE FUNCTION update_annotation_comments_count();

-- ============================================================
-- Paper Comments Count Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_paper_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE papers SET comments_count = comments_count + 1 WHERE id = NEW.paper_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE papers SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.paper_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_paper_comments_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_paper_comments_count();

-- ============================================================
-- Paper Ratings Stats Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_paper_ratings_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_paper_id UUID;
    new_count INTEGER;
    new_avg NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_paper_id := OLD.paper_id;
    ELSE
        target_paper_id := NEW.paper_id;
    END IF;
    
    SELECT COUNT(*), COALESCE(ROUND(AVG(overall_score)::numeric, 1), 0)
    INTO new_count, new_avg
    FROM ratings
    WHERE paper_id = target_paper_id;
    
    UPDATE papers
    SET ratings_count = new_count, average_rating = new_avg
    WHERE id = target_paper_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_paper_ratings_stats
    AFTER INSERT OR UPDATE OR DELETE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_paper_ratings_stats();

-- ============================================================
-- User Follow Count Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
        UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_counts
    AFTER INSERT OR DELETE ON user_follows
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ============================================================
-- Comment Reply Count Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_id;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_reply_count
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

-- ============================================================
-- Annotation Comment Reply Count Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_annotation_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE annotation_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE annotation_comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.parent_id;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_annotation_comment_reply_count
    AFTER INSERT OR DELETE ON annotation_comments
    FOR EACH ROW EXECUTE FUNCTION update_annotation_comment_reply_count();

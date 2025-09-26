-- Researchopia Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor to create the required tables

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create shared_annotations table
CREATE TABLE IF NOT EXISTS shared_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  annotation_text TEXT,
  annotation_comment TEXT,
  page_number INTEGER,
  position JSONB,
  annotation_type TEXT DEFAULT 'highlight',
  annotation_color TEXT DEFAULT '#ffff00',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create annotation_likes table
CREATE TABLE IF NOT EXISTS annotation_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(annotation_id, user_id)
);

-- Create annotation_comments table
CREATE TABLE IF NOT EXISTS annotation_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID REFERENCES shared_annotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_annotations_doi ON shared_annotations(doi);
CREATE INDEX IF NOT EXISTS idx_shared_annotations_user_id ON shared_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_annotations_created_at ON shared_annotations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_annotation_likes_annotation_id ON annotation_likes(annotation_id);
CREATE INDEX IF NOT EXISTS idx_annotation_likes_user_id ON annotation_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_annotation_comments_annotation_id ON annotation_comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);

-- Enable Row Level Security (RLS)
ALTER TABLE shared_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_annotations
CREATE POLICY "Anyone can view shared annotations" ON shared_annotations
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own annotations" ON shared_annotations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations" ON shared_annotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations" ON shared_annotations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for annotation_likes
CREATE POLICY "Anyone can view likes" ON annotation_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like annotations" ON annotation_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes" ON annotation_likes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for annotation_comments
CREATE POLICY "Anyone can view comments" ON annotation_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can add comments" ON annotation_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON annotation_comments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for user_follows
CREATE POLICY "Users can view follows" ON user_follows
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can follow others" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" ON user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_shared_annotations_updated_at 
  BEFORE UPDATE ON shared_annotations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a view for annotation statistics
CREATE OR REPLACE VIEW annotation_stats AS
SELECT 
  sa.id,
  sa.doi,
  sa.user_id,
  sa.user_name,
  sa.annotation_text,
  sa.annotation_comment,
  sa.page_number,
  sa.position,
  sa.annotation_type,
  sa.annotation_color,
  sa.created_at,
  sa.updated_at,
  COALESCE(like_counts.likes_count, 0) as likes_count,
  COALESCE(comment_counts.comments_count, 0) as comments_count
FROM shared_annotations sa
LEFT JOIN (
  SELECT annotation_id, COUNT(*) as likes_count
  FROM annotation_likes
  GROUP BY annotation_id
) like_counts ON sa.id = like_counts.annotation_id
LEFT JOIN (
  SELECT annotation_id, COUNT(*) as comments_count
  FROM annotation_comments
  GROUP BY annotation_id
) comment_counts ON sa.id = comment_counts.annotation_id;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create a function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'annotations_count', (
      SELECT COUNT(*) FROM shared_annotations WHERE user_id = user_uuid
    ),
    'likes_received', (
      SELECT COUNT(*) FROM annotation_likes al
      JOIN shared_annotations sa ON al.annotation_id = sa.id
      WHERE sa.user_id = user_uuid
    ),
    'comments_received', (
      SELECT COUNT(*) FROM annotation_comments ac
      JOIN shared_annotations sa ON ac.annotation_id = sa.id
      WHERE sa.user_id = user_uuid AND ac.user_id != user_uuid
    ),
    'followers_count', (
      SELECT COUNT(*) FROM user_follows WHERE following_id = user_uuid
    ),
    'following_count', (
      SELECT COUNT(*) FROM user_follows WHERE follower_id = user_uuid
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get trending annotations
CREATE OR REPLACE FUNCTION get_trending_annotations(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  id UUID,
  doi TEXT,
  user_name TEXT,
  annotation_text TEXT,
  annotation_comment TEXT,
  likes_count BIGINT,
  comments_count BIGINT,
  trend_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.doi,
    sa.user_name,
    sa.annotation_text,
    sa.annotation_comment,
    COALESCE(like_counts.likes_count, 0) as likes_count,
    COALESCE(comment_counts.comments_count, 0) as comments_count,
    (
      COALESCE(like_counts.likes_count, 0) * 2 + 
      COALESCE(comment_counts.comments_count, 0) * 3 +
      CASE 
        WHEN sa.created_at > NOW() - INTERVAL '1 day' THEN 10
        WHEN sa.created_at > NOW() - INTERVAL '3 days' THEN 5
        ELSE 0
      END
    )::NUMERIC as trend_score
  FROM shared_annotations sa
  LEFT JOIN (
    SELECT annotation_id, COUNT(*) as likes_count
    FROM annotation_likes
    WHERE created_at > NOW() - INTERVAL '%s days'
    GROUP BY annotation_id
  ) like_counts ON sa.id = like_counts.annotation_id
  LEFT JOIN (
    SELECT annotation_id, COUNT(*) as comments_count
    FROM annotation_comments
    WHERE created_at > NOW() - INTERVAL '%s days'
    GROUP BY annotation_id
  ) comment_counts ON sa.id = comment_counts.annotation_id
  WHERE sa.created_at > NOW() - INTERVAL '%s days'
  ORDER BY trend_score DESC, sa.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

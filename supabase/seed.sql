-- ============================================================
-- Seed Data for Development
-- Description: Test data for local development
-- Generated from production database: 2026-01-07
--
-- Usage: supabase db reset (automatically applies seed.sql)
-- ============================================================

-- ============================================================
-- Initial Visit Counters
-- ============================================================
INSERT INTO visit_counters (counter_type, counter_value) VALUES
('total_visits', 0),
('unique_visitors', 0)
ON CONFLICT (counter_type) DO NOTHING;

-- ============================================================
-- Sample Plugin Version Config
-- ============================================================
INSERT INTO plugin_version_config (plugin_name, min_version, latest_version, download_url, enabled) VALUES
('researchopia-zotero', '0.1.0', '0.6.0', 'https://github.com/occasional16/researchopia/releases', true)
ON CONFLICT (plugin_name) DO NOTHING;

-- ============================================================
-- Sample Papers (no user dependency)
-- ============================================================
-- Note: Papers need created_by to be set after users are created
-- For development, you can insert papers without created_by first

-- ============================================================
-- Note: User-related data cannot be seeded directly
-- because they depend on auth.users which is managed by Supabase Auth.
-- 
-- For testing with authenticated users:
-- 1. Create users via Supabase Dashboard or Auth API
-- 2. The trigger will auto-create users table entry
-- 3. Then insert related data (annotations, ratings, etc.)
-- ============================================================

-- ============================================================
-- Sample data insertion template (run after creating test users)
-- ============================================================
/*
-- Get your test user ID from auth.users table first
-- Then run these with the actual user ID:

-- Create a paper
INSERT INTO papers (title, authors, doi, abstract, journal)
VALUES (
    'Advances in Deep Learning for NLP',
    ARRAY['Zhang Wei', 'Li Ming'],
    '10.1234/test.001',
    'This paper presents recent advances...',
    'Journal of AI Research'
);

-- Rate the paper
INSERT INTO ratings (user_id, paper_id, innovation_score, methodology_score, practicality_score, overall_score)
SELECT 
    'YOUR-USER-UUID',
    id,
    4, 5, 4, 4
FROM papers WHERE doi = '10.1234/test.001';

-- Comment on the paper
INSERT INTO comments (user_id, paper_id, content)
SELECT 
    'YOUR-USER-UUID',
    id,
    'Great paper with solid methodology!'
FROM papers WHERE doi = '10.1234/test.001';
*/

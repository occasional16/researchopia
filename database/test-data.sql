-- Test data for academic rating system
-- Run this after setting up the main schema and admin account

-- Create test admin user (replace with your actual admin email)
-- First register normally through the website, then run this to promote to admin:
-- UPDATE public.users SET role = 'admin' WHERE email = 'admin@test.edu.cn';

-- Insert sample papers (these will be created automatically when searching DOI)
-- But we can add some manual entries for testing

-- Sample paper 1: A famous Nature paper
INSERT INTO public.papers (
  id,
  title,
  authors,
  doi,
  abstract,
  keywords,
  journal,
  publication_date,
  created_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Mastering the game of Go with deep neural networks and tree search',
  ARRAY['David Silver', 'Aja Huang', 'Chris J. Maddison', 'Arthur Guez', 'Laurent Sifre'],
  '10.1038/nature16961',
  'The game of Go has long been viewed as the most challenging of classic games for artificial intelligence owing to its enormous search space and the difficulty of evaluating board positions and moves. Here we introduce a new approach to computer Go that uses ''value networks'' to evaluate board positions and ''policy networks'' to select moves.',
  ARRAY['artificial intelligence', 'machine learning', 'game theory', 'neural networks'],
  'Nature',
  '2016-01-28',
  (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
) ON CONFLICT (doi) DO NOTHING;

-- Sample paper 2: A Science paper
INSERT INTO public.papers (
  id,
  title,
  authors,
  doi,
  abstract,
  keywords,
  journal,
  publication_date,
  created_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Attention is all you need',
  ARRAY['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones'],
  '10.5555/3295222.3295349',
  'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.',
  ARRAY['transformer', 'attention mechanism', 'neural networks', 'natural language processing'],
  'Advances in Neural Information Processing Systems',
  '2017-12-04',
  (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
) ON CONFLICT (doi) DO NOTHING;

-- Sample paper 3: A machine learning paper
INSERT INTO public.papers (
  id,
  title,
  authors,
  doi,
  abstract,
  keywords,
  journal,
  publication_date,
  created_by
) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
  ARRAY['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
  '10.18653/v1/N19-1423',
  'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
  ARRAY['BERT', 'transformers', 'language model', 'pre-training', 'NLP'],
  'Proceedings of NAACL-HLT',
  '2019-06-02',
  (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
) ON CONFLICT (doi) DO NOTHING;

-- Add some sample ratings (will be added after users register)
-- These will be inserted by the test script after user registration

-- Add some sample comments (will be added after users register)
-- These will be inserted by the test script after user registration

-- Create a function to add test ratings and comments
CREATE OR REPLACE FUNCTION add_test_ratings_and_comments()
RETURNS void AS $$
DECLARE
  admin_user_id UUID;
  paper1_id UUID := '550e8400-e29b-41d4-a716-446655440001';
  paper2_id UUID := '550e8400-e29b-41d4-a716-446655440002';
  paper3_id UUID := '550e8400-e29b-41d4-a716-446655440003';
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id FROM public.users WHERE role = 'admin' LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Add sample ratings
    INSERT INTO public.ratings (user_id, paper_id, innovation_score, methodology_score, practicality_score, overall_score)
    VALUES 
      (admin_user_id, paper1_id, 5, 5, 4, 5),
      (admin_user_id, paper2_id, 5, 4, 5, 5),
      (admin_user_id, paper3_id, 4, 4, 5, 4)
    ON CONFLICT (user_id, paper_id) DO NOTHING;
    
    -- Add sample comments
    INSERT INTO public.comments (user_id, paper_id, content)
    VALUES 
      (admin_user_id, paper1_id, '这篇论文开创了深度学习在围棋领域的应用，AlphaGo的成功证明了深度强化学习的巨大潜力。方法论非常严谨，实验设计完善。'),
      (admin_user_id, paper2_id, 'Transformer架构彻底改变了自然语言处理领域，注意力机制的设计非常巧妙。这篇论文的影响力巨大，后续的BERT、GPT等模型都基于这个架构。'),
      (admin_user_id, paper3_id, 'BERT模型在多个NLP任务上都取得了突破性的成果，双向编码的设计很有创新性。预训练+微调的范式也成为了后续研究的标准做法。')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Instructions for setup:
-- 1. First register an admin account through the website using email: admin@test.edu.cn
-- 2. Run the admin-setup.sql script to promote the user to admin
-- 3. Run this script to add test data
-- 4. Call the function to add ratings and comments: SELECT add_test_ratings_and_comments();

-- Sample DOIs for testing the DOI search functionality:
-- 10.1038/nature16961 (AlphaGo paper)
-- 10.5555/3295222.3295349 (Attention is All You Need)
-- 10.18653/v1/N19-1423 (BERT paper)
-- 10.1038/nature17946 (Another Nature paper)
-- 10.1126/science.aaf2654 (Science paper)

-- Test educational email domains:
-- admin@test.edu.cn (Chinese university)
-- user@stanford.edu (US university)
-- researcher@ox.ac.uk (UK university)
-- student@u-tokyo.ac.jp (Japanese university)

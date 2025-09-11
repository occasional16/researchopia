-- Initial data for Academic Rating Platform
-- Execute this after the schema setup

-- Insert sample papers
INSERT INTO public.papers (id, title, authors, doi, abstract, keywords, publication_date, journal, created_by) VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'Deep Learning for Natural Language Processing: A Comprehensive Survey',
  ARRAY['Zhang Wei', 'Li Ming', 'Wang Xiaoli'],
  '10.1038/nature17946',
  'This paper provides a comprehensive survey of deep learning techniques applied to natural language processing tasks. We review the latest developments in transformer architectures, attention mechanisms, and pre-trained language models.',
  ARRAY['deep learning', 'natural language processing', 'transformer', 'attention mechanism'],
  '2023-06-15',
  'Nature Machine Intelligence',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'Quantum Computing Applications in Cryptography',
  ARRAY['Chen Hao', 'Liu Yan'],
  '10.1126/science.abc123',
  'We explore the potential applications of quantum computing in modern cryptography, discussing both opportunities and threats posed by quantum algorithms.',
  ARRAY['quantum computing', 'cryptography', 'quantum algorithms', 'security'],
  '2023-08-20',
  'Science',
  (SELECT id FROM auth.users LIMIT 1)
),
(
  '550e8400-e29b-41d4-a716-446655440003',
  'Machine Learning in Healthcare: Current Trends and Future Directions',
  ARRAY['Dr. Sarah Johnson', 'Prof. Michael Brown'],
  '10.1016/j.cell.2023.01.001',
  'This review examines the current applications of machine learning in healthcare, from diagnostic imaging to drug discovery, and discusses future research directions.',
  ARRAY['machine learning', 'healthcare', 'medical imaging', 'drug discovery'],
  '2023-09-10',
  'Cell',
  (SELECT id FROM auth.users LIMIT 1)
);

-- Note: The following inserts will only work after users are registered
-- You can run these manually after creating test users

-- Sample ratings (run after user registration)
-- INSERT INTO public.ratings (user_id, paper_id, innovation_score, methodology_score, practicality_score, overall_score) VALUES
-- (user_id_here, '550e8400-e29b-41d4-a716-446655440001', 5, 4, 4, 5),
-- (user_id_here, '550e8400-e29b-41d4-a716-446655440002', 4, 5, 3, 4);

-- Sample comments (run after user registration)
-- INSERT INTO public.comments (user_id, paper_id, content) VALUES
-- (user_id_here, '550e8400-e29b-41d4-a716-446655440001', '这篇论文对深度学习在NLP领域的应用做了很好的总结，特别是对Transformer架构的分析很深入。'),
-- (user_id_here, '550e8400-e29b-41d4-a716-446655440002', '量子计算在密码学中的应用确实是一个重要的研究方向，文章的分析很全面。');

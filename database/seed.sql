-- Sample papers data
INSERT INTO public.papers (title, authors, doi, abstract, keywords, publication_date, journal) VALUES
(
  'Deep Learning for Natural Language Processing: A Comprehensive Survey',
  ARRAY['John Smith', 'Jane Doe', 'Bob Johnson'],
  '10.1000/example.2023.001',
  'This paper provides a comprehensive survey of deep learning techniques applied to natural language processing tasks. We review the latest developments in transformer architectures, attention mechanisms, and their applications across various NLP domains.',
  ARRAY['deep learning', 'natural language processing', 'transformers', 'attention mechanism'],
  '2023-06-15',
  'Journal of Machine Learning Research'
),
(
  'Quantum Computing Applications in Cryptography',
  ARRAY['Alice Chen', 'David Wilson'],
  '10.1000/example.2023.002',
  'We explore the potential applications of quantum computing in modern cryptography, discussing both opportunities and threats posed by quantum algorithms to current encryption methods.',
  ARRAY['quantum computing', 'cryptography', 'quantum algorithms', 'encryption'],
  '2023-08-20',
  'Nature Quantum Information'
),
(
  'Sustainable Energy Systems: A Machine Learning Approach',
  ARRAY['Maria Garcia', 'Tom Brown', 'Lisa Wang'],
  '10.1000/example.2023.003',
  'This study presents novel machine learning approaches for optimizing sustainable energy systems, focusing on renewable energy prediction and grid management.',
  ARRAY['sustainable energy', 'machine learning', 'renewable energy', 'grid optimization'],
  '2023-09-10',
  'Energy and AI'
),
(
  'Advances in Computer Vision for Medical Imaging',
  ARRAY['Dr. Sarah Johnson', 'Prof. Michael Lee'],
  '10.1000/example.2023.004',
  'Recent advances in computer vision techniques have shown remarkable potential in medical imaging applications. This paper reviews state-of-the-art methods and their clinical applications.',
  ARRAY['computer vision', 'medical imaging', 'deep learning', 'healthcare'],
  '2023-07-30',
  'Medical Image Analysis'
),
(
  'Blockchain Technology in Supply Chain Management',
  ARRAY['Robert Kim', 'Jennifer Liu', 'Mark Davis'],
  '10.1000/example.2023.005',
  'We investigate the implementation of blockchain technology in supply chain management systems, analyzing benefits, challenges, and real-world case studies.',
  ARRAY['blockchain', 'supply chain', 'distributed systems', 'transparency'],
  '2023-05-25',
  'Supply Chain Management Review'
);

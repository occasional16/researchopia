import type { Paper } from './supabase'

// Sample papers for demonstration
export const samplePapers: Paper[] = [
  {
    id: '1',
    title: 'Deep Learning for Climate Change Prediction: A Comprehensive Review',
    authors: ['Zhang Wei', 'Liu Xiaoming', 'Chen Yifan'],
    abstract: 'This comprehensive review explores the application of deep learning techniques in climate change prediction. We analyze various neural network architectures including convolutional neural networks, recurrent neural networks, and transformer models for processing climate data. Our findings demonstrate that deep learning approaches can significantly improve the accuracy of long-term climate predictions compared to traditional statistical methods.',
    doi: '10.1038/s41586-023-12345-6',
    publication_date: '2023-11-15',
    journal: 'Nature Climate Change',
    keywords: ['deep learning', 'climate change', 'neural networks', 'prediction', 'machine learning'],
    view_count: 1543,
    created_at: '2023-11-16T10:30:00Z',
    updated_at: '2023-12-01T14:20:00Z',
    created_by: 'demo-user-1'
  },
  {
    id: '2',
    title: 'Quantum Computing Applications in Drug Discovery',
    authors: ['Sarah Johnson', 'Michael Chen', 'David Rodriguez'],
    abstract: 'We present novel applications of quantum computing algorithms for accelerating drug discovery processes. By leveraging quantum machine learning techniques, we demonstrate significant speedups in molecular simulation and protein folding prediction tasks. Our quantum-enhanced approach shows promising results in identifying potential drug candidates for neurodegenerative diseases.',
    doi: '10.1126/science.2023.11223',
    publication_date: '2023-10-28',
    journal: 'Science',
    keywords: ['quantum computing', 'drug discovery', 'molecular simulation', 'protein folding', 'pharmaceutical research'],
    view_count: 892,
    created_at: '2023-10-29T08:15:00Z',
    updated_at: '2023-11-15T16:45:00Z',
    created_by: 'demo-user-2'
  },
  {
    id: '3',
    title: 'Sustainable Energy Storage: Advanced Battery Technologies for Grid-Scale Applications',
    authors: ['Emily Rodriguez', 'Takeshi Yamamoto', 'Anna Kowalski'],
    abstract: 'This study investigates next-generation battery technologies for large-scale energy storage applications. We focus on lithium-sulfur and solid-state battery systems, analyzing their performance characteristics, safety profiles, and economic viability. Our research demonstrates that these advanced battery technologies can provide cost-effective solutions for grid-scale renewable energy storage.',
    doi: '10.1016/j.ensm.2023.108456',
    publication_date: '2023-09-20',
    journal: 'Energy Storage Materials',
    keywords: ['battery technology', 'energy storage', 'renewable energy', 'grid scale', 'sustainability'],
    view_count: 2156,
    created_at: '2023-09-21T12:00:00Z',
    updated_at: '2023-10-05T09:30:00Z',
    created_by: 'demo-user-3'
  }
]

// Function to initialize sample data in localStorage
export function initializeSampleData() {
  if (typeof window === 'undefined') return

  const MOCK_PAPERS_KEY = 'academic_rating_mock_papers'
  const existingPapers = localStorage.getItem(MOCK_PAPERS_KEY)
  
  if (!existingPapers) {
    localStorage.setItem(MOCK_PAPERS_KEY, JSON.stringify(samplePapers))
    console.log('✅ 示例论文数据已初始化')
  }
}

// Function to clear all mock data
export function clearMockData() {
  if (typeof window === 'undefined') return

  const keys = [
    'academic_rating_mock_papers',
    'academic_rating_mock_ratings',
    'academic_rating_mock_comments',
    'academic_rating_mock_favorites',
    'academic_rating_mock_users',
    'academic_rating_current_user'
  ]

  keys.forEach(key => localStorage.removeItem(key))
  console.log('🗑️ 所有模拟数据已清除')
}

// Function to reset to sample data
export function resetToSampleData() {
  clearMockData()
  initializeSampleData()
  console.log('🔄 已重置为示例数据')
}

import type { Paper } from './supabase'

// Sample papers for demonstration
export const samplePapers: Paper[] = []

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

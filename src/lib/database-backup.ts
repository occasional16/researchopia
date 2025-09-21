import { supabase } from './supabase'
import { MockAuthService } from './mockAuth'
import type { Paper, Rating, Comment, User } from './supabase'
import { fetchPaperByDOI, isValidDOI, type PaperMetadata } from './crossref'

// Mock storage keys
const MOCK_PAPERS_KEY = 'academic_rating_mock_papers'
const MOCK_RATINGS_KEY = 'academic_rating_mock_ratings'
const MOCK_COMMENTS_KEY = 'academic_rating_mock_comments'
const MOCK_USERS_KEY = 'academic_rating_mock_users'

// Mock data service
class MockDatabaseService {
  private getStoredPapers(): Paper[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_PAPERS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private saveStoredPapers(papers: Paper[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_PAPERS_KEY, JSON.stringify(papers))
  }

  private getRatings(): Rating[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_RATINGS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private saveRatings(ratings: Rating[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_RATINGS_KEY, JSON.stringify(ratings))
  }

  private getComments(): Comment[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_COMMENTS_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private saveComments(comments: Comment[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_COMMENTS_KEY, JSON.stringify(comments))
  }

  async getPapers(limit = 20, offset = 0): Promise<Paper[]> {
    const papers = this.getStoredPapers()
    const ratings = this.getRatings()
    const comments = this.getComments()

    // Add ratings and comments to papers
    const papersWithData = papers.map(paper => ({
      ...paper,
      ratings: ratings.filter(r => r.paper_id === paper.id),
      comments: comments.filter(c => c.paper_id === paper.id)
    }))

    return papersWithData
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(offset, offset + limit)
  }

  async getPaper(id: string): Promise<Paper | null> {
    const papers = this.getStoredPapers()
    const ratings = this.getRatings()
    const comments = this.getComments()

    const paper = papers.find(p => p.id === id)
    if (!paper) return null

    return {
      ...paper,
      ratings: ratings.filter(r => r.paper_id === id),
      comments: comments.filter(c => c.paper_id === id)
    } as any
  }

  async createPaper(paperData: Omit<Paper, 'id' | 'created_at' | 'updated_at'>): Promise<Paper> {
    const papers = this.getStoredPapers()

    const newPaper: Paper = {
      ...paperData,
      id: 'mock-paper-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    papers.push(newPaper)
    this.saveStoredPapers(papers)

    return newPaper
  }

  async searchPaperByDOI(doi: string): Promise<Paper[]> {
    const papers = this.getStoredPapers()
    return papers.filter(p => p.doi === doi)
  }

  async createOrUpdateRating(ratingData: Omit<Rating, 'id' | 'created_at' | 'updated_at'>): Promise<Rating> {
    const ratings = this.getRatings()

    // Check if rating already exists
    const existingIndex = ratings.findIndex(r =>
      r.user_id === ratingData.user_id && r.paper_id === ratingData.paper_id
    )

    const rating: Rating = {
      ...ratingData,
      id: existingIndex >= 0 ? ratings[existingIndex].id : 'mock-rating-' + Math.random().toString(36).substr(2, 9),
      created_at: existingIndex >= 0 ? ratings[existingIndex].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (existingIndex >= 0) {
      ratings[existingIndex] = rating
    } else {
      ratings.push(rating)
    }

    this.saveRatings(ratings)
    return rating
  }

  async getUserRating(userId: string, paperId: string): Promise<Rating | null> {
    const ratings = this.getRatings()
    return ratings.find(r => r.user_id === userId && r.paper_id === paperId) || null
  }

  async createComment(commentData: Omit<Comment, 'id' | 'created_at' | 'updated_at'>): Promise<any> {
    const comments = this.getComments()
    const users = this.getUsers()

    const newComment: Comment = {
      ...commentData,
      id: 'mock-comment-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    comments.push(newComment)
    this.saveComments(comments)

    // Return comment with user info like Supabase does
    const user = users.find(u => u.id === commentData.user_id)
    return {
      ...newComment,
      users: user ? { username: user.username, avatar_url: user.avatar_url } : { username: 'Unknown User' }
    }
  }

  async updatePaper(id: string, paperData: Partial<Paper>): Promise<Paper> {
    const papers = this.getStoredPapers()
    const index = papers.findIndex(p => p.id === id)

    if (index === -1) {
      throw new Error('Paper not found')
    }

    const updatedPaper = {
      ...papers[index],
      ...paperData,
      updated_at: new Date().toISOString()
    }

    papers[index] = updatedPaper
    this.saveStoredPapers(papers)
    return updatedPaper
  }

  async deletePaper(id: string): Promise<boolean> {
    const papers = this.getStoredPapers()
    const filteredPapers = papers.filter(p => p.id !== id)

    if (filteredPapers.length === papers.length) {
      throw new Error('Paper not found')
    }

    this.saveStoredPapers(filteredPapers)
    return true
  }

  private getUsers(): any[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('academic_rating_mock_users')
    return stored ? JSON.parse(stored) : []
  }
}

const mockDatabase = new MockDatabaseService()

// Paper operations
export async function getPapers(limit = 20, offset = 0) {
  if (MockAuthService.shouldUseMockAuth() || !supabase) {
    return await mockDatabase.getPapers(limit, offset)
  }

  try {
    const { data, error } = await supabase
      .from('papers')
      .select(`
        *,
        ratings (
          innovation_score,
          methodology_score,
          practicality_score,
          overall_score
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Supabase getPapers error:', error)
      // Fallback to mock data on error
      return await mockDatabase.getPapers(limit, offset)
    }
    
    return data || []
  } catch (error) {
    console.error('getPapers error:', error)
    // Fallback to mock data on any error
    return await mockDatabase.getPapers(limit, offset)
  }
}

export async function getPaper(id: string) {
  if (MockAuthService.shouldUseMockAuth()) {
    return await mockDatabase.getPaper(id)
  }

  if (!supabase) return null

  const { data, error } = await supabase
    .from('papers')
    .select(`
      *,
      ratings (
        *,
        users (username, avatar_url)
      ),
      comments (
        *,
        users (username, avatar_url)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createPaper(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'>) {
  if (MockAuthService.shouldUseMockAuth()) {
    return await mockDatabase.createPaper(paper)
  }

  if (!supabase) throw new Error('Database not available')

  const { data, error } = await (supabase as any)
    .from('papers')
    .insert(paper)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function searchPapers(query: string, limit = 20) {
  // If query looks like a DOI, search by DOI first
  if (isValidDOI(query)) {
    return await searchOrCreatePaperByDOI(query)
  }

  if (MockAuthService.shouldUseMockAuth()) {
    const papers = await mockDatabase.getPapers(100, 0) // Get more papers for search
    return papers.filter(paper =>
      paper.title.toLowerCase().includes(query.toLowerCase()) ||
      paper.authors?.some(author => author.toLowerCase().includes(query.toLowerCase())) ||
      paper.keywords?.some(keyword => keyword.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, limit)
  }

  if (!supabase) return []

  const { data, error } = await supabase
    .from('papers')
    .select(`
      *,
      ratings (
        innovation_score,
        methodology_score,
        practicality_score,
        overall_score
      )
    `)
    .or(`title.ilike.%${query}%, authors.cs.{${query}}, keywords.cs.{${query}}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function searchOrCreatePaperByDOI(doi: string) {
  if (MockAuthService.shouldUseMockAuth()) {
    // Check if paper already exists in mock storage
    const existingPapers = await mockDatabase.searchPaperByDOI(doi)
    if (existingPapers.length > 0) {
      return existingPapers
    }

    // If not found, fetch from CrossRef and create
    try {
      const metadata = await fetchPaperByDOI(doi)

      if (!metadata) {
        throw new Error('无法获取论文信息，请检查DOI是否正确')
      }

      // Get current user from mock auth
      const mockAuth = MockAuthService.getInstance()
      const currentUser = mockAuth.getCurrentUser()

      const newPaper = {
        title: metadata.title,
        authors: metadata.authors,
        doi: metadata.doi,
        abstract: metadata.abstract,
        keywords: metadata.keywords,
        publication_date: metadata.publication_date,
        journal: metadata.journal,
        created_by: currentUser?.id || '00000000-0000-0000-0000-000000000000' // System created
      }

      const createdPaper = await mockDatabase.createPaper(newPaper)
      return [createdPaper]
    } catch (error) {
      console.error('Error fetching paper metadata:', error)
      throw new Error('无法获取论文信息，请检查DOI是否正确')
    }
  }

  if (!supabase) throw new Error('Database not available')

  // First, check if paper already exists
  const { data: existingPaper, error: searchError } = await supabase
    .from('papers')
    .select(`
      *,
      ratings (
        innovation_score,
        methodology_score,
        practicality_score,
        overall_score
      )
    `)
    .eq('doi', doi)
    .single()

  if (searchError && searchError.code !== 'PGRST116') {
    throw searchError
  }

  if (existingPaper) {
    return [existingPaper]
  }

  // If not found, fetch from CrossRef and create
  try {
    const metadata = await fetchPaperByDOI(doi)

    if (!metadata) {
      throw new Error('无法获取论文信息，请检查DOI是否正确')
    }

    // Get current user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser()

    const newPaper = {
      title: metadata.title,
      authors: metadata.authors,
      doi: metadata.doi,
      abstract: metadata.abstract,
      keywords: metadata.keywords,
      publication_date: metadata.publication_date,
      journal: metadata.journal,
      created_by: user?.id || '00000000-0000-0000-0000-000000000000' // System created
    }

    const { data: createdPaper, error: createError } = await (supabase as any)
      .from('papers')
      .insert(newPaper)
      .select(`
        *,
        ratings (
          innovation_score,
          methodology_score,
          practicality_score,
          overall_score
        )
      `)
      .single()

    if (createError) throw createError
    return [createdPaper]
  } catch (error) {
    console.error('Error fetching paper from CrossRef:', error)
    throw new Error('无法找到该DOI对应的论文信息')
  }
}

// Rating operations
export async function createOrUpdateRating(rating: Omit<Rating, 'id' | 'created_at' | 'updated_at'>) {
  if (!supabase) throw new Error('Database not available')

  const { data, error } = await (supabase as any)
    .from('ratings')
    .upsert(rating, { onConflict: 'user_id,paper_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getUserRating(userId: string, paperId: string) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('paper_id', paperId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getPaperRatings(paperId: string) {
  if (MockAuthService.shouldUseMockAuth()) {
    // Use localStorage directly since getRatings is private
    const stored = typeof window !== 'undefined' ? localStorage.getItem(MOCK_RATINGS_KEY) : null
    const ratings = stored ? JSON.parse(stored) : []
    const usersStored = typeof window !== 'undefined' ? localStorage.getItem(MOCK_USERS_KEY) : null
    const users = usersStored ? JSON.parse(usersStored) : []

    return ratings.filter((r: any) => r.paper_id === paperId).map((rating: any) => ({
      ...rating,
      users: users.find((u: any) => u.id === rating.user_id) || { username: 'Unknown User' }
    })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  if (!supabase) return []

  const { data, error } = await supabase
    .from('ratings')
    .select(`
      *,
      users (username, avatar_url)
    `)
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Comment operations
export async function createComment(comment: Omit<Comment, 'id' | 'created_at' | 'updated_at'>) {
  if (MockAuthService.shouldUseMockAuth()) {
    return await mockDatabase.createComment(comment)
  }

  if (!supabase) throw new Error('Database not available')

  const { data, error } = await (supabase as any)
    .from('comments')
    .insert(comment)
    .select(`
      *,
      users (username, avatar_url)
    `)
    .single()

  if (error) throw error
  return data
}

export async function getPaperComments(paperId: string) {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      users (username, avatar_url)
    `)
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// Admin functions
export async function updatePaper(id: string, paperData: Partial<Paper>) {
  if (MockAuthService.shouldUseMockAuth()) {
    return await mockDatabase.updatePaper(id, paperData)
  }

  if (!supabase) throw new Error('Database not available')

  const { data, error } = await (supabase as any)
    .from('papers')
    .update(paperData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deletePaper(id: string) {
  if (MockAuthService.shouldUseMockAuth()) {
    return await mockDatabase.deletePaper(id)
  }

  if (!supabase) throw new Error('Database not available')

  const { error } = await supabase
    .from('papers')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

export async function deleteComment(commentId: string, userId: string) {
  if (!supabase) throw new Error('Database not available')

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)

  if (error) throw error
}

// User operations
export async function getUser(id: string) {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function updateUser(id: string, updates: Partial<User>) {
  if (!supabase) throw new Error('Database not available')

  const { data, error } = await (supabase as any)
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Utility functions
export function calculateAverageRating(ratings: Rating[]) {
  if (ratings.length === 0) return null

  const totals = ratings.reduce(
    (acc, rating) => ({
      innovation: acc.innovation + rating.innovation_score,
      methodology: acc.methodology + rating.methodology_score,
      practicality: acc.practicality + rating.practicality_score,
      overall: acc.overall + rating.overall_score,
    }),
    { innovation: 0, methodology: 0, practicality: 0, overall: 0 }
  )

  const count = ratings.length
  return {
    innovation: Math.round((totals.innovation / count) * 10) / 10,
    methodology: Math.round((totals.methodology / count) * 10) / 10,
    practicality: Math.round((totals.practicality / count) * 10) / 10,
    overall: Math.round((totals.overall / count) * 10) / 10,
    count,
  }
}

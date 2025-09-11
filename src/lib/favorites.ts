import { supabase } from './supabase'
import { mockAuth, MockAuthService } from './mockAuth'
import type { Paper } from './supabase'

export interface PaperFavorite {
  id: string
  user_id: string
  paper_id: string
  created_at: string
  papers?: Paper
}

export interface PaperWithFavorite extends Paper {
  is_favorited?: boolean
  favorite_count?: number
}

// Mock storage for favorites when using mock auth
const MOCK_FAVORITES_KEY = 'academic_rating_mock_favorites'

class MockFavoritesService {
  private getFavorites(): PaperFavorite[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(MOCK_FAVORITES_KEY)
    return stored ? JSON.parse(stored) : []
  }

  private saveFavorites(favorites: PaperFavorite[]): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(MOCK_FAVORITES_KEY, JSON.stringify(favorites))
  }

  getPapers(): Paper[] {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem('academic_rating_mock_papers')
    return stored ? JSON.parse(stored) : []
  }

  async addFavorite(userId: string, paperId: string): Promise<boolean> {
    try {
      const favorites = this.getFavorites()
      
      // Check if already favorited
      if (favorites.find(f => f.user_id === userId && f.paper_id === paperId)) {
        return false // Already favorited
      }

      const newFavorite: PaperFavorite = {
        id: 'mock-fav-' + Math.random().toString(36).substr(2, 9),
        user_id: userId,
        paper_id: paperId,
        created_at: new Date().toISOString()
      }

      favorites.push(newFavorite)
      this.saveFavorites(favorites)
      return true
    } catch (error) {
      console.error('Error adding favorite:', error)
      return false
    }
  }

  async removeFavorite(userId: string, paperId: string): Promise<boolean> {
    try {
      const favorites = this.getFavorites()
      const filtered = favorites.filter(f => !(f.user_id === userId && f.paper_id === paperId))
      this.saveFavorites(filtered)
      return true
    } catch (error) {
      console.error('Error removing favorite:', error)
      return false
    }
  }

  async getUserFavorites(userId: string): Promise<PaperFavorite[]> {
    try {
      const favorites = this.getFavorites()
      return favorites.filter(f => f.user_id === userId)
    } catch (error) {
      console.error('Error getting user favorites:', error)
      return []
    }
  }

  async isFavorited(userId: string, paperId: string): Promise<boolean> {
    try {
      const favorites = this.getFavorites()
      return favorites.some(f => f.user_id === userId && f.paper_id === paperId)
    } catch (error) {
      console.error('Error checking favorite status:', error)
      return false
    }
  }
}

const mockFavorites = new MockFavoritesService()

/**
 * Add a paper to user's favorites
 */
export async function addToFavorites(userId: string, paperId: string): Promise<boolean> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockFavorites.addFavorite(userId, paperId)
    }

    if (!supabase) throw new Error('Database not available')

    const { error } = await supabase
      .from('paper_favorites')
      .insert({
        user_id: userId,
        paper_id: paperId
      })

    if (error) {
      // If it's a unique constraint violation, it's already favorited
      if (error.code === '23505') {
        return false
      }
      throw error
    }

    return true
  } catch (error) {
    console.error('Error adding to favorites:', error)
    return false
  }
}

/**
 * Remove a paper from user's favorites
 */
export async function removeFromFavorites(userId: string, paperId: string): Promise<boolean> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockFavorites.removeFavorite(userId, paperId)
    }

    if (!supabase) throw new Error('Database not available')

    const { error } = await supabase
      .from('paper_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('paper_id', paperId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error removing from favorites:', error)
    return false
  }
}

/**
 * Toggle favorite status of a paper
 */
export async function toggleFavorite(userId: string, paperId: string): Promise<boolean> {
  try {
    const isFav = await isFavorited(userId, paperId)
    
    if (isFav) {
      return await removeFromFavorites(userId, paperId)
    } else {
      return await addToFavorites(userId, paperId)
    }
  } catch (error) {
    console.error('Error toggling favorite:', error)
    return false
  }
}

/**
 * Check if a paper is favorited by user
 */
export async function isFavorited(userId: string, paperId: string): Promise<boolean> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      return await mockFavorites.isFavorited(userId, paperId)
    }

    if (!supabase) return false

    const { data, error } = await supabase
      .from('paper_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Error checking favorite status:', error)
    return false
  }
}

/**
 * Get user's favorite papers
 */
export async function getUserFavorites(userId: string): Promise<PaperWithFavorite[]> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      const favorites = await mockFavorites.getUserFavorites(userId)
      const papers = mockFavorites.getPapers()

      return favorites.map(favorite => {
        const paper = papers.find(p => p.id === favorite.paper_id)
        return paper ? { ...paper, is_favorited: true } : null
      }).filter(Boolean) as PaperWithFavorite[]
    }

    if (!supabase) return []

    const { data, error } = await supabase
      .from('paper_favorites')
      .select(`
        *,
        papers (
          id,
          title,
          authors,
          doi,
          abstract,
          keywords,
          journal,
          publication_date,
          created_at,
          created_by
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map(fav => ({
      ...fav.papers,
      is_favorited: true
    })) as PaperWithFavorite[]
  } catch (error) {
    console.error('Error getting user favorites:', error)
    return []
  }
}

/**
 * Get favorite count for a paper
 */
export async function getFavoriteCount(paperId: string): Promise<number> {
  try {
    if (MockAuthService.shouldUseMockAuth()) {
      // Use localStorage directly since getFavorites is private
      const stored = typeof window !== 'undefined' ? localStorage.getItem('academic_rating_mock_favorites') : null
      const favorites = stored ? JSON.parse(stored) : []
      return favorites.filter((f: any) => f.paper_id === paperId).length
    }

    if (!supabase) return 0

    const { count, error } = await supabase
      .from('paper_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('paper_id', paperId)

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error getting favorite count:', error)
    return 0
  }
}

/**
 * Get papers with favorite status for a user
 */
export async function getPapersWithFavoriteStatus(
  userId: string | null, 
  papers: Paper[]
): Promise<PaperWithFavorite[]> {
  if (!userId || papers.length === 0) {
    return papers.map(paper => ({ ...paper, is_favorited: false }))
  }

  try {
    if (MockAuthService.shouldUseMockAuth()) {
      const favorites = await mockFavorites.getUserFavorites(userId)
      const favoriteIds = new Set(favorites.map(f => f.paper_id))
      
      return papers.map(paper => ({
        ...paper,
        is_favorited: favoriteIds.has(paper.id)
      }))
    }

    if (!supabase) return papers.map(paper => ({ ...paper, is_favorited: false }))

    const { data: favorites, error } = await supabase
      .from('paper_favorites')
      .select('paper_id')
      .eq('user_id', userId)
      .in('paper_id', papers.map(p => p.id))

    if (error) throw error

    const favoriteIds = new Set(favorites?.map(f => f.paper_id) || [])

    return papers.map(paper => ({
      ...paper,
      is_favorited: favoriteIds.has(paper.id)
    }))
  } catch (error) {
    console.error('Error getting papers with favorite status:', error)
    return papers.map(paper => ({ ...paper, is_favorited: false }))
  }
}

/**
 * Webpage Evaluation System - Database Functions
 * Doc: docs/dev/Knowledge-Web/10.5-Webpage-Evaluation-System.md
 */

import { supabase } from './supabase'
import crypto from 'crypto'

// ============================================================================
// Type Definitions
// ============================================================================

export interface Webpage {
  id: string
  url: string
  url_hash: string
  title?: string
  description?: string
  favicon_url?: string
  og_image_url?: string
  metadata?: Record<string, any>
  first_submitted_by?: string
  created_at: string
  updated_at: string
}

export interface WebpageRating {
  id: string
  webpage_id: string
  user_id: string
  quality_score: number
  usefulness_score: number
  accuracy_score: number
  overall_score: number
  is_anonymous: boolean
  created_at: string
  updated_at: string
}

export interface WebpageComment {
  id: string
  webpage_id: string
  user_id: string
  content: string
  parent_id?: string
  is_anonymous: boolean
  created_at: string
  updated_at: string
}

export interface WebpageLatestComment {
  content: string
  is_anonymous: boolean
  created_at: string
  user?: {
    username: string
  } | null
}

export interface WebpageWithStats extends Webpage {
  average_rating?: number
  rating_count?: number
  comment_count?: number
  latest_comment?: WebpageLatestComment
}

// ============================================================================
// URL Utilities
// ============================================================================

/**
 * Normalize URL by removing tracking parameters and standardizing format
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid', '_ga']
    trackingParams.forEach(p => parsed.searchParams.delete(p))
    // Remove hash
    parsed.hash = ''
    // Normalize to lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase()
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Generate a short hash for URL (for routing and indexing)
 */
export function hashUrl(url: string): string {
  const normalized = normalizeUrl(url)
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

// ============================================================================
// Webpage CRUD
// ============================================================================

/**
 * Get webpage by URL hash
 */
export async function getWebpageByHash(urlHash: string): Promise<Webpage | null> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpages')
    .select('*')
    .eq('url_hash', urlHash)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching webpage:', error)
    throw error
  }

  return data as Webpage | null
}

/**
 * Get webpage by URL (will normalize and hash)
 */
export async function getWebpageByUrl(url: string): Promise<Webpage | null> {
  const urlHash = hashUrl(url)
  return getWebpageByHash(urlHash)
}

/**
 * Create a new webpage record
 */
export async function createWebpage(
  url: string,
  metadata: {
    title?: string
    description?: string
    favicon_url?: string
    og_image_url?: string
    metadata?: Record<string, any>
  },
  userId?: string
): Promise<Webpage> {
  if (!supabase) throw new Error('Supabase is not available')

  const normalizedUrl = normalizeUrl(url)
  const urlHash = hashUrl(url)

  const { data, error } = await supabase
    .from('webpages')
    .insert({
      url: normalizedUrl,
      url_hash: urlHash,
      title: metadata.title,
      description: metadata.description,
      favicon_url: metadata.favicon_url,
      og_image_url: metadata.og_image_url,
      metadata: metadata.metadata,
      first_submitted_by: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating webpage:', error)
    throw error
  }

  return data as Webpage
}

/**
 * Get or create webpage (upsert pattern)
 */
export async function getOrCreateWebpage(
  url: string,
  metadata: {
    title?: string
    description?: string
    favicon_url?: string
    og_image_url?: string
    metadata?: Record<string, any>
  },
  userId?: string
): Promise<Webpage> {
  const existing = await getWebpageByUrl(url)
  if (existing) return existing
  return createWebpage(url, metadata, userId)
}

/**
 * Update webpage metadata
 */
export async function updateWebpage(
  urlHash: string,
  updates: Partial<Pick<Webpage, 'title' | 'description' | 'favicon_url' | 'og_image_url' | 'metadata'>>
): Promise<Webpage> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpages')
    .update(updates)
    .eq('url_hash', urlHash)
    .select()
    .single()

  if (error) {
    console.error('Error updating webpage:', error)
    throw error
  }

  return data as Webpage
}

/**
 * Get webpages with statistics
 */
export async function getWebpagesWithStats(
  limit: number = 20,
  offset: number = 0,
  sortBy: 'newest' | 'rating' | 'comments' = 'newest',
  search?: string
): Promise<WebpageWithStats[]> {
  if (!supabase) throw new Error('Supabase is not available')

  // Build query with optional search filter
  let query = supabase.from('webpages').select('*')
  
  // Apply search filter if provided
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`
    query = query.or(`title.ilike.${searchTerm},url.ilike.${searchTerm},description.ilike.${searchTerm}`)
  }
  
  // Fetch webpages
  const { data: webpages, error: webpagesError } = await query.order('created_at', { ascending: false })

  if (webpagesError) throw webpagesError
  if (!webpages || webpages.length === 0) return []

  const webpageIds = (webpages as Webpage[]).map(w => w.id)

  // Fetch ratings, comments count, and latest comments in parallel
  const [ratingsRes, commentsRes, latestCommentsRes] = await Promise.all([
    supabase.from('webpage_ratings').select('webpage_id, overall_score').in('webpage_id', webpageIds),
    supabase.from('webpage_comments').select('webpage_id').in('webpage_id', webpageIds),
    // Fetch latest comment for each webpage
    supabase.from('webpage_comments')
      .select('webpage_id, content, is_anonymous, created_at, user_id')
      .in('webpage_id', webpageIds)
      .order('created_at', { ascending: false }),
  ])

  if (ratingsRes.error) throw ratingsRes.error
  if (commentsRes.error) throw commentsRes.error

  // Build stats maps
  const ratingMap = new Map<string, { count: number; sum: number }>()
  for (const r of ratingsRes.data || []) {
    const prev = ratingMap.get(r.webpage_id) || { count: 0, sum: 0 }
    ratingMap.set(r.webpage_id, { count: prev.count + 1, sum: prev.sum + (r.overall_score || 0) })
  }

  const commentMap = new Map<string, number>()
  for (const c of commentsRes.data || []) {
    commentMap.set(c.webpage_id, (commentMap.get(c.webpage_id) || 0) + 1)
  }

  // Build latest comment map (only keep the first one per webpage_id since they're ordered by created_at desc)
  const latestCommentMap = new Map<string, { content: string; is_anonymous: boolean; created_at: string; user_id: string }>()
  for (const c of latestCommentsRes.data || []) {
    if (!latestCommentMap.has(c.webpage_id)) {
      latestCommentMap.set(c.webpage_id, c)
    }
  }

  // Fetch usernames for latest comments
  const userIds = [...new Set([...latestCommentMap.values()].filter(c => !c.is_anonymous).map(c => c.user_id))]
  let usernameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('profiles').select('id, username').in('id', userIds)
    if (users) {
      for (const u of users) {
        usernameMap.set(u.id, u.username || '匿名')
      }
    }
  }

  // Enrich with stats
  const enriched: WebpageWithStats[] = (webpages as Webpage[]).map(w => {
    const r = ratingMap.get(w.id) || { count: 0, sum: 0 }
    const latestComment = latestCommentMap.get(w.id)
    return {
      ...w,
      rating_count: r.count,
      average_rating: r.count > 0 ? Math.round((r.sum / r.count) * 10) / 10 : 0,
      comment_count: commentMap.get(w.id) || 0,
      latest_comment: latestComment ? {
        content: latestComment.content,
        is_anonymous: latestComment.is_anonymous,
        created_at: latestComment.created_at,
        user: latestComment.is_anonymous ? null : { username: usernameMap.get(latestComment.user_id) || '匿名' }
      } : undefined,
    }
  })

  // When sorting by rating or comments, filter out items without engagement
  let filtered = enriched
  if (sortBy === 'rating') {
    filtered = enriched.filter(w => (w.rating_count ?? 0) > 0 || (w.comment_count ?? 0) > 0)
  } else if (sortBy === 'comments') {
    filtered = enriched.filter(w => (w.comment_count ?? 0) > 0)
  }

  // Sort
  filtered.sort((a, b) => {
    if (sortBy === 'rating') {
      return (b.average_rating || 0) - (a.average_rating || 0)
    }
    if (sortBy === 'comments') {
      return (b.comment_count || 0) - (a.comment_count || 0)
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return filtered.slice(offset, offset + limit)
}

// ============================================================================
// Rating CRUD
// ============================================================================

/**
 * Get user's rating for a webpage
 */
export async function getWebpageUserRating(
  webpageId: string,
  userId: string
): Promise<WebpageRating | null> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_ratings')
    .select('*')
    .eq('webpage_id', webpageId)
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user rating:', error)
    throw error
  }

  return data as WebpageRating | null
}

/**
 * Get all ratings for a webpage
 */
export async function getWebpageRatings(webpageId: string): Promise<WebpageRating[]> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_ratings')
    .select('*')
    .eq('webpage_id', webpageId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching webpage ratings:', error)
    throw error
  }

  return (data || []) as WebpageRating[]
}

/**
 * Create or update a webpage rating
 */
export async function createOrUpdateWebpageRating(
  webpageId: string,
  userId: string,
  scores: {
    quality_score: number
    usefulness_score: number
    accuracy_score: number
    overall_score: number
    is_anonymous?: boolean
  }
): Promise<WebpageRating> {
  if (!supabase) throw new Error('Supabase is not available')

  const existing = await getWebpageUserRating(webpageId, userId)

  if (existing) {
    // Update
    const { data, error } = await supabase
      .from('webpage_ratings')
      .update({
        quality_score: scores.quality_score,
        usefulness_score: scores.usefulness_score,
        accuracy_score: scores.accuracy_score,
        overall_score: scores.overall_score,
        is_anonymous: scores.is_anonymous ?? false,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data as WebpageRating
  } else {
    // Create
    const { data, error } = await supabase
      .from('webpage_ratings')
      .insert({
        webpage_id: webpageId,
        user_id: userId,
        quality_score: scores.quality_score,
        usefulness_score: scores.usefulness_score,
        accuracy_score: scores.accuracy_score,
        overall_score: scores.overall_score,
        is_anonymous: scores.is_anonymous ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return data as WebpageRating
  }
}

/**
 * Calculate average rating for a webpage
 */
export function calculateWebpageAverageRating(ratings: WebpageRating[]) {
  if (ratings.length === 0) return null

  const totals = ratings.reduce(
    (acc, rating) => ({
      quality: acc.quality + (rating.quality_score || 0),
      usefulness: acc.usefulness + (rating.usefulness_score || 0),
      accuracy: acc.accuracy + (rating.accuracy_score || 0),
      overall: acc.overall + (rating.overall_score || 0),
    }),
    { quality: 0, usefulness: 0, accuracy: 0, overall: 0 }
  )

  const count = ratings.length
  return {
    quality: Math.round((totals.quality / count) * 10) / 10,
    usefulness: Math.round((totals.usefulness / count) * 10) / 10,
    accuracy: Math.round((totals.accuracy / count) * 10) / 10,
    overall: Math.round((totals.overall / count) * 10) / 10,
    count,
  }
}

// ============================================================================
// Comment CRUD
// ============================================================================

/**
 * Get comments for a webpage
 */
export async function getWebpageComments(
  webpageId: string,
  limit: number = 50,
  offset: number = 0
): Promise<WebpageComment[]> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_comments')
    .select('*')
    .eq('webpage_id', webpageId)
    .is('parent_id', null)  // Top-level comments only
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching webpage comments:', error)
    throw error
  }

  return (data || []) as WebpageComment[]
}

/**
 * Get replies for a comment
 */
export async function getWebpageCommentReplies(parentId: string): Promise<WebpageComment[]> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_comments')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching comment replies:', error)
    throw error
  }

  return (data || []) as WebpageComment[]
}

/**
 * Create a new comment
 */
export async function createWebpageComment(
  webpageId: string,
  userId: string,
  content: string,
  options?: {
    parent_id?: string
    is_anonymous?: boolean
  }
): Promise<WebpageComment> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_comments')
    .insert({
      webpage_id: webpageId,
      user_id: userId,
      content,
      parent_id: options?.parent_id,
      is_anonymous: options?.is_anonymous ?? false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating comment:', error)
    throw error
  }

  return data as WebpageComment
}

/**
 * Update a comment
 */
export async function updateWebpageComment(
  commentId: string,
  content: string
): Promise<WebpageComment> {
  if (!supabase) throw new Error('Supabase is not available')

  const { data, error } = await supabase
    .from('webpage_comments')
    .update({ content })
    .eq('id', commentId)
    .select()
    .single()

  if (error) {
    console.error('Error updating comment:', error)
    throw error
  }

  return data as WebpageComment
}

/**
 * Delete a comment
 */
export async function deleteWebpageComment(commentId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not available')

  const { error } = await supabase
    .from('webpage_comments')
    .delete()
    .eq('id', commentId)

  if (error) {
    console.error('Error deleting comment:', error)
    throw error
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { CreatePaperBookmarkRequest } from '@/types/paper-bookmarks'

/**
 * Get Supabase client with auth from either Bearer token or cookies
 */
async function getSupabaseWithAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (token) {
    const supabase = createClientWithToken(token)
    const { data: { user } } = await supabase.auth.getUser()
    return { supabase, user }
  }
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/**
 * GET /api/paper-bookmarks/items
 * Get user's paper bookmarks with optional folder filter
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('paper_bookmark_items')
      .select(`
        *,
        paper:papers(
          id,
          doi,
          title,
          authors,
          abstract,
          journal,
          publication_date,
          average_rating,
          ratings_count,
          comments_count
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    // Filter by folder
    if (folderId === 'null' || folderId === '') {
      query = query.is('folder_id', null)
    } else if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: items, count, error } = await query

    if (error) {
      console.error('Error fetching paper bookmarks:', error)
      return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 })
    }

    // If search query, filter in memory (could be optimized with full-text search)
    let filteredItems = items || []
    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filteredItems = filteredItems.filter(item => {
        const paper = item.paper as any
        if (!paper) return false
        return (
          paper.title?.toLowerCase().includes(searchLower) ||
          paper.authors?.some((a: string) => a.toLowerCase().includes(searchLower)) ||
          paper.doi?.toLowerCase().includes(searchLower) ||
          paper.journal?.toLowerCase().includes(searchLower) ||
          item.custom_title?.toLowerCase().includes(searchLower) ||
          item.note?.toLowerCase().includes(searchLower)
        )
      })
    }

    return NextResponse.json({
      success: true,
      items: filteredItems,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0)
    })
  } catch (error) {
    console.error('GET /api/paper-bookmarks/items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/paper-bookmarks/items
 * Create a new paper bookmark
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreatePaperBookmarkRequest = await request.json()
    
    if (!body.paper_id) {
      return NextResponse.json({ error: 'Paper ID is required' }, { status: 400 })
    }

    // Check if paper exists
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('id, title')
      .eq('id', body.paper_id)
      .single()

    if (paperError || !paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
    }

    // Check if already bookmarked in the same folder
    // A paper can be bookmarked to multiple folders, so we check paper_id + folder_id combination
    let existingQuery = supabase
      .from('paper_bookmark_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('paper_id', body.paper_id)
    
    // Handle folder_id being null vs a specific folder
    if (body.folder_id) {
      existingQuery = existingQuery.eq('folder_id', body.folder_id)
    } else {
      existingQuery = existingQuery.is('folder_id', null)
    }

    const { data: existing } = await existingQuery.single()

    if (existing) {
      return NextResponse.json({ 
        error: 'Paper already bookmarked in this folder',
        existing_id: existing.id 
      }, { status: 409 })
    }

    // Get max position for new item
    const { data: maxPosData } = await supabase
      .from('paper_bookmark_items')
      .select('position')
      .eq('user_id', user.id)
      .is('folder_id', body.folder_id || null)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPosData?.position || 0) + 1

    const { data: bookmark, error } = await supabase
      .from('paper_bookmark_items')
      .insert({
        user_id: user.id,
        paper_id: body.paper_id,
        folder_id: body.folder_id || null,
        custom_title: body.custom_title || null,
        note: body.note || null,
        position: newPosition
      })
      .select(`
        *,
        paper:papers(
          id,
          doi,
          title,
          authors,
          abstract,
          journal,
          publication_date,
          average_rating,
          ratings_count,
          comments_count
        )
      `)
      .single()

    if (error) {
      console.error('Error creating paper bookmark:', error)
      return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      bookmark
    })
  } catch (error) {
    console.error('POST /api/paper-bookmarks/items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

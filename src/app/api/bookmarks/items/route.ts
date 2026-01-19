import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { CreateBookmarkRequest } from '@/types/bookmarks'
import crypto from 'crypto'

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
 * GET /api/bookmarks/items
 * Get bookmark items, optionally filtered by folder
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

    let query = supabase
      .from('bookmark_items')
      .select(`
        *,
        webpage:webpages(id, url, url_hash, title, favicon_url, description)
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    // Filter by folder
    if (folderId === 'uncategorized' || folderId === 'null') {
      query = query.is('folder_id', null)
    } else if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    // Search in title/url
    if (search) {
      // We need to search in the joined webpage data
      // This is a bit tricky with Supabase, so we'll filter after fetching
    }

    // Pagination
    query = query.range(offset, offset + limit - 1)

    const { data: items, count, error } = await query

    if (error) {
      console.error('Error fetching items:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Client-side search filter if needed
    let filteredItems = items || []
    if (search) {
      const searchLower = search.toLowerCase()
      filteredItems = filteredItems.filter(item => {
        const title = item.custom_title || item.webpage?.title || ''
        const url = item.webpage?.url || ''
        return title.toLowerCase().includes(searchLower) || 
               url.toLowerCase().includes(searchLower)
      })
    }

    return NextResponse.json({
      success: true,
      items: filteredItems,
      total: count || 0,
      offset,
      limit
    })
  } catch (error) {
    console.error('GET /api/bookmarks/items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/bookmarks/items
 * Add a new bookmark (creates webpage if not exists)
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateBookmarkRequest = await request.json()
    
    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Normalize URL - only add https:// if no protocol is specified
    let url = body.url.trim()
    // Check if URL has a protocol (contains ://)
    if (!url.includes('://')) {
      url = 'https://' + url
    }

    // Generate URL hash
    const urlHash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)

    // Check if webpage exists, if not create it
    let { data: webpage, error: webpageError } = await supabase
      .from('webpages')
      .select('*')
      .eq('url_hash', urlHash)
      .single()

    if (!webpage) {
      // Create new webpage
      const { data: newWebpage, error: createError } = await supabase
        .from('webpages')
        .insert({
          url,
          url_hash: urlHash,
          title: body.title || null,
          first_submitted_by: user.id
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating webpage:', createError)
        return NextResponse.json({ error: 'Failed to create webpage' }, { status: 500 })
      }
      webpage = newWebpage
    }

    // Check if folder exists and belongs to user (if provided)
    if (body.folder_id) {
      const { data: folder } = await supabase
        .from('bookmark_folders')
        .select('id, user_id')
        .eq('id', body.folder_id)
        .single()

      if (!folder || folder.user_id !== user.id) {
        return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
      }
    }

    // Get max position in target folder
    const { data: existingItems } = await supabase
      .from('bookmark_items')
      .select('position')
      .eq('user_id', user.id)
      .eq('folder_id', body.folder_id || null)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existingItems && existingItems.length > 0 
      ? existingItems[0].position + 1 
      : 0

    // Create bookmark item
    const { data: item, error: createItemError } = await supabase
      .from('bookmark_items')
      .insert({
        user_id: user.id,
        webpage_id: webpage.id,
        folder_id: body.folder_id || null,
        custom_title: body.custom_title || null,
        note: body.note || null,
        position: nextPosition
      })
      .select(`
        *,
        webpage:webpages(id, url, url_hash, title, favicon_url, description),
        folder:bookmark_folders(id, name)
      `)
      .single()

    if (createItemError) {
      if (createItemError.code === '23505') {
        return NextResponse.json({ error: 'Bookmark already exists in this folder' }, { status: 409 })
      }
      console.error('Error creating bookmark:', createItemError)
      return NextResponse.json({ error: 'Failed to create bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item
    })
  } catch (error) {
    console.error('POST /api/bookmarks/items error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

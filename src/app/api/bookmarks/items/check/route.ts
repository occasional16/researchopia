import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
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
 * Generate URL hash for lookup (must match the format used in POST)
 * Uses first 16 characters of SHA256 hash
 */
function generateUrlHash(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)
}

/**
 * GET /api/bookmarks/items/check
 * Check if a URL is already bookmarked by the current user
 * Returns all bookmark instances (can be in multiple folders)
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Debug log
    console.log('[check API] User ID:', user.id, 'Email:', user.email)

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    // Normalize URL (must match the normalization in POST)
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    // Generate URL hash to find the webpage
    const urlHash = generateUrlHash(normalizedUrl)

    // Find webpage by URL hash
    const { data: webpage } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', urlHash)
      .single()

    if (!webpage) {
      // URL not in webpages table, so definitely not bookmarked
      return NextResponse.json({
        success: true,
        isBookmarked: false,
        bookmarks: []
      })
    }

    // Find all bookmark items for this webpage by this user
    const { data: bookmarks, error } = await supabase
      .from('bookmark_items')
      .select(`
        id,
        custom_title,
        note,
        folder_id,
        created_at,
        folder:bookmark_folders(id, name)
      `)
      .eq('user_id', user.id)
      .eq('webpage_id', webpage.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error checking bookmarks:', error)
      return NextResponse.json({ error: 'Failed to check bookmarks' }, { status: 500 })
    }
    
    // Debug: log what we're returning with folder details
    console.log('[check API] Returning bookmarks:', bookmarks?.map(b => ({
      id: b.id,
      folder_id: b.folder_id,
      folder: b.folder
    })))

    return NextResponse.json({
      success: true,
      isBookmarked: bookmarks && bookmarks.length > 0,
      bookmarks: bookmarks || []
    }, {
      headers: {
        // Disable caching for bookmark status checks
        // This API is called once per popup open, so no-store is acceptable
        // The main use case is checking after user navigates to a new page
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('GET /api/bookmarks/items/check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

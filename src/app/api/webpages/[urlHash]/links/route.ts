import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { CreateLinkRequest, LinkType } from '@/types/bookmarks'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ urlHash: string }>
}

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
 * GET /api/webpages/[urlHash]/links
 * Get links for a webpage
 * Query params:
 *   - scope: 'mine' | 'all' (default: 'all')
 *   - direction: 'outgoing' | 'incoming' | 'both' (default: 'both')
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash } = await params
    const supabase = await createClient()
    
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'all'
    const direction = searchParams.get('direction') || 'both'

    // Get current user (optional for viewing)
    const { data: { user } } = await supabase.auth.getUser()

    // Get webpage by url_hash
    const { data: webpage, error: webpageError } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', urlHash)
      .single()

    if (webpageError || !webpage) {
      return NextResponse.json({ error: 'Webpage not found' }, { status: 404 })
    }

    const webpageId = webpage.id
    const links: { outgoing: any[], incoming: any[] } = { outgoing: [], incoming: [] }

    // Build base query for outgoing links (from this webpage to others)
    if (direction === 'outgoing' || direction === 'both') {
      let outgoingQuery = supabase
        .from('webpage_links')
        .select(`
          id,
          source_webpage_id,
          target_webpage_id,
          link_type,
          note,
          created_by,
          created_at,
          target_webpage:webpages!webpage_links_target_webpage_id_fkey(id, url, url_hash, title, favicon_url)
        `)
        .eq('source_webpage_id', webpageId)
        .order('created_at', { ascending: false })

      // Filter by scope
      if (scope === 'mine' && user) {
        outgoingQuery = outgoingQuery.eq('created_by', user.id)
      }

      const { data: outgoingLinks, error } = await outgoingQuery

      if (!error && outgoingLinks) {
        links.outgoing = outgoingLinks.map(link => ({
          ...link,
          // Only include created_by for 'mine' scope
          created_by: scope === 'mine' ? link.created_by : undefined,
          is_mine: user ? link.created_by === user.id : false
        }))
      }
    }

    // Build base query for incoming links (from other webpages to this one)
    if (direction === 'incoming' || direction === 'both') {
      let incomingQuery = supabase
        .from('webpage_links')
        .select(`
          id,
          source_webpage_id,
          target_webpage_id,
          link_type,
          note,
          created_by,
          created_at,
          source_webpage:webpages!webpage_links_source_webpage_id_fkey(id, url, url_hash, title, favicon_url)
        `)
        .eq('target_webpage_id', webpageId)
        .order('created_at', { ascending: false })

      // Filter by scope
      if (scope === 'mine' && user) {
        incomingQuery = incomingQuery.eq('created_by', user.id)
      }

      const { data: incomingLinks, error } = await incomingQuery

      if (!error && incomingLinks) {
        links.incoming = incomingLinks.map(link => ({
          ...link,
          created_by: scope === 'mine' ? link.created_by : undefined,
          is_mine: user ? link.created_by === user.id : false
        }))
      }
    }

    return NextResponse.json({
      success: true,
      links,
      webpage_id: webpageId,
      scope,
      direction
    })
  } catch (error) {
    console.error('GET /api/webpages/[urlHash]/links error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/webpages/[urlHash]/links
 * Create a new link from this webpage to another
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    
    // Require authentication
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateLinkRequest = await request.json()

    // Validate link_type
    const validLinkTypes: LinkType[] = ['related', 'cite', 'respond', 'review', 'derive']
    if (!validLinkTypes.includes(body.link_type)) {
      return NextResponse.json({ error: 'Invalid link type' }, { status: 400 })
    }

    // Get source webpage
    const { data: sourceWebpage, error: sourceError } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', urlHash)
      .single()

    if (sourceError || !sourceWebpage) {
      return NextResponse.json({ error: 'Source webpage not found' }, { status: 404 })
    }

    // Get or create target webpage
    let targetWebpageId: string

    if (body.target_url_hash) {
      // Lookup by url_hash
      const { data: targetWebpage, error: targetError } = await supabase
        .from('webpages')
        .select('id')
        .eq('url_hash', body.target_url_hash)
        .single()

      if (targetError || !targetWebpage) {
        return NextResponse.json({ error: 'Target webpage not found' }, { status: 404 })
      }
      targetWebpageId = targetWebpage.id
    } else if (body.target_url) {
      // Create or get by URL
      let url = body.target_url.trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      const targetUrlHash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)

      let { data: existingWebpage } = await supabase
        .from('webpages')
        .select('id')
        .eq('url_hash', targetUrlHash)
        .single()

      if (existingWebpage) {
        targetWebpageId = existingWebpage.id
      } else {
        // Create new webpage
        const { data: newWebpage, error: createError } = await supabase
          .from('webpages')
          .insert({
            url,
            url_hash: targetUrlHash,
            first_submitted_by: user.id
          })
          .select('id')
          .single()

        if (createError || !newWebpage) {
          console.error('Error creating target webpage:', createError)
          return NextResponse.json({ error: 'Failed to create target webpage' }, { status: 500 })
        }
        targetWebpageId = newWebpage.id
      }
    } else {
      return NextResponse.json({ error: 'Target URL or url_hash is required' }, { status: 400 })
    }

    // Check self-link
    if (sourceWebpage.id === targetWebpageId) {
      return NextResponse.json({ error: 'Cannot link webpage to itself' }, { status: 400 })
    }

    // Create link
    const { data: link, error: createError } = await supabase
      .from('webpage_links')
      .insert({
        source_webpage_id: sourceWebpage.id,
        target_webpage_id: targetWebpageId,
        link_type: body.link_type,
        note: body.note || null,
        created_by: user.id
      })
      .select(`
        id,
        source_webpage_id,
        target_webpage_id,
        link_type,
        note,
        created_by,
        created_at,
        target_webpage:webpages!webpage_links_target_webpage_id_fkey(id, url, url_hash, title, favicon_url)
      `)
      .single()

    if (createError) {
      if (createError.code === '23505') {
        return NextResponse.json({ error: 'Link already exists' }, { status: 409 })
      }
      console.error('Error creating link:', createError)
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      link
    })
  } catch (error) {
    console.error('POST /api/webpages/[urlHash]/links error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'

interface RouteParams {
  params: Promise<{ urlHash: string; id: string }>
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
 * DELETE /api/webpages/[urlHash]/links/[id]
 * Delete a link (only the creator can delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash, id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    
    // Require authentication
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the webpage exists
    const { data: webpage, error: webpageError } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', urlHash)
      .single()

    if (webpageError || !webpage) {
      return NextResponse.json({ error: 'Webpage not found' }, { status: 404 })
    }

    // Get the link to verify ownership and association
    const { data: link, error: linkError } = await supabase
      .from('webpage_links')
      .select('id, source_webpage_id, target_webpage_id, created_by')
      .eq('id', id)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Verify the link is associated with this webpage
    if (link.source_webpage_id !== webpage.id && link.target_webpage_id !== webpage.id) {
      return NextResponse.json({ error: 'Link not associated with this webpage' }, { status: 400 })
    }

    // Verify ownership
    if (link.created_by !== user.id) {
      return NextResponse.json({ error: 'Only the creator can delete this link' }, { status: 403 })
    }

    // Delete the link
    const { error: deleteError } = await supabase
      .from('webpage_links')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting link:', deleteError)
      return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/webpages/[urlHash]/links/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/webpages/[urlHash]/links/[id]
 * Update a link's note or type (only the creator can update)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { urlHash, id } = await params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Verify the webpage exists
    const { data: webpage, error: webpageError } = await supabase
      .from('webpages')
      .select('id')
      .eq('url_hash', urlHash)
      .single()

    if (webpageError || !webpage) {
      return NextResponse.json({ error: 'Webpage not found' }, { status: 404 })
    }

    // Get the link to verify ownership
    const { data: link, error: linkError } = await supabase
      .from('webpage_links')
      .select('id, source_webpage_id, target_webpage_id, created_by')
      .eq('id', id)
      .single()

    if (linkError || !link) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 })
    }

    // Verify the link is associated with this webpage
    if (link.source_webpage_id !== webpage.id && link.target_webpage_id !== webpage.id) {
      return NextResponse.json({ error: 'Link not associated with this webpage' }, { status: 400 })
    }

    // Verify ownership
    if (link.created_by !== user.id) {
      return NextResponse.json({ error: 'Only the creator can update this link' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, any> = {}
    if (body.link_type !== undefined) {
      const validLinkTypes = ['related', 'cite', 'respond', 'review', 'derive']
      if (!validLinkTypes.includes(body.link_type)) {
        return NextResponse.json({ error: 'Invalid link type' }, { status: 400 })
      }
      updates.link_type = body.link_type
    }
    if (body.note !== undefined) {
      updates.note = body.note || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update the link
    const { data: updatedLink, error: updateError } = await supabase
      .from('webpage_links')
      .update(updates)
      .eq('id', id)
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

    if (updateError) {
      console.error('Error updating link:', updateError)
      return NextResponse.json({ error: 'Failed to update link' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      link: updatedLink
    })
  } catch (error) {
    console.error('PATCH /api/webpages/[urlHash]/links/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

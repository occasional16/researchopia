import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { UpdateBookmarkRequest } from '@/types/bookmarks'

interface RouteParams {
  params: Promise<{ id: string }>
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
 * GET /api/bookmarks/items/[id]
 * Get a single bookmark item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: item, error } = await supabase
      .from('bookmark_items')
      .select(`
        *,
        webpage:webpages(id, url, url_hash, title, favicon_url, description),
        folder:bookmark_folders(id, name, visibility)
      `)
      .eq('id', id)
      .single()

    if (error || !item) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    // Check access
    if (item.user_id !== user.id) {
      // Check if folder is public/shared
      if (!item.folder || item.folder.visibility === 'private') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json({
      success: true,
      item
    })
  } catch (error) {
    console.error('GET /api/bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/bookmarks/items/[id]
 * Update a bookmark item (move folder, custom title, note)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ownership
    const { data: existingItem } = await supabase
      .from('bookmark_items')
      .select('id, user_id, folder_id')
      .eq('id', id)
      .single()

    if (!existingItem) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    if (existingItem.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body: UpdateBookmarkRequest = await request.json()

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (body.folder_id !== undefined) {
      // Validate folder if provided
      if (body.folder_id !== null) {
        const { data: folder } = await supabase
          .from('bookmark_folders')
          .select('id, user_id')
          .eq('id', body.folder_id)
          .single()

        if (!folder || folder.user_id !== user.id) {
          return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
        }
      }
      updateData.folder_id = body.folder_id
    }
    if (body.custom_title !== undefined) updateData.custom_title = body.custom_title
    if (body.note !== undefined) updateData.note = body.note
    if (body.position !== undefined) updateData.position = body.position

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: item, error } = await supabase
      .from('bookmark_items')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        webpage:webpages(id, url, url_hash, title, favicon_url, description)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Bookmark already exists in target folder' }, { status: 409 })
      }
      console.error('Error updating bookmark:', error)
      return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item
    })
  } catch (error) {
    console.error('PUT /api/bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/bookmarks/items/[id]
 * Delete a bookmark item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ownership
    const { data: existingItem } = await supabase
      .from('bookmark_items')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existingItem) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    if (existingItem.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { error } = await supabase
      .from('bookmark_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting bookmark:', error)
      return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

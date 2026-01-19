import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { UpdatePaperBookmarkRequest } from '@/types/paper-bookmarks'

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
 * GET /api/paper-bookmarks/items/[id]
 * Get a single paper bookmark
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bookmark, error } = await supabase
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
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      bookmark
    })
  } catch (error) {
    console.error('GET /api/paper-bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/paper-bookmarks/items/[id]
 * Update a paper bookmark
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdatePaperBookmarkRequest = await request.json()

    // Check ownership
    const { data: existing } = await supabase
      .from('paper_bookmark_items')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update object
    const updateData: any = {}
    if (body.folder_id !== undefined) updateData.folder_id = body.folder_id
    if (body.custom_title !== undefined) updateData.custom_title = body.custom_title
    if (body.note !== undefined) updateData.note = body.note
    if (body.position !== undefined) updateData.position = body.position

    const { data: bookmark, error } = await supabase
      .from('paper_bookmark_items')
      .update(updateData)
      .eq('id', id)
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
      console.error('Error updating paper bookmark:', error)
      return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      bookmark
    })
  } catch (error) {
    console.error('PATCH /api/paper-bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/paper-bookmarks/items/[id]
 * Delete a paper bookmark
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ownership
    const { data: existing } = await supabase
      .from('paper_bookmark_items')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('paper_bookmark_items')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting paper bookmark:', error)
      return NextResponse.json({ error: 'Failed to delete bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('DELETE /api/paper-bookmarks/items/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { UpdatePaperBookmarkFolderRequest } from '@/types/paper-bookmarks'

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
 * GET /api/paper-bookmarks/folders/[id]
 * Get a single folder
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

    const { data: folder, error } = await supabase
      .from('paper_bookmark_folders')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      folder
    })
  } catch (error) {
    console.error('GET /api/paper-bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/paper-bookmarks/folders/[id]
 * Update a folder
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

    const body: UpdatePaperBookmarkFolderRequest = await request.json()

    // Check ownership
    const { data: existing } = await supabase
      .from('paper_bookmark_folders')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build update object
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.parent_id !== undefined) updateData.parent_id = body.parent_id
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.description !== undefined) updateData.description = body.description
    if (body.position !== undefined) updateData.position = body.position
    if (body.visibility !== undefined) updateData.visibility = body.visibility

    const { data: folder, error } = await supabase
      .from('paper_bookmark_folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating paper bookmark folder:', error)
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      folder
    })
  } catch (error) {
    console.error('PATCH /api/paper-bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/paper-bookmarks/folders/[id]
 * Delete a folder (items will have folder_id set to null)
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
      .from('paper_bookmark_folders')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete folder (items will have folder_id set to null due to ON DELETE SET NULL)
    const { error } = await supabase
      .from('paper_bookmark_folders')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting paper bookmark folder:', error)
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('DELETE /api/paper-bookmarks/folders/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

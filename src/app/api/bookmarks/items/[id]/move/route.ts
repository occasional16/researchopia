/**
 * PUT /api/bookmarks/items/[id]/move
 * Move a bookmark item to a different folder
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'

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

interface MoveRequest {
  folder_id: string | null // null = move to uncategorized
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body: MoveRequest = await request.json()
    const targetFolderId = body.folder_id

    // Verify bookmark exists and belongs to user
    const { data: item, error: fetchError } = await supabase
      .from('bookmark_items')
      .select('id, folder_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !item) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
    }

    // If same folder, no action needed
    if (item.folder_id === targetFolderId) {
      return NextResponse.json({ success: true, message: 'Already in this folder' })
    }

    // If moving to a folder, verify it exists and belongs to user
    if (targetFolderId !== null) {
      const { data: folder } = await supabase
        .from('bookmark_folders')
        .select('id')
        .eq('id', targetFolderId)
        .eq('user_id', user.id)
        .single()

      if (!folder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 })
      }
    }

    // Get max position in target folder
    const { data: siblings } = await supabase
      .from('bookmark_items')
      .select('position')
      .eq('user_id', user.id)
      .eq('folder_id', targetFolderId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = siblings?.[0]?.position !== undefined 
      ? siblings[0].position + 1 
      : 0

    // Update the item
    const { error: updateError } = await supabase
      .from('bookmark_items')
      .update({
        folder_id: targetFolderId,
        position: nextPosition
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      // Check for unique constraint violation (duplicate in same folder)
      if (updateError.code === '23505') {
        return NextResponse.json({ 
          error: 'This bookmark already exists in the target folder' 
        }, { status: 409 })
      }
      console.error('Error moving bookmark:', updateError)
      return NextResponse.json({ error: 'Failed to move bookmark' }, { status: 500 })
    }

    return NextResponse.json({ success: true, folder_id: targetFolderId })
  } catch (error) {
    console.error('PUT /api/bookmarks/items/[id]/move error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

/**
 * POST /api/bookmarks/items/batch/move
 * Batch move multiple bookmark items to a folder
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const { supabase, user } = await getSupabaseWithAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    // Parse request body
    const body = await req.json()
    const { item_ids, folder_id } = body as { 
      item_ids: string[]
      folder_id: string | null  // null = move to uncategorized
    }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'item_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (item_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 items can be moved at once' },
        { status: 400 }
      )
    }

    // If folder_id is provided, verify it exists and belongs to user
    if (folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from('bookmark_folders')
        .select('id')
        .eq('id', folder_id)
        .eq('user_id', userId)
        .single()

      if (folderError || !folder) {
        return NextResponse.json(
          { error: 'Folder not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Get max position in target folder
    const { data: maxPosData } = await supabase
      .from('bookmark_items')
      .select('position')
      .eq('user_id', userId)
      .eq('folder_id', folder_id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    let nextPosition = (maxPosData?.position || 0) + 1

    // Move items - update folder_id and assign new positions
    const updates = item_ids.map((id, index) => ({
      id,
      folder_id,
      position: nextPosition + index
    }))

    // Perform updates one by one (Supabase doesn't support batch update with different values)
    const results = []
    for (const update of updates) {
      const { data, error } = await supabase
        .from('bookmark_items')
        .update({ folder_id: update.folder_id, position: update.position })
        .eq('id', update.id)
        .eq('user_id', userId)
        .select('id')

      if (error) {
        console.error('Batch move error for item:', update.id, error)
      } else if (data && data.length > 0) {
        results.push(data[0].id)
      }
    }

    return NextResponse.json({
      success: true,
      moved_count: results.length,
      moved_ids: results,
      target_folder_id: folder_id
    })
  } catch (error) {
    console.error('Batch move error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

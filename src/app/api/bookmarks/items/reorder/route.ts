/**
 * PUT /api/bookmarks/items/reorder
 * Reorder bookmark items within a folder
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

interface ReorderItem {
  id: string
  position: number
}

interface ReorderRequest {
  folder_id: string | null // null = uncategorized
  items: ReorderItem[]
}

export async function PUT(request: NextRequest) {
  try {
    console.log('[reorder API] Starting...')
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      console.log('[reorder API] Unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[reorder API] User:', user.id)

    const body: ReorderRequest = await request.json()
    const { folder_id, items } = body
    console.log('[reorder API] Request:', { folder_id, itemCount: items?.length })

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 })
    }

    // Verify all items belong to user and are in the specified folder
    const itemIds = items.map(i => i.id)
    console.log('[reorder API] Checking items:', itemIds)
    
    const { data: existingItems, error: fetchError } = await supabase
      .from('bookmark_items')
      .select('id, folder_id')
      .eq('user_id', user.id)
      .in('id', itemIds)

    if (fetchError) {
      console.error('[reorder API] Error fetching items:', fetchError)
      return NextResponse.json({ error: 'Failed to verify items' }, { status: 500 })
    }
    console.log('[reorder API] Found items:', existingItems)

    // Check all items exist and belong to the same folder
    if (existingItems?.length !== items.length) {
      console.error('[reorder API] Item count mismatch:', existingItems?.length, 'vs', items.length)
      return NextResponse.json({ 
        error: 'Some items were not found or do not belong to you' 
      }, { status: 400 })
    }

    // Handle null folder_id comparison properly
    const targetFolderId = folder_id === undefined ? null : folder_id
    console.log('[reorder API] Target folder:', targetFolderId)
    const invalidItems = existingItems.filter(i => {
      // Both null means they match
      if (i.folder_id === null && targetFolderId === null) return false
      // Otherwise compare normally
      return i.folder_id !== targetFolderId
    })
    if (invalidItems.length > 0) {
      console.error('[reorder API] Invalid items found:', invalidItems, 'Expected folder_id:', targetFolderId)
      return NextResponse.json({ 
        error: 'All items must be in the same folder' 
      }, { status: 400 })
    }
    console.log('[reorder API] Validation passed, updating positions...')

    // Update positions in a batch
    const updates = items.map(item => 
      supabase
        .from('bookmark_items')
        .update({ 
          position: item.position
        })
        .eq('id', item.id)
        .eq('user_id', user.id)
    )

    const results = await Promise.all(updates)
    
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Errors updating positions:', errors.map(e => e.error))
      return NextResponse.json({ 
        error: 'Some items failed to update',
        failedCount: errors.length 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount: items.length 
    })
  } catch (error) {
    console.error('PUT /api/bookmarks/items/reorder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
 * DELETE /api/bookmarks/items/batch/delete
 * Batch delete multiple bookmark items
 */
export async function DELETE(req: NextRequest) {
  try {
    // Auth check
    const { supabase, user } = await getSupabaseWithAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    // Parse request body
    const body = await req.json()
    const { item_ids } = body as { item_ids: string[] }

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'item_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (item_ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 items can be deleted at once' },
        { status: 400 }
      )
    }

    // Delete items - RLS will ensure only user's items are deleted
    const { data, error } = await supabase
      .from('bookmark_items')
      .delete()
      .in('id', item_ids)
      .eq('user_id', userId)
      .select('id')

    if (error) {
      console.error('Batch delete error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      deleted_count: data?.length || 0,
      deleted_ids: data?.map(d => d.id) || []
    })
  } catch (error) {
    console.error('Batch delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

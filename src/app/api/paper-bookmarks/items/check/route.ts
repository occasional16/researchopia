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
 * GET /api/paper-bookmarks/items/check
 * Check if a paper is bookmarked by the current user
 * Returns all folders where the paper is bookmarked (supports multi-folder bookmarking)
 * Query params: paper_id
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ 
        success: true,
        isBookmarked: false,
        bookmarks: []
      })
    }

    const { searchParams } = new URL(request.url)
    const paperId = searchParams.get('paper_id')

    if (!paperId) {
      return NextResponse.json({ error: 'paper_id is required' }, { status: 400 })
    }

    // Query ALL bookmarks for this paper (not just single)
    const { data: bookmarks, error } = await supabase
      .from('paper_bookmark_items')
      .select(`
        id, 
        folder_id,
        folder:paper_bookmark_folders(id, name)
      `)
      .eq('user_id', user.id)
      .eq('paper_id', paperId)

    if (error) {
      console.error('Error checking paper bookmark:', error)
      return NextResponse.json({ error: 'Failed to check bookmark' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      isBookmarked: bookmarks && bookmarks.length > 0,
      bookmarks: bookmarks || []
    })
  } catch (error) {
    console.error('GET /api/paper-bookmarks/items/check error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

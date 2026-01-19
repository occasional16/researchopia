import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { BookmarkFolder, CreateFolderRequest } from '@/types/bookmarks'

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
 * GET /api/bookmarks/folders
 * Get user's bookmark folders (tree structure)
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all folders for this user
    const { data: folders, error } = await supabase
      .from('bookmark_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching folders:', error)
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    // Get item counts for each folder
    const folderIds = folders?.map(f => f.id) || []
    let itemCounts: Record<string, number> = {}
    
    if (folderIds.length > 0) {
      const { data: counts } = await supabase
        .from('bookmark_items')
        .select('folder_id')
        .eq('user_id', user.id)
        .in('folder_id', folderIds)

      if (counts) {
        counts.forEach(item => {
          if (item.folder_id) {
            itemCounts[item.folder_id] = (itemCounts[item.folder_id] || 0) + 1
          }
        })
      }
    }

    // Get uncategorized count (items with null folder_id)
    const { count: uncategorizedCount } = await supabase
      .from('bookmark_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('folder_id', null)

    // Add item counts to folders
    const foldersWithCounts = folders?.map(f => ({
      ...f,
      item_count: itemCounts[f.id] || 0
    })) || []

    // Build tree structure
    const tree = buildFolderTree(foldersWithCounts as BookmarkFolder[])

    return NextResponse.json({
      success: true,
      folders: tree,
      uncategorized_count: uncategorizedCount || 0
    })
  } catch (error) {
    console.error('GET /api/bookmarks/folders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/bookmarks/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateFolderRequest = await request.json()
    
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    // Get max position for this parent level
    const { data: existingFolders } = await supabase
      .from('bookmark_folders')
      .select('position')
      .eq('user_id', user.id)
      .eq('parent_id', body.parent_id || null)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existingFolders && existingFolders.length > 0 
      ? existingFolders[0].position + 1 
      : 0

    // Create folder
    const { data: folder, error } = await supabase
      .from('bookmark_folders')
      .insert({
        user_id: user.id,
        parent_id: body.parent_id || null,
        name: body.name.trim(),
        icon: body.icon || null,
        visibility: body.visibility || 'private',
        description: body.description || null,
        position: nextPosition
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Folder with this name already exists' }, { status: 409 })
      }
      console.error('Error creating folder:', error)
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      folder
    })
  } catch (error) {
    console.error('POST /api/bookmarks/folders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Build tree structure from flat folder list
 */
function buildFolderTree(folders: BookmarkFolder[]): BookmarkFolder[] {
  const folderMap = new Map<string, BookmarkFolder>()
  const roots: BookmarkFolder[] = []

  // First pass: create map
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // Second pass: build tree
  folders.forEach(folder => {
    const current = folderMap.get(folder.id)!
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      const parent = folderMap.get(folder.parent_id)!
      parent.children = parent.children || []
      parent.children.push(current)
    } else {
      roots.push(current)
    }
  })

  return roots
}

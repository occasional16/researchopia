import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import type { PaperBookmarkFolder, CreatePaperBookmarkFolderRequest } from '@/types/paper-bookmarks'

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
 * Build folder tree from flat list
 */
function buildFolderTree(folders: PaperBookmarkFolder[]): PaperBookmarkFolder[] {
  const folderMap = new Map<string, PaperBookmarkFolder>()
  const roots: PaperBookmarkFolder[] = []

  // First pass: create map
  folders.forEach(folder => {
    folderMap.set(folder.id, { ...folder, children: [] })
  })

  // Second pass: build tree
  folders.forEach(folder => {
    const node = folderMap.get(folder.id)!
    if (folder.parent_id) {
      const parent = folderMap.get(folder.parent_id)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

/**
 * GET /api/paper-bookmarks/folders
 * Get user's paper bookmark folders (tree structure)
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all folders for this user
    const { data: folders, error } = await supabase
      .from('paper_bookmark_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching paper bookmark folders:', error)
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    // Get item counts for each folder
    const folderIds = folders?.map(f => f.id) || []
    let itemCounts: Record<string, number> = {}
    
    if (folderIds.length > 0) {
      const { data: counts } = await supabase
        .from('paper_bookmark_items')
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
      .from('paper_bookmark_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('folder_id', null)

    // Add item counts to folders
    const foldersWithCounts = folders?.map(f => ({
      ...f,
      item_count: itemCounts[f.id] || 0
    })) || []

    // Build tree structure
    const tree = buildFolderTree(foldersWithCounts as PaperBookmarkFolder[])

    return NextResponse.json({
      success: true,
      folders: tree,
      uncategorized_count: uncategorizedCount || 0
    })
  } catch (error) {
    console.error('GET /api/paper-bookmarks/folders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/paper-bookmarks/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreatePaperBookmarkFolderRequest = await request.json()
    
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    // Get max position for new folder
    const { data: maxPosData } = await supabase
      .from('paper_bookmark_folders')
      .select('position')
      .eq('user_id', user.id)
      .is('parent_id', body.parent_id || null)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPosData?.position || 0) + 1

    const { data: folder, error } = await supabase
      .from('paper_bookmark_folders')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        parent_id: body.parent_id || null,
        icon: body.icon || null,
        description: body.description || null,
        visibility: body.visibility || 'private',
        position: newPosition
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating paper bookmark folder:', error)
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      folder
    })
  } catch (error) {
    console.error('POST /api/paper-bookmarks/folders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

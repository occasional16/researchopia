/**
 * GET /api/bookmarks/export
 * Export bookmarks as HTML file (Netscape Bookmark format)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import { 
  generateBookmarkHtml, 
  type ExportFolder, 
  type ExportBookmark 
} from '@/lib/bookmarks/server-parser'

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

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id') // Export specific folder only
    const format = searchParams.get('format') || 'html' // html or json

    // Get all folders for user
    const { data: folders, error: foldersError } = await supabase
      .from('bookmark_folders')
      .select('id, name, parent_id, created_at, position')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (foldersError) {
      console.error('Error fetching folders:', foldersError)
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    // Get all bookmark items with webpage data
    const { data: items, error: itemsError } = await supabase
      .from('bookmark_items')
      .select(`
        id,
        folder_id,
        custom_title,
        created_at,
        position,
        webpage:webpages(url, title)
      `)
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Build folder tree
    const folderMap = new Map<string, ExportFolder>()
    const rootFolders: ExportFolder[] = []
    const rootBookmarks: ExportBookmark[] = []

    // Create folder objects
    folders?.forEach(f => {
      folderMap.set(f.id, {
        name: f.name,
        created_at: f.created_at,
        children: []
      })
    })

    // Build hierarchy - add child folders to parents
    folders?.forEach(f => {
      const folder = folderMap.get(f.id)!
      if (f.parent_id && folderMap.has(f.parent_id)) {
        folderMap.get(f.parent_id)!.children.push(folder)
      } else {
        rootFolders.push(folder)
      }
    })

    // Add bookmarks to their folders
    items?.forEach(item => {
      // webpage is returned as array by Supabase, get first element
      const webpage = Array.isArray(item.webpage) ? item.webpage[0] : item.webpage
      const bookmark: ExportBookmark = {
        title: item.custom_title || webpage?.title || 'Untitled',
        url: webpage?.url || '',
        created_at: item.created_at
      }

      if (item.folder_id && folderMap.has(item.folder_id)) {
        folderMap.get(item.folder_id)!.children.push(bookmark)
      } else {
        rootBookmarks.push(bookmark)
      }
    })

    // If specific folder requested, filter
    let exportFolders = rootFolders
    let exportBookmarks = rootBookmarks

    if (folderId) {
      if (folderId === 'uncategorized') {
        exportFolders = []
        // rootBookmarks is already items without folder
      } else if (folderMap.has(folderId)) {
        exportFolders = [folderMap.get(folderId)!]
        exportBookmarks = []
      } else {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: {
          folders: exportFolders,
          uncategorized: exportBookmarks,
          exportedAt: new Date().toISOString(),
          totalFolders: folders?.length || 0,
          totalBookmarks: items?.length || 0
        }
      })
    }

    // Generate HTML
    const html = generateBookmarkHtml(exportFolders, exportBookmarks)

    // Return as downloadable file
    const filename = folderId 
      ? `bookmarks-${folderId}.html`
      : `bookmarks-${new Date().toISOString().split('T')[0]}.html`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('GET /api/bookmarks/export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/bookmarks/import
 * Import bookmarks from HTML file (Netscape Bookmark format)
 * 
 * Strategy: All imported bookmarks go into a timestamped "Import" folder
 * to avoid interfering with existing bookmarks. Users can then manually
 * organize them as needed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClientWithToken } from '@/lib/supabase-server'
import { 
  parseBookmarkHtml, 
  isFolder,
  type ParsedFolder, 
  type ParsedBookmark 
} from '@/lib/bookmarks/server-parser'
import crypto from 'crypto'

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

interface ImportStats {
  foldersCreated: number
  bookmarksCreated: number
  bookmarksSkipped: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data or JSON
    const contentType = request.headers.get('content-type') || ''
    
    let htmlContent: string
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      
      htmlContent = await file.text()
    } else {
      // JSON body
      const body = await request.json()
      htmlContent = body.html
      
      if (!htmlContent) {
        return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 })
      }
    }

    // Parse HTML
    const parseResult = parseBookmarkHtml(htmlContent)
    
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: 'Failed to parse bookmark file',
        details: parseResult.error 
      }, { status: 400 })
    }

    // Initialize stats
    const stats: ImportStats = {
      foldersCreated: 0,
      bookmarksCreated: 0,
      bookmarksSkipped: 0,
      errors: []
    }

    // Create root "Import" folder with timestamp
    const now = new Date()
    const timestamp = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-')
    
    const importFolderName = `导入 ${timestamp}`

    // Get max position at root level
    const { data: rootSiblings } = await supabase
      .from('bookmark_folders')
      .select('position')
      .eq('user_id', user.id)
      .is('parent_id', null)
      .order('position', { ascending: false })
      .limit(1)

    const rootNextPosition = rootSiblings?.[0]?.position !== undefined 
      ? rootSiblings[0].position + 1 
      : 0

    // Create the import root folder
    const { data: importRootFolder, error: createRootError } = await supabase
      .from('bookmark_folders')
      .insert({
        user_id: user.id,
        name: importFolderName,
        parent_id: null,
        position: rootNextPosition,
        visibility: 'private'
      })
      .select('id')
      .single()

    if (createRootError) {
      return NextResponse.json({ 
        error: 'Failed to create import folder',
        details: createRootError.message 
      }, { status: 500 })
    }

    stats.foldersCreated++
    const importRootId = importRootFolder.id

    // Track created webpages to avoid duplicate inserts
    const urlHashMap = new Map<string, string>()

    // Fetch existing webpages first
    const { data: existingWebpages } = await supabase
      .from('webpages')
      .select('id, url_hash')

    existingWebpages?.forEach(w => {
      urlHashMap.set(w.url_hash, w.id)
    })

    // Position counter per folder
    const folderPositions = new Map<string | null, number>()

    // Get or increment position for a folder
    const getNextPosition = (folderId: string | null): number => {
      const current = folderPositions.get(folderId) || 0
      folderPositions.set(folderId, current + 1)
      return current
    }

    // Recursive function to import folder and its contents
    const importFolder = async (
      folder: ParsedFolder, 
      parentId: string
    ): Promise<string | null> => {
      try {
        // Create folder
        const { data: newFolder, error } = await supabase
          .from('bookmark_folders')
          .insert({
            user_id: user.id,
            name: folder.name.slice(0, 100), // Max 100 chars
            parent_id: parentId,
            position: getNextPosition(parentId),
            visibility: 'private'
          })
          .select('id')
          .single()

        if (error) {
          stats.errors.push(`Failed to create folder "${folder.name}": ${error.message}`)
          return null
        }

        stats.foldersCreated++
        const folderId = newFolder.id

        // Import children
        for (const child of folder.children) {
          if (isFolder(child)) {
            await importFolder(child, folderId)
          } else {
            await importBookmark(child, folderId)
          }
        }

        return folderId
      } catch (error) {
        stats.errors.push(`Error importing folder "${folder.name}": ${error}`)
        return null
      }
    }

    // Import a single bookmark
    const importBookmark = async (
      bookmark: ParsedBookmark, 
      folderId: string
    ): Promise<void> => {
      try {
        // Skip invalid URLs
        if (!bookmark.url || bookmark.url.startsWith('javascript:')) {
          return
        }

        // Normalize URL
        let url = bookmark.url.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url
        }

        // Generate URL hash
        const urlHash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 16)

        // Check/create webpage
        let webpageId = urlHashMap.get(urlHash)

        if (!webpageId) {
          const { data: newWebpage, error } = await supabase
            .from('webpages')
            .insert({
              url,
              url_hash: urlHash,
              title: bookmark.title.slice(0, 500) || null, // Max 500 chars
              first_submitted_by: user.id
            })
            .select('id')
            .single()

          if (error) {
            stats.errors.push(`Failed to create webpage for "${bookmark.url}": ${error.message}`)
            return
          }

          if (!newWebpage?.id) {
            stats.errors.push(`Failed to get webpage ID for "${bookmark.url}"`)
            return
          }

          webpageId = newWebpage.id
          urlHashMap.set(urlHash, newWebpage.id)
        }

        // Create bookmark item (duplicates within import folder are allowed)
        const { error } = await supabase
          .from('bookmark_items')
          .insert({
            user_id: user.id,
            webpage_id: webpageId,
            folder_id: folderId,
            custom_title: bookmark.title.slice(0, 500) || null,
            position: getNextPosition(folderId)
          })

        if (error) {
          if (error.code === '23505') {
            // Unique constraint - already exists in this folder
            stats.bookmarksSkipped++
          } else {
            stats.errors.push(`Failed to create bookmark for "${bookmark.url}": ${error.message}`)
          }
          return
        }

        stats.bookmarksCreated++
      } catch (error) {
        stats.errors.push(`Error importing bookmark "${bookmark.url}": ${error}`)
      }
    }

    // Import all parsed content into the import folder

    // Import folders from the parsed tree
    for (const folder of parseResult.rootFolders) {
      await importFolder(folder, importRootId)
    }

    // Import uncategorized bookmarks directly into import root folder
    for (const bookmark of parseResult.uncategorizedBookmarks) {
      await importBookmark(bookmark, importRootId)
    }

    return NextResponse.json({
      success: true,
      importFolderId: importRootId,
      importFolderName,
      stats: {
        parsed: {
          folders: parseResult.totalFolders,
          bookmarks: parseResult.totalBookmarks
        },
        imported: {
          foldersCreated: stats.foldersCreated,
          bookmarksCreated: stats.bookmarksCreated,
          bookmarksSkipped: stats.bookmarksSkipped
        },
        errors: stats.errors.slice(0, 20) // Limit error messages
      }
    })
  } catch (error) {
    console.error('POST /api/bookmarks/import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

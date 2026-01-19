/**
 * Server-side Bookmark Import/Export Parser
 * Uses regex-based parsing instead of DOMParser (which is browser-only)
 */

export interface ParsedBookmark {
  title: string
  url: string
  addDate?: number
  icon?: string
}

export interface ParsedFolder {
  name: string
  addDate?: number
  children: (ParsedFolder | ParsedBookmark)[]
}

export interface ParseResult {
  success: boolean
  error?: string
  rootFolders: ParsedFolder[]
  uncategorizedBookmarks: ParsedBookmark[]
  totalFolders: number
  totalBookmarks: number
}

/**
 * Check if an item is a folder
 */
export function isFolder(item: ParsedFolder | ParsedBookmark): item is ParsedFolder {
  return 'children' in item
}

/**
 * Parse Netscape Bookmark HTML file (server-side compatible)
 * This uses a simple state machine approach to parse the hierarchical structure
 */
export function parseBookmarkHtml(html: string): ParseResult {
  const result: ParseResult = {
    success: false,
    rootFolders: [],
    uncategorizedBookmarks: [],
    totalFolders: 0,
    totalBookmarks: 0
  }

  try {
    // Normalize line endings and remove extra whitespace
    const content = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Parse the tree structure
    const { folders, bookmarks } = parseContent(content)
    
    result.rootFolders = folders
    result.uncategorizedBookmarks = bookmarks
    result.totalFolders = countFolders(folders)
    result.totalBookmarks = bookmarks.length + countBookmarksInFolders(folders)
    result.success = true

    return result
  } catch (error) {
    result.error = `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
    return result
  }
}

/**
 * Parse the bookmark content using regex patterns
 */
function parseContent(content: string): { folders: ParsedFolder[], bookmarks: ParsedBookmark[] } {
  const rootFolders: ParsedFolder[] = []
  const rootBookmarks: ParsedBookmark[] = []
  
  // Stack to track folder hierarchy
  const folderStack: ParsedFolder[] = []
  
  // Split by lines for simpler processing
  const lines = content.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Match folder start: <DT><H3 ...>Folder Name</H3>
    const folderMatch = line.match(/<DT><H3[^>]*(?:ADD_DATE="(\d+)")?[^>]*>([^<]*)<\/H3>/i)
    if (folderMatch) {
      const folder: ParsedFolder = {
        name: decodeHtmlEntities(folderMatch[2].trim()),
        addDate: folderMatch[1] ? parseInt(folderMatch[1], 10) : undefined,
        children: []
      }
      
      // Add to parent or root
      if (folderStack.length > 0) {
        folderStack[folderStack.length - 1].children.push(folder)
      } else {
        rootFolders.push(folder)
      }
      
      folderStack.push(folder)
      continue
    }
    
    // Match bookmark: <DT><A HREF="..." ...>Title</A>
    const bookmarkMatch = line.match(/<DT><A\s+HREF="([^"]*)"[^>]*(?:ADD_DATE="(\d+)")?[^>]*(?:ICON="([^"]*)")?[^>]*>([^<]*)<\/A>/i)
    if (bookmarkMatch) {
      const bookmark: ParsedBookmark = {
        url: decodeHtmlEntities(bookmarkMatch[1]),
        title: decodeHtmlEntities(bookmarkMatch[4].trim()),
        addDate: bookmarkMatch[2] ? parseInt(bookmarkMatch[2], 10) : undefined,
        icon: bookmarkMatch[3] || undefined
      }
      
      // Skip invalid URLs
      if (!bookmark.url || bookmark.url.startsWith('javascript:')) {
        continue
      }
      
      // Add to current folder or root
      if (folderStack.length > 0) {
        folderStack[folderStack.length - 1].children.push(bookmark)
      } else {
        rootBookmarks.push(bookmark)
      }
      continue
    }
    
    // Match folder end: </DL><p>
    if (line.match(/<\/DL>/i)) {
      if (folderStack.length > 0) {
        folderStack.pop()
      }
    }
  }
  
  return { folders: rootFolders, bookmarks: rootBookmarks }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

/**
 * Count total folders in a folder tree
 */
function countFolders(folders: ParsedFolder[]): number {
  let count = folders.length
  for (const folder of folders) {
    const childFolders = folder.children.filter(isFolder) as ParsedFolder[]
    count += countFolders(childFolders)
  }
  return count
}

/**
 * Count total bookmarks in a folder tree
 */
function countBookmarksInFolders(folders: ParsedFolder[]): number {
  let count = 0
  for (const folder of folders) {
    for (const child of folder.children) {
      if (isFolder(child)) {
        count += countBookmarksInFolders([child])
      } else {
        count++
      }
    }
  }
  return count
}

// ============================================================================
// Export Functions
// ============================================================================

export interface ExportBookmark {
  title: string
  url: string
  created_at?: string
}

export interface ExportFolder {
  name: string
  created_at?: string
  children: (ExportFolder | ExportBookmark)[]
}

/**
 * Check if an export item is a folder
 */
export function isExportFolder(item: ExportFolder | ExportBookmark): item is ExportFolder {
  return 'children' in item
}

/**
 * Generate Netscape Bookmark HTML file
 */
export function generateBookmarkHtml(folders: ExportFolder[], uncategorized: ExportBookmark[]): string {
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. -->',
    '<!-- Exported from Researchopia (www.researchopia.com) -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ]

  // Add folders
  for (const folder of folders) {
    lines.push(...generateFolderHtml(folder, 1))
  }

  // Add uncategorized bookmarks at root level
  for (const bookmark of uncategorized) {
    lines.push(...generateBookmarkItemHtml(bookmark, 1))
  }

  lines.push('</DL><p>')

  return lines.join('\n')
}

/**
 * Generate HTML for a folder
 */
function generateFolderHtml(folder: ExportFolder, depth: number): string[] {
  const indent = '    '.repeat(depth)
  const lines: string[] = []

  const addDate = folder.created_at 
    ? Math.floor(new Date(folder.created_at).getTime() / 1000) 
    : Math.floor(Date.now() / 1000)

  lines.push(`${indent}<DT><H3 ADD_DATE="${addDate}">${escapeHtml(folder.name)}</H3>`)
  lines.push(`${indent}<DL><p>`)

  for (const child of folder.children) {
    if (isExportFolder(child)) {
      lines.push(...generateFolderHtml(child, depth + 1))
    } else {
      lines.push(...generateBookmarkItemHtml(child, depth + 1))
    }
  }

  lines.push(`${indent}</DL><p>`)

  return lines
}

/**
 * Generate HTML for a bookmark
 */
function generateBookmarkItemHtml(bookmark: ExportBookmark, depth: number): string[] {
  const indent = '    '.repeat(depth)
  
  const addDate = bookmark.created_at 
    ? Math.floor(new Date(bookmark.created_at).getTime() / 1000) 
    : Math.floor(Date.now() / 1000)

  return [
    `${indent}<DT><A HREF="${escapeHtml(bookmark.url)}" ADD_DATE="${addDate}">${escapeHtml(bookmark.title)}</A>`
  ]
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

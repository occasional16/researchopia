/**
 * Bookmark Import/Export Parser
 * Handles parsing and generating Netscape Bookmark HTML format
 * (Used by Chrome, Edge, Firefox, Safari)
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
 * Parse Netscape Bookmark HTML file
 * This format is used by Chrome, Edge, Firefox, and Safari
 */
export function parseBookmarkHtml(html: string): ParseResult {
  const result: ParseResult = {
    success: false,
    rootFolders: [],
    totalFolders: 0,
    totalBookmarks: 0
  }

  try {
    // Create a DOM parser
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Find the main DL element (bookmark list)
    const mainDl = doc.querySelector('DL')
    if (!mainDl) {
      result.error = 'Invalid bookmark file format: no DL element found'
      return result
    }

    // Parse the bookmark tree
    const { folders, bookmarks } = parseBookmarkList(mainDl)
    
    result.rootFolders = folders
    result.totalFolders = countFolders(folders)
    result.totalBookmarks = bookmarks + countBookmarksInFolders(folders)
    result.success = true

    return result
  } catch (error) {
    result.error = `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`
    return result
  }
}

/**
 * Parse a DL (definition list) element containing bookmarks
 */
function parseBookmarkList(dl: Element): { folders: ParsedFolder[], bookmarks: number } {
  const folders: ParsedFolder[] = []
  let bookmarkCount = 0
  
  // Get direct DT children
  const items = Array.from(dl.children).filter(el => el.tagName === 'DT')

  for (const dt of items) {
    const h3 = dt.querySelector(':scope > H3')
    const a = dt.querySelector(':scope > A')

    if (h3) {
      // This is a folder
      const folder: ParsedFolder = {
        name: h3.textContent?.trim() || 'Untitled Folder',
        addDate: parseInt(h3.getAttribute('ADD_DATE') || '0', 10) || undefined,
        children: []
      }

      // Find nested DL for children
      const nestedDl = dt.querySelector(':scope > DL')
      if (nestedDl) {
        const { folders: childFolders, bookmarks: childBookmarks } = parseBookmarkList(nestedDl)
        
        // Get direct bookmarks in this folder
        const directBookmarks = getDirectBookmarks(nestedDl)
        
        folder.children = [...childFolders, ...directBookmarks]
        bookmarkCount += childBookmarks
      }

      folders.push(folder)
    } else if (a) {
      // This is a root-level bookmark (outside folders)
      // We'll skip these as they should be in "Uncategorized"
      bookmarkCount++
    }
  }

  return { folders, bookmarks: bookmarkCount }
}

/**
 * Get direct bookmark links from a DL element
 */
function getDirectBookmarks(dl: Element): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []
  const items = Array.from(dl.children).filter(el => el.tagName === 'DT')

  for (const dt of items) {
    const a = dt.querySelector(':scope > A')
    const h3 = dt.querySelector(':scope > H3')

    // Only process bookmarks (A tags), not folders (H3 tags)
    if (a && !h3) {
      const bookmark: ParsedBookmark = {
        title: a.textContent?.trim() || 'Untitled',
        url: a.getAttribute('HREF') || '',
        addDate: parseInt(a.getAttribute('ADD_DATE') || '0', 10) || undefined,
        icon: a.getAttribute('ICON') || undefined
      }
      
      if (bookmark.url) {
        bookmarks.push(bookmark)
      }
    }
  }

  return bookmarks
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
    '<!-- It will be read and overwritten. DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ]

  // Add folders
  for (const folder of folders) {
    lines.push(...generateFolderHtml(folder, 1))
  }

  // Add uncategorized bookmarks
  if (uncategorized.length > 0) {
    const indent = '    '
    lines.push(`${indent}<DT><H3>Uncategorized</H3>`)
    lines.push(`${indent}<DL><p>`)
    for (const bookmark of uncategorized) {
      lines.push(...generateBookmarkItemHtml(bookmark, 2))
    }
    lines.push(`${indent}</DL><p>`)
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
 * Generate HTML for a bookmark item
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

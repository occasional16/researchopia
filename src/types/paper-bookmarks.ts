/**
 * Paper Bookmark system types
 * For paper bookmarks with nested folder support
 */

export interface PaperBookmarkFolder {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  icon?: string | null
  description?: string | null
  position: number
  visibility: 'private' | 'public' | 'shared'
  share_code?: string | null
  created_at: string
  updated_at: string
  // Frontend extensions
  children?: PaperBookmarkFolder[]
  items?: PaperBookmarkItem[]
  item_count?: number
}

export interface PaperBookmarkItem {
  id: string
  user_id: string
  paper_id: string
  folder_id: string | null
  custom_title?: string | null
  note?: string | null
  position: number
  created_at: string
  updated_at: string
  // Joined data from papers table
  paper?: {
    id: string
    doi: string | null
    title: string
    authors: string[]
    abstract: string | null
    journal: string | null
    publication_date: string | null
    average_rating: number
    ratings_count: number
    comments_count: number
  }
}

export interface CreatePaperBookmarkFolderRequest {
  name: string
  parent_id?: string | null
  icon?: string
  description?: string
  visibility?: 'private' | 'public' | 'shared'
}

export interface UpdatePaperBookmarkFolderRequest {
  name?: string
  parent_id?: string | null
  icon?: string | null
  description?: string | null
  position?: number
  visibility?: 'private' | 'public' | 'shared'
}

export interface CreatePaperBookmarkRequest {
  paper_id: string
  folder_id?: string | null
  custom_title?: string
  note?: string
}

export interface UpdatePaperBookmarkRequest {
  folder_id?: string | null
  custom_title?: string | null
  note?: string | null
  position?: number
}

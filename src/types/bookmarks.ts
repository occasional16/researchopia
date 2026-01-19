/**
 * Bookmark system types
 * For webpage bookmarks with nested folder support
 */

export interface BookmarkFolder {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  icon?: string | null
  position: number
  visibility: 'private' | 'public' | 'shared'
  share_code?: string | null
  description?: string | null
  created_at: string
  updated_at: string
  // Frontend extensions
  children?: BookmarkFolder[]
  items?: BookmarkItem[]
  item_count?: number
}

export interface BookmarkItem {
  id: string
  user_id: string
  webpage_id: string
  folder_id: string | null
  custom_title?: string | null
  note?: string | null
  position: number
  created_at: string
  // Joined data
  webpage?: {
    id: string
    url: string
    url_hash: string
    title: string | null
    favicon_url: string | null
    description?: string | null
  }
}

export interface WebpageLink {
  id: string
  source_webpage_id: string
  target_webpage_id: string
  link_type: LinkType
  note?: string | null
  created_by: string
  created_at: string
  // Joined data (based on direction)
  source_webpage?: {
    id: string
    url: string
    url_hash: string
    title: string | null
    favicon_url: string | null
  }
  target_webpage?: {
    id: string
    url: string
    url_hash: string
    title: string | null
    favicon_url: string | null
  }
}

export type LinkType = 'related' | 'cite' | 'respond' | 'review' | 'derive'

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  related: '相关',
  cite: '引用',
  respond: '回应',
  review: '评述',
  derive: '衍生'
}

export const LINK_TYPE_COLORS: Record<LinkType, string> = {
  related: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cite: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  respond: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  review: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  derive: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
}

export const LINK_TYPE_DESCRIPTIONS: Record<LinkType, string> = {
  related: '与目标网页相关',
  cite: '引用了目标网页的内容',
  respond: '回应了目标网页的观点',
  review: '评述/评论了目标网页',
  derive: '衍生自目标网页（如翻译、改编）'
}

export type FolderVisibility = 'private' | 'public' | 'shared'

export const VISIBILITY_LABELS: Record<FolderVisibility, string> = {
  private: '私密',
  public: '公开',
  shared: '分享'
}

export const VISIBILITY_ICONS: Record<FolderVisibility, string> = {
  private: '🔒',
  public: '🌍',
  shared: '🔗'
}

// API request/response types
export interface CreateFolderRequest {
  name: string
  parent_id?: string | null
  icon?: string
  visibility?: FolderVisibility
  description?: string
}

export interface UpdateFolderRequest {
  name?: string
  parent_id?: string | null
  icon?: string | null
  position?: number
  visibility?: FolderVisibility
  description?: string | null
}

export interface CreateBookmarkRequest {
  url: string
  title?: string
  folder_id?: string | null
  custom_title?: string
  note?: string
}

export interface UpdateBookmarkRequest {
  folder_id?: string | null
  custom_title?: string | null
  note?: string | null
  position?: number
}

export interface CreateLinkRequest {
  target_url_hash: string  // or target_url
  target_url?: string
  link_type: LinkType
  note?: string
}

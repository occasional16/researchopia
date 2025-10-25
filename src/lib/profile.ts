import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 用户资料类型定义
export interface UserProfile {
  id: string
  username: string
  email?: string | null
  avatar_url?: string | null
  role: string
  created_at: string
  updated_at: string
  
  // 学术身份
  real_name?: string | null
  institution?: string | null
  department?: string | null
  position?: string | null
  research_fields: string[]
  
  // 学术标识
  orcid?: string | null
  google_scholar_id?: string | null
  researchgate_id?: string | null
  
  // 个人信息
  bio?: string | null
  website?: string | null
  location?: string | null
  
  // 隐私设置
  profile_visibility?: 'public' | 'followers' | 'private' | null
  show_email?: boolean | null
  show_institution?: boolean | null
  
  // 统计信息
  stats: UserStats
  
  // 关系状态
  isOwner: boolean
  isFollowing: boolean
}

export interface UserStats {
  papers_count: number
  annotations_count: number
  comments_count: number
  ratings_count: number
  favorites_count: number
  followers_count: number
  following_count: number
  avg_rating?: number
  quality_annotations_count?: number
}

export interface UpdateProfileData {
  real_name?: string
  institution?: string
  department?: string
  position?: string
  research_fields?: string[]
  orcid?: string
  google_scholar_id?: string
  researchgate_id?: string
  bio?: string
  website?: string
  location?: string
  profile_visibility?: 'public' | 'followers' | 'private'
  show_email?: boolean
  show_institution?: boolean
}

/**
 * 获取用户资料
 */
export async function getUserProfile(
  username: string,
  accessToken?: string
): Promise<UserProfile | null> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(`/api/users/${username}/profile`, {
      headers
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch profile')
    }

    const data = await response.json()
    return data.profile
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

/**
 * 更新用户资料
 */
export async function updateUserProfile(
  username: string,
  profileData: UpdateProfileData,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/users/${username}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(profileData)
    })

    if (!response.ok) {
      throw new Error('Failed to update profile')
    }

    return true
  } catch (error) {
    console.error('Error updating user profile:', error)
    return false
  }
}

/**
 * 获取用户的最新论文
 */
export async function getUserPapers(
  userId: string,
  limit: number = 5
) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching user papers:', error)
    return []
  }

  return data || []
}

/**
 * 获取用户的热门标注
 */
export async function getUserTopAnnotations(
  userId: string,
  limit: number = 5
) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  const { data, error } = await supabase
    .from('annotations')
    .select(`
      *,
      documents:document_id (
        title,
        paper_id
      )
    `)
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .order('likes_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching user annotations:', error)
    return []
  }

  return data || []
}

/**
 * 获取用户的最新评论
 */
export async function getUserRecentComments(
  userId: string,
  limit: number = 5
) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      paper:paper_id (
        title
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching user comments:', error)
    return []
  }

  return data || []
}

/**
 * 验证用户名是否可用
 */
export async function checkUsernameAvailability(
  username: string,
  currentUserId?: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
  let query = supabase
    .from('users')
    .select('id')
    .eq('username', username)

  if (currentUserId) {
    query = query.neq('id', currentUserId)
  }

  const { data, error } = await query.single()

  if (error && error.code === 'PGRST116') {
    // 没有找到，用户名可用
    return true
  }

  return !data
}

/**
 * 格式化研究领域标签
 */
export function formatResearchFields(fields: string[]): string {
  if (!fields || fields.length === 0) {
    return '未设置研究领域'
  }
  return fields.map(field => `#${field}`).join(' ')
}

/**
 * 格式化统计数字
 */
export function formatStatNumber(num: number | undefined | null): string {
  // 处理未定义或null的情况
  if (num === undefined || num === null || isNaN(num)) {
    return '0'
  }
  
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}


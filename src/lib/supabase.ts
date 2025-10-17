import { createClient } from '@supabase/supabase-js'

// 创建客户端Supabase客户端的函数
export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce'
    }
  })
}

// 懒加载的客户端
let _supabase: any | null = null

export function getSupabase() {
  if (_supabase === null) {
    _supabase = createSupabaseClient()
  }
  return _supabase
}

// 向后兼容的导出
export const supabase = getSupabase()

// Types for our database tables
export interface User {
  id: string
  email: string
  username: string
  avatar_url?: string
  role: 'user' | 'admin' | 'moderator'
  created_at: string
  updated_at: string
}

export interface Paper {
  id: string
  title: string
  authors: string[]
  doi?: string
  abstract?: string
  keywords: string[]
  publication_date?: string
  journal?: string
  view_count?: number
  created_at: string
  updated_at: string
  created_by: string
}

export interface Rating {
  id: string
  user_id: string
  paper_id: string
  innovation_score: number
  methodology_score: number
  practicality_score: number
  overall_score: number
  is_anonymous?: boolean // 🆕 是否匿名评分
  show_username?: boolean // 🆕 是否显示用户名(可随时切换)
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  user_id: string
  paper_id: string
  content: string
  created_at: string
  updated_at: string
  user?: User
}

export interface PaperReport {
  id: string
  paper_id: string
  title: string
  url: string
  source: 'wechat' | 'news' | 'blog' | 'other'
  author?: string
  publish_date?: string
  description?: string
  thumbnail_url?: string
  view_count: number
  created_at: string
  updated_at: string
  created_by?: string
  contributor_name?: string  // 贡献者昵称
  contribution_type?: string  // 贡献类型：'智能爬取' | '手动添加'
}

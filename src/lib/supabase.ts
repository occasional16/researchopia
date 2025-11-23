import { createClient } from '@supabase/supabase-js'
import type {
  User as SharedUser,
  Paper as SharedPaper,
  Rating as SharedRating,
  Comment as SharedComment,
  PaperWithStats,
} from '@researchopia/shared/types'

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

// ========== 类型定义：使用共享库类型 ==========

// 基础类型：直接使用共享库
export type User = SharedUser;
export type Paper = SharedPaper;
export type Comment = SharedComment;

// 扩展类型：添加项目特定字段
export interface Rating extends SharedRating {
  innovation_score?: number;
  methodology_score?: number;
  practicality_score?: number;
  is_anonymous?: boolean;
  show_username?: boolean;
}

// 重新导出共享类型
export type { PaperWithStats }

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

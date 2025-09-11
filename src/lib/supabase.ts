import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create Supabase client if environment variables are provided
// Otherwise, the app will use Mock mode
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce'
      }
    })
  : null

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

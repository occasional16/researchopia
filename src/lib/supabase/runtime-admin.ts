/**
 * Runtime Supabase Admin Client
 * 
 * This module provides a Supabase admin client that reads environment variables
 * at runtime instead of at module load time. This is required for Cloudflare Workers
 * where environment variables are not available at module load time.
 * 
 * Usage:
 * ```typescript
 * import { getSupabaseAdmin } from '@/lib/supabase/runtime-admin'
 * 
 * export async function GET() {
 *   const supabase = getSupabaseAdmin()
 *   // ... use supabase client
 * }
 * ```
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Get Supabase admin client with service role key
 * Reads environment variables at runtime (not at module load time)
 */
export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get Supabase anon client
 * Reads environment variables at runtime (not at module load time)
 */
export function getSupabaseAnon(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Get Supabase client with user token for authenticated requests
 * Reads environment variables at runtime (not at module load time)
 */
export function getSupabaseWithToken(token: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

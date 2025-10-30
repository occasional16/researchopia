import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 创建Anon客户端(用于常规操作)
 */
export function createAnonClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * 创建Admin客户端(用于管理员操作)
 */
export function createAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role key');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * 使用用户token创建客户端
 */
export function createClientWithToken(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
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
  });
}

// 创建服务端 Supabase 客户端的函数(向后兼容)
export function createSupabaseServerClient() {
  return createAdminClient();
}

// 懒加载的服务端客户端
let _supabaseServer: any | null = null

export function getSupabaseServer() {
  if (!_supabaseServer) {
    _supabaseServer = createSupabaseServerClient()
  }
  return _supabaseServer
}

// 向后兼容的导出（使用getter）
export const supabaseServer = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabaseServer()[prop as keyof ReturnType<typeof createClient>]
  }
})

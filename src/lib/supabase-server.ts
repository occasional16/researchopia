import { createClient } from '@supabase/supabase-js'

// 创建服务端 Supabase 客户端的函数
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for server-side operations')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
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

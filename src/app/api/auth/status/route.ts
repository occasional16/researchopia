import { NextRequest, NextResponse } from 'next/server'
import { withSecurity } from '@/middleware/security'
import { createClient } from '@supabase/supabase-js'

// 强制动态渲染(消除build警告)
export const dynamic = 'force-dynamic'

// Enhanced auth status for Zotero plugin
// - Returns authenticated based on presence of Supabase cookies or dev cookies
// - Attempts to validate Supabase session if available
// - Supplies appropriate tokens for local annotation APIs
export const GET = withSecurity(async (req: NextRequest) => {
  try {
    const cookie = req.headers.get('cookie') || ''
    const origin = req.headers.get('origin') || 'no-origin'
    const userAgent = req.headers.get('user-agent') || 'no-user-agent'

    console.log('🔍 检查认证状态')
    console.log('  Origin:', origin)
    console.log('  User-Agent:', userAgent.substring(0, 50) + '...')
    console.log('  Cookie:', cookie || 'no-cookie')

    const hasSupabaseCookie = /sb-[a-zA-Z0-9]+-auth-token/.test(cookie)
    const hasDevCookie = /rp_dev_auth=1/.test(cookie)

    console.log('  hasSupabaseCookie:', hasSupabaseCookie)
    console.log('  hasDevCookie:', hasDevCookie)

    let authenticated = false
    let user = null
    let authMethod = 'none'

    // 1. 优先检查Supabase认证
    if (hasSupabaseCookie) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey)

          // 尝试从cookie中解析session
          const authTokenMatch = cookie.match(/sb-[a-zA-Z0-9]+-auth-token=([^;]+)/)
          if (authTokenMatch) {
            try {
              const tokenData = JSON.parse(decodeURIComponent(authTokenMatch[1]))
              if (tokenData.access_token) {
                // 验证token
                const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(tokenData.access_token)
                if (supabaseUser && !error) {
                  authenticated = true
                  authMethod = 'supabase'
                  user = {
                    id: supabaseUser.id,
                    name: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || '用户',
                    email: supabaseUser.email || '',
                    username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'user'
                  }
                  console.log('✅ Supabase认证成功:', user.email)
                }
              }
            } catch (e) {
              console.log('⚠️ Supabase token解析失败:', e instanceof Error ? e.message : String(e))
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Supabase认证检查失败:', e instanceof Error ? e.message : String(e))
      }
    }

    // 2. 如果Supabase认证失败，检查开发认证
    if (!authenticated && hasDevCookie) {
      authenticated = true
      authMethod = 'dev'

      // 尝试获取开发用户信息
      const userCookieMatch = cookie.match(/rp_dev_user=([^;]+)/)
      if (userCookieMatch) {
        try {
          const userData = JSON.parse(decodeURIComponent(userCookieMatch[1]))
          user = {
            id: userData.id || 'dev-user',
            name: userData.username === 'admin' ? '管理员' : '开发用户',
            email: userData.email || 'dev@researchopia.com',
            username: userData.username || 'dev'
          }
          console.log('✅ 开发认证成功:', user.username)
        } catch (e) {
          // 使用默认开发用户信息
          user = {
            id: 'dev-user',
            name: '开发用户',
            email: 'dev@researchopia.com',
            username: 'dev'
          }
        }
      }
    }

    const body: any = {
      authenticated,
      authMethod,
      timestamp: new Date().toISOString()
    }

    if (authenticated && user) {
      body.user = user
      // 提供适当的token
      body.token = authMethod === 'supabase' ? 'supabase-token' : 'test-token'
    }

    console.log('🔍 认证状态检查结果:', { authenticated, authMethod, userId: user?.id })
    return NextResponse.json(body, { status: 200 })

  } catch (error) {
    console.error('❌ 认证状态检查失败:', error)
    return NextResponse.json({
      authenticated: false,
      error: 'Authentication check failed',
      timestamp: new Date().toISOString()
    }, { status: 200 })
  }
})

// 🔥 优化: 认证状态可以短时缓存30秒,移除force-dynamic以启用缓存
export const revalidate = 30;


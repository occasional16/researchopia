import { NextRequest, NextResponse } from 'next/server'
import { withSecurity } from '@/middleware/security'

// Lightweight auth status for Zotero plugin development
// - Returns authenticated based on presence of Supabase cookies (best-effort)
// - Supplies a dev token 'test-token' that is accepted by local annotation APIs
export const GET = withSecurity(async (req: NextRequest) => {
  try {
    const cookie = req.headers.get('cookie') || ''
    const hasSupabaseCookie = /sb|supabase/i.test(cookie)
    const hasDevCookie = /rp_dev_auth=1/.test(cookie)

    const authenticated = !!(hasSupabaseCookie || hasDevCookie)
    const body: any = { authenticated }

    if (authenticated) {
      // 尝试从cookie中获取用户信息
      let user = {
        id: 'local-web-user',
        name: '本地用户',
        email: 'local@researchopia',
        username: 'user'
      }

      // 检查是否有开发用户信息
      const userCookieMatch = cookie.match(/rp_dev_user=([^;]+)/)
      if (userCookieMatch) {
        try {
          const userData = JSON.parse(decodeURIComponent(userCookieMatch[1]))
          user = {
            id: userData.id || 'local-web-user',
            name: userData.username === 'admin' ? '管理员' : '本地用户',
            email: userData.email || 'local@researchopia',
            username: userData.username || 'user'
          }
        } catch (e) {
          // 解析失败，使用默认值
        }
      }

      body.user = user
      // Dev token accepted by some local endpoints (e.g., v1/annotations simple route)
      body.token = 'test-token'
    }

    return NextResponse.json(body, { status: 200 })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
})

export const dynamic = 'force-dynamic'


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
      body.user = {
        id: 'local-web-user',
        name: '本地用户',
        email: 'local@researchopia'
      }
      // Dev token accepted by some local endpoints (e.g., v1/annotations simple route)
      body.token = 'test-token'
    }

    return NextResponse.json(body, { status: 200 })
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
})

export const dynamic = 'force-dynamic'


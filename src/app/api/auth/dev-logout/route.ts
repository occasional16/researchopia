import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true, authenticated: false, mode: 'dev' })
  // Clear the dev cookie
  res.cookies.set('rp_dev_auth', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  })
  return res
}


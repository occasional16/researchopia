import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true, authenticated: true, mode: 'dev' })
  // Set a simple dev cookie for local plugin sync
  res.cookies.set('rp_dev_auth', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  return res
}


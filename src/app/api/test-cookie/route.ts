import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': req.headers.get('origin') || 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  }

  const cookie = req.headers.get('cookie') || ''
  const origin = req.headers.get('origin') || 'no-origin'
  const userAgent = req.headers.get('user-agent') || 'no-user-agent'

  console.log('🧪 Cookie测试API')
  console.log('  Origin:', origin)
  console.log('  User-Agent:', userAgent)
  console.log('  Cookie:', cookie)

  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    headers: {
      origin,
      userAgent: userAgent.substring(0, 100),
      cookie
    },
    cookieAnalysis: {
      hasDevAuth: /rp_dev_auth=1/.test(cookie),
      hasDevUser: /rp_dev_user=/.test(cookie),
      cookieCount: cookie.split(';').filter(c => c.trim()).length
    }
  }

  return NextResponse.json(response, { 
    status: 200,
    headers 
  })
}

export async function OPTIONS(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': req.headers.get('origin') || 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
  }

  return new NextResponse(null, { status: 200, headers })
}

export const dynamic = 'force-dynamic'

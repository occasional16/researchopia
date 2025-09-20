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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { username = 'admin' } = body

    // 开发环境快速登录
    const response = NextResponse.json({
      success: true,
      message: 'Dev login successful',
      user: {
        username: username,
        id: username === 'admin' ? 'admin-123' : 'dev-123',
        email: username === 'admin' ? 'admin@researchopia.com' : 'dev@researchopia.com'
      }
    })

    // 设置开发认证cookie
    response.cookies.set('rp_dev_auth', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7天
    })

    // 设置用户信息cookie
    response.cookies.set('rp_dev_user', JSON.stringify({
      username: username,
      id: username === 'admin' ? 'admin-123' : 'dev-123',
      email: username === 'admin' ? 'admin@researchopia.com' : 'dev@researchopia.com'
    }), {
      httpOnly: false, // 前端需要读取
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7天
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Login failed' },
      { status: 500 }
    )
  }
}


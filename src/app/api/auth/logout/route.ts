import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const response = NextResponse.json({ 
      success: true, 
      message: 'Logged out successfully' 
    })
    
    // 清除所有认证相关的cookie
    response.cookies.set('rp_dev_auth', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // 立即过期
    })
    
    response.cookies.set('rp_dev_user', '', {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // 立即过期
    })
    
    // 清除Supabase相关cookie（如果存在）
    response.cookies.set('sb-access-token', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    
    response.cookies.set('sb-refresh-token', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0
    })
    
    return response
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Logout failed' },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'

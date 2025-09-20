import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, SecurityHeaders, getSecurityHeaders } from '@/utils/security'

// API安全中间件
export function withSecurity(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // 1. 速率限制检查
      const clientIP = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown'
      
      if (!rateLimiter.isAllowed(clientIP, 30, 60000)) { // 每分钟最多30个请求
        return NextResponse.json(
          { error: '请求过于频繁，请稍后再试' },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(rateLimiter.getRemainingTime(clientIP) / 1000)),
              ...SecurityHeaders
            }
          }
        )
      }

      // 2. CORS检查
      const origin = req.headers.get('origin')
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost:3005',
        'http://localhost:3006',
        'http://localhost:3007',
        'http://localhost:3008',
        'http://localhost:3009',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
        'http://127.0.0.1:3003',
        'http://127.0.0.1:3004',
        'http://127.0.0.1:3005',
        'http://127.0.0.1:3006',
        'http://127.0.0.1:3007',
        'http://127.0.0.1:3008',
        'http://127.0.0.1:3009',
        'https://researchopia.vercel.app',
        'https://www.researchopia.com'
      ]

      // 对于Zotero插件请求，可能没有origin头部，需要特殊处理
      const userAgent = req.headers.get('user-agent') || ''
      const isZoteroRequest = userAgent.includes('Zotero') || !origin

      if (origin && !allowedOrigins.includes(origin) && !isZoteroRequest) {
        return NextResponse.json(
          { error: '不允许的源' },
          {
            status: 403,
            headers: SecurityHeaders
          }
        )
      }

      // 3. 执行原始处理器
      const response = await handler(req)
      
      // 4. 添加动态安全头部
      const securityHeaders = getSecurityHeaders(req.nextUrl.pathname)
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      // 5. CORS头部
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, User-Agent')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set('Access-Control-Max-Age', '86400')
      } else if (isZoteroRequest || !origin) {
        // 为Zotero插件请求或同源请求设置CORS头部
        // 注意：当使用credentials时，不能设置Access-Control-Allow-Origin为*
        const requestOrigin = origin || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000'
        response.headers.set('Access-Control-Allow-Origin', requestOrigin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, User-Agent')
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set('Access-Control-Max-Age', '86400')
      }

      // 6. 处理预检请求
      if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers: response.headers })
      }

      return response

    } catch (error) {
      console.error('Security middleware error:', error)
      return NextResponse.json(
        { error: '服务器内部错误' },
        { 
          status: 500,
          headers: SecurityHeaders
        }
      )
    }
  }
}

// 认证检查中间件
export function requireAuth(handler: (req: NextRequest, user: any) => Promise<NextResponse>) {
  return withSecurity(async (req: NextRequest) => {
    try {
      // 从请求头获取认证信息
      const authHeader = req.headers.get('authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: '未提供认证信息' },
          { status: 401 }
        )
      }

      const token = authHeader.substring(7)
      
      // 这里应该验证JWT token
      // 简化版本，实际应该使用Supabase客户端验证
      if (!token || token.length < 10) {
        return NextResponse.json(
          { error: '无效的认证信息' },
          { status: 401 }
        )
      }

      // 模拟用户信息，实际应该从token解析
      const user = { id: 'user-id', email: 'user@example.com' }

      return await handler(req, user)

    } catch (error) {
      console.error('Auth middleware error:', error)
      return NextResponse.json(
        { error: '认证验证失败' },
        { status: 401 }
      )
    }
  })
}

// 管理员权限检查
export function requireAdmin(handler: (req: NextRequest, user: any) => Promise<NextResponse>) {
  return requireAuth(async (req: NextRequest, user: any) => {
    // 检查用户是否为管理员
    if (!user.isAdmin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    return await handler(req, user)
  })
}

// 输入验证中间件
export function validateInput<T>(
  schema: Record<string, (value: any) => { isValid: boolean; message?: string }>,
  handler: (req: NextRequest, data: T) => Promise<NextResponse>
) {
  return withSecurity(async (req: NextRequest) => {
    try {
      const contentType = req.headers.get('content-type')
      
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json(
          { error: '请求必须为JSON格式' },
          { status: 400 }
        )
      }

      const data = await req.json()
      
      // 验证输入
      const errors: Record<string, string> = {}
      let hasErrors = false

      for (const field in schema) {
        const validation = schema[field](data[field])
        if (!validation.isValid) {
          errors[field] = validation.message || '无效的输入'
          hasErrors = true
        }
      }

      if (hasErrors) {
        return NextResponse.json(
          { error: '输入验证失败', details: errors },
          { status: 400 }
        )
      }

      return await handler(req, data)

    } catch (error) {
      console.error('Input validation error:', error)
      return NextResponse.json(
        { error: '请求数据格式错误' },
        { status: 400 }
      )
    }
  })
}

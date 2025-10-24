import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 定义需要限制的路径模式
const API_RATE_LIMIT_PATHS = [
  '/api/notifications/unread',
  '/api/users/stats',
]

// 简单的内存缓存（生产环境建议使用Redis）
const requestCache = new Map<string, { count: number; resetTime: number }>()

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 只在匹配的API路径上运行
  const shouldLimit = API_RATE_LIMIT_PATHS.some(path => pathname.startsWith(path))
  
  if (shouldLimit) {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const cacheKey = `${clientIp}:${pathname}`
    const now = Date.now()
    
    // 获取或创建缓存记录
    let record = requestCache.get(cacheKey)
    
    if (!record || now > record.resetTime) {
      // 新建或重置记录（每分钟限制60次请求）
      record = { count: 0, resetTime: now + 60000 }
      requestCache.set(cacheKey, record)
    }
    
    record.count++
    
    // 检查是否超过限制
    if (record.count > 60) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((record.resetTime - now) / 1000)),
        },
      })
    }
  }

  // 为静态资源添加缓存头
  if (pathname.match(/\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|woff|woff2|ttf|eot)$/)) {
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return response
  }

  // 为API响应添加ETag支持
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    
    // 如果请求包含If-None-Match头，检查ETag
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch) {
      // Next.js会自动处理ETag，这里只是确保头部存在
      response.headers.set('Cache-Control', 'public, max-age=600, must-revalidate')
    }
    
    return response
  }

  return NextResponse.next()
}

// 配置中间件匹配路径
export const config = {
  matcher: [
    // 匹配所有API路由
    '/api/:path*',
  ],
}

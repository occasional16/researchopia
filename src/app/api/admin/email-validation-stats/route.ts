import { NextRequest, NextResponse } from 'next/server'
import { emailValidationMonitor, emailValidationCache } from '@/lib/emailValidationMonitor'

export async function GET(request: NextRequest) {
  try {
    // Simple admin authentication (in production, use proper auth)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes('admin-token')) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const stats = emailValidationMonitor.getStats()
    const suspiciousAttempts = emailValidationMonitor.getSuspiciousAttempts()
    const cacheStats = emailValidationCache.getStats()

    return NextResponse.json({
      success: true,
      data: {
        validation: stats,
        suspicious: suspiciousAttempts.slice(-20), // Last 20 suspicious attempts
        cache: cacheStats,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Email validation stats error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve stats'
    }, { status: 500 })
  }
}

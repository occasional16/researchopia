import { NextRequest, NextResponse } from 'next/server'
import { emailMonitor } from '@/lib/emailMonitor'

export async function GET(request: NextRequest) {
  try {
    // Simple admin authentication (in production, use proper auth)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes('admin-token')) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const stats = emailMonitor.getStats()
    const highRiskEmails = emailMonitor.getHighRiskEmails()

    return NextResponse.json({
      success: true,
      data: {
        stats,
        highRiskEmails,
        alerts: {
          highBounceRate: stats.bounceRate > 0.05,
          bounceRatePercentage: (stats.bounceRate * 100).toFixed(2),
          recentFailures: stats.recentSends.filter(log => !log.success).length
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Email stats error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve email stats'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Simple admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes('admin-token')) {
      return NextResponse.json({
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const { action, email, bounceType, reason, messageId } = await request.json()

    if (action === 'report_bounce') {
      // Manually report a bounce (useful for webhook integration)
      emailMonitor.logEmailBounce({
        email,
        bounceType: bounceType || 'hard',
        reason: reason || 'Manual report',
        messageId
      })

      return NextResponse.json({
        success: true,
        message: 'Bounce reported successfully'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })

  } catch (error: any) {
    console.error('Email stats POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 })
  }
}

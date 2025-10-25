import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/site/daily-stats
 * 获取每日访问统计历史
 * 
 * Query parameters:
 * - days: 获取最近多少天的数据（默认30天）
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('daily_visit_stats')
      .select('*')
      .order('visit_date', { ascending: false })

    if (startDate && endDate) {
      // 使用日期范围查询
      query = query
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
    } else {
      // 使用天数限制
      query = query.limit(days)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch daily stats' },
        { status: 500 }
      )
    }

    // 计算统计信息
    const totalVisits = data?.reduce((sum, day) => sum + (day.total_visits || 0), 0) || 0
    const avgVisitsPerDay = data && data.length > 0 ? Math.round(totalVisits / data.length) : 0
    const maxVisitsDay = data && data.length > 0
      ? data.reduce((max, day) => day.total_visits > max.total_visits ? day : max, data[0])
      : null

    return NextResponse.json({
      success: true,
      data: {
        stats: data || [],
        summary: {
          totalDays: data?.length || 0,
          totalVisits,
          avgVisitsPerDay,
          maxVisitsDay: maxVisitsDay ? {
            date: maxVisitsDay.visit_date,
            visits: maxVisitsDay.total_visits
          } : null
        }
      }
    })
  } catch (error) {
    console.error('Error in daily-stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

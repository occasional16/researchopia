import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin API for managing visit statistics
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 200 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey)

  try {
    // 获取访问统计数据
    const [countersResult, statisticsResult, recentVisitsResult] = await Promise.all([
      supabase.from('realtime_counters').select('*'),
      supabase.from('visit_statistics').select('*').order('date', { ascending: false }).limit(7),
      supabase.from('page_visits').select('*').order('created_at', { ascending: false }).limit(20)
    ])

    return NextResponse.json({
      success: true,
      data: {
        counters: countersResult.data || [],
        statistics: statisticsResult.data || [],
        recentVisits: recentVisitsResult.data || []
      }
    })

  } catch (error: any) {
    console.error('Admin visits API error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

// Update visit counters
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey)

  try {
    const body = await request.json()
    const { action, counterName, value } = body

    if (action === 'set' && counterName && typeof value === 'number') {
      // 设置计数器值
      const { error } = await supabase
        .from('realtime_counters')
        .update({ 
          counter_value: value,
          last_updated: new Date().toISOString()
        })
        .eq('counter_name', counterName)

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: `Counter ${counterName} set to ${value}`
      })
    }

    if (action === 'reset' && counterName) {
      // 重置计数器
      const { error } = await supabase
        .from('realtime_counters')
        .update({ 
          counter_value: 0,
          last_updated: new Date().toISOString()
        })
        .eq('counter_name', counterName)

      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: `Counter ${counterName} reset to 0`
      })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (error: any) {
    console.error('Admin visits POST error:', error)
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}

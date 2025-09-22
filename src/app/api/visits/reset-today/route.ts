import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Reset today's visit counter (can be called by cron job)
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // If Supabase is not configured, no-op
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ success: false, message: 'Supabase not configured' }, { status: 200 })
  }

  // Use service role key for admin operations
  const supabase = createClient(supabaseUrl, serviceRoleKey || anonKey)

  try {
    // 验证请求来源（简单的安全检查）
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || 'default-secret'
    
    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // 重置今日访问计数器
    const { error } = await supabase
      .from('realtime_counters')
      .update({ 
        counter_value: 0,
        last_updated: new Date().toISOString()
      })
      .eq('counter_name', 'today_visits')

    if (error) {
      console.error('Failed to reset today counter:', error)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    console.log('Today visit counter reset successfully')
    return NextResponse.json({ 
      success: true, 
      message: 'Today visit counter reset',
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('Reset today counter error:', e)
    return NextResponse.json({ success: false, message: e?.message || 'unknown error' }, { status: 500 })
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Reset today counter endpoint',
    usage: 'POST with Authorization: Bearer <CRON_SECRET>'
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 检查并重置今日访问量（精确的0点重置逻辑）
async function checkAndResetTodayVisits(supabase: any) {
  try {
    // 获取今日访问量计数器的最后更新时间
    const { data: counter, error } = await supabase
      .from('visit_counters')
      .select('counter_value, last_updated')
      .eq('counter_type', 'today_visits')
      .single()

    if (error || !counter) {
      console.warn('Failed to get today visits counter:', error?.message)
      return
    }

    // 使用中国时区（UTC+8）进行日期计算
    const now = new Date()
    const chinaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)) // UTC+8
    const lastUpdated = new Date(counter.last_updated)
    const lastUpdatedChina = new Date(lastUpdated.getTime() + (8 * 60 * 60 * 1000))

    // 获取今天0点的时间戳（中国时区）
    const todayStart = new Date(chinaTime.getFullYear(), chinaTime.getMonth(), chinaTime.getDate())
    const lastUpdateDate = new Date(lastUpdatedChina.getFullYear(), lastUpdatedChina.getMonth(), lastUpdatedChina.getDate())

    // 如果最后更新时间早于今天0点，则需要重置
    if (lastUpdateDate.getTime() < todayStart.getTime()) {
      console.log(`🔄 Resetting today visits counter (new day detected)`)
      console.log(`   Last update: ${lastUpdatedChina.toLocaleString('zh-CN')}`)
      console.log(`   Today start: ${todayStart.toLocaleString('zh-CN')}`)

      const { error: resetError } = await supabase
        .from('visit_counters')
        .update({
          counter_value: 0,
          last_updated: now.toISOString() // 使用UTC时间存储
        })
        .eq('counter_type', 'today_visits')

      if (resetError) {
        console.warn('Failed to reset today visits:', resetError.message)
      } else {
        console.log('✅ Today visits counter reset successfully')
      }
    }
  } catch (error) {
    console.warn('Error in checkAndResetTodayVisits:', error)
  }
}

// 极简访问统计 - 记录页面访问
export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // 注意：Service Role Key 具有超级管理员权限，仅在必要时使用
  // const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 如果Supabase未配置，返回成功避免破坏UI
  if (!supabaseUrl || !anonKey) {
    console.warn('Supabase not configured for visit tracking')
    return NextResponse.json({
      success: true,
      message: 'Visit tracking disabled - Supabase not configured',
      totalVisits: 2600, // 固定值避免hydration错误
      todayVisits: 35     // 固定值避免hydration错误
    })
  }

  // 优先使用anon key，提高安全性
  const supabase = createClient(supabaseUrl, anonKey)

  try {
    // 获取客户端信息
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwarded?.split(',')[0] || realIp || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    // 1. 记录访问日志（可选，不影响主要功能）
    try {
      await supabase
        .from('visit_logs')
        .insert([{
          ip_address: ipAddress,
          user_agent: userAgent,
          page_path: '/',
          visited_at: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0]
        }])
    } catch (logError) {
      console.warn('Failed to insert visit log:', logError)
      // 不影响主要功能
    }

    // 2. 检查是否需要重置今日访问量
    await checkAndResetTodayVisits(supabase)

    // 3. 更新访问计数器（核心功能）
    let totalVisits = 0
    let todayVisits = 0

    try {
      // 使用存储过程增加计数器
      const { data: totalResult, error: totalError } = await supabase
        .rpc('increment_counter', { counter_name: 'total_visits', increment_by: 1 })

      const { data: todayResult, error: todayError } = await supabase
        .rpc('increment_counter', { counter_name: 'today_visits', increment_by: 1 })

      if (!totalError && totalResult !== null) {
        totalVisits = totalResult
      }
      if (!todayError && todayResult !== null) {
        todayVisits = todayResult
      }

      // 如果存储过程失败，尝试直接更新
      if (totalError || todayError) {
        console.warn('RPC failed, trying direct update:', { totalError, todayError })

        const { data: counters } = await supabase
          .from('visit_counters')
          .select('counter_type, counter_value')
          .in('counter_type', ['total_visits', 'today_visits'])

        if (counters && counters.length > 0) {
          for (const counter of counters) {
            const newValue = (counter.counter_value || 0) + 1

            await supabase
              .from('visit_counters')
              .update({
                counter_value: newValue,
                last_updated: new Date().toISOString()
              })
              .eq('counter_type', counter.counter_type)

            if (counter.counter_type === 'total_visits') totalVisits = newValue
            if (counter.counter_type === 'today_visits') todayVisits = newValue
          }
        }
      }
    } catch (counterError) {
      console.error('Counter update failed:', counterError)
      // 使用固定估算值作为后备（避免hydration错误）
      totalVisits = 2600 // 固定值
      todayVisits = 35   // 固定值
    }

    return NextResponse.json({
      success: true,
      totalVisits,
      todayVisits,
      ip: ipAddress,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('Visit tracking error:', e)

    // 即使出错也返回一些数据，避免前端显示错误
    return NextResponse.json({
      success: true,
      totalVisits: 2600, // 固定值避免hydration错误
      todayVisits: 35,    // 固定值避免hydration错误
      message: 'Fallback data due to error',
      error: e?.message
    })
  }
}

// Optional GET for quick ping/debug
export async function GET() {
  return NextResponse.json({ ok: true })
}

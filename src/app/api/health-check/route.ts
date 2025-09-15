import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  console.log('🔍 Health check requested')
  
  try {
    const checks: any = {
      server: true,
      timestamp: new Date().toISOString(),
      database: false,
      environment: {
        nodeVersion: process.version,
        // 动态导入以避免 require() 被 ESLint 禁止
        // 在下方会覆盖为实际版本号
        nextVersion: 'unknown',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    }

    try {
      const pkg: any = await import('next/package.json')
      if (pkg && pkg.version) {
        checks.environment.nextVersion = pkg.version
      }
    } catch (e) {
      // 保持为 'unknown'，并不阻断健康检查
    }

    // 测试数据库连接
    if (supabase) {
      try {
        console.log('🗄️ Testing database connection...')
        const { data, error } = await supabase
          .from('papers')
          .select('count')
          .limit(1)
          .single()

        if (!error) {
          checks.database = true
          console.log('✅ Database connection successful')
        } else {
          console.log('❌ Database query failed:', error.message)
          checks.databaseError = error.message
        }
      } catch (dbError) {
        console.log('❌ Database connection failed:', dbError)
        checks.databaseError = dbError instanceof Error ? dbError.message : 'Unknown database error'
      }
    } else {
      console.log('⚠️ Supabase client not initialized')
      checks.databaseError = 'Supabase client not initialized'
    }

    console.log('✅ Health check completed:', checks)
    
    return NextResponse.json({
      status: 'ok',
      checks
    })
    
  } catch (error) {
    console.error('❌ Health check failed:', error)
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          server: true,
          database: false,
          timestamp: new Date().toISOString()
        }
      }, 
      { status: 500 }
    )
  }
}
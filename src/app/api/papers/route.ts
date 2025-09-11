import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MockAuthService } from '@/lib/mockAuth'
import { getPapers } from '@/lib/database'

// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存
let cachedPapers: any = null
let cacheTimestamp = 0

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  console.log('📄 GET /api/papers - 开始处理')

  try {
    // 检查缓存
    const now = Date.now()
    if (cachedPapers && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`⚡ 使用缓存数据 - ${(performance.now() - startTime).toFixed(2)}ms`)
      return NextResponse.json(cachedPapers)
    }

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      console.log('🔧 使用Mock模式')
      const papers = await getPapers()
      cachedPapers = papers
      cacheTimestamp = now
      console.log(`✅ Mock数据返回 - ${(performance.now() - startTime).toFixed(2)}ms`)
      return NextResponse.json(papers)
    }

    console.log('🗄️ 查询Supabase数据库...')
    // 优化查询：只获取必要字段
    const { data: papers, error } = await supabase
      .from('papers')
      .select(`
        id,
        title,
        abstract,
        authors,
        journal,
        publication_date,
        doi,
        created_at,
        updated_at,
        users:created_by (
          id,
          username,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50) // 限制结果数量以提高性能

    if (error) {
      console.error('❌ Supabase查询错误:', error)
      // Fallback to mock data
      const mockPapers = await getPapers()
      console.log(`🔄 降级到Mock数据 - ${(performance.now() - startTime).toFixed(2)}ms`)
      return NextResponse.json(mockPapers)
    }

    // 缓存结果
    cachedPapers = papers || []
    cacheTimestamp = now
    
    console.log(`✅ Supabase查询成功，返回${papers?.length || 0}条记录 - ${(performance.now() - startTime).toFixed(2)}ms`)
    return NextResponse.json(papers || [])
    
  } catch (error) {
    console.error('❌ API处理异常:', error)
    // Fallback to mock data
    const mockPapers = await getPapers()
    console.log(`🔄 异常降级到Mock数据 - ${(performance.now() - startTime).toFixed(2)}ms`)
    return NextResponse.json(mockPapers)
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now()
  console.log('📝 POST /api/papers - 开始处理')

  try {
    const body = await request.json()
    console.log('📦 接收到论文数据:', { title: body.title, doi: body.doi })
    
    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      console.log('🔧 使用Mock模式创建论文')
      console.log(`✅ Mock创建成功 - ${(performance.now() - startTime).toFixed(2)}ms`)
      return NextResponse.json({ success: true, message: 'Paper added (Mock mode)' })
    }

    console.log('🗄️ 插入到Supabase数据库...')
    const { data, error } = await supabase
      .from('papers')
      .insert([{
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()

    if (error) {
      console.error('❌ Supabase插入错误:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // 清除缓存
    cachedPapers = null
    cacheTimestamp = 0

    console.log(`✅ 论文创建成功 - ${(performance.now() - startTime).toFixed(2)}ms`)
    return NextResponse.json(data[0])
    
  } catch (error) {
    console.error('❌ API处理异常:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

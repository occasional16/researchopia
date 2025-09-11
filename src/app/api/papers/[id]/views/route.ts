import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    // 先获取当前查看次数
    const { data: paperData, error: fetchError } = await supabase
      .from('papers')
      .select('view_count')
      .eq('id', paperId)
      .single()

    if (fetchError) {
      console.error('Failed to fetch paper:', fetchError)
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      )
    }

    // 增加查看次数
    const currentViewCount = paperData?.view_count || 0
    const { error } = await supabase
      .from('papers')
      .update({ 
        view_count: currentViewCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', paperId)

    if (error) {
      console.error('Failed to update view count:', error)
      return NextResponse.json(
        { error: 'Failed to update view count' },
        { status: 500 }
      )
    }

    // 记录访问历史（可选）
    try {
      await supabase
        .from('paper_views')
        .insert({
          paper_id: paperId,
          viewed_at: new Date().toISOString(),
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
        })
    } catch (viewError) {
      // 如果paper_views表不存在，忽略错误
      console.log('Paper views table not available:', viewError)
    }

    return NextResponse.json({ 
      success: true, 
      viewCount: currentViewCount + 1 
    })
  } catch (error) {
    console.error('Error updating view count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      )
    }

    // 获取当前查看次数
    const { data, error } = await supabase
      .from('papers')
      .select('view_count')
      .eq('id', paperId)
      .single()

    if (error) {
      console.error('Failed to get view count:', error)
      return NextResponse.json(
        { error: 'Failed to get view count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      viewCount: data?.view_count || 0 
    })
  } catch (error) {
    console.error('Error getting view count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

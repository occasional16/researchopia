import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paperId } = await params

    if (!paperId) {
      return NextResponse.json(
        { error: '缺少论文ID' },
        { status: 400 }
      )
    }

    // 使用我们创建的函数获取论文的Zotero标注
    const { data: annotations, error } = await supabase
      .rpc('get_paper_zotero_annotations', { 
        target_paper_id: paperId 
      })

    if (error) {
      console.error('Error fetching Zotero annotations:', error)
      return NextResponse.json(
        { error: '获取标注失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      annotations: annotations || [],
      count: annotations?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
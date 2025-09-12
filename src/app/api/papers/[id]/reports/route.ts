import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - 获取论文的相关报道
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    
    if (!supabase) {
      // Mock data for development
      const mockReports = [
        {
          id: '1',
          paper_id: paperId,
          title: '重大突破！这项研究颠覆了我们对材料科学的认知',
          url: 'https://mp.weixin.qq.com/s/example1',
          source: 'wechat',
          author: '材料科学前沿',
          publish_date: '2024-01-15',
          description: '这篇发表在《Nature》上的论文展示了一种全新的材料制备方法，有望革命性地改变相关领域...',
          view_count: 1250,
          created_at: '2024-01-16T10:00:00Z'
        },
        {
          id: '2',
          paper_id: paperId,
          title: '科学家发现新材料，未来应用前景广阔',
          url: 'https://www.example-news.com/article/123',
          source: 'news',
          author: '科技日报',
          publish_date: '2024-01-16',
          description: '该研究成果在材料强度和导电性方面实现了重大突破，为新能源、电子器件等领域带来新机遇...',
          view_count: 2100,
          created_at: '2024-01-17T14:30:00Z'
        }
      ]
      
      return NextResponse.json({ 
        reports: mockReports,
        count: mockReports.length
      })
    }

    const { data: reports, error } = await supabase
      .from('paper_reports')
      .select('*')
      .eq('paper_id', paperId)
      .order('publish_date', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      reports: reports || [],
      count: reports?.length || 0
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - 添加新的相关报道
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    const body = await request.json()
    
    const { title, url, source, author, publish_date, description } = body
    
    // 基本验证
    if (!title?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: 'Title and URL are required' },
        { status: 400 }
      )
    }
    
    if (!supabase) {
      // Mock success response for development
      return NextResponse.json({
        success: true,
        report: {
          id: Date.now().toString(),
          paper_id: paperId,
          title,
          url,
          source: source || 'other',
          author,
          publish_date,
          description,
          view_count: 0,
          created_at: new Date().toISOString()
        }
      })
    }

    const reportData = {
      paper_id: paperId,
      title: title.trim(),
      url: url.trim(),
      source: source || 'other',
      author: author?.trim() || null,
      publish_date: publish_date || null,
      description: description?.trim() || null,
      created_by: null // TODO: 添加用户认证后设置实际用户ID
    }

    const { data: report, error } = await supabase
      .from('paper_reports')
      .insert(reportData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      
      // 处理重复URL错误
      if (error.code === '23505' && error.message.includes('paper_reports_paper_id_url_key')) {
        return NextResponse.json(
          { error: 'This report URL already exists for this paper' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to create report' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      report
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
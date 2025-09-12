import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getUserPermissions, canUserEditReport, canUserDeleteReport } from '@/lib/permissions'

// GET - 获取论文的相关报道
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    
    // 如果没有Supabase配置，或者paperId是简单数字（开发模式），使用mock数据
    if (!supabase || paperId === "1" || paperId === "2" || paperId === "3") {
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
          created_at: '2024-01-16T10:00:00Z',
          created_by: 'demo-user-1',
          contributor_name: '科研助手',
          contribution_type: '智能爬取'
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
          created_at: '2024-01-17T14:30:00Z',
          created_by: 'demo-user-2',
          contributor_name: '学术观察者',
          contribution_type: '手动添加'
        },
        {
          id: '3',
          paper_id: paperId,
          title: '深度学习助力气候预测新突破',
          url: 'https://www.science-daily.com/example',
          source: 'news',
          author: 'Science Daily',
          publish_date: '2024-01-18',
          description: '研究团队利用深度学习技术显著提升了气候变化预测的准确性，为应对全球气候挑战提供了重要工具...',
          view_count: 1800,
          created_at: '2024-01-18T09:15:00Z',
          created_by: 'demo-user-3',
          contributor_name: 'AI科技',
          contribution_type: '智能爬取'
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
    
    // 如果没有Supabase配置，或者paperId是简单数字（开发模式），使用mock响应
    if (!supabase || paperId === "1" || paperId === "2" || paperId === "3") {
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
          created_at: new Date().toISOString(),
          created_by: 'demo-user',
          contributor_name: '开发用户',
          contribution_type: '手动添加'
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

// PATCH - 更新报道
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    const body = await request.json()
    
    const { reportId, title, url, source, author, publish_date, description } = body
    
    // 基本验证
    if (!reportId || !title?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: 'Report ID, title and URL are required' },
        { status: 400 }
      )
    }

    // 权限检查
    const userPermissions = await getUserPermissions(request)
    const canEdit = await canUserEditReport(reportId, userPermissions)
    
    if (!canEdit) {
      return NextResponse.json(
        { error: userPermissions.isAuthenticated ? 'You can only edit your own reports' : 'Authentication required' },
        { status: userPermissions.isAuthenticated ? 403 : 401 }
      )
    }
    
    // 如果没有Supabase配置，或者paperId是简单数字（开发模式），使用mock响应
    if (!supabase || paperId === "1" || paperId === "2" || paperId === "3") {
      // Mock success response for development
      return NextResponse.json({
        success: true,
        report: {
          id: reportId,
          paper_id: paperId,
          title,
          url,
          source: source || 'other',
          author,
          publish_date,
          description,
          view_count: 0,
          updated_at: new Date().toISOString()
        }
      })
    }

    const updateData = {
      title: title.trim(),
      url: url.trim(),
      source: source || 'other',
      author: author?.trim() || null,
      publish_date: publish_date || null,
      description: description?.trim() || null,
      updated_at: new Date().toISOString()
    }

    const { data: report, error } = await supabase
      .from('paper_reports')
      .update(updateData)
      .eq('id', reportId)
      .eq('paper_id', paperId) // 确保只能更新属于该论文的报道
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
        { error: 'Failed to update report' },
        { status: 500 }
      )
    }

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
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

// DELETE - 删除报道
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    const url = new URL(request.url)
    const reportId = url.searchParams.get('reportId')
    
    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    // 权限检查
    const userPermissions = await getUserPermissions(request)
    const canDelete = await canUserDeleteReport(reportId, userPermissions)
    
    if (!canDelete) {
      return NextResponse.json(
        { 
          error: userPermissions.isAuthenticated 
            ? 'You can only delete your own reports or need admin privileges' 
            : 'Authentication required' 
        },
        { status: userPermissions.isAuthenticated ? 403 : 401 }
      )
    }
    
    // 如果没有Supabase配置，或者paperId是简单数字（开发模式），使用mock响应
    if (!supabase || paperId === "1" || paperId === "2" || paperId === "3") {
      // Mock success response for development
      return NextResponse.json({
        success: true,
        message: 'Report deleted successfully'
      })
    }

    const { error } = await supabase
      .from('paper_reports')
      .delete()
      .eq('id', reportId)
      .eq('paper_id', paperId) // 确保只能删除属于该论文的报道

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete report' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
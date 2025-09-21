import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - 获取论文报道统计信息
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const paperId = resolvedParams.id
    
    if (!supabase) {
      // Mock数据用于开发
      const mockStats = {
        totalReports: 8,
        crawledReports: 5,
        manualReports: 3,
        uniqueContributors: 4,
        topContributor: {
          name: '研究助手AI',
          count: 3
        }
      }
      
      return NextResponse.json(mockStats)
    }

    // 获取基本统计
    const { data: reports, error } = await supabase
      .from('paper_reports')
      .select('created_by, source')
      .eq('paper_id', paperId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch report stats' },
        { status: 500 }
      )
    }

    const totalReports = reports?.length || 0
    
    // 统计按来源分类
    const crawledReports = reports?.filter((r: any) =>
      r.source === 'news' || r.source === 'blog'
    ).length || 0
    
    const manualReports = totalReports - crawledReports
    
    // 统计贡献者
    const contributorCounts = new Map<string, number>()
    reports?.forEach((report: any) => {
      if (report.created_by) {
        contributorCounts.set(
          report.created_by,
          (contributorCounts.get(report.created_by) || 0) + 1
        )
      }
    })
    
    const uniqueContributors = contributorCounts.size
    
    // 找出最佳贡献者
    let topContributor = null
    if (uniqueContributors > 0) {
      const sortedContributors = Array.from(contributorCounts.entries())
        .sort((a, b) => b[1] - a[1])
      
      const topContributorId = sortedContributors[0][0]
      const topContributorCount = sortedContributors[0][1]
      
      // 获取用户信息
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('id', topContributorId)
        .single()
      
      topContributor = {
        name: (userData as any)?.username || '匿名贡献者',
        count: topContributorCount
      }
    }

    const stats = {
      totalReports,
      crawledReports,
      manualReports,
      uniqueContributors,
      topContributor
    }

    return NextResponse.json(stats)
    
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
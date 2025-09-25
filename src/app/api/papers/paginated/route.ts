import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = performance.now()
  const { searchParams } = new URL(request.url)
  
  // 分页参数
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || 'recent_comments' // 默认按最新评论排序
  
  // 限制每页最大数量，防止性能问题
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const safePage = Math.max(page, 1)
  const offset = (safePage - 1) * safeLimit

  console.log(`📄 GET /api/papers/paginated - 页面:${safePage}, 限制:${safeLimit}, 偏移:${offset}, 排序:${sortBy}`)

  try {
    let papers
    let total = 0

    if (search) {
      // 如果有搜索查询，使用搜索函数
      const { searchPapers } = await import('@/lib/database')
      papers = await searchPapers(search, safeLimit)
      // 注意：搜索结果不需要总数，因为它基于相关性
      total = papers.length
    } else {
      // 普通分页查询，支持排序（使用真实总数）
      const { getPapersWithSort, getTotalPapersCount } = await import('@/lib/database')
      const [pageData, totalCount] = await Promise.all([
        getPapersWithSort(safeLimit, offset, sortBy),
        getTotalPapersCount()
      ])
      papers = pageData
      total = totalCount
    }

    const totalPages = Math.ceil(total / safeLimit)
    const hasMore = safePage < totalPages
    const hasPrevious = safePage > 1

    const response = {
      data: papers,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasMore,
        hasPrevious,
        nextPage: hasMore ? safePage + 1 : null,
        previousPage: hasPrevious ? safePage - 1 : null
      }
    }

    console.log(`✅ 分页查询成功 - 返回${papers.length}条记录 - ${(performance.now() - startTime).toFixed(2)}ms`)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('❌ 分页API错误:', error)
    return NextResponse.json(
      { 
        error: '获取论文列表失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}

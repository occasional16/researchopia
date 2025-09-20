import { NextRequest, NextResponse } from 'next/server'

// 模拟标注数据
const mockAnnotations = [
  {
    id: '1',
    text: '这个方法很有创新性，值得深入研究。',
    author: 'researcher1',
    type: 'highlight',
    likes: 15,
    comments: 3,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小时前
    page: 1,
    position: { x: 100, y: 200 }
  },
  {
    id: '2', 
    text: '实验设计需要改进，样本量可能不够。',
    author: 'expert2',
    type: 'note',
    likes: 8,
    comments: 1,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1天前
    page: 3,
    position: { x: 150, y: 300 }
  },
  {
    id: '3',
    text: '这个结论与之前的研究结果一致。',
    author: 'scholar3',
    type: 'highlight',
    likes: 12,
    comments: 2,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6小时前
    page: 5,
    position: { x: 200, y: 150 }
  }
]

// GET - 获取DOI对应的标注
export async function GET(
  request: NextRequest,
  { params }: { params: { doi: string } }
) {
  try {
    const doi = decodeURIComponent(params.doi)
    
    // 验证DOI格式
    if (!doi || !doi.includes('/')) {
      return NextResponse.json(
        { success: false, message: 'Invalid DOI format' },
        { status: 400 }
      )
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'

    // 模拟数据过滤和排序
    let annotations = [...mockAnnotations]
    
    // 按指定字段排序
    annotations.sort((a, b) => {
      let aValue = a[sortBy as keyof typeof a]
      let bValue = b[sortBy as keyof typeof b]
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return order === 'desc' ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue)
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'desc' ? bValue - aValue : aValue - bValue
      }
      
      return 0
    })

    // 限制数量
    if (limit > 0) {
      annotations = annotations.slice(0, limit)
    }

    return NextResponse.json({
      success: true,
      data: {
        doi,
        total: mockAnnotations.length,
        annotations,
        meta: {
          limit,
          sortBy,
          order
        }
      }
    })
  } catch (error) {
    console.error('Error fetching annotations:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - 添加新标注
export async function POST(
  request: NextRequest,
  { params }: { params: { doi: string } }
) {
  try {
    const doi = decodeURIComponent(params.doi)
    const body = await request.json()
    
    const { text, type = 'highlight', page, position } = body
    
    if (!text || !page) {
      return NextResponse.json(
        { success: false, message: 'Text and page are required' },
        { status: 400 }
      )
    }

    // 创建新标注
    const newAnnotation = {
      id: Date.now().toString(),
      text: text.trim(),
      author: 'current_user', // 实际应该从认证中获取
      type,
      likes: 0,
      comments: 0,
      created_at: new Date().toISOString(),
      page,
      position: position || { x: 0, y: 0 }
    }

    // 在实际应用中，这里应该保存到数据库
    mockAnnotations.unshift(newAnnotation)

    return NextResponse.json({
      success: true,
      data: newAnnotation,
      message: 'Annotation created successfully'
    })
  } catch (error) {
    console.error('Error creating annotation:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

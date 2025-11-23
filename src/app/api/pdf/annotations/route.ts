import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/pdf/annotations - 获取PDF标注列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const documentId = searchParams.get('document_id')
    const pageNumber = searchParams.get('page_number')
    const annotationType = searchParams.get('annotation_type')
    const userId = searchParams.get('user_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // 验证必需参数
    if (!documentId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: document_id' 
      }, { status: 400 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // Build query
    let query = supabase
      .from('pdf_annotations')
      .select(`
        *,
        users:user_id(username, avatar_url),
        replies:pdf_annotations!reply_to(
          id,
          content,
          created_at,
          users:user_id(username, avatar_url)
        )
      `, { count: 'exact' })
      .eq('pdf_document_id', documentId)

    // Apply filters
    if (pageNumber) {
      query = query.eq('page_number', parseInt(pageNumber))
    }
    if (annotationType) {
      query = query.eq('annotation_type', annotationType)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // Apply pagination and ordering
    const { data: annotations, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching PDF annotations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get interaction stats for each annotation
    const annotationsWithStats = await Promise.all(
      (annotations || []).map(async (annotation: any) => {
        if (!supabase) return annotation
        
        const { data: interactions } = await supabase
          .from('pdf_annotation_interactions')
          .select('interaction_type')
          .eq('annotation_id', annotation.id)

        const stats = {
          likes: (interactions as any)?.filter((i: any) => i.interaction_type === 'like').length || 0,
          dislikes: (interactions as any)?.filter((i: any) => i.interaction_type === 'dislike').length || 0,
          helpful: (interactions as any)?.filter((i: any) => i.interaction_type === 'helpful').length || 0,
          flags: (interactions as any)?.filter((i: any) => i.interaction_type === 'flag').length || 0
        }

        return {
          ...annotation,
          interactions: stats
        }
      })
    )

    return NextResponse.json({
      annotations: annotationsWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Error in GET /api/pdf/annotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/pdf/annotations - 创建新的PDF标注
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      pdf_document_id,
      page_number,
      annotation_type,
      position_data,
      content,
      selected_text,
      color = '#ffff00',
      opacity = 0.3,
      tags = [],
      is_private = false,
      reply_to = null
    } = body

    // 验证必需字段
    if (!pdf_document_id || !page_number || !annotation_type || !position_data) {
      return NextResponse.json({
        error: 'Missing required fields: pdf_document_id, page_number, annotation_type, position_data'
      }, { status: 400 })
    }

    // 验证标注类型
    const validTypes = ['highlight', 'note', 'bookmark', 'drawing']
    if (!validTypes.includes(annotation_type)) {
      return NextResponse.json({
        error: `Invalid annotation_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    // 验证PDF文档是否存在
    const { data: document } = await supabase
      .from('pdf_documents')
      .select('id, total_pages')
      .eq('id', pdf_document_id)
      .single()

    if (!document) {
      return NextResponse.json({
        error: 'PDF document not found'
      }, { status: 404 })
    }

    // 验证页码范围
    if (page_number < 1 || page_number > (document as any).total_pages) {
      return NextResponse.json({
        error: `Invalid page_number. Must be between 1 and ${(document as any).total_pages}`
      }, { status: 400 })
    }

    // 如果是回复，验证父级标注是否存在
    if (reply_to) {
      const { data: parentAnnotation } = await supabase
        .from('pdf_annotations')
        .select('id')
        .eq('id', reply_to)
        .single()

      if (!parentAnnotation) {
        return NextResponse.json({
          error: 'Parent annotation not found'
        }, { status: 404 })
      }
    }

    // 获取当前用户ID（这里需要实现真实的认证逻辑）
    const userId = 'demo-user-id' // TODO: 从认证系统获取真实用户ID

    // 插入新的标注记录
    const { data: annotation, error } = await (supabase as any)
      .from('pdf_annotations')
      .insert([{
        pdf_document_id,
        user_id: userId,
        page_number,
        annotation_type,
        position_data,
        content,
        selected_text,
        color,
        opacity,
        tags,
        is_private,
        reply_to
      }])
      .select(`
        *,
        users:user_id(username, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Error creating PDF annotation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Annotation created successfully',
      annotation
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/pdf/annotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
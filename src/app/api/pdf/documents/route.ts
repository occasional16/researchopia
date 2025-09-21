import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MockAuthService } from '@/lib/mockAuth'

// GET /api/pdf/documents - 获取PDF文档列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock data for development
      return NextResponse.json({
        documents: [
          {
            id: 'mock-pdf-001',
            title: '示例论文：机器学习在学术评估中的应用',
            filename: 'sample-ml-paper.pdf',
            file_url: '/api/pdf/sample.pdf',
            total_pages: 15,
            file_size: 2048000,
            users: { username: 'demo', avatar_url: null },
            papers: { title: '机器学习在学术评估中的应用', authors: ['张三', '李四'] },
            stats: {
              total_annotations: 5,
              total_highlights: 3,
              total_notes: 2,
              total_bookmarks: 1,
              unique_users: 2,
              avg_annotations_per_page: 0.33
            },
            created_at: new Date().toISOString()
          }
        ],
        pagination: {
          page,
          limit,
          total: 1,
          totalPages: 1
        }
      })
    }

    // 查询PDF文档，包含上传者信息
    const { data: documents, error, count } = await supabase
      .from('pdf_documents')
      .select(`
        *,
        users:uploaded_by(username, avatar_url),
        papers:paper_id(title, authors)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching PDF documents:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 为每个文档获取标注统计
    const documentsWithStats = await Promise.all(
      (documents || []).map(async (doc: any) => {
        let stats = {
          total_annotations: 0,
          total_highlights: 0,
          total_notes: 0,
          total_bookmarks: 0,
          unique_users: 0,
          avg_annotations_per_page: 0
        }
        
        if (supabase) {
          const { data: statsData } = await (supabase as any).rpc('get_pdf_annotation_stats', {
            document_id: doc.id
          })
          stats = statsData?.[0] || stats
        }
        
        return {
          ...doc,
          stats
        }
      })
    )

    return NextResponse.json({
      documents: documentsWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Error in GET /api/pdf/documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/pdf/documents - 创建新的PDF文档记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      title, 
      filename, 
      file_url, 
      file_hash, 
      total_pages, 
      file_size, 
      paper_id 
    } = body

    // 验证必需字段
    if (!title || !filename || !file_url || !total_pages || !file_size) {
      return NextResponse.json({ 
        error: 'Missing required fields: title, filename, file_url, total_pages, file_size' 
      }, { status: 400 })
    }

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock response for development
      return NextResponse.json({
        message: 'PDF document created successfully (mock mode)',
        document: {
          id: `mock-pdf-${Date.now()}`,
          title,
          filename,
          file_url,
          total_pages,
          file_size,
          paper_id: paper_id || null,
          uploaded_by: 'mock-demo-001',
          users: { username: 'demo', avatar_url: null },
          created_at: new Date().toISOString()
        }
      }, { status: 201 })
    }

    // 检查文件哈希是否已存在（避免重复上传）
    if (file_hash) {
      const { data: existing } = await supabase
        .from('pdf_documents')
        .select('id, title')
        .eq('file_hash', file_hash)
        .single()
      
      if (existing) {
        return NextResponse.json({
          message: 'Document already exists',
          document: existing
        }, { status: 200 })
      }
    }

    // 如果提供了paper_id，验证论文是否存在
    if (paper_id) {
      const { data: paper } = await supabase
        .from('papers')
        .select('id')
        .eq('id', paper_id)
        .single()
      
      if (!paper) {
        return NextResponse.json({ 
          error: 'Invalid paper_id: paper does not exist' 
        }, { status: 400 })
      }
    }

    // 获取当前用户ID（这里需要实现真实的认证逻辑）
    const userId = 'demo-user-id' // TODO: 从认证系统获取真实用户ID

    // 插入新的PDF文档记录
    const { data: document, error } = await (supabase as any)
      .from('pdf_documents')
      .insert([{
        title,
        filename,
        file_url,
        file_hash,
        total_pages,
        file_size,
        paper_id: paper_id || null,
        uploaded_by: userId
      }])
      .select(`
        *,
        users:uploaded_by(username, avatar_url),
        papers:paper_id(title, authors)
      `)
      .single()

    if (error) {
      console.error('Error creating PDF document:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'PDF document created successfully',
      document 
    }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/pdf/documents:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
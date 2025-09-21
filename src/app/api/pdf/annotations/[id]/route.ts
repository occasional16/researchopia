import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MockAuthService } from '@/lib/mockAuth'

// GET /api/pdf/annotations/[id] - 获取特定标注详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock data for development
      return NextResponse.json({
        annotation: {
          id,
          pdf_document_id: 'mock-pdf-001',
          user_id: 'mock-demo-001',
          page_number: 1,
          annotation_type: 'highlight',
          position_data: {
            x: 100,
            y: 200,
            width: 200,
            height: 20,
            bounds: { left: 100, top: 200, right: 300, bottom: 220 }
          },
          content: '这是一个重要的观点',
          selected_text: '机器学习算法的准确性',
          color: '#ffff00',
          opacity: 0.3,
          tags: ['重要', '算法'],
          is_private: false,
          users: { username: 'demo', avatar_url: null },
          created_at: new Date().toISOString(),
          interactions: {
            likes: 2,
            dislikes: 0,
            helpful: 1,
            flags: 0
          }
        }
      })
    }

    // 查询标注详情
    const { data: annotation, error } = await supabase
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
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
      }
      console.error('Error fetching annotation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 获取交互统计
    const { data: interactions } = await supabase
      .from('pdf_annotation_interactions')
      .select('interaction_type')
      .eq('annotation_id', id)

    const stats = {
      likes: (interactions as any)?.filter((i: any) => i.interaction_type === 'like').length || 0,
      dislikes: (interactions as any)?.filter((i: any) => i.interaction_type === 'dislike').length || 0,
      helpful: (interactions as any)?.filter((i: any) => i.interaction_type === 'helpful').length || 0,
      flags: (interactions as any)?.filter((i: any) => i.interaction_type === 'flag').length || 0
    }

    return NextResponse.json({
      annotation: {
        ...(annotation as any),
        interactions: stats
      }
    })

  } catch (error) {
    console.error('Error in GET /api/pdf/annotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/pdf/annotations/[id] - 更新标注
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const {
      content,
      color,
      opacity,
      tags,
      is_private
    } = body

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock response for development
      return NextResponse.json({
        message: 'Annotation updated successfully (mock mode)',
        annotation: {
          id,
          content,
          color,
          opacity,
          tags,
          is_private,
          updated_at: new Date().toISOString()
        }
      })
    }

    // 先检查标注是否存在以及用户权限
    const { data: existing } = await supabase
      .from('pdf_annotations')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
    }

    // 获取当前用户ID（这里需要实现真实的认证逻辑）
    const userId = 'demo-user-id' // TODO: 从认证系统获取真实用户ID

    // 检查权限（只有标注作者可以编辑）
    if ((existing as any).user_id !== userId) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // 构建更新对象
    const updateData: any = {}
    if (content !== undefined) updateData.content = content
    if (color !== undefined) updateData.color = color
    if (opacity !== undefined) updateData.opacity = opacity
    if (tags !== undefined) updateData.tags = tags
    if (is_private !== undefined) updateData.is_private = is_private

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // 更新标注
    const { data: annotation, error } = await (supabase as any)
      .from('pdf_annotations')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        users:user_id(username, avatar_url)
      `)
      .single()

    if (error) {
      console.error('Error updating annotation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Annotation updated successfully',
      annotation
    })

  } catch (error) {
    console.error('Error in PUT /api/pdf/annotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/pdf/annotations/[id] - 删除标注
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if using Supabase or Mock mode
    if (!supabase || MockAuthService.shouldUseMockAuth()) {
      // Mock response for development
      return NextResponse.json({
        message: 'Annotation deleted successfully (mock mode)'
      })
    }

    // 先检查标注是否存在以及用户权限
    const { data: existing } = await supabase
      .from('pdf_annotations')
      .select('id, user_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
    }

    // 获取当前用户ID（这里需要实现真实的认证逻辑）
    const userId = 'demo-user-id' // TODO: 从认证系统获取真实用户ID

    // 检查权限（只有标注作者可以删除）
    if ((existing as any).user_id !== userId) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // 删除标注（级联删除相关的交互和回复）
    const { error } = await supabase
      .from('pdf_annotations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting annotation:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Annotation deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/pdf/annotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
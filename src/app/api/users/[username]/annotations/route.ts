import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/users/[username]/annotations
 * 获取用户的标注
 * 
 * Query params:
 * - limit: 每页数量 (默认20)
 * - offset: 偏移量 (默认0)
 * 
 * 返回: { success: true, annotations: Annotation[], total: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 获取用户ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 获取用户的标注（通过documents关联到papers）
    const { data: annotations, error: annotationsError } = await supabase
      .from('annotations')
      .select(`
        id,
        content,
        comment,
        position,
        color,
        tags,
        visibility,
        created_at,
        updated_at,
        documents (
          id,
          doi,
          title,
          authors,
          journal,
          paper_id,
          papers (
            id,
            doi,
            title,
            authors,
            journal
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (annotationsError) {
      throw annotationsError
    }

    // 获取总数
    const { count } = await supabase
      .from('annotations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('visibility', 'public')

    return NextResponse.json({
      success: true,
      annotations: annotations || [],
      total: count || 0
    })

  } catch (error) {
    console.error('Error fetching user annotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


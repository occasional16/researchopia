import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 首先获取论文的 DOI
    const { data: paper, error: paperError } = await supabase
      .from('papers')
      .select('doi')
      .eq('id', paperId)
      .single()

    if (paperError || !paper?.doi) {
      console.error('Error fetching paper or paper has no DOI:', paperError)
      return NextResponse.json({
        annotations: [],
        count: 0
      })
    }

    // 通过 DOI 查找 document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('doi', paper.doi)
      .single()

    if (docError || !document) {
      console.error('Error fetching document:', docError)
      return NextResponse.json({
        annotations: [],
        count: 0
      })
    }

    // 获取该文档的所有公开标注
    const { data: annotations, error: annotationsError } = await supabase
      .from('annotations')
      .select(`
        id,
        document_id,
        user_id,
        type,
        content,
        comment,
        color,
        position,
        tags,
        visibility,
        likes_count,
        comments_count,
        created_at,
        platform,
        quality_score,
        helpfulness_score,
        show_author_name,
        users:user_id (
          username,
          avatar_url
        )
      `)
      .eq('document_id', document.id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })

    if (annotationsError) {
      console.error('Error fetching annotations:', annotationsError)
      return NextResponse.json(
        { error: '获取标注失败' },
        { status: 500 }
      )
    }

    // 格式化返回数据
    const formattedAnnotations = (annotations || []).map(ann => {
      // 处理 users 可能是数组的情况
      const user = Array.isArray(ann.users) ? ann.users[0] : ann.users;
      
      return {
        annotation_id: ann.id,
        document_id: ann.document_id,
        user_id: ann.user_id,
        type: ann.type,
        content: ann.content,
        comment: ann.comment,
        color: ann.color,
        position: ann.position,
        tags: ann.tags,
        visibility: ann.visibility,
        likes_count: ann.likes_count || 0,
        comments_count: ann.comments_count || 0,
        created_at: ann.created_at,
        platform: ann.platform,
        quality_score: ann.quality_score,
        helpfulness_score: ann.helpfulness_score,
        display_name: ann.show_author_name === false ? '匿名用户' : (user?.username || '未知用户'),
        username: ann.show_author_name === false ? null : user?.username,
        user_avatar: ann.show_author_name === false ? null : user?.avatar_url
      };
    })

    return NextResponse.json({
      annotations: formattedAnnotations,
      count: formattedAnnotations.length
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}
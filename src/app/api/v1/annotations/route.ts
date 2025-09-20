import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { UniversalAnnotation, APIResponse } from '@/types/annotation-protocol';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 获取标注列表
 * GET /api/v1/annotations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const userId = searchParams.get('userId');
    const platform = searchParams.get('platform');
    const type = searchParams.get('type');
    const visibility = searchParams.get('visibility');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');

    let query = supabase
      .from('annotations')
      .select(`
        *,
        users:user_id (
          id,
          username,
          avatar_url
        ),
        documents:document_id (
          id,
          title,
          doi,
          authors
        )
      `)
      .order('created_at', { ascending: false });

    // 应用过滤条件
    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    if (search) {
      query = query.or(`content.ilike.%${search}%,comment.ilike.%${search}%`);
    }

    // 分页
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: annotations, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const response: APIResponse<{
      annotations: UniversalAnnotation[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = {
      success: true,
      data: {
        annotations: annotations || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'FETCH_ANNOTATIONS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

/**
 * 创建新标注
 * POST /api/v1/annotations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const annotation: Omit<UniversalAnnotation, 'id' | 'createdAt' | 'modifiedAt'> = body;

    // 验证必需字段
    if (!annotation.documentId || !annotation.metadata?.author?.id) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: documentId and author.id'
        }
      }, { status: 400 });
    }

    // 检查文档是否存在
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', annotation.documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found'
        }
      }, { status: 404 });
    }

    // 创建标注
    const { data: newAnnotation, error: createError } = await supabase
      .from('annotations')
      .insert({
        document_id: annotation.documentId,
        user_id: annotation.metadata.author.id,
        type: annotation.type,
        content: annotation.content?.text,
        comment: annotation.content?.comment,
        color: annotation.content?.color,
        position: annotation.content?.position,
        tags: annotation.metadata.tags || [],
        visibility: annotation.metadata.visibility || 'private',
        platform: annotation.metadata.platform || 'researchopia',
        original_id: annotation.metadata.originalData?.id,
        permissions: annotation.metadata.permissions || {}
      })
      .select(`
        *,
        users:user_id (
          id,
          username,
          avatar_url
        ),
        documents:document_id (
          id,
          title,
          doi,
          authors
        )
      `)
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    const response: APIResponse<{ annotation: UniversalAnnotation }> = {
      success: true,
      data: {
        annotation: {
          id: newAnnotation.id,
          type: newAnnotation.type,
          documentId: newAnnotation.document_id,
          createdAt: newAnnotation.created_at,
          modifiedAt: newAnnotation.updated_at,
          version: newAnnotation.version.toString(),
          content: {
            text: newAnnotation.content,
            comment: newAnnotation.comment,
            color: newAnnotation.color,
            position: newAnnotation.position
          },
          metadata: {
            platform: newAnnotation.platform,
            author: {
              id: newAnnotation.users.id,
              name: newAnnotation.users.username,
              avatar: newAnnotation.users.avatar_url,
              platform: newAnnotation.platform
            },
            tags: newAnnotation.tags,
            visibility: newAnnotation.visibility,
            permissions: newAnnotation.permissions,
            documentInfo: {
              title: newAnnotation.documents.title,
              doi: newAnnotation.documents.doi
            }
          }
        }
      }
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_ANNOTATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}

/**
 * 批量操作标注
 * PUT /api/v1/annotations
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, annotations } = body;

    if (!action || !annotations || !Array.isArray(annotations)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: action and annotations array'
        }
      }, { status: 400 });
    }

    const results = [];

    switch (action) {
      case 'create':
        for (const annotation of annotations) {
          try {
            const response = await POST(new NextRequest(request.url, {
              method: 'POST',
              body: JSON.stringify(annotation)
            }));
            const result = await response.json();
            results.push({
              id: annotation.id || 'unknown',
              success: result.success,
              error: result.error?.message
            });
          } catch (error) {
            results.push({
              id: annotation.id || 'unknown',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        break;

      case 'update':
        for (const annotation of annotations) {
          try {
            const { data, error } = await supabase
              .from('annotations')
              .update({
                content: annotation.content?.text,
                comment: annotation.content?.comment,
                color: annotation.content?.color,
                position: annotation.content?.position,
                tags: annotation.metadata?.tags,
                visibility: annotation.metadata?.visibility,
                permissions: annotation.metadata?.permissions
              })
              .eq('id', annotation.id)
              .select()
              .single();

            results.push({
              id: annotation.id,
              success: !error,
              error: error?.message
            });
          } catch (error) {
            results.push({
              id: annotation.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        break;

      case 'delete':
        for (const annotation of annotations) {
          try {
            const { error } = await supabase
              .from('annotations')
              .delete()
              .eq('id', annotation.id);

            results.push({
              id: annotation.id,
              success: !error,
              error: error?.message
            });
          } catch (error) {
            results.push({
              id: annotation.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        break;

      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: 'Invalid action. Supported actions: create, update, delete'
          }
        }, { status: 400 });
    }

    const response: APIResponse<{
      results: Array<{ id: string; success: boolean; error?: string }>;
      summary: {
        total: number;
        successful: number;
        failed: number;
      };
    }> = {
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in batch operation:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'BATCH_OPERATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 });
  }
}
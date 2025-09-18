// 跨平台标注分享API实现
// Cross-Platform Annotation Sharing API Implementation

import { NextRequest, NextResponse } from 'next/server';
import {
  UniversalAnnotation,
  APIResponse,
  BatchResult,
  SharingPermissions,
  AuthorInfo,
  VisibilityLevel
} from '@/types/annotation-protocol';
import { ConverterManager } from '@/lib/annotation-converters';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase客户端
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * 标注API路由处理器
 * Annotation API Route Handlers
 */

/**
 * POST /api/v1/annotations
 * 创建新标注
 */
export async function createAnnotation(request: NextRequest): Promise<NextResponse<APIResponse<UniversalAnnotation>>> {
  try {
    const annotation: UniversalAnnotation = await request.json();
    
    // 验证标注数据
    const validationResult = validateAnnotation(annotation);
    if (!validationResult.valid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid annotation data',
          details: validationResult.errors
        }
      }, { status: 400 });
    }
    
    // 检查权限
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }
    
    // 设置创建者信息
    annotation.metadata.author = user;
    annotation.createdAt = new Date().toISOString();
    annotation.modifiedAt = annotation.createdAt;
    
    // 保存到数据库
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('annotations')
      .insert([{
        id: annotation.id,
        document_id: annotation.documentId,
        type: annotation.type,
        position: annotation.position,
        content: annotation.content,
        metadata: annotation.metadata,
        created_at: annotation.createdAt,
        modified_at: annotation.modifiedAt,
        author_id: user.id,
        visibility: annotation.metadata.visibility
      }])
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save annotation',
          details: { error: error.message }
        }
      }, { status: 500 });
    }
    
    // 广播实时更新
    await broadcastAnnotationCreated(annotation);
    
    return NextResponse.json({
      success: true,
      data: annotation
    });
    
  } catch (error) {
    console.error('Create annotation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/v1/annotations/[id]
 * 获取指定标注
 */
export async function getAnnotation(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<APIResponse<UniversalAnnotation>>> {
  try {
    const { id } = params;
    const user = await getCurrentUser(request);
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('annotations')
      .select(`
        *,
        author:profiles(id, name, email, avatar_url),
        document:documents(id, title, url)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Annotation not found'
        }
      }, { status: 404 });
    }
    
    // 检查访问权限
    const hasAccess = await checkAnnotationAccess(data, user);
    if (!hasAccess) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      }, { status: 403 });
    }
    
    const annotation = mapDatabaseToUniversal(data);
    
    return NextResponse.json({
      success: true,
      data: annotation
    });
    
  } catch (error) {
    console.error('Get annotation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * PUT /api/v1/annotations/[id]
 * 更新标注
 */
export async function updateAnnotation(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<APIResponse<UniversalAnnotation>>> {
  try {
    const { id } = params;
    const updates: Partial<UniversalAnnotation> = await request.json();
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }
    
    // 获取现有标注
    const supabase = getSupabaseClient();
    const { data: existing, error: fetchError } = await supabase
      .from('annotations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !existing) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Annotation not found'
        }
      }, { status: 404 });
    }
    
    // 检查编辑权限
    const canEdit = await checkEditPermission(existing, user);
    if (!canEdit) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No permission to edit this annotation'
        }
      }, { status: 403 });
    }
    
    // 更新字段
    const updatedFields: any = {};
    if (updates.content) updatedFields.content = { ...existing.content, ...updates.content };
    if (updates.metadata) updatedFields.metadata = { ...existing.metadata, ...updates.metadata };
    if (updates.position) updatedFields.position = updates.position;
    
    updatedFields.modified_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('annotations')
      .update(updatedFields)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update annotation'
        }
      }, { status: 500 });
    }
    
    const updatedAnnotation = mapDatabaseToUniversal(data);
    
    // 广播实时更新
    await broadcastAnnotationUpdated(updatedAnnotation, updates);
    
    return NextResponse.json({
      success: true,
      data: updatedAnnotation
    });
    
  } catch (error) {
    console.error('Update annotation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/annotations/[id]
 * 删除标注
 */
export async function deleteAnnotation(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<APIResponse<{ deleted: boolean }>>> {
  try {
    const { id } = params;
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }
    
    // 获取标注信息
    const { data: annotation, error: fetchError } = await supabase
      .from('annotations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !annotation) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Annotation not found'
        }
      }, { status: 404 });
    }
    
    // 检查删除权限
    const canDelete = await checkDeletePermission(annotation, user);
    if (!canDelete) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No permission to delete this annotation'
        }
      }, { status: 403 });
    }
    
    // 软删除（标记为已删除）
    const { error } = await supabase
      .from('annotations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to delete annotation'
        }
      }, { status: 500 });
    }
    
    // 广播删除事件
    await broadcastAnnotationDeleted(id, annotation.document_id);
    
    return NextResponse.json({
      success: true,
      data: { deleted: true }
    });
    
  } catch (error) {
    console.error('Delete annotation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/v1/documents/[documentId]/annotations
 * 获取文档的所有标注
 */
export async function getDocumentAnnotations(
  request: NextRequest,
  { params }: { params: { documentId: string } }
): Promise<NextResponse<APIResponse<{ annotations: UniversalAnnotation[], total: number }>>> {
  try {
    const { documentId } = params;
    const { searchParams } = new URL(request.url);
    
    const platform = searchParams.get('platform')?.split(',');
    const type = searchParams.get('type')?.split(',');
    const author = searchParams.get('author');
    const visibility = searchParams.get('visibility') as VisibilityLevel;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const user = await getCurrentUser(request);
    
    let query = supabase
      .from('annotations')
      .select(`
        *,
        author:profiles(id, name, email, avatar_url)
      `)
      .eq('document_id', documentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    // 应用过滤器
    if (platform) {
      query = query.in('metadata->platform', platform);
    }
    
    if (type) {
      query = query.in('type', type);
    }
    
    if (author) {
      query = query.eq('author_id', author);
    }
    
    if (visibility) {
      query = query.eq('visibility', visibility);
    }
    
    // 权限过滤
    if (!user) {
      query = query.eq('visibility', 'public');
    } else {
      query = query.or(`visibility.eq.public,visibility.eq.shared,author_id.eq.${user.id}`);
    }
    
    // 分页
    const { data, error, count } = await query
      .range(offset, offset + limit - 1);
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch annotations'
        }
      }, { status: 500 });
    }
    
    const annotations = data.map(mapDatabaseToUniversal);
    
    return NextResponse.json({
      success: true,
      data: {
        annotations,
        total: count || 0
      },
      meta: {
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    });
    
  } catch (error) {
    console.error('Get document annotations error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * POST /api/v1/annotations/batch
 * 批量操作标注
 */
export async function batchAnnotations(request: NextRequest): Promise<NextResponse<APIResponse<BatchResult>>> {
  try {
    const { action, annotations } = await request.json();
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }
    
    const results: BatchResult['results'] = [];
    
    for (const annotation of annotations) {
      try {
        switch (action) {
          case 'create':
            await createAnnotationInternal(annotation, user);
            results.push({ id: annotation.id, success: true });
            break;
            
          case 'update':
            await updateAnnotationInternal(annotation, user);
            results.push({ id: annotation.id, success: true });
            break;
            
          case 'delete':
            await deleteAnnotationInternal(annotation.id, user);
            results.push({ id: annotation.id, success: true });
            break;
            
          default:
            results.push({ 
              id: annotation.id, 
              success: false, 
              error: 'Invalid action' 
            });
        }
      } catch (error) {
        results.push({ 
          id: annotation.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
    
    return NextResponse.json({
      success: true,
      data: {
        results,
        summary
      }
    });
    
  } catch (error) {
    console.error('Batch annotations error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, { status: 500 });
  }
}

/**
 * 工具函数
 * Utility Functions
 */

/**
 * 验证标注数据
 */
function validateAnnotation(annotation: UniversalAnnotation): { valid: boolean; errors?: any } {
  const errors: any = {};
  
  if (!annotation.id) errors.id = 'ID is required';
  if (!annotation.type) errors.type = 'Type is required';
  if (!annotation.documentId) errors.documentId = 'Document ID is required';
  if (!annotation.position) errors.position = 'Position is required';
  if (!annotation.metadata?.author) errors.author = 'Author information is required';
  
  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  };
}

/**
 * 获取当前用户
 */
async function getCurrentUser(request: NextRequest): Promise<AuthorInfo | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  // 实现JWT或其他认证逻辑
  // 这里简化处理
  try {
    const token = authHeader.replace('Bearer ', '');
    // 验证token并返回用户信息
    // 实际实现应该调用认证服务
    
    return {
      id: 'user-123',
      name: 'Test User',
      email: 'user@example.com',
      platform: 'researchopia',
      isAuthoritative: true
    };
  } catch {
    return null;
  }
}

/**
 * 检查标注访问权限
 */
async function checkAnnotationAccess(annotation: any, user: AuthorInfo | null): Promise<boolean> {
  if (annotation.visibility === 'public') return true;
  if (!user) return false;
  if (annotation.author_id === user.id) return true;
  if (annotation.visibility === 'shared') {
    // 检查是否在共享列表中
    // 实现具体的权限检查逻辑
    return true;
  }
  return false;
}

/**
 * 检查编辑权限
 */
async function checkEditPermission(annotation: any, user: AuthorInfo): Promise<boolean> {
  return annotation.author_id === user.id;
}

/**
 * 检查删除权限
 */
async function checkDeletePermission(annotation: any, user: AuthorInfo): Promise<boolean> {
  return annotation.author_id === user.id;
}

/**
 * 数据库记录转换为通用格式
 */
function mapDatabaseToUniversal(data: any): UniversalAnnotation {
  return {
    id: data.id,
    type: data.type,
    documentId: data.document_id,
    position: data.position,
    createdAt: data.created_at,
    modifiedAt: data.modified_at,
    content: data.content || {},
    metadata: {
      ...data.metadata,
      author: {
        id: data.author.id,
        name: data.author.name,
        email: data.author.email,
        avatar: data.author.avatar_url,
        platform: data.metadata.platform,
        isAuthoritative: data.metadata.author?.isAuthoritative || true
      }
    },
    extensions: data.extensions
  };
}

/**
 * 内部创建标注函数
 */
async function createAnnotationInternal(annotation: UniversalAnnotation, user: AuthorInfo) {
  annotation.metadata.author = user;
  annotation.createdAt = new Date().toISOString();
  annotation.modifiedAt = annotation.createdAt;
  
  const { error } = await supabase
    .from('annotations')
    .insert([{
      id: annotation.id,
      document_id: annotation.documentId,
      type: annotation.type,
      position: annotation.position,
      content: annotation.content,
      metadata: annotation.metadata,
      created_at: annotation.createdAt,
      modified_at: annotation.modifiedAt,
      author_id: user.id,
      visibility: annotation.metadata.visibility
    }]);
  
  if (error) throw new Error(`Failed to create annotation: ${error.message}`);
}

/**
 * 内部更新标注函数
 */
async function updateAnnotationInternal(annotation: Partial<UniversalAnnotation>, user: AuthorInfo) {
  const { error } = await supabase
    .from('annotations')
    .update({
      content: annotation.content,
      metadata: annotation.metadata,
      modified_at: new Date().toISOString()
    })
    .eq('id', annotation.id)
    .eq('author_id', user.id);  // 确保只能更新自己的标注
  
  if (error) throw new Error(`Failed to update annotation: ${error.message}`);
}

/**
 * 内部删除标注函数
 */
async function deleteAnnotationInternal(annotationId: string, user: AuthorInfo) {
  const { error } = await supabase
    .from('annotations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', annotationId)
    .eq('author_id', user.id);  // 确保只能删除自己的标注
  
  if (error) throw new Error(`Failed to delete annotation: ${error.message}`);
}

/**
 * 实时广播函数
 */
async function broadcastAnnotationCreated(annotation: UniversalAnnotation) {
  // 实现WebSocket广播逻辑
  console.log('Broadcasting annotation created:', annotation.id);
}

async function broadcastAnnotationUpdated(annotation: UniversalAnnotation, changes: Partial<UniversalAnnotation>) {
  // 实现WebSocket广播逻辑
  console.log('Broadcasting annotation updated:', annotation.id);
}

async function broadcastAnnotationDeleted(annotationId: string, documentId: string) {
  // 实现WebSocket广播逻辑
  console.log('Broadcasting annotation deleted:', annotationId);
}
// 跨平台标注分享API简化版
// Cross-Platform Annotation Sharing API (Simplified)

import { NextRequest, NextResponse } from 'next/server';
import {
  UniversalAnnotation,
  APIResponse,
  BatchResult,
  AuthorInfo,
  VisibilityLevel
} from '@/types/annotation-protocol';

// 模拟数据存储
const annotationsStore = new Map<string, UniversalAnnotation>();
const documentsStore = new Map<string, UniversalAnnotation[]>();

/**
 * POST /api/v1/annotations
 * 创建新标注
 */
export async function POST(request: NextRequest): Promise<NextResponse<APIResponse<UniversalAnnotation>>> {
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
    
    // 保存到存储
    annotationsStore.set(annotation.id, annotation);
    
    // 添加到文档标注列表
    const docAnnotations = documentsStore.get(annotation.documentId) || [];
    docAnnotations.push(annotation);
    documentsStore.set(annotation.documentId, docAnnotations);
    
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
 * GET /api/v1/annotations
 * 获取标注列表（支持查询参数）
 */
export async function GET(request: NextRequest): Promise<NextResponse<APIResponse<{ annotations: UniversalAnnotation[], total: number }>>> {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const platform = searchParams.get('platform')?.split(',');
    const type = searchParams.get('type')?.split(',');
    const author = searchParams.get('author');
    const visibility = searchParams.get('visibility') as VisibilityLevel;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const user = await getCurrentUser(request);
    
    let annotations: UniversalAnnotation[] = [];
    
    if (documentId) {
      // 获取特定文档的标注
      annotations = documentsStore.get(documentId) || [];
    } else {
      // 获取所有标注
      annotations = Array.from(annotationsStore.values());
    }
    
    // 应用过滤器
    if (platform) {
      annotations = annotations.filter(a => platform.includes(a.metadata.platform));
    }
    
    if (type) {
      annotations = annotations.filter(a => type.includes(a.type));
    }
    
    if (author) {
      annotations = annotations.filter(a => a.metadata.author.id === author);
    }
    
    if (visibility) {
      annotations = annotations.filter(a => a.metadata.visibility === visibility);
    }
    
    // 权限过滤
    annotations = annotations.filter(a => {
      if (a.metadata.visibility === 'public') return true;
      if (!user) return false;
      if (a.metadata.author.id === user.id) return true;
      if (a.metadata.visibility === 'shared') return true; // 简化处理
      return false;
    });
    
    // 排序
    annotations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // 分页
    const total = annotations.length;
    const paginatedAnnotations = annotations.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: {
        annotations: paginatedAnnotations,
        total
      },
      meta: {
        total,
        page: Math.floor(offset / limit) + 1,
        limit
      }
    });
    
  } catch (error) {
    console.error('Get annotations error:', error);
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
  
  try {
    const token = authHeader.replace('Bearer ', '');
    // 简化的用户验证
    if (token === 'test-token') {
      return {
        id: 'user-123',
        name: 'Test User',
        email: 'user@example.com',
        platform: 'researchopia',
        isAuthoritative: true
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 导出命名函数用于特定路由
export { POST as createAnnotation, GET as getAnnotations };
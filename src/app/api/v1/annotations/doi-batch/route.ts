/*
  DOI-based Annotation Batch Upload API
  Specialized endpoint for handling annotations from DOI-identified documents
*/

import { NextRequest, NextResponse } from 'next/server';
import { UniversalAnnotation } from '@/types/annotation-protocol';

interface DocumentIdentifier {
  type: 'doi' | 'isbn' | 'pmid' | 'zotero';
  value: string;
  normalized: string;
}

interface DOIBatchRequest {
  documentInfo: {
    identifier: DocumentIdentifier;
    title: string;
    authors: Array<{
      firstName: string;
      lastName: string;
      name: string;
      creatorType: string;
    }>;
    publication?: {
      journal?: string;
      volume?: string;
      issue?: string;
      pages?: string;
      publisher?: string;
      place?: string;
    };
    year?: string;
  };
  annotations: UniversalAnnotation[];
  source: string;
  version: string;
}

interface DOIBatchResponse {
  success: boolean;
  message: string;
  data?: {
    documentId: string;
    processedCount: number;
    annotations: Array<{
      id: string;
      status: 'created' | 'updated' | 'skipped' | 'error';
      message?: string;
    }>;
  };
  error?: string;
}

// 简化的内存存储（生产环境应使用数据库）
const annotationStore = new Map<string, UniversalAnnotation[]>();
const documentStore = new Map<string, any>();

export async function POST(request: NextRequest): Promise<NextResponse<DOIBatchResponse>> {
  try {
    const body: DOIBatchRequest = await request.json();
    
    // 验证请求数据
    const validation = validateDOIBatchRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid request data',
          error: validation.error
        },
        { status: 400 }
      );
    }
    
    // 生成文档ID（基于DOI或其他标识符）
    const documentId = generateDocumentId(body.documentInfo.identifier);
    
    // 存储文档信息
    documentStore.set(documentId, {
      id: documentId,
      identifier: body.documentInfo.identifier,
      title: body.documentInfo.title,
      authors: body.documentInfo.authors,
      publication: body.documentInfo.publication,
      year: body.documentInfo.year,
      source: body.source,
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    });
    
    // 处理标注
    const results = await processAnnotations(documentId, body.annotations);
    
    // 存储处理后的标注
    const existingAnnotations = annotationStore.get(documentId) || [];
    const newAnnotations = results
      .filter(r => r.status === 'created')
      .map(r => r.annotation)
      .filter(Boolean) as UniversalAnnotation[];
    
    annotationStore.set(documentId, [...existingAnnotations, ...newAnnotations]);
    
    const response: DOIBatchResponse = {
      success: true,
      message: `Successfully processed ${results.length} annotations for DOI document`,
      data: {
        documentId,
        processedCount: results.length,
        annotations: results.map(r => ({
          id: r.annotation?.id || '',
          status: r.status,
          message: r.message
        }))
      }
    };
    
    return NextResponse.json(response, { status: 201 });
    
  } catch (error) {
    console.error('DOI Batch Upload Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const doi = searchParams.get('doi');
    const documentId = searchParams.get('documentId');
    
    if (!doi && !documentId) {
      return NextResponse.json(
        { error: 'Either DOI or documentId parameter is required' },
        { status: 400 }
      );
    }
    
    const searchId = documentId || generateDocumentId({ type: 'doi', value: doi!, normalized: doi!.toLowerCase() });
    
    const document = documentStore.get(searchId);
    const annotations = annotationStore.get(searchId) || [];
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        document,
        annotations,
        total: annotations.length
      }
    });
    
  } catch (error) {
    console.error('DOI Annotation Retrieval Error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function validateDOIBatchRequest(body: DOIBatchRequest): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: 'Request body is required' };
  }
  
  if (!body.documentInfo) {
    return { valid: false, error: 'documentInfo is required' };
  }
  
  if (!body.documentInfo.identifier) {
    return { valid: false, error: 'Document identifier is required' };
  }
  
  if (!body.documentInfo.title) {
    return { valid: false, error: 'Document title is required' };
  }
  
  if (!Array.isArray(body.annotations)) {
    return { valid: false, error: 'annotations must be an array' };
  }
  
  // 验证DOI格式（如果是DOI类型）
  if (body.documentInfo.identifier.type === 'doi') {
    const doi = body.documentInfo.identifier.value;
    if (!doi.startsWith('10.')) {
      return { valid: false, error: 'Invalid DOI format' };
    }
  }
  
  return { valid: true };
}

function generateDocumentId(identifier: DocumentIdentifier): string {
  return `${identifier.type}_${identifier.normalized.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

async function processAnnotations(documentId: string, annotations: UniversalAnnotation[]) {
  const results = [];
  
  for (const annotation of annotations) {
    try {
      // 为每个标注生成唯一ID
      const fullId = `${documentId}_${annotation.id}`;
      
      // 检查是否已存在
      const existingAnnotations = annotationStore.get(documentId) || [];
      const exists = existingAnnotations.some(a => a.id === annotation.id);
      
      if (exists) {
        results.push({
          annotation,
          status: 'skipped' as const,
          message: 'Annotation already exists'
        });
        continue;
      }
      
      // 验证标注数据
      const validationResult = validateAnnotation(annotation);
      if (!validationResult.valid) {
        results.push({
          annotation,
          status: 'error' as const,
          message: validationResult.error
        });
        continue;
      }
      
      // 处理成功
      const processedAnnotation: UniversalAnnotation = {
        ...annotation,
        id: annotation.id || generateAnnotationId(),
        createdAt: annotation.createdAt || new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      };
      
      results.push({
        annotation: processedAnnotation,
        status: 'created' as const,
        message: 'Successfully created annotation'
      });
      
    } catch (error) {
      results.push({
        annotation,
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

function validateAnnotation(annotation: UniversalAnnotation): { valid: boolean; error?: string } {
  if (!annotation.type) {
    return { valid: false, error: 'Annotation type is required' };
  }
  
  if (!annotation.content?.text && !annotation.content?.comment) {
    return { valid: false, error: 'Annotation must have content text or comment' };
  }
  
  return { valid: true };
}

function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 用于调试的辅助函数
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // 清空存储（仅用于开发测试）
  annotationStore.clear();
  documentStore.clear();
  
  return NextResponse.json({
    success: true,
    message: 'Storage cleared'
  });
}
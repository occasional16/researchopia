/*
  Mendeley Annotation Converter
  Converts annotations between Mendeley format and Universal Annotation Protocol
*/

import { UniversalAnnotation, AnnotationConverter } from '@/types/annotation-protocol';

interface MendeleyAnnotation {
  id: string;
  type: 'highlight' | 'note' | 'comment';
  document_id: string;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  note?: string;
  color: {
    r: number;
    g: number;
    b: number;
  };
  author: {
    id: string;
    name: string;
    email?: string;
  };
  privacy_level: 'private' | 'group' | 'public';
  created: string; // ISO date string
  last_modified: string;
  tags?: string[];
  filehash?: string;
}

interface MendeleyDocument {
  id: string;
  title: string;
  authors?: Array<{
    first_name: string;
    last_name: string;
  }>;
  year?: number;
  source?: string;
  doi?: string;
  url?: string;
  file_hash?: string;
}

export class MendeleyAnnotationConverter implements AnnotationConverter<MendeleyAnnotation> {
  platform = 'mendeley' as const;

  /**
   * 将Mendeley标注转换为通用格式
   */
  async fromPlatform(
    mendeleyAnnotation: MendeleyAnnotation, 
    document?: MendeleyDocument
  ): Promise<UniversalAnnotation> {
    // 转换标注类型
    let annotationType: UniversalAnnotation['type'];
    switch (mendeleyAnnotation.type) {
      case 'highlight':
        annotationType = 'highlight';
        break;
      case 'note':
      case 'comment':
        annotationType = 'note';
        break;
      default:
        annotationType = 'highlight';
    }

    // 转换颜色格式
    const color = `rgb(${mendeleyAnnotation.color.r}, ${mendeleyAnnotation.color.g}, ${mendeleyAnnotation.color.b})`;

    // 转换可见性
    let visibility: UniversalAnnotation['metadata']['visibility'];
    switch (mendeleyAnnotation.privacy_level) {
      case 'public':
        visibility = 'public';
        break;
      case 'group':
        visibility = 'shared';
        break;
      case 'private':
      default:
        visibility = 'private';
    }

    // 构建文档信息
    let documentTitle = `Document ${mendeleyAnnotation.document_id}`;
    if (document) {
      documentTitle = document.title;
      if (document.authors && document.authors.length > 0) {
        const authorNames = document.authors
          .map(author => `${author.first_name} ${author.last_name}`)
          .join(', ');
        documentTitle += ` - ${authorNames}`;
      }
      if (document.year) {
        documentTitle += ` (${document.year})`;
      }
    }

    const universalAnnotation: UniversalAnnotation = {
      id: mendeleyAnnotation.id,
      type: annotationType,
      documentId: mendeleyAnnotation.document_id,
      content: {
        text: mendeleyAnnotation.text || '',
        comment: mendeleyAnnotation.note,
        color: color,
        position: {
          page: mendeleyAnnotation.page,
          start: { 
            x: mendeleyAnnotation.x, 
            y: mendeleyAnnotation.y 
          },
          end: { 
            x: mendeleyAnnotation.x + (mendeleyAnnotation.width || 0), 
            y: mendeleyAnnotation.y + (mendeleyAnnotation.height || 0) 
          }
        }
      },
      metadata: {
        platform: 'mendeley',
        author: {
          id: mendeleyAnnotation.author.id,
          name: mendeleyAnnotation.author.name,
          email: mendeleyAnnotation.author.email || ''
        },
        tags: mendeleyAnnotation.tags || [],
        visibility: visibility,
        permissions: {
          canEdit: [mendeleyAnnotation.author.id],
          canView: visibility === 'public' ? ['public'] : [mendeleyAnnotation.author.id]
        },
        documentInfo: {
          title: documentTitle,
          doi: document?.doi,
          url: document?.url
        },
        originalData: mendeleyAnnotation
      },
      createdAt: mendeleyAnnotation.created,
      modifiedAt: mendeleyAnnotation.last_modified,
      version: '1.0.0'
    };

    return universalAnnotation;
  }

  /**
   * 将通用格式转换为Mendeley标注
   */
  async toPlatform(universalAnnotation: UniversalAnnotation): Promise<MendeleyAnnotation> {
    // 转换标注类型
    let mendeleyType: MendeleyAnnotation['type'];
    switch (universalAnnotation.type) {
      case 'highlight':
        mendeleyType = 'highlight';
        break;
      case 'note':
        mendeleyType = 'note';
        break;
      default:
        mendeleyType = 'highlight';
    }

    // 解析颜色
    let color = { r: 255, g: 255, b: 0 }; // 默认黄色
    if (universalAnnotation.content?.color) {
      const colorStr = universalAnnotation.content.color;
      const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        color = {
          r: parseInt(rgbMatch[1]),
          g: parseInt(rgbMatch[2]),
          b: parseInt(rgbMatch[3])
        };
      } else if (colorStr.startsWith('#')) {
        // 处理十六进制颜色
        const hex = colorStr.slice(1);
        if (hex.length === 6) {
          color = {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
          };
        }
      }
    }

    // 转换可见性
    let privacyLevel: MendeleyAnnotation['privacy_level'];
    switch (universalAnnotation.metadata.visibility) {
      case 'public':
        privacyLevel = 'public';
        break;
      case 'shared':
        privacyLevel = 'group';
        break;
      case 'private':
      default:
        privacyLevel = 'private';
    }

    // 计算位置和尺寸
    const position = universalAnnotation.content?.position;
    const x = position?.start?.x || 0;
    const y = position?.start?.y || 0;
    const width = position?.end ? position.end.x - x : undefined;
    const height = position?.end ? position.end.y - y : undefined;

    const mendeleyAnnotation: MendeleyAnnotation = {
      id: universalAnnotation.id,
      type: mendeleyType,
      document_id: universalAnnotation.documentId,
      page: position?.page || 1,
      x: x,
      y: y,
      width: width,
      height: height,
      text: universalAnnotation.content?.text,
      note: universalAnnotation.content?.comment,
      color: color,
      author: {
        id: universalAnnotation.metadata.author.id,
        name: universalAnnotation.metadata.author.name,
        email: universalAnnotation.metadata.author.email
      },
      privacy_level: privacyLevel,
      created: universalAnnotation.createdAt,
      last_modified: universalAnnotation.modifiedAt,
      tags: universalAnnotation.metadata.tags,
      filehash: universalAnnotation.metadata.originalData?.filehash
    };

    return mendeleyAnnotation;
  }

  /**
   * 验证Mendeley标注格式
   */
  validate(annotation: unknown): annotation is MendeleyAnnotation {
    if (!annotation || typeof annotation !== 'object') {
      return false;
    }

    const ann = annotation as any;

    return (
      typeof ann.id === 'string' &&
      ['highlight', 'note', 'comment'].includes(ann.type) &&
      typeof ann.document_id === 'string' &&
      typeof ann.page === 'number' &&
      typeof ann.x === 'number' &&
      typeof ann.y === 'number' &&
      typeof ann.color === 'object' &&
      typeof ann.color.r === 'number' &&
      typeof ann.color.g === 'number' &&
      typeof ann.color.b === 'number' &&
      typeof ann.author === 'object' &&
      typeof ann.author.id === 'string' &&
      typeof ann.author.name === 'string' &&
      ['private', 'group', 'public'].includes(ann.privacy_level) &&
      typeof ann.created === 'string' &&
      typeof ann.last_modified === 'string'
    );
  }

  /**
   * 从Mendeley API导出数据
   */
  async exportFromAPI(accessToken: string, options?: {
    documentId?: string;
    folderId?: string;
    limit?: number;
  }): Promise<MendeleyAnnotation[]> {
    const baseUrl = 'https://api.mendeley.com';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.mendeley-annotation.1+json'
    };

    try {
      let url = `${baseUrl}/annotations`;
      const params = new URLSearchParams();

      if (options?.documentId) {
        params.append('document_id', options.documentId);
      }
      if (options?.folderId) {
        params.append('folder_id', options.folderId);
      }
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Mendeley API error: ${response.status} ${response.statusText}`);
      }

      const annotations = await response.json();
      
      // 验证数据格式
      if (!Array.isArray(annotations)) {
        throw new Error('Invalid response format from Mendeley API');
      }

      return annotations.filter(ann => this.validate(ann));
    } catch (error) {
      console.error('Error fetching Mendeley annotations:', error);
      throw error;
    }
  }

  /**
   * 批量转换Mendeley标注
   */
  async convertBatch(
    mendeleyAnnotations: MendeleyAnnotation[],
    documents?: Record<string, MendeleyDocument>
  ): Promise<UniversalAnnotation[]> {
    const converted: UniversalAnnotation[] = [];

    for (const annotation of mendeleyAnnotations) {
      try {
        const document = documents?.[annotation.document_id];
        const universalAnnotation = await this.fromPlatform(annotation, document);
        converted.push(universalAnnotation);
      } catch (error) {
        console.error(`Error converting Mendeley annotation ${annotation.id}:`, error);
      }
    }

    return converted;
  }

  /**
   * 获取支持的导出格式
   */
  getSupportedFormats(): string[] {
    return ['json', 'bibtex', 'csv'];
  }

  /**
   * 导出为指定格式
   */
  async exportToFormat(annotations: MendeleyAnnotation[], format: string): Promise<string> {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(annotations, null, 2);
        
      case 'csv':
        if (annotations.length === 0) return '';
        
        const headers = [
          'id', 'type', 'document_id', 'page', 'text', 'note', 
          'author_name', 'privacy_level', 'created', 'tags'
        ];
        
        const rows = annotations.map(ann => [
          ann.id,
          ann.type,
          ann.document_id,
          ann.page,
          ann.text || '',
          ann.note || '',
          ann.author.name,
          ann.privacy_level,
          ann.created,
          (ann.tags || []).join('; ')
        ]);
        
        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        return csvContent;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}
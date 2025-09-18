/*
  Adobe Reader Annotation Converter
  Converts annotations between Adobe Reader format and Universal Annotation Protocol
*/

import { UniversalAnnotation, AnnotationConverter } from '@/types/annotation-protocol';

interface AdobeAnnotation {
  id: string;
  type: 'Highlight' | 'Note' | 'Text' | 'Underline' | 'Squiggly' | 'StrikeOut' | 'FreeText' | 'Ink';
  page: number;
  rect: [number, number, number, number]; // [x1, y1, x2, y2]
  contents?: string; // 注释内容
  richContents?: string; // 富文本内容
  quadPoints?: number[]; // 高亮区域的四边形点
  inkList?: number[][]; // 手绘路径点
  color: [number, number, number]; // RGB颜色值 (0-1)
  opacity?: number; // 透明度 (0-1)
  author: string;
  subject?: string; // 主题
  title?: string; // 标题
  creationDate: string; // D:YYYYMMDDHHmmSSOHH'mm format
  modDate: string;
  uniqueID?: string;
  inReplyTo?: string; // 回复的标注ID
  popup?: {
    open: boolean;
    rect: [number, number, number, number];
  };
  appearance?: {
    normal?: string; // AP字典
  };
  border?: {
    width: number;
    style: 'solid' | 'dashed' | 'beveled' | 'inset' | 'underline';
    dashArray?: number[];
  };
  markup?: {
    text: string; // 标记的文本
    quadPoints: number[]; // 文本位置
  };
}

interface AdobeDocument {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pages: number;
  path: string;
  fileSize: number;
  checksum?: string;
}

export class AdobeAnnotationConverter implements AnnotationConverter<AdobeAnnotation> {
  platform = 'adobe-reader' as const;

  /**
   * 将Adobe标注转换为通用格式
   */
  async fromPlatform(
    adobeAnnotation: AdobeAnnotation, 
    document?: AdobeDocument
  ): Promise<UniversalAnnotation> {
    // 转换标注类型
    let annotationType: UniversalAnnotation['type'];
    switch (adobeAnnotation.type) {
      case 'Highlight':
      case 'Squiggly':
        annotationType = 'highlight';
        break;
      case 'Underline':
        annotationType = 'underline';
        break;
      case 'StrikeOut':
        annotationType = 'strikeout';
        break;
      case 'Note':
      case 'Text':
      case 'FreeText':
        annotationType = 'note';
        break;
      case 'Ink':
        annotationType = 'ink';
        break;
      default:
        annotationType = 'note';
    }

    // 转换颜色格式 (Adobe使用0-1范围，我们转换为RGB)
    const [r, g, b] = adobeAnnotation.color;
    const color = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

    // 解析PDF日期格式 (D:YYYYMMDDHHmmSSOHH'mm)
    const parseAdobeDate = (dateStr: string): string => {
      try {
        // 移除D:前缀并解析
        const cleanDate = dateStr.replace(/^D:/, '');
        const year = cleanDate.substring(0, 4);
        const month = cleanDate.substring(4, 6);
        const day = cleanDate.substring(6, 8);
        const hour = cleanDate.substring(8, 10) || '00';
        const minute = cleanDate.substring(10, 12) || '00';
        const second = cleanDate.substring(12, 14) || '00';
        
        const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        return new Date(isoDate).toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    // 计算位置信息
    const [x1, y1, x2, y2] = adobeAnnotation.rect;
    const position = {
      page: adobeAnnotation.page,
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    };

    // 提取标记的文本
    let markedText = '';
    if (adobeAnnotation.markup?.text) {
      markedText = adobeAnnotation.markup.text;
    }

    // 构建文档信息
    let documentTitle = `Page ${adobeAnnotation.page}`;
    if (document) {
      documentTitle = document.title || document.path;
    }

    const universalAnnotation: UniversalAnnotation = {
      id: adobeAnnotation.id,
      type: annotationType,
      documentId: document?.path || `adobe-doc-${adobeAnnotation.id}`,
      content: {
        text: markedText || undefined,
        comment: adobeAnnotation.contents || adobeAnnotation.richContents,
        color: color,
        position: position
      },
      metadata: {
        platform: 'adobe-reader',
        author: {
          id: adobeAnnotation.author || 'unknown',
          name: adobeAnnotation.author || 'Unknown User',
          platform: 'adobe-reader'
        },
        tags: [], // Adobe Reader没有内置标签系统
        visibility: 'private', // Adobe标注通常是私有的
        permissions: {
          canEdit: [adobeAnnotation.author || 'unknown'],
          canView: [adobeAnnotation.author || 'unknown']
        },
        documentInfo: {
          title: documentTitle,
          url: document?.path
        },
        originalData: {
          rect: adobeAnnotation.rect,
          quadPoints: adobeAnnotation.quadPoints,
          inkList: adobeAnnotation.inkList,
          opacity: adobeAnnotation.opacity,
          subject: adobeAnnotation.subject,
          title: adobeAnnotation.title,
          border: adobeAnnotation.border,
          appearance: adobeAnnotation.appearance,
          popup: adobeAnnotation.popup,
          inReplyTo: adobeAnnotation.inReplyTo
        }
      },
      createdAt: parseAdobeDate(adobeAnnotation.creationDate),
      modifiedAt: parseAdobeDate(adobeAnnotation.modDate),
      version: '1.0.0'
    };

    return universalAnnotation;
  }

  /**
   * 将通用格式转换为Adobe标注
   */
  async toPlatform(universalAnnotation: UniversalAnnotation): Promise<AdobeAnnotation> {
    // 转换标注类型
    let adobeType: AdobeAnnotation['type'];
    switch (universalAnnotation.type) {
      case 'highlight':
        adobeType = 'Highlight';
        break;
      case 'underline':
        adobeType = 'Underline';
        break;
      case 'strikeout':
        adobeType = 'StrikeOut';
        break;
      case 'note':
      case 'text':
        adobeType = 'Note';
        break;
      case 'ink':
        adobeType = 'Ink';
        break;
      default:
        adobeType = 'Highlight';
    }

    // 转换颜色格式（转换为0-1范围）
    let color: [number, number, number] = [1, 1, 0]; // 默认黄色
    if (universalAnnotation.content?.color) {
      const colorStr = universalAnnotation.content.color;
      const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        color = [
          parseInt(rgbMatch[1]) / 255,
          parseInt(rgbMatch[2]) / 255,
          parseInt(rgbMatch[3]) / 255
        ];
      }
    }

    // 转换日期格式为Adobe格式
    const formatAdobeDate = (isoDate: string): string => {
      const date = new Date(isoDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const second = String(date.getSeconds()).padStart(2, '0');
      
      return `D:${year}${month}${day}${hour}${minute}${second}+00'00`;
    };

    // 计算矩形坐标
    const position = universalAnnotation.content?.position;
    const rect: [number, number, number, number] = position ? [
      position.start?.x || 0,
      position.start?.y || 0,
      position.end?.x || 0,
      position.end?.y || 0
    ] : [0, 0, 0, 0];

    // 构建标记文本的四边形点（如果有文本）
    let quadPoints: number[] | undefined;
    let markup: AdobeAnnotation['markup'] | undefined;
    
    if (universalAnnotation.content?.text && position) {
      quadPoints = [
        position.start?.x || 0, position.end?.y || 0,   // 左上
        position.end?.x || 0, position.end?.y || 0,     // 右上
        position.start?.x || 0, position.start?.y || 0, // 左下
        position.end?.x || 0, position.start?.y || 0    // 右下
      ];
      
      markup = {
        text: universalAnnotation.content.text,
        quadPoints: quadPoints
      };
    }

    const adobeAnnotation: AdobeAnnotation = {
      id: universalAnnotation.id,
      type: adobeType,
      page: position?.page || 1,
      rect: rect,
      contents: universalAnnotation.content?.comment,
      quadPoints: quadPoints,
      inkList: universalAnnotation.metadata.originalData?.inkList,
      color: color,
      opacity: universalAnnotation.metadata.originalData?.opacity || 1.0,
      author: universalAnnotation.metadata.author.name,
      subject: universalAnnotation.metadata.originalData?.subject,
      title: universalAnnotation.metadata.originalData?.title,
      creationDate: formatAdobeDate(universalAnnotation.createdAt),
      modDate: formatAdobeDate(universalAnnotation.modifiedAt),
      uniqueID: universalAnnotation.id,
      inReplyTo: universalAnnotation.metadata.originalData?.inReplyTo,
      popup: universalAnnotation.metadata.originalData?.popup,
      appearance: universalAnnotation.metadata.originalData?.appearance,
      border: universalAnnotation.metadata.originalData?.border,
      markup: markup
    };

    return adobeAnnotation;
  }

  /**
   * 验证Adobe标注格式
   */
  validate(annotation: unknown): annotation is AdobeAnnotation {
    if (!annotation || typeof annotation !== 'object') {
      return false;
    }

    const ann = annotation as any;

    return (
      typeof ann.id === 'string' &&
      typeof ann.type === 'string' &&
      typeof ann.page === 'number' &&
      Array.isArray(ann.rect) &&
      ann.rect.length === 4 &&
      Array.isArray(ann.color) &&
      ann.color.length === 3 &&
      typeof ann.author === 'string' &&
      typeof ann.creationDate === 'string' &&
      typeof ann.modDate === 'string'
    );
  }

  /**
   * 从PDF文件提取标注数据（需要PDF处理库）
   */
  async extractFromPDF(pdfPath: string): Promise<AdobeAnnotation[]> {
    // 注意：这里需要一个PDF处理库，如pdf-lib或pdf2pic
    // 这是一个示例实现
    
    try {
      // 模拟PDF标注提取
      console.log(`Extracting annotations from PDF: ${pdfPath}`);
      
      // 实际实现需要：
      // 1. 读取PDF文件
      // 2. 解析注释对象
      // 3. 提取标注数据
      // 4. 转换为我们的格式
      
      // 这里返回空数组作为占位符
      return [];
    } catch (error) {
      console.error('Error extracting annotations from PDF:', error);
      throw error;
    }
  }

  /**
   * 批量转换Adobe标注
   */
  async convertBatch(
    adobeAnnotations: AdobeAnnotation[],
    document?: AdobeDocument
  ): Promise<UniversalAnnotation[]> {
    const converted: UniversalAnnotation[] = [];

    for (const annotation of adobeAnnotations) {
      try {
        const universalAnnotation = await this.fromPlatform(annotation, document);
        converted.push(universalAnnotation);
      } catch (error) {
        console.error(`Error converting Adobe annotation ${annotation.id}:`, error);
      }
    }

    return converted;
  }

  /**
   * 获取支持的导出格式
   */
  getSupportedFormats(): string[] {
    return ['json', 'csv', 'fdf', 'xfdf'];
  }

  /**
   * 导出为指定格式
   */
  async exportToFormat(annotations: AdobeAnnotation[], format: string): Promise<string> {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(annotations, null, 2);
        
      case 'csv':
        if (annotations.length === 0) return '';
        
        const headers = [
          'id', 'type', 'page', 'author', 'contents', 'text', 
          'color', 'created', 'modified', 'x1', 'y1', 'x2', 'y2'
        ];
        
        const rows = annotations.map(ann => [
          ann.id,
          ann.type,
          ann.page,
          ann.author,
          ann.contents || '',
          ann.markup?.text || '',
          `rgb(${ann.color.map(c => Math.round(c * 255)).join(',')})`,
          ann.creationDate,
          ann.modDate,
          ann.rect[0],
          ann.rect[1],
          ann.rect[2],
          ann.rect[3]
        ]);
        
        const csvContent = [headers, ...rows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        return csvContent;
        
      case 'fdf':
      case 'xfdf':
        // Forms Data Format / XML Forms Data Format
        // 这些是Adobe的标准交换格式
        return this.generateXFDF(annotations);
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 生成XFDF格式
   */
  private generateXFDF(annotations: AdobeAnnotation[]): string {
    let xfdf = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xfdf += '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n';
    xfdf += '  <annots>\n';

    for (const ann of annotations) {
      const colorHex = ann.color.map(c => 
        Math.round(c * 255).toString(16).padStart(2, '0')
      ).join('');

      xfdf += `    <${ann.type.toLowerCase()}`;
      xfdf += ` page="${ann.page}"`;
      xfdf += ` rect="${ann.rect.join(',')}"`;
      xfdf += ` color="#${colorHex}"`;
      xfdf += ` title="${this.escapeXML(ann.author)}"`;
      xfdf += ` date="${ann.modDate}"`;
      
      if (ann.quadPoints) {
        xfdf += ` coords="${ann.quadPoints.join(',')}"`;
      }
      
      xfdf += '>';
      
      if (ann.contents) {
        xfdf += `<contents>${this.escapeXML(ann.contents)}</contents>`;
      }
      
      xfdf += `</${ann.type.toLowerCase()}>\n`;
    }

    xfdf += '  </annots>\n';
    xfdf += '</xfdf>';
    
    return xfdf;
  }

  /**
   * XML转义
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
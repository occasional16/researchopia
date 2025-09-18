// 跨平台标注格式转换器
// Cross-Platform Annotation Format Converters

import {
  UniversalAnnotation,
  ZoteroAnnotation,
  MendeleyAnnotation,
  AnnotationType,
  PositionInfo,
  PDFPosition,
  EPUBPosition,
  WebPosition,
  AuthorInfo,
  TextQuoteSelector,
  TextPositionSelector,
  CssSelector,
  FragmentSelector
} from '@/types/annotation-protocol';

/**
 * 基础转换器抽象类
 * Base Converter Abstract Class
 */
export abstract class BaseConverter {
  protected static generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  protected static generateSortIndex(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${timestamp}|${random}`;
  }
  
  protected static formatDate(date: Date | string): string {
    return new Date(date).toISOString();
  }
}

/**
 * Zotero格式转换器
 * Zotero Format Converter
 */
export class ZoteroConverter extends BaseConverter {
  /**
   * 将Zotero标注转换为通用格式
   */
  static toUniversal(zotero: ZoteroAnnotation): UniversalAnnotation {
    return {
      id: zotero.id,
      type: this.mapZoteroType(zotero.type),
      documentId: this.extractDocumentId(zotero),
      position: this.convertZoteroPosition(zotero.position),
      createdAt: zotero.dateCreated,
      modifiedAt: zotero.dateModified,
      content: {
        text: zotero.text || undefined,
        comment: zotero.comment || undefined,
        color: zotero.color || undefined
      },
      metadata: {
        platform: 'zotero',
        version: '1.0',
        author: {
          id: zotero.authorName || 'anonymous',
          name: zotero.authorName || 'Anonymous',
          platform: 'zotero',
          isAuthoritative: zotero.isAuthorNameAuthoritative || false
        },
        tags: zotero.tags || [],
        visibility: 'private'
      },
      extensions: {
        zotero: {
          sortIndex: zotero.sortIndex,
          pageLabel: zotero.pageLabel,
          readOnly: zotero.readOnly
        }
      }
    };
  }
  
  /**
   * 将通用格式转换为Zotero标注
   */
  static fromUniversal(universal: UniversalAnnotation): ZoteroAnnotation {
    const extensions = universal.extensions?.zotero as any || {};
    
    return {
      id: universal.id,
      type: universal.type,
      color: universal.content?.color || '#ffd400',
      sortIndex: extensions.sortIndex || this.generateSortIndex(),
      position: this.convertUniversalPosition(universal.position),
      text: universal.content?.text || '',
      comment: universal.content?.comment || '',
      tags: universal.metadata.tags || [],
      dateCreated: universal.createdAt,
      dateModified: universal.modifiedAt,
      authorName: universal.metadata.author.name,
      isAuthorNameAuthoritative: universal.metadata.author.isAuthoritative,
      pageLabel: extensions.pageLabel || '',
      readOnly: extensions.readOnly || false
    };
  }
  
  /**
   * 映射Zotero标注类型到通用类型
   */
  private static mapZoteroType(zoteroType: string): AnnotationType {
    const typeMap: Record<string, AnnotationType> = {
      'highlight': 'highlight',
      'underline': 'underline',
      'strikeout': 'strikeout',
      'note': 'note',
      'text': 'text',
      'ink': 'ink',
      'image': 'image',
      'area': 'image'  // Zotero的area类型映射为image
    };
    
    return typeMap[zoteroType] || 'note';
  }
  
  /**
   * 提取文档ID
   */
  private static extractDocumentId(zotero: ZoteroAnnotation): string {
    // 实际实现中应该从Zotero数据库或API获取
    return 'document-' + this.generateId();
  }
  
  /**
   * 转换Zotero位置信息到通用格式
   */
  private static convertZoteroPosition(position: any): PositionInfo {
    if (!position) {
      throw new Error('Position information is required');
    }
    
    // 检查是否为PDF位置
    if ('pageIndex' in position && typeof position.pageIndex === 'number') {
      return {
        documentType: 'pdf',
        pdf: {
          pageIndex: position.pageIndex,
          rects: position.rects,
          paths: position.paths,
          rotation: position.rotation,
          fontSize: position.fontSize,
          width: position.width,
          height: position.height
        }
      };
    }
    
    // 检查是否为EPUB位置（FragmentSelector）
    if (position.type === 'FragmentSelector') {
      return {
        documentType: 'epub',
        epub: {
          cfi: position.value,
          spineIndex: position.spineIndex
        }
      };
    }
    
    // 检查是否为Web位置
    if (position.type === 'TextQuoteSelector' || 
        position.type === 'TextPositionSelector' ||
        position.type === 'CssSelector') {
      return {
        documentType: 'html',
        web: {
          selector: position,
          url: '',  // 需要从上下文获取
          title: position.title
        }
      };
    }
    
    // 默认处理为文本位置
    return {
      documentType: 'text',
      text: {
        startOffset: position.start || 0,
        endOffset: position.end || 0,
        context: position.exact || position.text
      }
    };
  }
  
  /**
   * 转换通用位置信息到Zotero格式
   */
  private static convertUniversalPosition(position: PositionInfo): any {
    switch (position.documentType) {
      case 'pdf':
        return position.pdf;
        
      case 'epub':
        if (position.epub) {
          return {
            type: 'FragmentSelector',
            conformsTo: 'http://www.idpf.org/epub/linking/cfi/epub-cfi.html',
            value: position.epub.cfi
          };
        }
        break;
        
      case 'html':
        if (position.web) {
          return position.web.selector;
        }
        break;
        
      case 'text':
        if (position.text) {
          return {
            type: 'TextPositionSelector',
            start: position.text.startOffset,
            end: position.text.endOffset
          };
        }
        break;
    }
    
    throw new Error('Unable to convert position information');
  }
}

/**
 * Mendeley格式转换器
 * Mendeley Format Converter
 */
export class MendeleyConverter extends BaseConverter {
  /**
   * 将Mendeley标注转换为通用格式
   */
  static toUniversal(mendeley: MendeleyAnnotation): UniversalAnnotation {
    return {
      id: mendeley.uuid,
      type: this.mapMendeleyType(mendeley.type),
      documentId: mendeley.documentId,
      position: this.convertMendeleyPosition(mendeley.positions),
      createdAt: mendeley.created,
      modifiedAt: mendeley.last_modified,
      content: {
        text: mendeley.text || undefined,
        comment: mendeley.note || undefined,
        color: mendeley.color?.hex || undefined
      },
      metadata: {
        platform: 'mendeley',
        version: '1.0',
        author: {
          id: mendeley.profile_id,
          name: this.getMendeleyAuthorName(mendeley),
          platform: 'mendeley',
          isAuthoritative: true
        },
        tags: [],  // Mendeley标注通常不包含标签
        visibility: this.mapMendeleyVisibility(mendeley.privacy_level)
      },
      extensions: {
        mendeley: {
          profileId: mendeley.profile_id,
          color: mendeley.color
        }
      }
    };
  }
  
  /**
   * 将通用格式转换为Mendeley标注
   */
  static fromUniversal(universal: UniversalAnnotation): MendeleyAnnotation {
    const extensions = universal.extensions?.mendeley as any || {};
    
    return {
      uuid: universal.id,
      type: this.mapUniversalTypeToMendeley(universal.type),
      documentId: universal.documentId,
      positions: this.convertUniversalPositionToMendeley(universal.position),
      created: universal.createdAt,
      last_modified: universal.modifiedAt,
      text: universal.content?.text,
      note: universal.content?.comment,
      color: this.parseMendeleyColor(universal.content?.color),
      profile_id: extensions.profileId || universal.metadata.author.id,
      author: this.parseMendeleyAuthor(universal.metadata.author.name),
      privacy_level: this.mapVisibilityToMendeley(universal.metadata.visibility)
    };
  }
  
  /**
   * 映射Mendeley标注类型
   */
  private static mapMendeleyType(mendeleyType: string): AnnotationType {
    const typeMap: Record<string, AnnotationType> = {
      'highlight': 'highlight',
      'note': 'note',
      'sticky_note': 'note',
      'underline': 'underline'
    };
    
    return typeMap[mendeleyType] || 'note';
  }
  
  /**
   * 映射通用类型到Mendeley类型
   */
  private static mapUniversalTypeToMendeley(universalType: AnnotationType): string {
    const typeMap: Record<AnnotationType, string> = {
      'highlight': 'highlight',
      'note': 'sticky_note',
      'underline': 'underline',
      'strikeout': 'highlight',  // Mendeley没有删除线，映射为高亮
      'text': 'sticky_note',
      'ink': 'sticky_note',
      'image': 'highlight',
      'shape': 'highlight'
    };
    
    return typeMap[universalType] || 'sticky_note';
  }
  
  /**
   * 获取Mendeley作者姓名
   */
  private static getMendeleyAuthorName(mendeley: MendeleyAnnotation): string {
    if (mendeley.author) {
      return `${mendeley.author.first_name} ${mendeley.author.last_name}`.trim();
    }
    return 'Anonymous';
  }
  
  /**
   * 映射Mendeley可见性
   */
  private static mapMendeleyVisibility(privacy: 'private' | 'group' | 'public'): 'private' | 'shared' | 'public' {
    const visibilityMap = {
      'private': 'private' as const,
      'group': 'shared' as const,
      'public': 'public' as const
    };
    
    return visibilityMap[privacy] || 'private';
  }
  
  /**
   * 映射可见性到Mendeley格式
   */
  private static mapVisibilityToMendeley(visibility: 'private' | 'shared' | 'public'): 'private' | 'group' | 'public' {
    const visibilityMap = {
      'private': 'private' as const,
      'shared': 'group' as const,
      'public': 'public' as const
    };
    
    return visibilityMap[visibility] || 'private';
  }
  
  /**
   * 转换Mendeley位置信息
   */
  private static convertMendeleyPosition(positions: any[]): PositionInfo {
    if (!positions || positions.length === 0) {
      throw new Error('Position information is required');
    }
    
    const position = positions[0];  // 取第一个位置
    
    // PDF位置
    if (position.page !== undefined) {
      return {
        documentType: 'pdf',
        pdf: {
          pageIndex: position.page,
          rects: position.bounding_boxes || [],
          rotation: position.rotation || 0
        }
      };
    }
    
    // 文本位置
    return {
      documentType: 'text',
      text: {
        startOffset: position.start_offset || 0,
        endOffset: position.end_offset || 0,
        context: position.text
      }
    };
  }
  
  /**
   * 转换通用位置到Mendeley格式
   */
  private static convertUniversalPositionToMendeley(position: PositionInfo): any[] {
    switch (position.documentType) {
      case 'pdf':
        if (position.pdf) {
          return [{
            page: position.pdf.pageIndex,
            bounding_boxes: position.pdf.rects || [],
            rotation: position.pdf.rotation || 0
          }];
        }
        break;
        
      case 'text':
        if (position.text) {
          return [{
            start_offset: position.text.startOffset,
            end_offset: position.text.endOffset,
            text: position.text.context
          }];
        }
        break;
    }
    
    return [];
  }
  
  /**
   * 解析Mendeley颜色格式
   */
  private static parseMendeleyColor(hexColor?: string) {
    if (!hexColor) return undefined;
    
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return {
      hex: hexColor,
      r,
      g,
      b
    };
  }
  
  /**
   * 解析作者信息为Mendeley格式
   */
  private static parseMendeleyAuthor(name: string) {
    const parts = name.split(' ');
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || ''
    };
  }
}

/**
 * Hypothesis格式转换器
 * Hypothesis Format Converter
 */
export class HypothesisConverter extends BaseConverter {
  /**
   * 将Hypothesis标注转换为通用格式
   */
  static toUniversal(hypothesis: any): UniversalAnnotation {
    return {
      id: hypothesis.id,
      type: this.mapHypothesisType(hypothesis.motivation),
      documentId: hypothesis.uri,
      position: this.convertHypothesisPosition(hypothesis.target),
      createdAt: hypothesis.created,
      modifiedAt: hypothesis.updated,
      content: {
        text: hypothesis.target?.[0]?.selector?.find((s: any) => s.type === 'TextQuoteSelector')?.exact,
        comment: hypothesis.text,
        color: '#ffff00'  // Hypothesis默认黄色
      },
      metadata: {
        platform: 'hypothesis',
        version: '1.0',
        author: {
          id: hypothesis.user,
          name: hypothesis.user_info?.display_name || hypothesis.user,
          platform: 'hypothesis',
          isAuthoritative: true
        },
        tags: hypothesis.tags || [],
        visibility: this.mapHypothesisVisibility(hypothesis.permissions)
      },
      extensions: {
        hypothesis: {
          group: hypothesis.group,
          permissions: hypothesis.permissions,
          links: hypothesis.links
        }
      }
    };
  }
  
  /**
   * 映射Hypothesis动机到标注类型
   */
  private static mapHypothesisType(motivation?: string): AnnotationType {
    const typeMap: Record<string, AnnotationType> = {
      'highlighting': 'highlight',
      'commenting': 'note',
      'bookmarking': 'note',
      'tagging': 'note'
    };
    
    return typeMap[motivation || ''] || 'note';
  }
  
  /**
   * 转换Hypothesis位置信息
   */
  private static convertHypothesisPosition(target: any[]): PositionInfo {
    if (!target || target.length === 0) {
      throw new Error('Target information is required');
    }
    
    const firstTarget = target[0];
    const selectors = firstTarget.selector || [];
    
    // 查找文本选择器
    const textQuoteSelector = selectors.find((s: any) => s.type === 'TextQuoteSelector');
    const textPositionSelector = selectors.find((s: any) => s.type === 'TextPositionSelector');
    const rangeSelector = selectors.find((s: any) => s.type === 'RangeSelector');
    
    if (textQuoteSelector) {
      return {
        documentType: 'html',
        web: {
          selector: {
            type: 'TextQuoteSelector',
            exact: textQuoteSelector.exact,
            prefix: textQuoteSelector.prefix,
            suffix: textQuoteSelector.suffix
          },
          url: firstTarget.source,
          title: firstTarget.title
        }
      };
    }
    
    if (textPositionSelector) {
      return {
        documentType: 'text',
        text: {
          startOffset: textPositionSelector.start,
          endOffset: textPositionSelector.end,
          context: textQuoteSelector?.exact
        }
      };
    }
    
    // 默认处理
    return {
      documentType: 'html',
      web: {
        selector: {
          type: 'CssSelector',
          value: 'body'
        },
        url: firstTarget.source || '',
        title: firstTarget.title
      }
    };
  }
  
  /**
   * 映射Hypothesis可见性
   */
  private static mapHypothesisVisibility(permissions: any): 'private' | 'shared' | 'public' {
    if (!permissions) return 'private';
    
    if (permissions.read?.includes('group:__world__')) {
      return 'public';
    }
    
    if (permissions.read?.some((r: string) => r.startsWith('group:'))) {
      return 'shared';
    }
    
    return 'private';
  }
}

/**
 * 转换器管理器
 * Converter Manager
 */
export class ConverterManager {
  private static converters = new Map([
    ['zotero', ZoteroConverter],
    ['mendeley', MendeleyConverter],
    ['hypothesis', HypothesisConverter]
  ]);
  
  /**
   * 注册新的转换器
   */
  static registerConverter(platform: string, converter: typeof BaseConverter) {
    this.converters.set(platform, converter);
  }
  
  /**
   * 转换为通用格式
   */
  static toUniversal(annotation: any, platform: string): UniversalAnnotation {
    const converter = this.converters.get(platform);
    if (!converter) {
      throw new Error(`No converter found for platform: ${platform}`);
    }
    
    return (converter as any).toUniversal(annotation);
  }
  
  /**
   * 从通用格式转换
   */
  static fromUniversal(universal: UniversalAnnotation, targetPlatform: string): any {
    const converter = this.converters.get(targetPlatform);
    if (!converter) {
      throw new Error(`No converter found for platform: ${targetPlatform}`);
    }
    
    return (converter as any).fromUniversal(universal);
  }
  
  /**
   * 获取支持的平台列表
   */
  static getSupportedPlatforms(): string[] {
    return Array.from(this.converters.keys());
  }
  
  /**
   * 批量转换
   */
  static convertBatch(annotations: any[], sourcePlatform: string, targetPlatform?: string): UniversalAnnotation[] {
    const results: UniversalAnnotation[] = [];
    
    for (const annotation of annotations) {
      try {
        const universal = this.toUniversal(annotation, sourcePlatform);
        
        if (targetPlatform && targetPlatform !== 'universal') {
          const converted = this.fromUniversal(universal, targetPlatform);
          results.push(this.toUniversal(converted, targetPlatform));
        } else {
          results.push(universal);
        }
      } catch (error) {
        console.error(`Failed to convert annotation ${annotation.id}:`, error);
        // 可以选择跳过错误的标注或者抛出异常
      }
    }
    
    return results;
  }
}
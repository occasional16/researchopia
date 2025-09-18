/*
  Annotation Converter Manager
  Manages multiple platform converters and provides unified conversion interface
*/

import { UniversalAnnotation, AnnotationConverter, PlatformType } from '@/types/annotation-protocol';
import { MendeleyAnnotationConverter } from './mendeley-converter';
import { HypothesisAnnotationConverter } from './hypothesis-converter';
import { AdobeAnnotationConverter } from './adobe-converter';

export interface ConversionResult<T = any> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
  processed: number;
  failed: number;
}

export interface BatchConversionOptions {
  skipInvalid?: boolean;
  validateBeforeConvert?: boolean;
  includeWarnings?: boolean;
  maxErrors?: number;
}

export class AnnotationConverterManager {
  private converters: Map<PlatformType, AnnotationConverter> = new Map();

  constructor() {
    this.registerDefaultConverters();
  }

  /**
   * 注册默认转换器
   */
  private registerDefaultConverters() {
    this.registerConverter(new MendeleyAnnotationConverter());
    this.registerConverter(new HypothesisAnnotationConverter());
    this.registerConverter(new AdobeAnnotationConverter());
  }

  /**
   * 注册转换器
   */
  registerConverter(converter: AnnotationConverter) {
    this.converters.set(converter.platform, converter);
  }

  /**
   * 获取转换器
   */
  getConverter(platform: PlatformType): AnnotationConverter | undefined {
    return this.converters.get(platform);
  }

  /**
   * 获取所有支持的平台
   */
  getSupportedPlatforms(): PlatformType[] {
    return Array.from(this.converters.keys());
  }

  /**
   * 从平台格式转换为通用格式
   */
  async fromPlatform<T = any>(
    platform: PlatformType,
    platformAnnotations: T[],
    context?: any
  ): Promise<ConversionResult<UniversalAnnotation[]>> {
    const converter = this.getConverter(platform);
    if (!converter) {
      return {
        success: false,
        errors: [`No converter found for platform: ${platform}`],
        processed: 0,
        failed: platformAnnotations.length
      };
    }

    const result: ConversionResult<UniversalAnnotation[]> = {
      success: true,
      data: [],
      errors: [],
      warnings: [],
      processed: 0,
      failed: 0
    };

    for (let i = 0; i < platformAnnotations.length; i++) {
      const annotation = platformAnnotations[i];
      
      try {
        // 验证输入数据
        if (!converter.validate(annotation)) {
          result.warnings?.push(`Invalid annotation format at index ${i}`);
          result.failed++;
          continue;
        }

        // 转换标注
        const universalAnnotation = await converter.fromPlatform(annotation, context);
        result.data?.push(universalAnnotation);
        result.processed++;

      } catch (error) {
        const errorMessage = `Error converting annotation at index ${i}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.errors?.push(errorMessage);
        result.failed++;
      }
    }

    result.success = result.failed === 0 || result.processed > 0;
    return result;
  }

  /**
   * 转换为平台格式
   */
  async toPlatform<T = any>(
    platform: PlatformType,
    universalAnnotations: UniversalAnnotation[]
  ): Promise<ConversionResult<T[]>> {
    const converter = this.getConverter(platform);
    if (!converter) {
      return {
        success: false,
        errors: [`No converter found for platform: ${platform}`],
        processed: 0,
        failed: universalAnnotations.length
      };
    }

    const result: ConversionResult<T[]> = {
      success: true,
      data: [],
      errors: [],
      warnings: [],
      processed: 0,
      failed: 0
    };

    for (let i = 0; i < universalAnnotations.length; i++) {
      const annotation = universalAnnotations[i];
      
      try {
        const platformAnnotation = await converter.toPlatform(annotation) as T;
        result.data?.push(platformAnnotation);
        result.processed++;

      } catch (error) {
        const errorMessage = `Error converting annotation ${annotation.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`;
        result.errors?.push(errorMessage);
        result.failed++;
      }
    }

    result.success = result.failed === 0 || result.processed > 0;
    return result;
  }

  /**
   * 平台间直接转换
   */
  async convertBetweenPlatforms<TFrom = any, TTo = any>(
    fromPlatform: PlatformType,
    toPlatform: PlatformType,
    annotations: TFrom[],
    context?: any
  ): Promise<ConversionResult<TTo[]>> {
    // 首先转换为通用格式
    const universalResult = await this.fromPlatform(fromPlatform, annotations, context);
    
    if (!universalResult.success || !universalResult.data) {
      return {
        success: false,
        errors: universalResult.errors,
        processed: 0,
        failed: annotations.length
      };
    }

    // 然后转换为目标平台格式
    const platformResult = await this.toPlatform<TTo>(toPlatform, universalResult.data);
    
    return {
      success: platformResult.success && universalResult.success,
      data: platformResult.data,
      errors: [...(universalResult.errors || []), ...(platformResult.errors || [])],
      warnings: [...(universalResult.warnings || []), ...(platformResult.warnings || [])],
      processed: Math.min(universalResult.processed, platformResult.processed),
      failed: universalResult.failed + platformResult.failed
    };
  }

  /**
   * 批量验证标注
   */
  validateAnnotations<T = any>(
    platform: PlatformType,
    annotations: T[]
  ): { valid: T[]; invalid: { index: number; annotation: T; error: string }[] } {
    const converter = this.getConverter(platform);
    if (!converter) {
      return {
        valid: [],
        invalid: annotations.map((ann, index) => ({
          index,
          annotation: ann,
          error: `No converter found for platform: ${platform}`
        }))
      };
    }

    const valid: T[] = [];
    const invalid: { index: number; annotation: T; error: string }[] = [];

    annotations.forEach((annotation, index) => {
      try {
        if (converter.validate(annotation)) {
          valid.push(annotation);
        } else {
          invalid.push({
            index,
            annotation,
            error: 'Invalid annotation format'
          });
        }
      } catch (error) {
        invalid.push({
          index,
          annotation,
          error: error instanceof Error ? error.message : 'Validation error'
        });
      }
    });

    return { valid, invalid };
  }

  /**
   * 导出为多种格式
   */
  async exportToFormat(
    platform: PlatformType,
    annotations: any[],
    format: string
  ): Promise<string> {
    const converter = this.getConverter(platform);
    if (!converter) {
      throw new Error(`No converter found for platform: ${platform}`);
    }

    // 检查转换器是否支持exportToFormat方法
    if ('exportToFormat' in converter && typeof converter.exportToFormat === 'function') {
      return await converter.exportToFormat(annotations, format);
    }

    // 回退到JSON格式
    if (format.toLowerCase() === 'json') {
      return JSON.stringify(annotations, null, 2);
    }

    throw new Error(`Export format '${format}' not supported for platform '${platform}'`);
  }

  /**
   * 获取平台支持的导出格式
   */
  getSupportedFormats(platform: PlatformType): string[] {
    const converter = this.getConverter(platform);
    if (!converter) {
      return [];
    }

    // 检查转换器是否有getSupportedFormats方法
    if ('getSupportedFormats' in converter && typeof converter.getSupportedFormats === 'function') {
      return converter.getSupportedFormats();
    }

    return ['json']; // 默认支持JSON
  }

  /**
   * 获取转换统计信息
   */
  getConversionStats(): {
    supportedPlatforms: number;
    totalConverters: number;
    platforms: Array<{
      platform: PlatformType;
      supportedFormats: string[];
      hasValidation: boolean;
      hasExport: boolean;
    }>;
  } {
    const platforms = this.getSupportedPlatforms().map(platform => {
      const converter = this.getConverter(platform)!;
      return {
        platform,
        supportedFormats: this.getSupportedFormats(platform),
        hasValidation: typeof converter.validate === 'function',
        hasExport: 'exportToFormat' in converter && typeof converter.exportToFormat === 'function'
      };
    });

    return {
      supportedPlatforms: this.converters.size,
      totalConverters: this.converters.size,
      platforms
    };
  }

  /**
   * 清理和标准化标注数据
   */
  async cleanupAnnotations(
    universalAnnotations: UniversalAnnotation[]
  ): Promise<UniversalAnnotation[]> {
    return universalAnnotations.map(annotation => ({
      ...annotation,
      // 确保必需字段存在
      id: annotation.id || this.generateId(),
      createdAt: annotation.createdAt || new Date().toISOString(),
      modifiedAt: annotation.modifiedAt || annotation.createdAt || new Date().toISOString(),
      version: annotation.version || '1.0.0',
      
      // 清理内容
      content: annotation.content ? {
        text: annotation.content.text?.trim() || undefined,
        comment: annotation.content.comment?.trim() || undefined,
        color: annotation.content.color || '#ffeb3b',
        position: annotation.content.position
      } : undefined,
      
      // 标准化元数据
      metadata: {
        ...annotation.metadata,
        tags: annotation.metadata.tags?.filter(tag => tag.trim()) || [],
        author: {
          ...annotation.metadata.author,
          name: annotation.metadata.author.name.trim()
        }
      }
    }));
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 合并重复标注
   */
  async mergeDuplicates(
    annotations: UniversalAnnotation[],
    strategy: 'keep-first' | 'keep-last' | 'merge-content' = 'merge-content'
  ): Promise<UniversalAnnotation[]> {
    const seen = new Map<string, UniversalAnnotation>();
    const duplicateKey = (ann: UniversalAnnotation) => 
      `${ann.documentId}-${ann.content?.position?.page}-${ann.content?.text}`;

    for (const annotation of annotations) {
      const key = duplicateKey(annotation);
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, annotation);
        continue;
      }

      switch (strategy) {
        case 'keep-first':
          // 保持已有的
          break;
        case 'keep-last':
          seen.set(key, annotation);
          break;
        case 'merge-content':
          // 合并内容
          const merged: UniversalAnnotation = {
            ...existing,
            content: {
              text: existing.content?.text || annotation.content?.text,
              comment: [existing.content?.comment, annotation.content?.comment]
                .filter(Boolean)
                .join('\n\n') || undefined,
              color: existing.content?.color || annotation.content?.color,
              position: existing.content?.position || annotation.content?.position
            },
            metadata: {
              ...existing.metadata,
              tags: Array.from(new Set([
                ...(existing.metadata.tags || []),
                ...(annotation.metadata.tags || [])
              ]))
            },
            modifiedAt: new Date(Math.max(
              new Date(existing.modifiedAt).getTime(),
              new Date(annotation.modifiedAt).getTime()
            )).toISOString()
          };
          seen.set(key, merged);
          break;
      }
    }

    return Array.from(seen.values());
  }
}

// 默认导出单例
export const annotationConverterManager = new AnnotationConverterManager();
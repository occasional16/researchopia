/**
 * 标注共享模块 - 缓存管理器
 * 
 * 统一管理标注共享功能的缓存，避免重复请求。
 * 
 * 缓存类型:
 * 1. documentCache: DOI → document_id 映射
 * 2. sharedInfoCache: annotation_key → {likes, comments} 社交信息
 */

import { logger } from '../../utils/logger';
import { CACHE_EXPIRY_MS } from './constants';
import type { SharedAnnotationCacheEntry } from './types';

/**
 * 标注共享缓存管理器 (单例)
 */
export class AnnotationSharingCache {
  private static instance: AnnotationSharingCache;
  
  // DOI → document_id 缓存
  private documentCache: Map<string, string> = new Map();
  
  // DOI → paper_id 缓存 (用于打开论文详情页)
  private paperIdCache: Map<string, string> = new Map();
  
  // annotation_key → 社交信息缓存
  private sharedInfoCache: Map<string, SharedAnnotationCacheEntry> = new Map();
  
  private constructor() {
    logger.log('[AnnotationSharingCache] Initialized');
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): AnnotationSharingCache {
    if (!AnnotationSharingCache.instance) {
      AnnotationSharingCache.instance = new AnnotationSharingCache();
    }
    return AnnotationSharingCache.instance;
  }
  
  // ========== Document Cache ==========
  
  /**
   * 获取 document_id (从 DOI)
   */
  public getDocumentId(doi: string): string | undefined {
    return this.documentCache.get(doi);
  }
  
  /**
   * 设置 document_id 缓存
   */
  public setDocumentId(doi: string, documentId: string): void {
    this.documentCache.set(doi, documentId);
    logger.log(`[AnnotationSharingCache] Cached document: ${doi} -> ${documentId}`);
  }
  
  /**
   * 获取 paper_id (从 DOI)
   */
  public getPaperId(doi: string): string | undefined {
    return this.paperIdCache.get(doi);
  }
  
  /**
   * 设置 paper_id 缓存
   */
  public setPaperId(doi: string, paperId: string): void {
    this.paperIdCache.set(doi, paperId);
    logger.log(`[AnnotationSharingCache] Cached paper_id: ${doi} -> ${paperId}`);
  }
  
  /**
   * 检查 DOI 是否已缓存
   */
  public hasDocument(doi: string): boolean {
    return this.documentCache.has(doi);
  }
  
  /**
   * 清除所有 document 缓存
   */
  public clearDocumentCache(): void {
    const size = this.documentCache.size;
    this.documentCache.clear();
    this.paperIdCache.clear();
    logger.log(`[AnnotationSharingCache] Cleared ${size} document cache entries`);
  }
  
  // ========== Shared Info Cache ==========
  
  /**
   * 获取标注的社交信息 (点赞、评论)
   */
  public getSharedInfo(annotationKey: string): SharedAnnotationCacheEntry | undefined {
    const entry = this.sharedInfoCache.get(annotationKey);
    
    // 检查是否过期
    if (entry && Date.now() - entry.cachedAt > CACHE_EXPIRY_MS) {
      this.sharedInfoCache.delete(annotationKey);
      logger.log(`[AnnotationSharingCache] Expired cache for: ${annotationKey}`);
      return undefined;
    }
    
    return entry;
  }
  
  /**
   * 设置标注的社交信息缓存
   */
  public setSharedInfo(annotationKey: string, likes: any[], comments: any[]): void {
    this.sharedInfoCache.set(annotationKey, {
      likes,
      comments,
      cachedAt: Date.now()
    });
    logger.log(`[AnnotationSharingCache] Cached shared info for: ${annotationKey}`);
  }
  
  /**
   * 更新缓存中的点赞数据
   */
  public updateLikes(annotationKey: string, likes: any[]): void {
    const entry = this.sharedInfoCache.get(annotationKey);
    if (entry) {
      entry.likes = likes;
      entry.cachedAt = Date.now();
    }
  }
  
  /**
   * 更新缓存中的评论数据
   */
  public updateComments(annotationKey: string, comments: any[]): void {
    const entry = this.sharedInfoCache.get(annotationKey);
    if (entry) {
      entry.comments = comments;
      entry.cachedAt = Date.now();
    }
  }
  
  /**
   * 删除特定标注的缓存
   */
  public invalidateSharedInfo(annotationKey: string): void {
    this.sharedInfoCache.delete(annotationKey);
    logger.log(`[AnnotationSharingCache] Invalidated cache for: ${annotationKey}`);
  }
  
  /**
   * 清除所有社交信息缓存
   */
  public clearSharedInfoCache(): void {
    const size = this.sharedInfoCache.size;
    this.sharedInfoCache.clear();
    logger.log(`[AnnotationSharingCache] Cleared ${size} shared info cache entries`);
  }
  
  /**
   * 清除所有缓存
   */
  public clearAll(): void {
    this.clearDocumentCache();
    this.clearSharedInfoCache();
  }
  
  /**
   * 获取缓存统计信息
   */
  public getStats(): { documentCount: number; sharedInfoCount: number } {
    return {
      documentCount: this.documentCache.size,
      sharedInfoCount: this.sharedInfoCache.size
    };
  }
}

// 导出单例实例
export const annotationSharingCache = AnnotationSharingCache.getInstance();

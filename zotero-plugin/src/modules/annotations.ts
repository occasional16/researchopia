/**
 * 标注管理模块
 * 负责标注的同步、共享、管理等功能
 */

import { logger } from "../utils/logger";
import { SupabaseManager, SupabaseAnnotation } from "./supabase";
import { AuthManager } from "./auth";

export interface ZoteroAnnotation {
  id: number;
  key: string;
  type: string;
  text: string;
  comment: string;
  color: string;
  pageLabel: string;
  sortIndex: string;
  position: any;
  tags: any[];
  dateModified: string;
  parentItemID: number;
  // Supabase状态
  supabaseId?: string;
  visibility?: 'private' | 'shared' | 'public';
  showAuthorName?: boolean;
  synced?: boolean;
}

export class AnnotationManager {
  private static instance: AnnotationManager | null = null;
  private isInitialized = false;
  private supabaseManager: SupabaseManager;
  private annotationsCache: Map<number, ZoteroAnnotation[]> = new Map();

  private constructor() {
    this.supabaseManager = new SupabaseManager();
  }

  public static getInstance(): AnnotationManager {
    if (!AnnotationManager.instance) {
      AnnotationManager.instance = new AnnotationManager();
    }
    return AnnotationManager.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = AnnotationManager.getInstance();
    if (instance.isInitialized) {
      return;
    }

    logger.log("[AnnotationManager] Initializing...");
    
    try {
      // 初始化标注管理器
      instance.isInitialized = true;
      logger.log("[AnnotationManager] Initialized successfully");
    } catch (error) {
      logger.error("[AnnotationManager] Initialization error:", error);
      throw error;
    }
  }

  /**
   * 从Zotero item中提取所有标注
   */
  public static async getItemAnnotations(item: any): Promise<ZoteroAnnotation[]> {
    const instance = AnnotationManager.getInstance();
    
    try {
      logger.log("[AnnotationManager] Getting annotations for item:", item.id);
      
      // 暂时禁用缓存以调试
      // if (instance.annotationsCache.has(item.id)) {
      //   logger.log("[AnnotationManager] Using cached annotations");
      //   return instance.annotationsCache.get(item.id)!;
      // }
      instance.annotationsCache.delete(item.id); // 强制清除缓存
      
      const annotations: ZoteroAnnotation[] = [];
      
      // 获取所有附件
      const attachmentIDs = item.getAttachments();
      logger.log("[AnnotationManager] Found attachments:", attachmentIDs.length);
      
      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment) {
          logger.log("[AnnotationManager] Attachment not found:", attachmentID);
          continue;
        }
        
        logger.log("[AnnotationManager] Checking attachment:", attachmentID, "isPDF?", attachment.isPDFAttachment?.());
        
        // 获取该附件的所有标注(不管是不是PDF,先都试试)
        const annotationIDs = attachment.getAnnotations?.() || [];
        logger.log("[AnnotationManager] Found annotations in attachment:", annotationIDs.length);
        
        // attachment.getAnnotations()在Zotero 7/8中返回的是annotation对象数组,而不是ID数组
        for (const annotation of annotationIDs) {
          if (!annotation) {
            logger.log("[AnnotationManager] ⚠️ Skipping null annotation");
            continue;
          }
          
          try {
            // 直接从annotation对象构建ZoteroAnnotation
            const zoteroAnn: ZoteroAnnotation = {
              id: annotation.id || 0, // 如果没有id,使用0作为占位
              key: annotation.key || '',
              type: annotation.annotationType || 'highlight',
              text: annotation.annotationText || '',
              comment: annotation.annotationComment || '',
              color: annotation.annotationColor || '#ffd400',
              pageLabel: annotation.annotationPageLabel || '',
              sortIndex: annotation.annotationSortIndex || '',
              position: typeof annotation.annotationPosition === 'string' 
                ? JSON.parse(annotation.annotationPosition) 
                : (annotation.annotationPosition || {}),
              tags: annotation.tags || [],
              dateModified: annotation.dateModified || new Date().toISOString(),
              parentItemID: item.id,
              visibility: 'private',
              showAuthorName: true,
              synced: false
            };
            
            logger.log("[AnnotationManager] ✓ Added annotation:", zoteroAnn.key, "text:", zoteroAnn.text.substring(0, 30));
            annotations.push(zoteroAnn);
          } catch (error) {
            logger.error("[AnnotationManager] ❌ Error processing annotation:", error);
          }
        }
      }
      
      // 按页码和位置排序
      annotations.sort((a, b) => {
        const pageA = parseInt(a.pageLabel) || 0;
        const pageB = parseInt(b.pageLabel) || 0;
        if (pageA !== pageB) return pageA - pageB;
        return a.sortIndex.localeCompare(b.sortIndex);
      });
      
      // 缓存结果
      instance.annotationsCache.set(item.id, annotations);
      
      logger.log("[AnnotationManager] Total annotations found:", annotations.length);
      return annotations;
      
    } catch (error) {
      logger.error("[AnnotationManager] Error getting annotations:", error);
      return [];
    }
  }

  /**
   * 从Supabase同步标注状态
   */
  public static async syncAnnotationsWithSupabase(
    itemAnnotations: ZoteroAnnotation[],
    documentId: string,
    userId: string
  ): Promise<ZoteroAnnotation[]> {
    const instance = AnnotationManager.getInstance();
    
    try {
      logger.log("[AnnotationManager] Syncing with Supabase...");
      
      // 获取该文档的用户标注
      const supabaseAnnotations = await instance.supabaseManager.getAnnotationsForDocument(
        documentId,
        userId
      );
      
      logger.log("[AnnotationManager] Supabase annotations:", supabaseAnnotations.length);
      
      // 创建key到supabase annotation的映射
      const supabaseMap = new Map<string, SupabaseAnnotation>();
      supabaseAnnotations.forEach(ann => {
        if (ann.original_id) {
          supabaseMap.set(ann.original_id, ann);
        }
      });
      
      // 更新本地标注的状态
      const updatedAnnotations = itemAnnotations.map(ann => {
        const supabaseAnn = supabaseMap.get(ann.key);
        if (supabaseAnn) {
          return {
            ...ann,
            supabaseId: supabaseAnn.id,
            visibility: supabaseAnn.visibility,
            showAuthorName: supabaseAnn.show_author_name,
            synced: true
          };
        }
        return ann;
      });
      
      return updatedAnnotations;
      
    } catch (error) {
      logger.error("[AnnotationManager] Error syncing with Supabase:", error);
      return itemAnnotations;
    }
  }

  /**
   * 更新单个标注的共享状态
   */
  public static async updateAnnotationSharing(
    annotation: ZoteroAnnotation,
    documentId: string,
    userId: string,
    visibility: 'private' | 'shared' | 'public',
    showAuthorName: boolean
  ): Promise<boolean> {
    const instance = AnnotationManager.getInstance();
    
    try {
      logger.log("[AnnotationManager] Updating annotation sharing:", annotation.key);
      
      if (annotation.supabaseId) {
        // 更新现有标注
        await instance.supabaseManager.updateAnnotationSharing(
          annotation.supabaseId,
          visibility,
          showAuthorName
        );
      } else {
        // 创建新标注
        const newAnnotation = await instance.supabaseManager.createAnnotation({
          document_id: documentId,
          user_id: userId,
          type: annotation.type,
          content: annotation.text,
          comment: annotation.comment,
          color: annotation.color,
          position: annotation.position,
          tags: annotation.tags.map((t: any) => t.tag || t),
          visibility: visibility,
          show_author_name: showAuthorName,
          platform: 'zotero',
          original_id: annotation.key,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        annotation.supabaseId = newAnnotation.id;
      }
      
      // 更新本地状态
      annotation.visibility = visibility;
      annotation.showAuthorName = showAuthorName;
      annotation.synced = true;
      
      logger.log("[AnnotationManager] Annotation sharing updated successfully");
      return true;
      
    } catch (error) {
      logger.error("[AnnotationManager] Error updating annotation sharing:", error);
      return false;
    }
  }

  /**
   * 批量更新标注共享状态
   */
  public static async batchUpdateAnnotationSharing(
    annotations: ZoteroAnnotation[],
    documentId: string,
    userId: string,
    visibility: 'private' | 'shared' | 'public',
    showAuthorName: boolean
  ): Promise<{ success: number; failed: number }> {
    const instance = AnnotationManager.getInstance();
    
    try {
      logger.log("[AnnotationManager] Batch updating annotations:", annotations.length);
      
      let success = 0;
      let failed = 0;
      
      // 分离已同步和未同步的标注
      const syncedAnnotations = annotations.filter(ann => ann.supabaseId);
      const unsyncedAnnotations = annotations.filter(ann => !ann.supabaseId);
      
      // 批量更新已同步的标注
      if (syncedAnnotations.length > 0) {
        const ids = syncedAnnotations.map(ann => ann.supabaseId!);
        try {
          await instance.supabaseManager.batchUpdateAnnotationSharing(
            ids,
            visibility,
            showAuthorName
          );
          success += syncedAnnotations.length;
          
          // 更新本地状态
          syncedAnnotations.forEach(ann => {
            ann.visibility = visibility;
            ann.showAuthorName = showAuthorName;
          });
        } catch (error) {
          logger.error("[AnnotationManager] Error batch updating synced annotations:", error);
          failed += syncedAnnotations.length;
        }
      }
      
      // 逐个创建未同步的标注
      for (const ann of unsyncedAnnotations) {
        const result = await AnnotationManager.updateAnnotationSharing(
          ann,
          documentId,
          userId,
          visibility,
          showAuthorName
        );
        if (result) {
          success++;
        } else {
          failed++;
        }
      }
      
      logger.log("[AnnotationManager] Batch update completed:", { success, failed });
      return { success, failed };
      
    } catch (error) {
      logger.error("[AnnotationManager] Error in batch update:", error);
      return { success: 0, failed: annotations.length };
    }
  }

  /**
   * 清除缓存
   */
  public static clearCache(itemId?: number): void {
    const instance = AnnotationManager.getInstance();
    if (itemId) {
      instance.annotationsCache.delete(itemId);
    } else {
      instance.annotationsCache.clear();
    }
  }

  public static cleanup(): void {
    const instance = AnnotationManager.getInstance();
    instance.annotationsCache.clear();
    instance.isInitialized = false;
    AnnotationManager.instance = null;
    logger.log("[AnnotationManager] Cleanup completed");
  }
}
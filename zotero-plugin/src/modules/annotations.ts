import { AuthManager } from "./auth";
import { SupabaseAPI, DatabaseAnnotation } from "../api/supabase";
import { DataTransform, ZoteroAnnotation, EnrichedAnnotation } from "../utils/dataTransform";
import { QualityScoringEngine, QualityMetrics } from "./qualityScoring";

// Enable strict mode for Zotero 8 compatibility
"use strict";

export interface SharedAnnotation extends EnrichedAnnotation {
  qualityMetrics?: QualityMetrics;
}

export class AnnotationManager {
  private static initialized: boolean = false;
  
  static async initialize() {
    if (this.initialized) return;
    
    try {
      ztoolkit.log("AnnotationManager initializing...");

      // Initialize Supabase API
      const supabaseClient = AuthManager.getSupabaseClient();
      if (supabaseClient) {
        SupabaseAPI.initialize(supabaseClient);
      }
      
      this.initialized = true;
      ztoolkit.log("AnnotationManager initialized successfully");
    } catch (error) {
      ztoolkit.log("AnnotationManager initialization failed:", error);
      throw error;
    }
  }

  static cleanup() {
    this.initialized = false;
    ztoolkit.log("AnnotationManager cleanup completed");
  }

  /**
   * Share annotations for given item IDs (batch operation)
   */
  static async shareAnnotations(itemIds: Array<string | number>): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) {
      ztoolkit.log("User not logged in");
      return false;
    }

    try {
      const results = await Promise.all(
        itemIds.map(id => this.uploadAnnotations(Number(id)))
      );
      
      const successCount = results.filter(Boolean).length;
      ztoolkit.log(`Shared annotations for ${successCount}/${itemIds.length} items`);
      
      return successCount > 0;
    } catch (error) {
      ztoolkit.log("Error sharing annotations:", error);
      return false;
    }
  }

  static async extractLocalAnnotations(itemID: number): Promise<ZoteroAnnotation[]> {
    try {
      const item = Zotero.Items.get(itemID);
      if (!item || !item.isRegularItem()) return [];

      // Use Zotero 8 compatible annotation fetching
      const annotations = await item.getAnnotations();
      const extractedAnnotations: ZoteroAnnotation[] = [];

      for (const annotation of annotations) {
        try {
          const annotationData: ZoteroAnnotation = {
            text: annotation.annotationText || "",
            comment: annotation.annotationComment || "",
            page: annotation.annotationPageLabel || "",
            position: this.parseAnnotationPosition(annotation.annotationPosition),
            type: annotation.annotationType || "highlight",
            color: annotation.annotationColor || "#ffff00",
            created: annotation.dateAdded || new Date(),
            tags: annotation.getTags?.() || [],
            sortIndex: annotation.annotationSortIndex || 0,
          };
          extractedAnnotations.push(annotationData);
        } catch (error) {
          ztoolkit.log(`Error processing annotation ${annotation.id}:`, error);
        }
      }

      return extractedAnnotations;
    } catch (error) {
      ztoolkit.log("Error extracting annotations:", error);
      return [];
    }
  }

  private static parseAnnotationPosition(position: any): any {
    if (!position) return null;
    
    try {
      // Handle different position formats from Zotero 8
      if (typeof position === 'string') {
        return JSON.parse(position);
      }
      return position;
    } catch {
      return null;
    }
  }

  static async uploadAnnotations(itemID: number): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) {
      ztoolkit.log("User not logged in");
      return false;
    }

    try {
      const item = Zotero.Items.get(itemID);
      if (!item || !item.isRegularItem()) return false;

      const doi = item.getField("DOI");
      if (!doi) {
        ztoolkit.log("Item has no DOI");
        return false;
      }

      const annotations = await this.extractLocalAnnotations(itemID);
      if (annotations.length === 0) {
        ztoolkit.log("No annotations to upload");
        return true;
      }

      const user = AuthManager.getCurrentUser();
      if (!user) return false;

      let uploadedCount = 0;
      let failedCount = 0;

      // Upload annotations one by one to handle errors gracefully
      for (const annotation of annotations) {
        try {
          const dbAnnotation = DataTransform.zoteroToDatabase(
            annotation,
            doi,
            user.id,
            user.email || "Anonymous"
          );

          const result = await SupabaseAPI.createAnnotation(dbAnnotation);
          if (result) {
            uploadedCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          ztoolkit.log(`Failed to upload annotation:`, error);
          failedCount++;
        }
      }

      ztoolkit.log(`Upload complete: ${uploadedCount} successful, ${failedCount} failed`);
      return failedCount === 0;
    } catch (error) {
      ztoolkit.log("Error uploading annotations:", error);
      return false;
    }
  }

  static async fetchSharedAnnotations(doi: string): Promise<SharedAnnotation[]> {
    try {
      // Get basic annotations
      const annotations = await SupabaseAPI.getAnnotationsByDOI(doi);
      if (annotations.length === 0) return [];

      // Enrich with social data
      const enrichedAnnotations: SharedAnnotation[] = [];
      const currentUser = AuthManager.getCurrentUser();

      for (const annotation of annotations) {
        try {
          // Get likes and comments count
          const likes = await SupabaseAPI.getAnnotationLikes(annotation.id);
          const comments = await SupabaseAPI.getAnnotationComments(annotation.id);

          // Check if current user liked this annotation
          const isLiked = currentUser ? likes.some(like => like.user_id === currentUser.id) : false;

          // Check if current user follows the author
          const isFollowingAuthor = currentUser && currentUser.id !== annotation.user_id ?
            await SupabaseAPI.isFollowing(annotation.user_id) : false;

          const enriched = DataTransform.databaseToDisplay(
            annotation,
            likes.length,
            comments.length,
            isLiked,
            isFollowingAuthor
          );

          enrichedAnnotations.push(enriched);
        } catch (error) {
          ztoolkit.log(`Error processing annotation ${annotation.id}:`, error);
        }
      }

      // Calculate quality scores and sort
      const qualityScores = await QualityScoringEngine.calculateBatchQualityScores(enrichedAnnotations);

      // Update annotations with quality metrics
      enrichedAnnotations.forEach(annotation => {
        const metrics = qualityScores.get(annotation.id);
        if (metrics) {
          annotation.qualityMetrics = metrics;
          annotation.quality_score = metrics.totalScore;
        }
      });

      // Sort by quality score (high quality first)
      return QualityScoringEngine.sortByQuality(enrichedAnnotations, qualityScores);
    } catch (error) {
      ztoolkit.log("Error fetching annotations:", error);
      return [];
    }
  }

  static async likeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    try {
      return await SupabaseAPI.likeAnnotation(annotationId);
    } catch (error) {
      ztoolkit.log("Error liking annotation:", error);
      return false;
    }
  }

  static async unlikeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    try {
      return await SupabaseAPI.unlikeAnnotation(annotationId);
    } catch (error) {
      ztoolkit.log("Error unliking annotation:", error);
      return false;
    }
  }

  static async addComment(annotationId: string, comment: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    try {
      const result = await SupabaseAPI.addComment(annotationId, comment);
      return result !== null;
    } catch (error) {
      ztoolkit.log("Error adding comment:", error);
      return false;
    }
  }

  static async followUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    try {
      return await SupabaseAPI.followUser(userId);
    } catch (error) {
      ztoolkit.log("Error following user:", error);
      return false;
    }
  }

  static async unfollowUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    try {
      return await SupabaseAPI.unfollowUser(userId);
    } catch (error) {
      ztoolkit.log("Error unfollowing user:", error);
      return false;
    }
  }

  static async getAnnotationComments(annotationId: string) {
    try {
      return await SupabaseAPI.getAnnotationComments(annotationId);
    } catch (error) {
      ztoolkit.log("Error getting comments:", error);
      return [];
    }
  }

  static async searchAnnotations(
    doi: string,
    searchText?: string,
    filters?: {
      minQualityScore?: number;
      hasComments?: boolean;
      hasLikes?: boolean;
      authorIds?: string[];
    }
  ): Promise<SharedAnnotation[]> {
    try {
      const annotations = await this.fetchSharedAnnotations(doi);

      if (!searchText && !filters) {
        return annotations;
      }

      return DataTransform.filterAnnotations(annotations, {
        searchText,
        ...filters,
      });
    } catch (error) {
      ztoolkit.log("Error searching annotations:", error);
      return [];
    }
  }

  static async handleItemChange(ids: Array<string | number>, extraData: any) {
    try {
      // Handle annotation changes - could trigger UI updates
      ztoolkit.log("Item changed:", ids, extraData);
      
      // If items are modified, we might want to refresh shared annotations
      // This is where we'd trigger UI updates for item pane or reader
      
    } catch (error) {
      ztoolkit.log("Error handling item change:", error);
    }
  }

  /**
   * Get current item annotations (for UI display)
   */
  static async getCurrentItemAnnotations(): Promise<ZoteroAnnotation[]> {
    // This method should return annotations for the currently selected item
    // We can use the current item from UIManager or get it from Zotero
    try {
      const items = Zotero.getActiveZoteroPane().getSelectedItems();
      if (items.length === 0) return [];
      
      const item = items[0];
      if (item.isNote() || item.isAttachment()) {
        const parentItem = item.getParent();
        if (parentItem) {
          return await this.extractLocalAnnotations(parentItem.id);
        }
      }
      
      return await this.extractLocalAnnotations(item.id);
    } catch (error) {
      ztoolkit.log("Error getting current item annotations:", error);
      return [];
    }
  }

  /**
   * Toggle like status for annotation
   */
  static async toggleLike(annotationId: string): Promise<boolean> {
    try {
      const currentUser = AuthManager.getCurrentUser();
      if (!currentUser) return false;
      
      // For now, just toggle between like and unlike
      // We can check current status later when SupabaseAPI has the method
      return await this.likeAnnotation(annotationId);
    } catch (error) {
      ztoolkit.log("Error toggling like:", error);
      return false;
    }
  }

  /**
   * Get comments for annotation
   */
  static async getComments(annotationId: string) {
    try {
      return await this.getAnnotationComments(annotationId);
    } catch (error) {
      ztoolkit.log("Error getting comments:", error);
      return [];
    }
  }

  /**
   * Get annotations for precise tracking (paragraph/sentence level)
   */
  static async getAnnotationsForPosition(doi: string, position: any): Promise<SharedAnnotation[]> {
    try {
      const allAnnotations = await this.fetchSharedAnnotations(doi);
      
      // Filter annotations by position/range
      return allAnnotations.filter(annotation => {
        if (!annotation.position || !position) return false;
        return this.positionIntersects(annotation.position, position);
      });
    } catch (error) {
      ztoolkit.log("Error getting position annotations:", error);
      return [];
    }
  }

  private static positionIntersects(annotationPos: any, targetPos: any): boolean {
    // Implement position intersection logic
    // This would be used for precise paragraph/sentence tracking
    try {
      if (!annotationPos || !targetPos) return false;
      
      // Simple range intersection check
      if (annotationPos.pageIndex !== targetPos.pageIndex) return false;
      
      const aStart = annotationPos.rects?.[0]?.y || 0;
      const aEnd = annotationPos.rects?.[annotationPos.rects.length - 1]?.y || 0;
      const tStart = targetPos.y || 0;
      const tEnd = targetPos.y || 0;
      
      return !(aEnd < tStart || tEnd < aStart);
    } catch {
      return false;
    }
  }
}

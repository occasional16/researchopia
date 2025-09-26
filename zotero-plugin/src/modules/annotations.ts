import { AuthManager } from "./auth";
import { SupabaseAPI, DatabaseAnnotation } from "../api/supabase";
import { DataTransform, ZoteroAnnotation, EnrichedAnnotation } from "../utils/dataTransform";
import { QualityScoringEngine, QualityMetrics } from "./qualityScoring";

export interface SharedAnnotation extends EnrichedAnnotation {
  qualityMetrics?: QualityMetrics;
}

export class AnnotationManager {
  static initialize() {
    ztoolkit.log("AnnotationManager initialized");

    // Initialize Supabase API
    const supabaseClient = AuthManager.getSupabaseClient();
    if (supabaseClient) {
      SupabaseAPI.initialize(supabaseClient);
    }
  }

  static async extractLocalAnnotations(itemID: number): Promise<ZoteroAnnotation[]> {
    try {
      const item = Zotero.Items.get(itemID);
      if (!item || !item.isRegularItem()) return [];

      const annotations = await item.getAnnotations();
      const extractedAnnotations: ZoteroAnnotation[] = [];

      for (const annotation of annotations) {
        const annotationData: ZoteroAnnotation = {
          text: annotation.annotationText || "",
          comment: annotation.annotationComment || "",
          page: annotation.annotationPageLabel || "",
          position: annotation.annotationPosition || null,
          type: annotation.annotationType || "highlight",
          color: annotation.annotationColor || "#ffff00",
          created: annotation.dateAdded || new Date(),
          tags: annotation.getTags?.() || [],
          sortIndex: annotation.annotationSortIndex || 0,
        };
        extractedAnnotations.push(annotationData);
      }

      return extractedAnnotations;
    } catch (error) {
      ztoolkit.log("Error extracting annotations:", error);
      return [];
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

      // Sort by quality score
      return QualityScoringEngine.sortByQuality(enrichedAnnotations, qualityScores);
    } catch (error) {
      ztoolkit.log("Error fetching annotations:", error);
      return [];
    }
  }

  static async likeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.likeAnnotation(annotationId);
  }

  static async unlikeAnnotation(annotationId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.unlikeAnnotation(annotationId);
  }

  static async addComment(annotationId: string, comment: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    const result = await SupabaseAPI.addComment(annotationId, comment);
    return result !== null;
  }

  static async followUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.followUser(userId);
  }

  static async unfollowUser(userId: string): Promise<boolean> {
    if (!AuthManager.isLoggedIn()) return false;
    return await SupabaseAPI.unfollowUser(userId);
  }

  static async getAnnotationComments(annotationId: string) {
    return await SupabaseAPI.getAnnotationComments(annotationId);
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
    const annotations = await this.fetchSharedAnnotations(doi);

    if (!searchText && !filters) {
      return annotations;
    }

    return DataTransform.filterAnnotations(annotations, {
      searchText,
      ...filters,
    });
  }

  static handleItemChange(ids: Array<string | number>, extraData: any) {
    // Handle annotation changes
    ztoolkit.log("Item changed:", ids, extraData);
  }
}

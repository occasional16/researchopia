import { DatabaseAnnotation } from "../api/supabase";

export interface ZoteroAnnotation {
  id?: string;
  text: string;
  comment: string;
  page: string | number;
  position: any;
  type: string;
  color: string;
  created: Date;
  tags?: string[];
  sortIndex?: number;
}

export interface EnrichedAnnotation extends DatabaseAnnotation {
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_following_author: boolean;
  quality_score: number;
}

export class DataTransform {
  /**
   * Convert Zotero annotation to database format
   */
  static zoteroToDatabase(
    zoteroAnnotation: ZoteroAnnotation,
    doi: string,
    userId: string,
    userName: string
  ): Omit<DatabaseAnnotation, 'id' | 'created_at' | 'updated_at'> {
    return {
      doi: doi,
      user_id: userId,
      user_name: userName,
      annotation_text: zoteroAnnotation.text || '',
      annotation_comment: zoteroAnnotation.comment || '',
      page_number: this.parsePageNumber(zoteroAnnotation.page) || undefined,
      position: this.normalizePosition(zoteroAnnotation.position),
      annotation_type: zoteroAnnotation.type || 'highlight',
      annotation_color: zoteroAnnotation.color || '#ffff00',
    };
  }

  /**
   * Convert database annotation to display format
   */
  static databaseToDisplay(
    dbAnnotation: DatabaseAnnotation,
    likesCount: number = 0,
    commentsCount: number = 0,
    isLiked: boolean = false,
    isFollowingAuthor: boolean = false
  ): EnrichedAnnotation {
    return {
      ...dbAnnotation,
      likes_count: likesCount,
      comments_count: commentsCount,
      is_liked: isLiked,
      is_following_author: isFollowingAuthor,
      quality_score: this.calculateQualityScore(dbAnnotation, likesCount, commentsCount),
    };
  }

  /**
   * Parse page number from various formats
   */
  private static parsePageNumber(page: string | number): number | null {
    if (typeof page === 'number') {
      return page;
    }
    
    if (typeof page === 'string') {
      // Try to extract number from string like "Page 5", "p. 10", etc.
      const match = page.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    
    return null;
  }

  /**
   * Normalize position data
   */
  private static normalizePosition(position: any): any {
    if (!position) return null;

    // Handle different position formats from different Zotero versions
    if (typeof position === 'string') {
      try {
        return JSON.parse(position);
      } catch {
        return null;
      }
    }

    if (typeof position === 'object') {
      return {
        x: position.x || position.left || 0,
        y: position.y || position.top || 0,
        width: position.width || 0,
        height: position.height || 0,
        pageIndex: position.pageIndex || position.page || 0,
      };
    }

    return null;
  }

  /**
   * Calculate quality score for annotation ranking
   */
  private static calculateQualityScore(
    annotation: DatabaseAnnotation,
    likesCount: number,
    commentsCount: number
  ): number {
    let score = 0;

    // Base score for having content
    if (annotation.annotation_text) {
      score += annotation.annotation_text.length > 50 ? 10 : 5;
    }
    
    if (annotation.annotation_comment) {
      score += annotation.annotation_comment.length > 100 ? 15 : 10;
    }

    // Social engagement score
    score += likesCount * 5;
    score += commentsCount * 3;

    // Recency bonus (newer annotations get slight boost)
    const daysSinceCreated = (Date.now() - new Date(annotation.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) {
      score += 5;
    } else if (daysSinceCreated < 30) {
      score += 2;
    }

    // Length penalty for very short annotations
    if (annotation.annotation_text && annotation.annotation_text.length < 10) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Sort annotations by quality score
   */
  static sortByQuality(annotations: EnrichedAnnotation[]): EnrichedAnnotation[] {
    return annotations.sort((a, b) => {
      // Primary sort by quality score
      if (b.quality_score !== a.quality_score) {
        return b.quality_score - a.quality_score;
      }
      
      // Secondary sort by creation date (newer first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Filter annotations by various criteria
   */
  static filterAnnotations(
    annotations: EnrichedAnnotation[],
    filters: {
      minQualityScore?: number;
      hasComments?: boolean;
      hasLikes?: boolean;
      authorIds?: string[];
      dateRange?: { start: Date; end: Date };
      searchText?: string;
    }
  ): EnrichedAnnotation[] {
    return annotations.filter(annotation => {
      // Quality score filter
      if (filters.minQualityScore && annotation.quality_score < filters.minQualityScore) {
        return false;
      }

      // Comments filter
      if (filters.hasComments && annotation.comments_count === 0) {
        return false;
      }

      // Likes filter
      if (filters.hasLikes && annotation.likes_count === 0) {
        return false;
      }

      // Author filter
      if (filters.authorIds && !filters.authorIds.includes(annotation.user_id)) {
        return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const createdAt = new Date(annotation.created_at);
        if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
          return false;
        }
      }

      // Text search filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const textMatch = annotation.annotation_text.toLowerCase().includes(searchLower);
        const commentMatch = annotation.annotation_comment.toLowerCase().includes(searchLower);
        const authorMatch = annotation.user_name.toLowerCase().includes(searchLower);
        
        if (!textMatch && !commentMatch && !authorMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Group annotations by page
   */
  static groupByPage(annotations: EnrichedAnnotation[]): Map<number, EnrichedAnnotation[]> {
    const grouped = new Map<number, EnrichedAnnotation[]>();

    annotations.forEach(annotation => {
      const page = annotation.page_number || 0;
      if (!grouped.has(page)) {
        grouped.set(page, []);
      }
      grouped.get(page)!.push(annotation);
    });

    // Sort annotations within each page by position
    grouped.forEach(pageAnnotations => {
      pageAnnotations.sort((a, b) => {
        if (a.position && b.position) {
          // Sort by Y position (top to bottom)
          return (a.position.y || 0) - (b.position.y || 0);
        }
        return 0;
      });
    });

    return grouped;
  }

  /**
   * Extract keywords from annotation text for search indexing
   */
  static extractKeywords(annotation: DatabaseAnnotation): string[] {
    const text = `${annotation.annotation_text} ${annotation.annotation_comment}`.toLowerCase();
    
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
    
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Remove duplicates and return
    return [...new Set(words)];
  }
}

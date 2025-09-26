import { SharedAnnotation } from "./annotations";
import { SocialManager } from "./social";

export interface QualityMetrics {
  contentQuality: number;
  socialEngagement: number;
  authorReputation: number;
  recency: number;
  relevance: number;
  totalScore: number;
}

export class QualityScoringEngine {
  // Weights for different quality factors
  private static readonly WEIGHTS = {
    contentQuality: 0.3,
    socialEngagement: 0.25,
    authorReputation: 0.2,
    recency: 0.15,
    relevance: 0.1,
  };

  // Content quality thresholds
  private static readonly CONTENT_THRESHOLDS = {
    minTextLength: 10,
    goodTextLength: 50,
    excellentTextLength: 150,
    minCommentLength: 20,
    goodCommentLength: 100,
  };

  static async calculateQualityScore(annotation: SharedAnnotation): Promise<QualityMetrics> {
    const contentQuality = this.calculateContentQuality(annotation);
    const socialEngagement = this.calculateSocialEngagement(annotation);
    const authorReputation = await this.calculateAuthorReputation(annotation.user_id);
    const recency = this.calculateRecency(annotation);
    const relevance = this.calculateRelevance(annotation);

    const totalScore = 
      contentQuality * this.WEIGHTS.contentQuality +
      socialEngagement * this.WEIGHTS.socialEngagement +
      authorReputation * this.WEIGHTS.authorReputation +
      recency * this.WEIGHTS.recency +
      relevance * this.WEIGHTS.relevance;

    return {
      contentQuality,
      socialEngagement,
      authorReputation,
      recency,
      relevance,
      totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Calculate content quality based on text length, structure, and completeness
   */
  private static calculateContentQuality(annotation: SharedAnnotation): number {
    let score = 0;
    const maxScore = 100;

    // Text quality scoring
    const textLength = annotation.annotation_text?.length || 0;
    if (textLength >= this.CONTENT_THRESHOLDS.excellentTextLength) {
      score += 40;
    } else if (textLength >= this.CONTENT_THRESHOLDS.goodTextLength) {
      score += 30;
    } else if (textLength >= this.CONTENT_THRESHOLDS.minTextLength) {
      score += 20;
    } else {
      score += 5; // Very short text gets minimal points
    }

    // Comment quality scoring
    const commentLength = annotation.annotation_comment?.length || 0;
    if (commentLength >= this.CONTENT_THRESHOLDS.goodCommentLength) {
      score += 35;
    } else if (commentLength >= this.CONTENT_THRESHOLDS.minCommentLength) {
      score += 25;
    } else if (commentLength > 0) {
      score += 10;
    }

    // Bonus for having both text and comment
    if (textLength > 0 && commentLength > 0) {
      score += 15;
    }

    // Content structure analysis
    if (annotation.annotation_comment) {
      // Check for question marks (indicates thoughtful questions)
      if (annotation.annotation_comment.includes('?')) {
        score += 5;
      }
      
      // Check for structured content (lists, numbers)
      if (/[1-9]\.|•|\*|-/.test(annotation.annotation_comment)) {
        score += 5;
      }
      
      // Check for academic keywords
      const academicKeywords = ['research', 'study', 'analysis', 'evidence', 'hypothesis', 'conclusion', 'methodology', 'findings'];
      const hasAcademicContent = academicKeywords.some(keyword => 
        annotation.annotation_comment.toLowerCase().includes(keyword)
      );
      if (hasAcademicContent) {
        score += 10;
      }
    }

    return Math.min(score, maxScore);
  }

  /**
   * Calculate social engagement score based on likes and comments
   */
  private static calculateSocialEngagement(annotation: SharedAnnotation): number {
    const maxScore = 100;
    const likesScore = Math.min(annotation.likes_count * 5, 50); // Max 50 points from likes
    const commentsScore = Math.min(annotation.comments_count * 10, 50); // Max 50 points from comments
    
    return Math.min(likesScore + commentsScore, maxScore);
  }

  /**
   * Calculate author reputation based on their overall contribution quality
   */
  private static async calculateAuthorReputation(userId: string): Promise<number> {
    try {
      const userStats = await SocialManager.getUserStats(userId);
      if (!userStats) return 0;

      let score = 0;
      const maxScore = 100;

      // Annotations count (productivity)
      const annotationsScore = Math.min(userStats.annotations_count * 2, 30);
      score += annotationsScore;

      // Likes received (quality indicator)
      const likesScore = Math.min(userStats.likes_received * 1.5, 35);
      score += likesScore;

      // Comments received (engagement indicator)
      const commentsScore = Math.min(userStats.comments_received * 2, 25);
      score += commentsScore;

      // Followers (influence indicator)
      const followersScore = Math.min(userStats.followers_count * 3, 10);
      score += followersScore;

      return Math.min(score, maxScore);
    } catch (error) {
      ztoolkit.log("Error calculating author reputation:", error);
      return 0;
    }
  }

  /**
   * Calculate recency score (newer annotations get higher scores)
   */
  private static calculateRecency(annotation: SharedAnnotation): number {
    const now = new Date();
    const createdAt = new Date(annotation.created_at);
    const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < 1) return 100;
    if (daysDiff < 7) return 80;
    if (daysDiff < 30) return 60;
    if (daysDiff < 90) return 40;
    if (daysDiff < 365) return 20;
    return 10;
  }

  /**
   * Calculate relevance score based on annotation type and position
   */
  private static calculateRelevance(annotation: SharedAnnotation): number {
    let score = 50; // Base score

    // Annotation type scoring
    switch (annotation.annotation_type) {
      case 'highlight':
        score += 20;
        break;
      case 'note':
        score += 30;
        break;
      case 'image':
        score += 15;
        break;
      default:
        score += 10;
    }

    // Position relevance (annotations in the middle of the document might be more relevant)
    if (annotation.page_number) {
      // This is a simplified heuristic - in practice, you'd want more sophisticated analysis
      score += 10;
    }

    // Color coding relevance (some colors might indicate importance)
    if (annotation.annotation_color) {
      const importantColors = ['#ff0000', '#ff6600', '#ffff00']; // Red, orange, yellow
      if (importantColors.includes(annotation.annotation_color.toLowerCase())) {
        score += 10;
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Batch calculate quality scores for multiple annotations
   */
  static async calculateBatchQualityScores(annotations: SharedAnnotation[]): Promise<Map<string, QualityMetrics>> {
    const results = new Map<string, QualityMetrics>();
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < annotations.length; i += batchSize) {
      const batch = annotations.slice(i, i + batchSize);
      const batchPromises = batch.map(async (annotation) => {
        const metrics = await this.calculateQualityScore(annotation);
        return { id: annotation.id, metrics };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, metrics }) => {
        results.set(id, metrics);
      });

      // Small delay between batches to prevent rate limiting
      if (i + batchSize < annotations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Sort annotations by quality score
   */
  static sortByQuality(annotations: SharedAnnotation[], qualityScores?: Map<string, QualityMetrics>): SharedAnnotation[] {
    return annotations.sort((a, b) => {
      const scoreA = qualityScores?.get(a.id)?.totalScore || a.quality_score || 0;
      const scoreB = qualityScores?.get(b.id)?.totalScore || b.quality_score || 0;
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA; // Higher scores first
      }
      
      // Secondary sort by creation date (newer first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  /**
   * Filter annotations by minimum quality threshold
   */
  static filterByQuality(
    annotations: SharedAnnotation[], 
    minScore: number,
    qualityScores?: Map<string, QualityMetrics>
  ): SharedAnnotation[] {
    return annotations.filter(annotation => {
      const score = qualityScores?.get(annotation.id)?.totalScore || annotation.quality_score || 0;
      return score >= minScore;
    });
  }

  /**
   * Get quality distribution statistics
   */
  static getQualityStats(qualityScores: Map<string, QualityMetrics>) {
    const scores = Array.from(qualityScores.values()).map(m => m.totalScore);
    
    if (scores.length === 0) {
      return {
        count: 0,
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        distribution: { excellent: 0, good: 0, average: 0, poor: 0 }
      };
    }

    scores.sort((a, b) => a - b);
    
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const median = scores.length % 2 === 0 
      ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
      : scores[Math.floor(scores.length / 2)];

    const distribution = {
      excellent: scores.filter(s => s >= 80).length,
      good: scores.filter(s => s >= 60 && s < 80).length,
      average: scores.filter(s => s >= 40 && s < 60).length,
      poor: scores.filter(s => s < 40).length,
    };

    return {
      count: scores.length,
      average: Math.round(average * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: scores[0],
      max: scores[scores.length - 1],
      distribution
    };
  }
}

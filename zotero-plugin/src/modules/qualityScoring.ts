import { SharedAnnotation } from "./annotations";
import { SocialManager } from "./social";

export interface QualityMetrics {
  contentQuality: number;
  socialEngagement: number;
  authorReputation: number;
  recency: number;
  relevance: number;
  academicValue: number;
  totalScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D';
}

export class QualityScoringEngine {
  // Enhanced weights for different quality factors
  private static readonly WEIGHTS = {
    contentQuality: 0.25,
    socialEngagement: 0.2,
    authorReputation: 0.15,
    recency: 0.1,
    relevance: 0.15,
    academicValue: 0.15,
  };

  // Academic keywords that indicate scholarly value
  private static readonly ACADEMIC_KEYWORDS = [
    'hypothesis', 'methodology', 'analysis', 'conclusion', 'evidence', 'research',
    'study', 'findings', 'results', 'discussion', 'theory', 'framework',
    'significant', 'correlation', 'causation', 'statistical', 'empirical',
    'peer-reviewed', 'citation', 'reference', 'literature', 'meta-analysis'
  ];

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
    const academicValue = this.calculateAcademicValue(annotation);

    const totalScore =
      contentQuality * this.WEIGHTS.contentQuality +
      socialEngagement * this.WEIGHTS.socialEngagement +
      authorReputation * this.WEIGHTS.authorReputation +
      recency * this.WEIGHTS.recency +
      relevance * this.WEIGHTS.relevance +
      academicValue * this.WEIGHTS.academicValue;

    const grade = this.calculateGrade(totalScore);

    return {
      contentQuality,
      socialEngagement,
      authorReputation,
      recency,
      relevance,
      academicValue,
      totalScore: Math.round(totalScore * 100) / 100,
      grade,
    };
  }

  /**
   * Calculate academic value based on scholarly keywords and content depth
   */
  private static calculateAcademicValue(annotation: SharedAnnotation): number {
    let score = 0;
    const maxScore = 100;

    const fullText = `${annotation.annotation_text || ''} ${annotation.annotation_comment || ''}`.toLowerCase();

    // Check for academic keywords
    let keywordCount = 0;
    for (const keyword of this.ACADEMIC_KEYWORDS) {
      if (fullText.includes(keyword)) {
        keywordCount++;
      }
    }

    // Score based on keyword density
    if (keywordCount >= 5) {
      score += 40;
    } else if (keywordCount >= 3) {
      score += 30;
    } else if (keywordCount >= 1) {
      score += 20;
    }

    // Check for citations or references
    if (/\(\d{4}\)|et al\.|doi:|http[s]?:\/\//.test(fullText)) {
      score += 25;
    }

    // Check for methodological language
    if (/method|approach|technique|procedure|protocol/.test(fullText)) {
      score += 15;
    }

    // Check for critical thinking indicators
    if (/however|although|despite|nevertheless|on the other hand|in contrast/.test(fullText)) {
      score += 10;
    }

    // Check for quantitative indicators
    if (/\d+%|\d+\.\d+|significant|p\s*[<>=]\s*\d/.test(fullText)) {
      score += 10;
    }

    return Math.min(score, maxScore);
  }

  /**
   * Calculate grade based on total score
   */
  private static calculateGrade(totalScore: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' {
    if (totalScore >= 90) return 'A+';
    if (totalScore >= 85) return 'A';
    if (totalScore >= 80) return 'B+';
    if (totalScore >= 75) return 'B';
    if (totalScore >= 70) return 'C+';
    if (totalScore >= 60) return 'C';
    return 'D';
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

  /**
   * Recommend annotations based on user preferences and quality
   */
  static async recommendAnnotations(
    allAnnotations: SharedAnnotation[],
    userPreferences: {
      followedUsers?: string[];
      preferredTopics?: string[];
      minQualityScore?: number;
      maxResults?: number;
    } = {}
  ): Promise<SharedAnnotation[]> {
    try {
      // Calculate quality scores for all annotations
      const qualityScores = await this.calculateBatchQualityScores(allAnnotations);

      // Filter and score annotations
      const scoredAnnotations = allAnnotations.map(annotation => {
        const quality = qualityScores.get(annotation.id);
        let recommendationScore = quality?.totalScore || 0;

        // Boost score for followed users
        if (userPreferences.followedUsers?.includes(annotation.user_id)) {
          recommendationScore += 15;
        }

        // Boost score for preferred topics (based on keywords in annotation)
        if (userPreferences.preferredTopics) {
          const annotationText = `${annotation.annotation_text || ''} ${annotation.annotation_comment || ''}`.toLowerCase();
          const topicMatches = userPreferences.preferredTopics.filter(topic =>
            annotationText.includes(topic.toLowerCase())
          ).length;
          recommendationScore += topicMatches * 5;
        }

        return {
          ...annotation,
          recommendationScore,
          qualityMetrics: quality
        };
      });

      // Filter by minimum quality score
      const minScore = userPreferences.minQualityScore || 60;
      const filteredAnnotations = scoredAnnotations.filter(a =>
        (a.qualityMetrics?.totalScore || 0) >= minScore
      );

      // Sort by recommendation score
      filteredAnnotations.sort((a, b) => b.recommendationScore - a.recommendationScore);

      // Return top recommendations
      const maxResults = userPreferences.maxResults || 20;
      return filteredAnnotations.slice(0, maxResults);

    } catch (error) {
      ztoolkit.log("Error generating recommendations:", error);
      return allAnnotations.slice(0, userPreferences.maxResults || 20);
    }
  }

  /**
   * Analyze annotation trends over time
   */
  static analyzeAnnotationTrends(annotations: SharedAnnotation[], days: number = 30) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const recentAnnotations = annotations.filter(a =>
      new Date(a.created_at) >= cutoffDate
    );

    // Group by day
    const dailyStats = new Map<string, { count: number; totalLikes: number }>();

    recentAnnotations.forEach(annotation => {
      const dateKey = new Date(annotation.created_at).toISOString().split('T')[0];
      const existing = dailyStats.get(dateKey) || { count: 0, totalLikes: 0 };

      existing.count++;
      existing.totalLikes += annotation.likes_count || 0;

      dailyStats.set(dateKey, existing);
    });

    return {
      totalAnnotations: recentAnnotations.length,
      dailyStats: Object.fromEntries(dailyStats),
      averagePerDay: Math.round((recentAnnotations.length / days) * 100) / 100,
      topAuthors: this.getTopAuthors(recentAnnotations),
      qualityTrend: this.calculateQualityTrend(recentAnnotations),
    };
  }

  /**
   * Get top authors by annotation count and engagement
   */
  static getTopAuthors(annotations: SharedAnnotation[], limit: number = 10) {
    const authorStats = new Map<string, {
      count: number;
      totalLikes: number;
      totalComments: number;
      name: string;
      engagementScore: number;
    }>();

    annotations.forEach(annotation => {
      const existing = authorStats.get(annotation.user_id) || {
        count: 0,
        totalLikes: 0,
        totalComments: 0,
        name: annotation.user_name,
        engagementScore: 0
      };

      existing.count++;
      existing.totalLikes += annotation.likes_count || 0;
      existing.totalComments += annotation.comments_count || 0;
      existing.engagementScore = existing.count * 10 + existing.totalLikes * 2 + existing.totalComments * 3;

      authorStats.set(annotation.user_id, existing);
    });

    return Array.from(authorStats.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);
  }

  /**
   * Calculate quality trend over time
   */
  private static calculateQualityTrend(annotations: SharedAnnotation[]) {
    if (annotations.length < 2) return { trend: 'stable', change: 0 };

    // Sort by date
    const sortedAnnotations = annotations.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const midpoint = Math.floor(sortedAnnotations.length / 2);
    const firstHalf = sortedAnnotations.slice(0, midpoint);
    const secondHalf = sortedAnnotations.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.quality_score || 0), 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.quality_score || 0), 0) / secondHalf.length;

    const change = secondHalfAvg - firstHalfAvg;
    const trend = change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable';

    return { trend, change: Math.round(change * 100) / 100 };
  }
}

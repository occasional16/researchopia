/**
 * Unified Rating API Client
 * Shared types and API methods for rating/comment operations
 */

// ============================================================================
// Types
// ============================================================================

export type TargetType = 'paper' | 'webpage';

export interface RatingScores {
  dimension1?: number;  // Paper: innovation | Webpage: quality
  dimension2?: number;  // Paper: methodology | Webpage: usefulness  
  dimension3?: number;  // Paper: practicality | Webpage: accuracy
  overall: number;
}

export interface Rating {
  id: string;
  targetType: TargetType;
  targetId: string;
  userId: string;
  dimension1?: number;
  dimension2?: number;
  dimension3?: number;
  overallScore: number;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  targetType: TargetType;
  targetId: string;
  userId: string;
  parentId?: string;
  content: string;
  isAnonymous: boolean;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  // User info (when joined)
  user?: {
    username?: string;
    email?: string;
    avatarUrl?: string;
  };
  // Nested replies
  children?: Comment[];
}

export interface RatingStats {
  count: number;
  average: {
    dimension1?: number;
    dimension2?: number;
    dimension3?: number;
    overall: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// API Client
// ============================================================================

export class EvaluationAPI {
  private serverUrl: string;
  private accessToken: string | null;

  constructor(serverUrl: string, accessToken?: string) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = accessToken || null;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const url = `${this.serverUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // ==================== Ratings ====================

  async submitRating(
    targetType: TargetType,
    targetId: string,
    scores: RatingScores,
    options: {
      isAnonymous?: boolean;
      url?: string;  // For auto-creating webpage
      title?: string;
    } = {}
  ): Promise<ApiResponse<{ rating: Rating; stats: RatingStats }>> {
    return this.request('/api/v2/ratings', 'POST', {
      targetType,
      targetId,
      scores,
      isAnonymous: options.isAnonymous ?? false,
      url: options.url,
      title: options.title,
    });
  }

  async getRatings(
    targetType: TargetType,
    targetId: string,
    options: { includeUserRating?: boolean } = {}
  ): Promise<ApiResponse<{ ratings: Rating[]; stats: RatingStats; userRating?: Rating }>> {
    const params = new URLSearchParams({
      targetType,
      targetId,
    });
    if (options.includeUserRating) {
      params.append('includeUserRating', 'true');
    }
    return this.request(`/api/v2/ratings?${params}`);
  }

  async deleteRating(ratingId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/v2/ratings/${ratingId}`, 'DELETE');
  }

  // ==================== Comments ====================

  async submitComment(
    targetType: TargetType,
    targetId: string,
    content: string,
    options: {
      parentId?: string;
      isAnonymous?: boolean;
    } = {}
  ): Promise<ApiResponse<{ comment: Comment }>> {
    return this.request('/api/v2/comments', 'POST', {
      targetType,
      targetId,
      content,
      parentId: options.parentId,
      isAnonymous: options.isAnonymous ?? false,
    });
  }

  async getComments(
    targetType: TargetType,
    targetId: string,
    options: {
      nested?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ApiResponse<{ comments: Comment[]; total: number; hasMore: boolean }>> {
    const params = new URLSearchParams({
      targetType,
      targetId,
    });
    if (options.nested) params.append('nested', 'true');
    if (options.limit) params.append('limit', String(options.limit));
    if (options.offset) params.append('offset', String(options.offset));
    
    return this.request(`/api/v2/comments?${params}`);
  }

  async updateComment(
    commentId: string,
    content: string,
    isAnonymous?: boolean
  ): Promise<ApiResponse<{ comment: Comment }>> {
    return this.request(`/api/v2/comments/${commentId}`, 'PATCH', {
      content,
      isAnonymous,
    });
  }

  async deleteComment(commentId: string): Promise<ApiResponse<void>> {
    return this.request(`/api/v2/comments/${commentId}`, 'DELETE');
  }

  async likeComment(commentId: string): Promise<ApiResponse<{ likesCount: number }>> {
    return this.request(`/api/v2/comments/${commentId}/like`, 'POST');
  }
}

// ============================================================================
// Dimension Configurations
// ============================================================================

export interface DimensionConfig {
  key: 'dimension1' | 'dimension2' | 'dimension3';
  label: string;
  description: string;
}

export const PAPER_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '创新性', description: '研究思路和方法的创新程度' },
  { key: 'dimension2', label: '方法论', description: '研究方法的科学性和严谨性' },
  { key: 'dimension3', label: '实用性', description: '研究成果的应用价值' },
];

export const WEBPAGE_DIMENSIONS: DimensionConfig[] = [
  { key: 'dimension1', label: '内容质量', description: '内容的深度和完整性' },
  { key: 'dimension2', label: '实用性', description: '内容的实际应用价值' },
  { key: 'dimension3', label: '准确性', description: '信息的准确性和可靠性' },
];

export function getDimensions(targetType: TargetType): DimensionConfig[] {
  return targetType === 'paper' ? PAPER_DIMENSIONS : WEBPAGE_DIMENSIONS;
}

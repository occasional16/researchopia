/**
 * API Service module for the browser extension
 * Handles all API communication with Researchopia server
 */

import type { RatingsResponse, CommentsResponse, SidebarComment, Ratings } from '../types';
import { showToast } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface SubmitRatingParams {
  targetId: string;
  scores: {
    dimension1: number | null;
    dimension2: number | null;
    dimension3: number | null;
    overall: number;
  };
  url: string;
  title: string;
  isAnonymous?: boolean;
  showUsername?: boolean;
}

export interface SubmitCommentParams {
  targetId: string;
  content: string;
  url: string;
  title: string;
  parentId?: string | null;
  isAnonymous?: boolean;
}

// ============================================================================
// API Service Class
// ============================================================================

export class ApiService {
  private serverUrl: string;
  private accessToken: string | null = null;
  private onAuthRequired?: () => void;

  constructor(serverUrl: string, onAuthRequired?: () => void) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.onAuthRequired = onAuthRequired;
  }

  // ==================== Config ====================

  setServerUrl(url: string): void {
    this.serverUrl = url.replace(/\/$/, '');
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  // ==================== Generic Request ====================

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
      credentials: 'include',
      cache: 'no-store',
    };

    if (this.accessToken) {
      (options.headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);

    if (!response.ok) {
      // Try to get error details from response body
      let errorDetail = '';
      try {
        const errorBody = await response.json();
        errorDetail = errorBody.error || errorBody.message || '';
      } catch {
        // Ignore
      }
      
      if (response.status === 401) {
        this.onAuthRequired?.();
        throw new Error('Authentication required');
      }
      throw new Error(`HTTP ${response.status}: ${errorDetail}`);
    }

    return await response.json();
  }

  // ==================== Ratings API ====================

  /**
   * Load ratings for a webpage (stats + user rating)
   */
  async loadRatings(urlHash: string): Promise<RatingsResponse> {
    return this.request<RatingsResponse>(
      `/api/v2/ratings?targetType=webpage&targetId=${urlHash}&includeUserRating=true`
    );
  }

  /**
   * Submit or update a rating
   */
  async submitRating(params: SubmitRatingParams): Promise<void> {
    await this.request('/api/v2/ratings', 'POST', {
      targetType: 'webpage',
      targetId: params.targetId,
      scores: params.scores,
      url: params.url,
      title: params.title,
      isAnonymous: params.isAnonymous || false,
      showUsername: params.showUsername ?? true,
    });
  }

  // ==================== Comments API ====================

  /**
   * Load comments for a webpage
   * @param urlHash - The hash of the webpage URL
   * @param limit - Maximum number of comments to load
   * @param offset - Offset for pagination
   * @param nested - Whether to include nested replies (default: true)
   */
  async loadComments(urlHash: string, limit: number, offset: number, nested: boolean = true): Promise<CommentsResponse> {
    return this.request<CommentsResponse>(
      `/api/v2/comments?targetType=webpage&targetId=${urlHash}&limit=${limit}&offset=${offset}&nested=${nested}`
    );
  }

  /**
   * Submit a new comment
   */
  async submitComment(params: SubmitCommentParams): Promise<void> {
    const body: Record<string, unknown> = {
      targetType: 'webpage',
      targetId: params.targetId,
      content: params.content,
      url: params.url,
      title: params.title,
      isAnonymous: params.isAnonymous || false,
    };
    if (params.parentId) body.parentId = params.parentId;

    await this.request('/api/v2/comments', 'POST', body);
  }

  /**
   * Delete a comment
   */
  async deleteComment(urlHash: string, commentId: string): Promise<void> {
    await this.request(
      `/api/v2/comments?targetType=webpage&targetId=${urlHash}&commentId=${commentId}`,
      'DELETE'
    );
  }

  /**
   * Toggle like on a comment
   * @returns { action: 'added' | 'removed', likeCount: number, hasLiked: boolean }
   */
  async voteComment(commentId: string): Promise<{ action: string; likeCount: number; hasLiked: boolean }> {
    return this.request('/api/v2/comments/vote', 'POST', {
      targetType: 'webpage',
      commentId,
    });
  }
}

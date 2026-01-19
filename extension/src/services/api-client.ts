/**
 * API Client Service
 * Centralized HTTP client for Researchopia API calls
 */

import type { MessageResponse } from '../types/api';

export interface APIClientConfig {
  baseUrl: string;
  timeout?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * API Client for making HTTP requests to Researchopia backend
 */
export class APIClient {
  private config: APIClientConfig;

  constructor(config: APIClientConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      ...config,
    };
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Set the base URL (useful for switching between dev/prod)
   */
  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
  }

  /**
   * Make an authenticated request
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
    authToken?: string
  ): Promise<APIResponse<T>> {
    const { method = 'GET', headers = {}, body, timeout = this.config.timeout } = options;

    const url = `${this.config.baseUrl}${endpoint}`;
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      // Handle both { success: true, data: ... } and direct data responses
      if (data.success === false) {
        return {
          success: false,
          error: data.error || 'Unknown error',
          status: response.status,
        };
      }

      return {
        success: true,
        data: data.data || data,
        status: response.status,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Request timeout' };
        }
        return { success: false, error: error.message };
      }

      return { success: false, error: 'Unknown error' };
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string, authToken?: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' }, authToken);
  }

  /**
   * POST request
   */
  async post<T = unknown>(endpoint: string, body: unknown, authToken?: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body }, authToken);
  }

  /**
   * PUT request
   */
  async put<T = unknown>(endpoint: string, body: unknown, authToken?: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body }, authToken);
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string, authToken?: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' }, authToken);
  }

  // ==========================================================================
  // Specific API Endpoints
  // ==========================================================================

  /**
   * Create a knowledge unit
   */
  async createKnowledgeUnit(
    data: {
      type: string;
      url: string;
      title: string;
      visibility: string;
      doi?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
    authToken: string
  ): Promise<APIResponse> {
    return this.post('/api/kn/units/create', data, authToken);
  }

  /**
   * Get paper info by DOI
   */
  async getPaperByDOI(doi: string): Promise<APIResponse> {
    return this.get(`/api/papers/doi/${encodeURIComponent(doi)}`);
  }

  /**
   * Get paper ratings
   */
  async getPaperRatings(doi: string): Promise<APIResponse> {
    return this.get(`/api/papers/doi/${encodeURIComponent(doi)}/ratings`);
  }

  /**
   * Submit a rating
   */
  async submitRating(
    data: {
      doi: string;
      rating: number;
      comment?: string;
    },
    authToken: string
  ): Promise<APIResponse> {
    return this.post('/api/ratings/submit', data, authToken);
  }

  /**
   * Get annotations for a paper
   */
  async getAnnotations(doi: string, authToken?: string): Promise<APIResponse> {
    const endpoint = `/api/proxy/annotations/list?doi=${encodeURIComponent(doi)}`;
    return this.get(endpoint, authToken);
  }

  /**
   * Create an annotation
   */
  async createAnnotation(
    data: {
      doi: string;
      content: string;
      position?: unknown;
      pageNumber?: number;
    },
    authToken: string
  ): Promise<APIResponse> {
    return this.post('/api/proxy/annotations/create', data, authToken);
  }

  /**
   * Search papers
   */
  async searchPapers(query: string, page = 1, limit = 10): Promise<APIResponse> {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      limit: String(limit),
    });
    return this.get(`/api/search?${params}`);
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let apiClientInstance: APIClient | null = null;

/**
 * Get or create the API client instance
 */
export function getAPIClient(baseUrl?: string): APIClient {
  if (!apiClientInstance) {
    apiClientInstance = new APIClient({
      baseUrl: baseUrl || 'https://www.researchopia.com',
    });
  } else if (baseUrl) {
    apiClientInstance.setBaseUrl(baseUrl);
  }
  return apiClientInstance;
}

/**
 * Initialize API client from storage
 */
export async function initAPIClient(): Promise<APIClient> {
  try {
    const result = await chrome.storage.sync.get(['researchopiaUrl']);
    const baseUrl = result.researchopiaUrl || 'https://www.researchopia.com';
    return getAPIClient(baseUrl);
  } catch {
    return getAPIClient();
  }
}

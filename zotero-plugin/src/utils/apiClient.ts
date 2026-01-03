/**
 * API请求工具
 * 统一的HTTP请求封装,包含认证、重试、超时等功能
 */

import { logger } from './logger';
import { envConfig } from '../config/env';

export class APIClient {
  private static instance: APIClient;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): APIClient {
    if (!APIClient.instance) {
      APIClient.instance = new APIClient();
    }
    return APIClient.instance;
  }

  private getApiBaseUrl(): string {
    return envConfig.apiBaseUrl;
  }

  private getAccessToken(): string | null {
    try {
      const session = Zotero.Prefs.get('extensions.zotero.researchopia.session', true);
      if (session) {
        const sessionData = JSON.parse(session as string);
        return sessionData?.access_token || null;
      }
    } catch (error) {
      logger.error('[APIClient] Error getting access token:', error);
    }
    return null;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout = 5000
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms: ${url}`));
      }, timeout);

      fetch(url, options)
        .then(response => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  public async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    requireAuth = true
  ): Promise<T> {
    const url = `${this.getApiBaseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    logger.log(`[APIClient] Making ${method} request to: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // 🔥 强制禁用缓存
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };

    if (requireAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        logger.warn('[APIClient] No access token for authenticated request');
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      cache: 'no-store', // 强制禁用 fetch API 缓存
    };

    if (data && method !== 'GET') {
      fetchOptions.body = JSON.stringify(data);
    }

    try {
      const response = await this.fetchWithTimeout(url, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `HTTP ${response.status} error`,
        })) as { message?: string };
        logger.error(`[APIClient] HTTP ${response.status} for ${url}:`, errorData);
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      const responseData = await response.json();
      logger.log(`[APIClient] ✅ Request successful: ${method} ${url}`);
      return responseData as T;
    } catch (error) {
      logger.error(`[APIClient] Request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  public get<T>(endpoint: string, params?: URLSearchParams, requireAuth = true): Promise<T> {
    const url = params ? `${endpoint}?${params.toString()}` : endpoint;
    return this.request<T>('GET', url, undefined, requireAuth);
  }

  public post<T>(endpoint: string, body: any, requireAuth = true): Promise<T> {
    return this.request<T>('POST', endpoint, body, requireAuth);
  }

  public patch<T>(endpoint: string, body: any, requireAuth = true): Promise<T> {
    return this.request<T>('PATCH', endpoint, body, requireAuth);
  }

  public delete<T>(endpoint: string, requireAuth = true): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, requireAuth);
  }
}

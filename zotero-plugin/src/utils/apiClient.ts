/**
 * API请求工具
 * 统一的HTTP请求封装,包含认证、重试、超时等功能
 */

import { logger } from "./logger";
import { envConfig } from "../config/env";

// 使用动态getter获取API基础URL,支持运行时环境切换
function getApiBaseUrl(): string {
  return envConfig.apiBaseUrl;
}

// 请求超时时间(毫秒)
const REQUEST_TIMEOUT = 5000;

// 最大重试次数
const MAX_RETRIES = 2;

/**
 * 获取当前用户的access_token
 */
function getAccessToken(): string | null {
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

/**
 * 带超时的fetch
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
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

/**
 * API请求配置
 */
interface APIRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean; // 是否需要认证
  timeout?: number;
  retries?: number;
}

/**
 * API响应接口
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 统一的API请求方法
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: APIRequestOptions = {}
): Promise<APIResponse<T>> {
  const {
    method = 'GET',
    body,
    headers = {},
    requireAuth = true,
    timeout = REQUEST_TIMEOUT,
    retries = MAX_RETRIES
  } = options;

  const url = `${getApiBaseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  logger.log(`[APIClient] Making ${method} request to:`, url);

  // 构建请求头
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  // 添加认证token
  if (requireAuth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      logger.warn('[APIClient] No access token available for authenticated request');
    }
  }

  // 构建请求选项
  const fetchOptions: RequestInit = {
    method,
    headers: requestHeaders
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  // 重试逻辑
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        logger.log(`[APIClient] Retry attempt ${attempt}/${retries} for ${url}`);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }

      const response = await fetchWithTimeout(url, fetchOptions, timeout);

      // 解析响应
      let responseData: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        responseData = { success: response.ok, data: text };
      }

      // 处理HTTP错误
      if (!response.ok) {
        logger.error(`[APIClient] HTTP ${response.status} error for ${url}:`, responseData);
        return {
          success: false,
          error: responseData.error || responseData.message || `HTTP ${response.status} Error`
        };
      }

      logger.log(`[APIClient] ✅ Request successful: ${method} ${url}`);
      return responseData;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error(`[APIClient] Request failed (attempt ${attempt + 1}/${retries + 1}):`, lastError.message);
      
      // 最后一次尝试失败时不继续重试
      if (attempt >= retries) {
        break;
      }
    }
  }

  // 所有重试都失败
  return {
    success: false,
    error: lastError?.message || 'Request failed after multiple retries'
  };
}

/**
 * 便捷方法: GET请求
 */
export function apiGet<T = any>(endpoint: string, options: Omit<APIRequestOptions, 'method'> = {}): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * 便捷方法: POST请求
 */
export function apiPost<T = any>(endpoint: string, body: any, options: Omit<APIRequestOptions, 'method' | 'body'> = {}): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * 便捷方法: PATCH请求
 */
export function apiPatch<T = any>(endpoint: string, body: any, options: Omit<APIRequestOptions, 'method' | 'body'> = {}): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'PATCH', body });
}

/**
 * 便捷方法: DELETE请求
 */
export function apiDelete<T = any>(endpoint: string, options: Omit<APIRequestOptions, 'method'> = {}): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
}

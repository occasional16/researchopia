/**
 * API Client工具
 */
interface FetchOptions extends RequestInit {
    timeout?: number;
}
/**
 * 带超时的fetch请求
 */
declare function fetchWithTimeout(url: string, options?: FetchOptions): Promise<Response>;
/**
 * 构建带查询参数的URL
 */
declare function buildUrlWithParams(baseUrl: string, params: Record<string, string>): string;
/**
 * 解析API错误
 */
declare function parseApiError(error: unknown): string;

export { type FetchOptions, buildUrlWithParams, fetchWithTimeout, parseApiError };

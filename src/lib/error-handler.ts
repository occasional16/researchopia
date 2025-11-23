/**
 * 网站端错误处理工具
 * 集成 @researchopia/shared/errors
 */

import {
  ResearchopiaError,
  ErrorCode,
  ErrorHandler as BaseErrorHandler,
  createError,
} from '@researchopia/shared/errors';

export { ResearchopiaError, ErrorCode, createError };

/**
 * 网站端错误处理器（扩展基础处理器）
 */
export class ErrorHandler extends BaseErrorHandler {
  /**
   * 在客户端显示错误提示（使用toast或其他UI组件）
   */
  static showToUser(error: ResearchopiaError): void {
    // TODO: 集成toast组件
    console.error('[User Error]', error.getUserMessage());
  }

  /**
   * 处理API错误
   */
  static handleApiError(error: unknown): ResearchopiaError {
    const normalized = this.normalize(error, 'website', ErrorCode.API_SERVER_ERROR);
    this.log(normalized);
    this.showToUser(normalized);
    return normalized;
  }

  /**
   * 处理认证错误
   */
  static handleAuthError(error: unknown): ResearchopiaError {
    const normalized = this.normalize(error, 'website', ErrorCode.AUTH_INVALID_CREDENTIALS);
    this.log(normalized);
    
    // 认证错误需要特殊处理（如跳转到登录页）
    if (normalized.requiresReauth()) {
      // TODO: 跳转到登录页或刷新token
      console.warn('[Auth Required] Redirecting to login...');
    }
    
    return normalized;
  }

  /**
   * 处理数据验证错误
   */
  static handleValidationError(
    message: string,
    context?: Record<string, any>
  ): ResearchopiaError {
    const error = createError.validation(message, 'website', context);
    this.log(error);
    this.showToUser(error);
    return error;
  }
}

/**
 * 错误边界辅助函数
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  onError?: (error: ResearchopiaError) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const handled = ErrorHandler.handleApiError(error);
    onError?.(handled);
    return null;
  }
}

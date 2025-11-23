/**
 * 统一错误处理工具
 * 用于Zotero插件的错误提示和日志
 */

import { logger } from './logger';

export class ResearchopiaError extends Error {
  constructor(
    message: string,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ResearchopiaError';
  }
}

/**
 * 网络错误（可重试）
 */
export class NetworkError extends ResearchopiaError {
  constructor(message = '网络连接失败，请检查网络设置') {
    super(message, 'NETWORK_ERROR', true);
  }
}

/**
 * 认证错误（不可重试）
 */
export class AuthenticationError extends ResearchopiaError {
  constructor(message = '认证失败，请重新登录') {
    super(message, 'AUTH_ERROR', false);
  }
}

/**
 * API错误
 */
export class APIError extends ResearchopiaError {
  constructor(message: string, public statusCode?: number) {
    super(message, 'API_ERROR', statusCode ? statusCode >= 500 : false);
  }
}

/**
 * 统一错误处理器
 */
export class ErrorHandler {
  /**
   * 处理错误并显示用户友好的提示
   */
  static handle(error: unknown, context?: string): ResearchopiaError {
    const processedError = this.processError(error);
    
    // 记录日志
    logger.error(`[ErrorHandler] ${context || 'Error'}:`, {
      message: processedError.message,
      code: processedError.code,
      retryable: processedError.retryable,
    });

    // 显示用户提示
    this.showUserNotification(processedError, context);

    return processedError;
  }

  /**
   * 处理错误，转换为标准错误类型
   */
  private static processError(error: unknown): ResearchopiaError {
    if (error instanceof ResearchopiaError) {
      return error;
    }

    if (error instanceof Error) {
      // 网络错误检测
      if (error.message.includes('timeout') || error.message.includes('network')) {
        return new NetworkError();
      }

      // 认证错误检测
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return new AuthenticationError();
      }

      return new ResearchopiaError(error.message);
    }

    return new ResearchopiaError('未知错误');
  }

  /**
   * 显示用户通知（使用logger，避免Zotero API版本问题）
   */
  private static showUserNotification(error: ResearchopiaError, context?: string) {
    const message = context ? `${context}: ${error.message}` : error.message;
    
    // 使用logger记录（Zotero会在控制台显示）
    logger.error(`[用户提示] ${message}`);
    
    if (error.retryable) {
      logger.info('[用户提示] 请稍后重试');
    }
  }

  /**
   * 带重试的异步操作
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    context?: string
  ): Promise<T> {
    let lastError: unknown;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const processedError = this.processError(error);
        
        if (!processedError.retryable || i === maxRetries - 1) {
          throw this.handle(error, context);
        }
        
        // 指数退避
        const delay = Math.min(1000 * Math.pow(2, i), 5000);
        logger.warn(`[ErrorHandler] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw this.handle(lastError, context);
  }
}

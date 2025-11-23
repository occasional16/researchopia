/**
 * 统一错误处理系统
 * 用于三端（网站、Zotero插件、浏览器扩展）的错误管理
 */

export enum ErrorCode {
  // 网络错误 (1xxx)
  NETWORK_ERROR = 1000,
  NETWORK_TIMEOUT = 1001,
  NETWORK_OFFLINE = 1002,

  // 认证错误 (2xxx)
  AUTH_INVALID_CREDENTIALS = 2000,
  AUTH_TOKEN_EXPIRED = 2001,
  AUTH_PERMISSION_DENIED = 2002,
  AUTH_SESSION_INVALID = 2003,

  // 数据错误 (3xxx)
  DATA_NOT_FOUND = 3000,
  DATA_VALIDATION_FAILED = 3001,
  DATA_CONFLICT = 3002,
  DATA_PARSE_ERROR = 3003,

  // API错误 (4xxx)
  API_INVALID_REQUEST = 4000,
  API_RATE_LIMIT = 4001,
  API_SERVER_ERROR = 4002,
  API_BAD_RESPONSE = 4003,

  // 业务逻辑错误 (5xxx)
  ANNOTATION_SYNC_FAILED = 5000,
  SESSION_JOIN_FAILED = 5001,
  PAPER_REGISTRATION_FAILED = 5002,
  PDF_LOAD_FAILED = 5003,
  DOI_INVALID = 5004,

  // 系统错误 (9xxx)
  UNKNOWN_ERROR = 9000,
}

export type ErrorSource = 'website' | 'zotero-plugin' | 'browser-extension';

export interface ErrorContext {
  [key: string]: any;
}

/**
 * Researchopia统一错误类
 * 
 * @example
 * ```typescript
 * throw new ResearchopiaError(
 *   ErrorCode.AUTH_TOKEN_EXPIRED,
 *   'Access token has expired',
 *   'website',
 *   { userId: '123', token: 'xxx...' }
 * );
 * ```
 */
export class ResearchopiaError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: ErrorContext;
  public readonly timestamp: number;
  public readonly source: ErrorSource;
  public readonly originalError?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    source: ErrorSource,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'ResearchopiaError';
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
    this.source = source;
    this.originalError = originalError;

    // 保持原始错误堆栈
    if (originalError && originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }

  /**
   * 转换为JSON格式（用于日志记录和网络传输）
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      source: this.source,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    const errorMessages: Record<ErrorCode, string> = {
      // 网络错误
      [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查网络设置',
      [ErrorCode.NETWORK_TIMEOUT]: '请求超时，请稍后重试',
      [ErrorCode.NETWORK_OFFLINE]: '当前处于离线状态，请检查网络连接',

      // 认证错误
      [ErrorCode.AUTH_INVALID_CREDENTIALS]: '用户名或密码错误',
      [ErrorCode.AUTH_TOKEN_EXPIRED]: '登录已过期，请重新登录',
      [ErrorCode.AUTH_PERMISSION_DENIED]: '您没有权限执行此操作',
      [ErrorCode.AUTH_SESSION_INVALID]: '会话无效，请重新登录',

      // 数据错误
      [ErrorCode.DATA_NOT_FOUND]: '未找到请求的数据',
      [ErrorCode.DATA_VALIDATION_FAILED]: '数据验证失败，请检查输入',
      [ErrorCode.DATA_CONFLICT]: '数据冲突，请刷新后重试',
      [ErrorCode.DATA_PARSE_ERROR]: '数据解析失败',

      // API错误
      [ErrorCode.API_INVALID_REQUEST]: '请求参数错误',
      [ErrorCode.API_RATE_LIMIT]: '请求过于频繁，请稍后再试',
      [ErrorCode.API_SERVER_ERROR]: '服务器错误，请稍后重试',
      [ErrorCode.API_BAD_RESPONSE]: '服务器响应异常',

      // 业务逻辑错误
      [ErrorCode.ANNOTATION_SYNC_FAILED]: '标注同步失败',
      [ErrorCode.SESSION_JOIN_FAILED]: '加入阅读会话失败',
      [ErrorCode.PAPER_REGISTRATION_FAILED]: '论文注册失败',
      [ErrorCode.PDF_LOAD_FAILED]: 'PDF加载失败',
      [ErrorCode.DOI_INVALID]: 'DOI格式无效',

      // 系统错误
      [ErrorCode.UNKNOWN_ERROR]: '发生未知错误',
    };

    return errorMessages[this.code] || this.message;
  }

  /**
   * 判断是否为可重试错误
   */
  isRetryable(): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.API_RATE_LIMIT,
      ErrorCode.API_SERVER_ERROR,
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * 判断是否为需要重新认证的错误
   */
  requiresReauth(): boolean {
    const reauthCodes = [
      ErrorCode.AUTH_TOKEN_EXPIRED,
      ErrorCode.AUTH_SESSION_INVALID,
    ];
    return reauthCodes.includes(this.code);
  }
}

/**
 * 错误处理工具函数
 */
export class ErrorHandler {
  /**
   * 将任意错误转换为ResearchopiaError
   */
  static normalize(
    error: unknown,
    source: ErrorSource,
    defaultCode = ErrorCode.UNKNOWN_ERROR
  ): ResearchopiaError {
    if (error instanceof ResearchopiaError) {
      return error;
    }

    if (error instanceof Error) {
      return new ResearchopiaError(
        defaultCode,
        error.message,
        source,
        undefined,
        error
      );
    }

    return new ResearchopiaError(
      defaultCode,
      String(error),
      source
    );
  }

  /**
   * 记录错误（可扩展到远程日志服务）
   */
  static log(error: ResearchopiaError): void {
    console.error('[Researchopia Error]', {
      code: error.code,
      message: error.message,
      source: error.source,
      context: error.context,
      timestamp: new Date(error.timestamp).toISOString(),
    });

    if (error.originalError) {
      console.error('[Original Error]', error.originalError);
    }
  }

  /**
   * 处理错误（记录 + 可选的用户提示）
   */
  static handle(
    error: unknown,
    source: ErrorSource,
    options?: {
      showToUser?: boolean;
      onUserMessage?: (message: string) => void;
    }
  ): ResearchopiaError {
    const normalizedError = this.normalize(error, source);
    this.log(normalizedError);

    if (options?.showToUser && options?.onUserMessage) {
      options.onUserMessage(normalizedError.getUserMessage());
    }

    return normalizedError;
  }
}

/**
 * 创建特定类型错误的便捷函数
 */
export const createError = {
  network: (message: string, source: ErrorSource, context?: ErrorContext) =>
    new ResearchopiaError(ErrorCode.NETWORK_ERROR, message, source, context),

  auth: (message: string, source: ErrorSource, context?: ErrorContext) =>
    new ResearchopiaError(ErrorCode.AUTH_INVALID_CREDENTIALS, message, source, context),

  notFound: (message: string, source: ErrorSource, context?: ErrorContext) =>
    new ResearchopiaError(ErrorCode.DATA_NOT_FOUND, message, source, context),

  validation: (message: string, source: ErrorSource, context?: ErrorContext) =>
    new ResearchopiaError(ErrorCode.DATA_VALIDATION_FAILED, message, source, context),

  api: (message: string, source: ErrorSource, context?: ErrorContext) =>
    new ResearchopiaError(ErrorCode.API_SERVER_ERROR, message, source, context),
};

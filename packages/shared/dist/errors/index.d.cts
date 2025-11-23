/**
 * 统一错误处理系统
 * 用于三端（网站、Zotero插件、浏览器扩展）的错误管理
 */
declare enum ErrorCode {
    NETWORK_ERROR = 1000,
    NETWORK_TIMEOUT = 1001,
    NETWORK_OFFLINE = 1002,
    AUTH_INVALID_CREDENTIALS = 2000,
    AUTH_TOKEN_EXPIRED = 2001,
    AUTH_PERMISSION_DENIED = 2002,
    AUTH_SESSION_INVALID = 2003,
    DATA_NOT_FOUND = 3000,
    DATA_VALIDATION_FAILED = 3001,
    DATA_CONFLICT = 3002,
    DATA_PARSE_ERROR = 3003,
    API_INVALID_REQUEST = 4000,
    API_RATE_LIMIT = 4001,
    API_SERVER_ERROR = 4002,
    API_BAD_RESPONSE = 4003,
    ANNOTATION_SYNC_FAILED = 5000,
    SESSION_JOIN_FAILED = 5001,
    PAPER_REGISTRATION_FAILED = 5002,
    PDF_LOAD_FAILED = 5003,
    DOI_INVALID = 5004,
    UNKNOWN_ERROR = 9000
}
type ErrorSource = 'website' | 'zotero-plugin' | 'browser-extension';
interface ErrorContext {
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
declare class ResearchopiaError extends Error {
    readonly code: ErrorCode;
    readonly context?: ErrorContext;
    readonly timestamp: number;
    readonly source: ErrorSource;
    readonly originalError?: Error;
    constructor(code: ErrorCode, message: string, source: ErrorSource, context?: ErrorContext, originalError?: Error);
    /**
     * 转换为JSON格式（用于日志记录和网络传输）
     */
    toJSON(): {
        name: string;
        code: ErrorCode;
        message: string;
        source: ErrorSource;
        context: ErrorContext | undefined;
        timestamp: number;
        stack: string | undefined;
    };
    /**
     * 获取用户友好的错误消息
     */
    getUserMessage(): string;
    /**
     * 判断是否为可重试错误
     */
    isRetryable(): boolean;
    /**
     * 判断是否为需要重新认证的错误
     */
    requiresReauth(): boolean;
}
/**
 * 错误处理工具函数
 */
declare class ErrorHandler {
    /**
     * 将任意错误转换为ResearchopiaError
     */
    static normalize(error: unknown, source: ErrorSource, defaultCode?: ErrorCode): ResearchopiaError;
    /**
     * 记录错误（可扩展到远程日志服务）
     */
    static log(error: ResearchopiaError): void;
    /**
     * 处理错误（记录 + 可选的用户提示）
     */
    static handle(error: unknown, source: ErrorSource, options?: {
        showToUser?: boolean;
        onUserMessage?: (message: string) => void;
    }): ResearchopiaError;
}
/**
 * 创建特定类型错误的便捷函数
 */
declare const createError: {
    network: (message: string, source: ErrorSource, context?: ErrorContext) => ResearchopiaError;
    auth: (message: string, source: ErrorSource, context?: ErrorContext) => ResearchopiaError;
    notFound: (message: string, source: ErrorSource, context?: ErrorContext) => ResearchopiaError;
    validation: (message: string, source: ErrorSource, context?: ErrorContext) => ResearchopiaError;
    api: (message: string, source: ErrorSource, context?: ErrorContext) => ResearchopiaError;
};

export { ErrorCode, type ErrorContext, ErrorHandler, type ErrorSource, ResearchopiaError, createError };

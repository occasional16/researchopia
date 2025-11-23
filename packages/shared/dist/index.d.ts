export { extractDOI, extractDOIFromURL, getDOIUrl, normalizeDOI, validateDOI } from './utils/index.js';
export { validateEmail, validatePassword, validateUsername } from './auth/index.js';
export { FetchOptions, buildUrlWithParams, fetchWithTimeout, parseApiError } from './api-client/index.js';
export { ErrorCode, ErrorContext, ErrorHandler, ErrorSource, ResearchopiaError, createError } from './errors/index.js';
export { Annotation, AnnotationPosition, AnnotationSyncMessage, AnnotationWithUser, AuthMessage, Comment, CrossPlatformMessage, Paper, PaperWithStats, Rating, ReadingSession, SessionMember, SessionWithDetails, User, UserProfile } from './types/index.js';

/**
 * 常量配置
 */
declare const API_BASE_URL: string;
declare const TIMEOUT_CONFIG: {
    readonly DEFAULT: 30000;
    readonly LONG: 60000;
    readonly SHORT: 10000;
};
declare const STORAGE_KEYS: {
    readonly AUTH_TOKEN: "auth_token";
    readonly USER_PREFERENCES: "user_preferences";
    readonly THEME: "theme";
};
declare const ERROR_MESSAGES: {
    readonly NETWORK_ERROR: "网络连接失败，请检查您的网络设置";
    readonly TIMEOUT_ERROR: "请求超时，请稍后重试";
    readonly AUTH_ERROR: "认证失败，请重新登录";
    readonly NOT_FOUND: "请求的资源不存在";
    readonly SERVER_ERROR: "服务器错误，请稍后重试";
};

export { API_BASE_URL, ERROR_MESSAGES, STORAGE_KEYS, TIMEOUT_CONFIG };

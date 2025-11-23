/**
 * 常量配置
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const TIMEOUT_CONFIG = {
  DEFAULT: 30000,
  LONG: 60000,
  SHORT: 10000,
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查您的网络设置',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  AUTH_ERROR: '认证失败，请重新登录',
  NOT_FOUND: '请求的资源不存在',
  SERVER_ERROR: '服务器错误，请稍后重试',
} as const;

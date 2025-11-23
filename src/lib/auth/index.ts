/**
 * Auth Module - 统一认证模块导出
 */

export * from './types';
export * from './SessionManager';
export * from './TokenManager';
export * from './AuthCore';
export * from './EventDispatcher';

// 导出便捷的单例实例
export { authCore } from './AuthCore';

/**
 * 环境配置模块
 * 负责环境变量、配置项管理等功能
 */

import { logger as Logger } from "../utils/logger";

interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  apiBaseUrl: string;
  enablePerformanceMonitoring: boolean;
  enableDetailedLogging: boolean;
  maxCacheSize: number;
  maxErrorLogSize: number;
}

const defaultConfig: EnvironmentConfig = {
  isDevelopment: false,
  isProduction: true,
  logLevel: 'warn',
  // 默认使用生产环境,用户勾选"使用开发环境API"时才切换到localhost
  apiBaseUrl: 'https://www.researchopia.com',
  enablePerformanceMonitoring: false,
  enableDetailedLogging: false,
  maxCacheSize: 100,
  maxErrorLogSize: 1000
};

// 根据环境变量确定配置
const getEnvironmentConfig = (): EnvironmentConfig => {
  const env = (globalThis as any).__env__ || 'development';
  
  const config: EnvironmentConfig = { ...defaultConfig };
  
  if (env === 'production') {
    config.isDevelopment = false;
    config.isProduction = true;
    config.logLevel = 'warn';
    config.enableDetailedLogging = false;
    config.enablePerformanceMonitoring = false;
    config.apiBaseUrl = 'https://www.researchopia.com'; // 生产环境使用正式域名
  }
  
  // 开发环境可以通过环境变量覆盖API地址
  try {
    // 尝试从prefs读取自定义API地址
    if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
      const customApiUrl = Zotero.Prefs.get('extensions.researchopia.apiBaseUrl');
      if (customApiUrl) {
        config.apiBaseUrl = customApiUrl as string;
        Logger.log('[Researchopia] Using custom API URL:', customApiUrl);
      }
    }
  } catch (e) {
    // 忽略错误，使用默认配置
  }
  
  return config;
};

// 创建动态配置对象,通过getter实时读取apiBaseUrl
const createDynamicConfig = (): EnvironmentConfig => {
  const env = (globalThis as any).__env__ || 'development';
  
  return {
    get isDevelopment() { return env !== 'production'; },
    get isProduction() { return env === 'production'; },
    get logLevel() { return env === 'production' ? 'warn' : 'debug'; },
    get apiBaseUrl() {
      // 每次访问时动态读取,确保获取最新设置
      try {
        if (typeof Zotero !== 'undefined' && Zotero.Prefs) {
          const customApiUrl = Zotero.Prefs.get('extensions.researchopia.apiBaseUrl', true);
          // 只有当用户明确设置为开发环境时才使用localhost
          if (customApiUrl && typeof customApiUrl === 'string') {
            return customApiUrl;
          }
        }
      } catch (e) {
        // 忽略错误
      }
      // 默认始终使用生产环境
      return 'https://www.researchopia.com';
    },
    get enablePerformanceMonitoring() { return env !== 'production'; },
    get enableDetailedLogging() { return env !== 'production'; },
    get maxCacheSize() { return defaultConfig.maxCacheSize; },
    get maxErrorLogSize() { return defaultConfig.maxErrorLogSize; }
  };
};

export const envConfig = createDynamicConfig();

// 导出config别名,方便导入使用
export const config = envConfig;

export const logConfig = (): void => {
  Logger.info('[Researchopia] Environment Configuration');
  Logger.info('Environment:', envConfig.isDevelopment ? 'Development' : 'Production');
  Logger.info('Log Level:', envConfig.logLevel);
  Logger.info('Performance Monitoring:', envConfig.enablePerformanceMonitoring);
  Logger.info('Detailed Logging:', envConfig.enableDetailedLogging);
  Logger.info('API Base URL:', envConfig.apiBaseUrl);
};

export const getApiUrl = (endpoint: string): string => {
  return `${envConfig.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

export const shouldLog = (level: 'debug' | 'info' | 'warn' | 'error'): boolean => {
  const levels = ['debug', 'info', 'warn', 'error'];
  const configLevel = levels.indexOf(envConfig.logLevel);
  const requestedLevel = levels.indexOf(level);
  
  return requestedLevel >= configLevel;
};

// 导出默认配置供其他模块使用
export default envConfig;
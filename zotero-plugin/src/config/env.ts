/**
 * 环境配置模块
 * 负责环境变量、配置项管理等功能
 */

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
  isDevelopment: true,
  isProduction: false,
  logLevel: 'debug',
  apiBaseUrl: 'https://api.researchopia.com',
  enablePerformanceMonitoring: true,
  enableDetailedLogging: true,
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
  }
  
  return config;
};

export const envConfig = getEnvironmentConfig();

export const logConfig = (): void => {
  console.group('[Researchopia] Environment Configuration');
  console.log('Environment:', envConfig.isDevelopment ? 'Development' : 'Production');
  console.log('Log Level:', envConfig.logLevel);
  console.log('Performance Monitoring:', envConfig.enablePerformanceMonitoring);
  console.log('Detailed Logging:', envConfig.enableDetailedLogging);
  console.log('API Base URL:', envConfig.apiBaseUrl);
  console.groupEnd();
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

export const logger = {
  debug: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.debug('[Researchopia]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info('[Researchopia]', ...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn('[Researchopia]', ...args);
    }
  },
  
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error('[Researchopia]', ...args);
    }
  }
};

// 导出默认配置供其他模块使用
export default envConfig;